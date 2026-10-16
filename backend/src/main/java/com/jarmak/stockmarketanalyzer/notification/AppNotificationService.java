package com.jarmak.stockmarketanalyzer.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppNotificationService {
  private static final Logger LOG = LoggerFactory.getLogger(AppNotificationService.class);
  private static final ZoneId ZONE = ZoneId.of("Europe/Brussels");
  private final DatabaseService database;
  private final DashboardService dashboard;
  private final WebPushTransport transport;
  private final ObjectMapper json;
  private final Clock clock;

  @Autowired
  public AppNotificationService(DatabaseService database, DashboardService dashboard, WebPushTransport transport, ObjectMapper json) {
    this(database, dashboard, transport, json, Clock.systemUTC());
  }

  AppNotificationService(DatabaseService database, DashboardService dashboard, WebPushTransport transport, ObjectMapper json, Clock clock) {
    this.database = database; this.dashboard = dashboard; this.transport = transport; this.json = json; this.clock = clock;
  }

  public record Preferences(boolean dca, boolean briefing, boolean returnReminder) {}
  public record Message(long id, String kind, String title, String body, Instant createdAt) {}
  public record Configuration(boolean configured, String publicKey, Preferences preferences) {}

  public Configuration configuration(String username) throws SQLException {
    try (var connection = database.connection(); var query = connection.prepareStatement(
        "select dca, briefing, return_reminder from app_notification_preferences where username = ?")) {
      query.setString(1, username);
      try (var row = query.executeQuery()) {
        Preferences preferences = row.next() ? new Preferences(row.getBoolean(1), row.getBoolean(2), row.getBoolean(3))
            : new Preferences(false, false, false);
        return new Configuration(transport.enabled(), transport.publicKey(), preferences);
      }
    }
  }

  public void preferences(String username, Preferences preferences) throws SQLException {
    try (var connection = database.connection(); var query = connection.prepareStatement("""
        insert into app_notification_preferences(username, dca, briefing, return_reminder) values (?, ?, ?, ?)
        on conflict (username) do update set dca = excluded.dca, briefing = excluded.briefing, return_reminder = excluded.return_reminder
        """)) {
      query.setString(1, username); query.setBoolean(2, preferences.dca());
      query.setBoolean(3, preferences.briefing()); query.setBoolean(4, preferences.returnReminder()); query.executeUpdate();
    }
  }

  public void subscribe(String username, String endpoint, String key, String auth) throws SQLException {
    if (!transport.enabled()) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "App notifications are not configured yet."); }
    WebPushTransport.validateEndpoint(endpoint); WebPushTransport.validateKeys(key, auth);
    try (var connection = database.connection()) {
      connection.setAutoCommit(false);
      try {
        try (var lock = connection.prepareStatement("select username from users where username = ? for update")) {
          lock.setString(1, username);
          try (var user = lock.executeQuery()) { if (!user.next()) { throw new ResponseStatusException(HttpStatus.NOT_FOUND); } }
        }
        try (var limit = connection.prepareStatement("select count(*) from web_push_subscriptions where username = ? and id <> ?")) {
          limit.setString(1, username); limit.setString(2, endpointId(endpoint));
          try (var rows = limit.executeQuery()) {
            if (rows.next() && rows.getInt(1) >= 10) { throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many notification devices for this account."); }
          }
        }
        try (var query = connection.prepareStatement("""
            insert into web_push_subscriptions(id, username, endpoint, public_key, auth_secret) values (?, ?, ?, ?, ?)
            on conflict (id) do update set public_key = excluded.public_key, auth_secret = excluded.auth_secret, updated_at = now()
            where web_push_subscriptions.username = excluded.username
            """)) {
          query.setString(1, endpointId(endpoint)); query.setString(2, username); query.setString(3, endpoint);
          query.setString(4, key); query.setString(5, auth);
          if (query.executeUpdate() == 0) { throw new ResponseStatusException(HttpStatus.CONFLICT, "This browser subscription belongs to another account. Disable notifications on this device first."); }
          try (var preferences = connection.prepareStatement("insert into app_notification_preferences(username) values (?) on conflict do nothing")) {
            preferences.setString(1, username); preferences.executeUpdate();
          }
        }
        connection.commit();
      } finally { connection.rollback(); }
    }
  }

  public void unsubscribe(String username, String endpoint) throws SQLException {
    try (var connection = database.connection(); var query = connection.prepareStatement(
        "delete from web_push_subscriptions where id = ? and username = ?")) {
      query.setString(1, endpointId(endpoint)); query.setString(2, username); query.executeUpdate();
    }
  }

  public List<Message> inbox(String username, long before) throws SQLException {
    List<Message> messages = new ArrayList<>();
    try (var connection = database.connection(); var query = connection.prepareStatement("""
        select id, kind, title, body, created_at from app_notifications
        where username = ? and id < ? order by id desc limit 25
        """)) {
      query.setString(1, username); query.setLong(2, before);
      try (var row = query.executeQuery()) {
        while (row.next()) { messages.add(new Message(row.getLong(1), row.getString(2), row.getString(3), row.getString(4), row.getTimestamp(5).toInstant())); }
      }
    }
    return messages;
  }

  @Scheduled(cron = "0 */10 16 * * *", zone = "Europe/Brussels")
  public void dca() { generate("dca"); }
  @Scheduled(cron = "0 */10 23 * * *", zone = "Europe/Brussels")
  public void briefing() { generate("briefing"); }
  @Scheduled(cron = "0 0 * * * *", zone = "Europe/Brussels")
  public void returnReminder() { generate("return"); }

  void generate(String kind) {
    String column = preferenceColumn(kind);
    try (var connection = database.connection(); var query = connection.prepareStatement(
        "select username from app_notification_preferences where " + column + " = true")) {
      try (var rows = query.executeQuery()) {
        while (rows.next()) {
          try { queue(rows.getString(1), kind); }
          catch (Exception failure) { LOG.warn("Could not queue app notification ({}); next schedule will retry", kind); }
        }
      }
    } catch (SQLException failure) { LOG.warn("Could not load app notification recipients"); }
  }

  private void queue(String username, String kind) throws SQLException {
    String day = LocalDate.now(clock.withZone(ZONE)).getDayOfWeek().name().substring(0, 3);
    try (var connection = database.connection()) {
      connection.setAutoCommit(false);
      try (var query = connection.prepareStatement("""
          select u.last_app_visit, u.telegram_dca_days, u.telegram_alert_days from users u
          join app_notification_preferences p on p.username = u.username
          where u.username = ? and u.enabled = true and p.%s = true for update of p skip locked
          """.formatted(preferenceColumn(kind)))) {
        query.setString(1, username);
        try (var row = query.executeQuery()) {
          if (!row.next()) { return; }
          var visit = row.getTimestamp(1);
          if (kind.equals("return")) {
            if (visit == null || visit.toInstant().isAfter(clock.instant().minus(Duration.ofDays(7)))) { return; }
          } else {
            String days = row.getString(kind.equals("dca") ? 2 : 3);
            if (days == null || !List.of(days.split(",")).contains(day)) { return; }
          }
          String eventKey = "open-fire:push:" + kind + ":" + username + ":"
              + (kind.equals("return") ? visit.toInstant() : LocalDate.now(clock.withZone(ZONE)));
          // Serialize per-account event creation, including the full inbox message and device jobs.
          try (var exists = connection.prepareStatement("select id from app_notifications where event_key = ?")) {
            exists.setString(1, eventKey);
            try (var result = exists.executeQuery()) { if (result.next()) { return; } }
          }
          String body = switch (kind) {
            case "dca" -> dashboard.generateDcaReminderForUser(username);
            case "briefing" -> dashboard.generateBriefingForUser(username);
            default -> NotificationContent.RETURN_REMINDER;
          };
          long id = insertMessage(connection, username, eventKey, kind, title(kind), NotificationContent.plainText(body));
          queueDevices(connection, username, id, null);
          connection.commit();
        }
      } finally { connection.rollback(); }
    }
  }

  public void test(String username, String endpoint) throws SQLException {
    if (!transport.enabled()) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "App notifications are not configured yet."); }
    try (var connection = database.connection()) {
      connection.setAutoCommit(false);
      try (var query = connection.prepareStatement("select id from web_push_subscriptions where id = ? and username = ? for update")) {
        query.setString(1, endpointId(endpoint)); query.setString(2, username);
        try (var row = query.executeQuery()) {
          if (!row.next()) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Enable notifications on this device first."); }
          String eventKey = "open-fire:push:test:" + username + ":" + clock.instant().getEpochSecond() / 900;
          long id = insertMessage(connection, username, eventKey, "test", "OpenFIRE notifications", "Notifications are enabled on this device.");
          if (id == 0) { throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "A test was already queued. Try again in 15 minutes."); }
          queueDevices(connection, username, id, endpointId(endpoint)); connection.commit();
        }
      } finally { connection.rollback(); }
    }
  }

  private long insertMessage(Connection connection, String username, String key, String kind, String title, String body) throws SQLException {
    try (var query = connection.prepareStatement("""
        insert into app_notifications(username, event_key, kind, title, body) values (?, ?, ?, ?, ?)
        on conflict (event_key) do nothing returning id
        """)) {
      query.setString(1, username); query.setString(2, key); query.setString(3, kind); query.setString(4, title); query.setString(5, body);
      try (var row = query.executeQuery()) { return row.next() ? row.getLong(1) : 0; }
    }
  }

  private void queueDevices(Connection connection, String username, long id, String device) throws SQLException {
    try (var query = connection.prepareStatement("""
        insert into web_push_deliveries(notification_id, subscription_id)
        select ?, id from web_push_subscriptions where username = ? and (?::text is null or id = ?)
        on conflict do nothing
        """)) {
      query.setLong(1, id); query.setString(2, username); query.setString(3, device); query.setString(4, device); query.executeUpdate();
    }
  }

  @Scheduled(fixedDelay = 60000)
  public void deliver() {
    if (!transport.enabled()) { return; }
    for (int count = 0; count < 50; count++) {
      try { if (!deliverOne()) { return; } }
      catch (Exception failure) { LOG.warn("App notification worker failed ({}); queued messages remain pending", failure.getClass().getSimpleName()); return; }
    }
  }

  boolean deliverOne() throws Exception {
    try (var connection = database.connection()) {
      connection.setAutoCommit(false);
      try (var query = connection.prepareStatement("""
          select d.notification_id, d.subscription_id, d.attempts, n.kind, n.title, n.body, n.created_at,
                 s.endpoint, s.public_key, s.auth_secret, u.enabled, u.last_app_visit, p.dca, p.briefing, p.return_reminder
          from web_push_deliveries d join app_notifications n on n.id = d.notification_id
          join web_push_subscriptions s on s.id = d.subscription_id and s.username = n.username
          join users u on u.username = n.username
          join app_notification_preferences p on p.username = n.username
          where d.finished = false and d.next_attempt_at <= now()
          order by d.next_attempt_at limit 1 for update of d, s, u, p skip locked
          """)) {
        try (var row = query.executeQuery()) {
          if (!row.next()) { return false; }
          long id = row.getLong(1); String device = row.getString(2); int attempts = row.getInt(3) + 1;
          String kind = row.getString(4);
          boolean optedIn = kind.equals("test") || row.getBoolean(preferenceColumn(kind));
          var visit = row.getTimestamp(12);
          boolean staleReturn = kind.equals("return") && visit != null && visit.toInstant().isAfter(row.getTimestamp(7).toInstant());
          int status = 0;
          if (row.getBoolean(11) && optedIn && !staleReturn
              && row.getTimestamp(7).toInstant().isAfter(clock.instant().minus(Duration.ofDays(1)))) {
            try { status = transport.send(row.getString(8), row.getString(9), row.getString(10), payload(id, row.getString(5), row.getString(6))); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw interrupted; }
            catch (Exception failure) { status = 503; LOG.warn("App push attempt failed ({})", failure.getClass().getSimpleName()); }
          }
          if (status == 404 || status == 410) {
            try (var delete = connection.prepareStatement("delete from web_push_subscriptions where id = ?")) {
              delete.setString(1, device); delete.executeUpdate();
            }
          } else {
            boolean accepted = status >= 200 && status < 300;
            boolean retry = status == 408 || status == 429 || status >= 500;
            try (var update = connection.prepareStatement("""
                update web_push_deliveries set attempts = ?, finished = ?, accepted_at = case when ? then now() else null end,
                next_attempt_at = now() + (? * interval '1 minute') where notification_id = ? and subscription_id = ?
                """)) {
              update.setInt(1, attempts); update.setBoolean(2, accepted || !retry || attempts >= 5); update.setBoolean(3, accepted);
              update.setInt(4, 1 << attempts); update.setLong(5, id); update.setString(6, device); update.executeUpdate();
            }
            if (!accepted && retry && attempts >= 5) { LOG.warn("App push exhausted its five delivery attempts"); }
            if (!accepted && !retry && status != 0) { LOG.warn("App push provider rejected a delivery with status {}", status); }
          }
          connection.commit(); return true;
        }
      } finally { connection.rollback(); }
    }
  }

  String payload(long id, String title, String body) throws Exception {
    // Push services have small payload limits; the inbox retains the complete message.
    String preview = body.codePointCount(0, body.length()) > 500 ? body.substring(0, body.offsetByCodePoints(0, 500)) + "..." : body;
    return json.writeValueAsString(Map.of("notification", Map.of("title", title, "body", preview,
        "icon", "/openfire-logo-dark-v2-192.png", "tag", "open-fire-" + id,
        "data", Map.of("notificationId", id, "onActionClick", Map.of("default", Map.of(
            "operation", "navigateLastFocusedOrOpen", "url", "/?notifications=1"))))));
  }

  @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Brussels")
  public void cleanup() throws SQLException {
    try (var connection = database.connection(); var query = connection.createStatement()) {
      query.executeUpdate("delete from app_notifications where created_at < now() - interval '90 days'");
      query.executeUpdate("delete from web_push_subscriptions where updated_at < now() - interval '90 days'");
      query.executeUpdate("delete from notification_message_snapshots where created_at < now() - interval '90 days'");
    }
  }

  static String endpointId(String endpoint) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(endpoint.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception failure) { throw new IllegalArgumentException("Invalid endpoint."); }
  }
  private static String preferenceColumn(String kind) {
    return switch (kind) { case "dca" -> "dca"; case "briefing" -> "briefing"; case "return" -> "return_reminder";
      default -> throw new IllegalArgumentException("Unknown notification category."); };
  }
  private static String title(String kind) {
    return switch (kind) { case "dca" -> "Your OpenFIRE DCA reminder"; case "briefing" -> "OpenFIRE risk and alert briefing";
      default -> "Time to check your OpenFIRE plan"; };
  }
}
