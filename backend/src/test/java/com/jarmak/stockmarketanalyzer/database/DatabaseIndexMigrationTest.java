package com.jarmak.stockmarketanalyzer.database;

import static org.assertj.core.api.Assertions.assertThat;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

// Only disposable loopback databases and uniquely named schemas; never production credentials.
@EnabledIfEnvironmentVariable(named = "OPENFIRE_INDEX_TEST_DB_URL", matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/.*")
@Timeout(90)
class DatabaseIndexMigrationTest {
  static final List<String> INDEXES = List.of(
      "portfolio_holdings_user_order_idx", "portfolio_holdings_alert_cooldown_idx",
      "users_telegram_recipients_idx", "users_telegram_dca_recipients_idx",
      "users_email_dca_days_idx", "users_email_return_due_idx",
      "app_notification_preferences_dca_idx", "app_notification_preferences_briefing_idx",
      "app_notification_preferences_return_idx", "app_notifications_created_at_idx",
      "web_push_subscriptions_updated_at_idx", "notification_message_snapshots_created_at_idx",
      "notification_message_snapshots_username_idx", "web_push_deliveries_subscription_idx",
      "feedback_messages_owner_idx");
  String url;
  String schema;

  Connection connect() throws Exception {
    var connection = DriverManager.getConnection(url, "openfire_test", "openfire_test");
    connection.setSchema(schema);
    return connection;
  }

  FluentConfiguration migration() {
    var properties = new AppProperties(new AppProperties.Security("fixture-owner", "salt", "unused-test-hash"), null,
        new AppProperties.Database(url, "openfire_test", "openfire_test"), null, null);
    return new DatabaseMigrationService(properties, null).configuration().schemas(schema).defaultSchema(schema);
  }

  @BeforeEach void setup() throws Exception {
    url = System.getenv("OPENFIRE_INDEX_TEST_DB_URL");
    schema = "openfire_index_test_" + UUID.randomUUID().toString().replace("-", "");
    try (var connection = DriverManager.getConnection(url, "openfire_test", "openfire_test"); var statement = connection.createStatement()) {
      statement.execute("create schema " + schema);
    }
    migration().target("15").load().migrate();
    sql("insert into portfolio_holdings(username, symbol, company_name, quantity, average_cost) values ('fixture-owner', 'FIXTURE', 'Fixture', 1, 1)");
    sql("insert into app_notification_preferences(username, dca, briefing, return_reminder) values ('fixture-owner', false, true, false)");
  }

  @AfterEach void cleanup() throws Exception {
    if (schema == null || !schema.matches("openfire_index_test_[a-f0-9]{32}")) return;
    try (var connection = DriverManager.getConnection(url, "openfire_test", "openfire_test"); var statement = connection.createStatement()) {
      statement.execute("drop schema " + schema + " cascade");
    }
  }

  void sql(String sql) throws Exception {
    try (var connection = connect(); var statement = connection.createStatement()) { statement.execute(sql); }
  }

  List<String> strings(String sql) throws Exception {
    var values = new ArrayList<String>();
    try (var connection = connect(); var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
      while (rows.next()) values.add(rows.getString(1));
    }
    return values;
  }

  @Test void upgradesExistingSchemaAndPreservesDataAndPreferences() throws Exception {
    assertThat(migration().load().migrate().migrationsExecuted).isEqualTo(1);
    var validIndexes = strings("""
        select c.relname from pg_index i join pg_class c on c.oid = i.indexrelid
        where c.relnamespace = current_schema()::regnamespace and i.indisvalid and i.indisready
        """);
    assertThat(validIndexes).containsAll(INDEXES);
    assertThat(strings("select symbol from portfolio_holdings")).containsExactly("FIXTURE");
    assertThat(strings("select dca::text || ',' || briefing::text || ',' || return_reminder::text from app_notification_preferences"))
        .containsExactly("false,true,false");
    assertThat(migration().load().migrate().migrationsExecuted).isZero();
  }

  @Test void everyForeignKeyHasAValidNonPartialLeadingColumnIndex() throws Exception {
    migration().load().migrate();
    assertThat(strings("""
        select c.conname from pg_constraint c
        where c.connamespace = current_schema()::regnamespace and c.contype = 'f'
          and not exists (
            select 1 from pg_index i where i.indrelid = c.conrelid
              and i.indisvalid and i.indisready and i.indpred is null
              and i.indkey[0] = c.conkey[1])
        """)).isEmpty();
  }

  @Test void filteredQueriesUseTheExpectedIndexes() throws Exception {
    seedPlannerFixtures();
    migration().load().migrate();
    for (String table : List.of("users", "portfolio_holdings", "app_notification_preferences", "feedback_messages",
        "app_notifications", "web_push_subscriptions", "web_push_deliveries", "notification_message_snapshots")) {
      sql("analyze " + table);
    }
    plan("select id from portfolio_holdings where username = 'test-1' order by watch_only, symbol, id",
        "portfolio_holdings_user_order_idx");
    plan("select symbol from portfolio_holdings where username = 'test-1' and last_alert_sent_at >= now() - interval '1 day'",
        "portfolio_holdings_alert_cooldown_idx");
    plan("select username from users where telegram_chat_id is not null and telegram_chat_id <> ''", "users_telegram_recipients_idx");
    plan("select username from users where telegram_chat_id is not null and telegram_chat_id <> '' and coalesce(telegram_dca_enabled, false) = true",
        "users_telegram_dca_recipients_idx");
    plan("select username from users where enabled = true and email_verified = true and email_address <> '' and email_dca_enabled = true "
        + "and string_to_array(telegram_dca_days, ',') @> array['MON']::text[]", "users_email_dca_days_idx");
    plan("select username from users where enabled = true and email_verified = true and email_address <> '' and email_return_enabled = true "
        + "and last_app_visit <= now() - interval '7 days'", "users_email_return_due_idx");
    for (String category : List.of("dca", "briefing", "return_reminder")) {
      plan("select username from app_notification_preferences where " + category + " = true",
          "app_notification_preferences_" + (category.equals("return_reminder") ? "return" : category) + "_idx");
    }
    plan("select id from app_notifications where created_at < now() - interval '90 days'", "app_notifications_created_at_idx");
    plan("select id from web_push_subscriptions where updated_at < now() - interval '90 days'", "web_push_subscriptions_updated_at_idx");
    plan("select event_key from notification_message_snapshots where created_at < now() - interval '90 days'", "notification_message_snapshots_created_at_idx");
    plan("select event_key from notification_message_snapshots where username = 'test-1'", "notification_message_snapshots_username_idx");
    plan("select notification_id from web_push_deliveries where subscription_id = 'sub-1'", "web_push_deliveries_subscription_idx");
    plan("select id from feedback_messages where username = 'test-1'", "feedback_messages_owner_idx");
    plan("select notification_id from web_push_deliveries where finished = false and next_attempt_at <= now() order by next_attempt_at limit 1",
        "web_push_deliveries_due_idx");
  }

  void plan(String sql, String index) throws Exception {
    assertThat(strings("explain (format json) " + sql).get(0)).as(sql).contains("\"Index Name\": \"" + index + "\"");
  }

  @Test void dcaDayContainmentKeepsRecipientSelectionUnchanged() throws Exception {
    sql("""
        insert into users(username, password_hash, email_address, email_verified, email_dca_enabled, telegram_dca_days)
        values ('monday', '', 'fixture@example.com', true, true, 'MON,WED'),
               ('friday', '', 'fixture@example.com', true, true, 'FRI'),
               ('empty', '', 'fixture@example.com', true, true, ''),
               ('unverified', '', 'fixture@example.com', false, true, 'MON')
        """);
    migration().load().migrate();
    String filter = " from users where enabled = true and email_verified = true and email_address <> '' and email_dca_enabled = true and ";
    for (String day : List.of("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")) {
      var previous = strings("select username" + filter + "'" + day + "' = any(string_to_array(telegram_dca_days, ',')) order by username");
      var indexed = strings("select username" + filter + "string_to_array(telegram_dca_days, ',') @> array['" + day + "']::text[] order by username");
      assertThat(indexed).as(day).isEqualTo(previous);
    }
  }

  @Test void concurrentBuildAllowsNormalWrites() throws Exception {
    var worker = Executors.newSingleThreadExecutor();
    try (var writer = connect(); var statement = writer.createStatement()) {
      writer.setAutoCommit(false);
      statement.executeUpdate("update portfolio_holdings set quantity = 2 where symbol = 'FIXTURE'");
      var build = worker.submit(() -> migration().load().migrate());
      try {
        boolean building = false;
        for (int attempt = 0; attempt < 200; attempt++) {
          if (!strings("select phase from pg_stat_progress_create_index where relid = 'portfolio_holdings'::regclass").isEmpty()) {
            building = true; break;
          }
          Thread.sleep(25);
        }
        assertThat(building).as("concurrent index build reached the held writer").isTrue();
        try (var other = connect(); var insert = other.createStatement()) {
          insert.execute("set statement_timeout = '2s'");
          insert.executeUpdate("insert into portfolio_holdings(username, symbol, company_name, quantity, average_cost) values ('fixture-owner', 'DURING-BUILD', 'Fixture', 1, 1)");
        }
      } finally { writer.rollback(); }
      assertThat(build.get(30, TimeUnit.SECONDS).migrationsExecuted).isEqualTo(1);
    } finally { worker.shutdownNow(); }
    assertThat(strings("select symbol from portfolio_holdings where symbol = 'DURING-BUILD'")).containsExactly("DURING-BUILD");
  }

  void seedPlannerFixtures() throws Exception {
    sql("""
        insert into users(username, password_hash, telegram_chat_id, telegram_dca_enabled, telegram_dca_days,
                          email_address, email_verified, email_dca_enabled, email_return_enabled, last_app_visit)
        select 'test-' || n, '', case when n <= 10 then 'chat-' || n end, n <= 5, 'MON,WED',
               'fixture@example.com', true, n <= 15, n <= 20, now() - n * interval '1 day'
        from generate_series(1, 10000) n
        """);
    sql("""
        insert into app_notification_preferences(username, dca, briefing, return_reminder)
        select 'test-' || n, n <= 10, n <= 15, n <= 20 from generate_series(1, 10000) n
        """);
    sql("""
        insert into portfolio_holdings(username, symbol, company_name, quantity, average_cost, watch_only, last_alert_sent_at)
        select 'test-1', 'SYMBOL-' || n, 'Fixture', 1, 1, n % 2 = 0, case when n = 1 then now() end
        from generate_series(1, 10000) n
        """);
    sql("""
        insert into app_notifications(username, event_key, kind, title, body, created_at)
        select 'test-' || n, 'event-' || n, 'dca', 'Fixture', 'Fixture',
               case when n = 1 then now() - interval '100 days' else now() end from generate_series(1, 10000) n
        """);
    sql("""
        insert into web_push_subscriptions(id, username, endpoint, public_key, auth_secret, updated_at)
        select 'sub-' || n, 'test-' || n, 'https://example.invalid/' || n, 'fixture', 'fixture',
               case when n = 1 then now() - interval '100 days' else now() end from generate_series(1, 10000) n
        """);
    sql("""
        insert into web_push_deliveries(notification_id, subscription_id, next_attempt_at)
        select a.id, 'sub-' || n, case when n = 1 then now() else now() + interval '1 day' end
        from generate_series(1, 10000) n join app_notifications a on a.event_key = 'event-' || n
        """);
    sql("""
        insert into notification_message_snapshots(event_key, username, content, created_at)
        select 'snapshot-' || n, 'test-' || n, '{}',
               case when n = 1 then now() - interval '100 days' else now() end from generate_series(1, 10000) n
        """);
    sql("insert into feedback_messages(username, message) select 'test-' || n, 'Fixture' from generate_series(1, 10000) n");
  }
}
