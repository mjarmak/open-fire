package com.jarmak.stockmarketanalyzer.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import java.sql.*;
import java.time.Clock;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.flywaydb.core.Flyway;

// Explicit opt-in and loopback-only: never uses the application's production DB or messaging clients.
@EnabledIfEnvironmentVariable(named = "OPENFIRE_PUSH_TEST_DB_URL", matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/.*")
class AppNotificationDatabaseTest {
  String schema;
  String url;
  DatabaseService database;
  DashboardService dashboard;
  WebPushTransport transport;
  AppNotificationService service;
  String key;
  String auth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);

  Connection connect() throws SQLException {
    var connection = DriverManager.getConnection(url, "openfire_test", "openfire_test");
    connection.setSchema(schema); return connection;
  }
  void sql(String sql) throws SQLException { try (var connection = connect(); var statement = connection.createStatement()) { statement.execute(sql); } }
  int count(String table) throws SQLException {
    try (var connection = connect(); var query = connection.createStatement(); var row = query.executeQuery("select count(*) from " + table)) { row.next(); return row.getInt(1); }
  }

  @BeforeEach void setup() throws Exception {
    url = System.getenv("OPENFIRE_PUSH_TEST_DB_URL"); schema = "openfire_push_test_" + UUID.randomUUID().toString().replace("-", "");
    try (var connection = DriverManager.getConnection(url, "openfire_test", "openfire_test"); var statement = connection.createStatement()) {
      statement.execute("create schema " + schema); connection.setSchema(schema);
      statement.execute("create table users(username varchar(128) primary key, enabled boolean default true, last_app_visit timestamptz default now(), telegram_dca_days text default 'MON,TUE,WED,THU,FRI,SAT,SUN', telegram_alert_days text default 'MON,TUE,WED,THU,FRI,SAT,SUN')");
      statement.execute("insert into users(username) values ('alice'), ('bob')");
    }
    Flyway.configure().dataSource(url, "openfire_test", "openfire_test").schemas(schema).defaultSchema(schema)
        .baselineOnMigrate(true).baselineVersion("13").target("14").load().migrate();
    sql("insert into app_notification_preferences(username, dca, briefing, return_reminder) values ('bob', false, false, false)");
    Flyway.configure().dataSource(url, "openfire_test", "openfire_test").schemas(schema).defaultSchema(schema)
        .load().migrate();
    database = mock(DatabaseService.class); when(database.connection()).thenAnswer(invocation -> connect());
    dashboard = mock(DashboardService.class); transport = mock(WebPushTransport.class);
    when(transport.enabled()).thenReturn(true);
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenReturn(201);
    when(dashboard.generateDcaReminderForUser(anyString())).thenReturn("<b>DCA focus:</b> Buy consistently &amp; follow the plan.");
    when(dashboard.generateBriefingForUser(anyString())).thenReturn("<b>Risk briefing:</b> AAPL needs review.");
    service = new AppNotificationService(database, dashboard, transport, new ObjectMapper(), Clock.systemUTC());
    new WebPushTransport("", "", "mailto:test@example.com");
    var generator = java.security.KeyPairGenerator.getInstance("ECDH", "BC");
    generator.initialize(new java.security.spec.ECGenParameterSpec("secp256r1"));
    var publicKey = (org.bouncycastle.jce.interfaces.ECPublicKey) generator.generateKeyPair().getPublic();
    key = Base64.getUrlEncoder().withoutPadding().encodeToString(publicKey.getQ().getEncoded(false));
  }

  @AfterEach void cleanup() throws SQLException {
    if (schema == null || !schema.matches("openfire_push_test_[a-f0-9]{32}")) return;
    try (var connection = DriverManager.getConnection(url, "openfire_test", "openfire_test"); var statement = connection.createStatement()) {
      statement.execute("drop schema " + schema + " cascade");
    }
  }

  void enable(String endpoint) throws SQLException {
    service.preferences("alice", new AppNotificationService.Preferences(true, true, true)); service.subscribe("alice", endpoint, key, auth);
  }

  @Test void defaultMigrationPreservesOptOutsAndDoesNotRegisterDevices() throws Exception {
    var enabled = new AppNotificationService.Preferences(true, true, true);
    assertThat(service.configuration("alice").preferences()).isEqualTo(enabled);
    sql("insert into app_notification_preferences(username) values ('alice')");
    assertThat(service.configuration("alice").preferences()).isEqualTo(enabled);
    assertThat(service.configuration("bob").preferences())
        .isEqualTo(new AppNotificationService.Preferences(false, false, false));
    assertThat(count("web_push_subscriptions")).isZero();
  }

  @Test void migrationQueueAndRestartDeduplicatePerDevice() throws Exception {
    enable("https://fcm.googleapis.com/fcm/send/phone"); enable("https://fcm.googleapis.com/fcm/send/desktop");
    service.generate("dca"); service.generate("dca");
    assertThat(count("app_notifications")).isEqualTo(1); assertThat(count("web_push_deliveries")).isEqualTo(2);
    service.deliver();
    var restarted = new AppNotificationService(database, dashboard, transport, new ObjectMapper(), Clock.systemUTC());
    restarted.generate("dca"); restarted.deliver();
    verify(transport, times(2)).send(anyString(), anyString(), anyString(), contains("Buy consistently & follow the plan."));
    verify(dashboard, times(1)).generateDcaReminderForUser("alice");
  }

  @Test void scheduleAndOptOutAreRecheckedAndNoOldBacklogIsSent() throws Exception {
    enable("https://fcm.googleapis.com/fcm/send/phone"); sql("update users set telegram_dca_days = ''");
    service.generate("dca"); assertThat(count("app_notifications")).isZero();
    sql("update users set telegram_dca_days = 'MON,TUE,WED,THU,FRI,SAT,SUN'"); service.generate("dca");
    service.preferences("alice", new AppNotificationService.Preferences(false, true, true)); service.deliver();
    verify(transport, never()).send(anyString(), anyString(), anyString(), anyString());
    service.preferences("alice", new AppNotificationService.Preferences(true, true, true)); service.generate("dca"); service.deliver();
    verify(transport, never()).send(anyString(), anyString(), anyString(), anyString());
  }

  @Test void browserOwnershipCannotBeHijackedAndInboxIsAccountScoped() throws Exception {
    String endpoint = "https://fcm.googleapis.com/fcm/send/phone"; enable(endpoint);
    assertThatThrownBy(() -> service.subscribe("bob", endpoint, key, auth)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    service.unsubscribe("bob", endpoint); assertThat(count("web_push_subscriptions")).isEqualTo(1);
    service.generate("briefing"); assertThat(service.inbox("bob", Long.MAX_VALUE)).isEmpty();
    assertThat(service.inbox("alice", Long.MAX_VALUE)).hasSize(1);
  }

  @Test void twoWorkersCannotClaimTheSameDelivery() throws Exception {
    enable("https://fcm.googleapis.com/fcm/send/phone"); service.generate("dca");
    CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenAnswer(invocation -> {
      entered.countDown(); if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out"); return 201;
    });
    ExecutorService workers = Executors.newFixedThreadPool(2);
    try {
      Future<Boolean> first = workers.submit(service::deliverOne);
      assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
      assertThat(workers.submit(service::deliverOne).get(5, TimeUnit.SECONDS)).isFalse();
      release.countDown(); assertThat(first.get(5, TimeUnit.SECONDS)).isTrue();
      verify(transport, times(1)).send(anyString(), anyString(), anyString(), anyString());
    } finally { release.countDown(); workers.shutdownNow(); }
  }

  @Test void absenceReminderIsOncePerVisitAndSuppressedOnReturn() throws Exception {
    enable("https://fcm.googleapis.com/fcm/send/phone"); service.generate("return"); assertThat(count("app_notifications")).isZero();
    sql("update users set last_app_visit = now() - interval '8 days' where username = 'alice'");
    service.generate("return"); service.generate("return"); assertThat(count("app_notifications")).isEqualTo(1);
    sql("update users set last_app_visit = now() where username = 'alice'"); service.deliver();
    verify(transport, never()).send(anyString(), anyString(), anyString(), anyString());
  }

  @Test void revokedEndpointIsPrunedAndTestIsRateLimited() throws Exception {
    String endpoint = "https://fcm.googleapis.com/fcm/send/phone"; enable(endpoint);
    service.test("alice", endpoint);
    assertThatThrownBy(() -> service.test("alice", endpoint)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenReturn(410); service.deliver();
    assertThat(count("web_push_subscriptions")).isZero(); assertThat(count("web_push_deliveries")).isZero();
  }

  @Test void sharedMessageSnapshotIsDurableAcrossChannels() {
    var snapshots = new NotificationMessageService(database, new ObjectMapper());
    var original = new NotificationMessageService.Snapshot("Exact briefing", List.of("AAPL"));
    assertThat(snapshots.daily("alice", "briefing", () -> original)).isEqualTo(original);
    assertThat(new NotificationMessageService(database, new ObjectMapper()).daily("alice", "briefing", () -> { throw new AssertionError("Must not reevaluate"); })).isEqualTo(original);
  }
}
