package com.jarmak.stockmarketanalyzer.notification;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class EmailReminderService {
  private static final Logger LOG = LoggerFactory.getLogger(EmailReminderService.class);
  private final DatabaseService database;
  private final DashboardService dashboard;
  private final EmailNotificationService email;

  public EmailReminderService(DatabaseService database, DashboardService dashboard, EmailNotificationService email) {
    this.database = database;
    this.dashboard = dashboard;
    this.email = email;
  }

  @Scheduled(cron = "0 */10 16 * * *", zone = "Europe/Brussels")
  public void sendDca() { dispatch("dca"); }

  @Scheduled(cron = "0 0 * * * *", zone = "Europe/Brussels")
  public void sendReturn() { dispatch("return"); }

  void dispatch(String kind) {
    if (!email.enabled()) { return; }
    String day = LocalDate.now(ZoneId.of("Europe/Brussels")).getDayOfWeek().name().substring(0, 3);
    String eligibility = kind.equals("dca")
        ? "email_dca_enabled = true and ? = any(string_to_array(telegram_dca_days, ','))"
        : "email_return_enabled = true and last_app_visit <= now() - interval '7 days'";
    try (Connection connection = database.connection();
        var statement = connection.prepareStatement("select username from users where enabled = true and email_verified = true and email_address <> '' and " + eligibility)) {
      if (kind.equals("dca")) { statement.setString(1, day); }
      try (var rows = statement.executeQuery()) {
        while (rows.next()) {
          try { deliver(rows.getString("username"), kind, day); }
          catch (Exception exception) { LOG.warn("Email reminder failed; will retry ({})", exception.getClass().getSimpleName()); }
        }
      }
    } catch (SQLException exception) { LOG.warn("Could not load email reminder recipients", exception); }
  }

  private void deliver(String username, String kind, String day) throws SQLException {
    // Account locks serialize workers and recheck activity/preferences before sending.
    try (Connection connection = database.connection()) {
      connection.setAutoCommit(false);
      try (var statement = connection.prepareStatement("select * from users where username = ? for update")) {
        statement.setString(1, username);
        try (var row = statement.executeQuery()) {
          if (!row.next() || !row.getBoolean("enabled") || !row.getBoolean("email_verified")
              || row.getString("email_address") == null || row.getString("email_address").isBlank()) { return; }
          var visit = row.getTimestamp("last_app_visit");
          if (kind.equals("dca")) {
            String days = row.getString("telegram_dca_days");
            if (!row.getBoolean("email_dca_enabled") || days == null
                || !java.util.Arrays.asList(days.split(",")).contains(day)) { return; }
          } else if (!row.getBoolean("email_return_enabled") || visit == null
              || visit.toInstant().isAfter(java.time.Instant.now().minus(java.time.Duration.ofDays(7)))) { return; }
          String key = "open-fire:" + kind + ":" + username + ":" + (kind.equals("dca")
              ? LocalDate.now(ZoneId.of("Europe/Brussels")) : visit.toInstant());
          try (var insert = connection.prepareStatement("insert into email_deliveries(event_key) values (?) on conflict do nothing")) {
            insert.setString(1, key);
            if (insert.executeUpdate() == 0) { return; }
          }
          String content = kind.equals("dca") ? dashboard.generateDcaReminderForUser(username)
              : "It has been a week since your last visit. Review your positions, update your profile and retirement settings, and check your DCA plan.";
          email.send(key, username, row.getString("email_address"), kind, content);
          connection.commit();
        }
      } finally { connection.rollback(); }
    }
  }
}
