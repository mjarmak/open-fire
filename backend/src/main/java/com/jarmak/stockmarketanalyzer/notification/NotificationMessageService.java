package com.jarmak.stockmarketanalyzer.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

@Service
public class NotificationMessageService {
  private final DatabaseService database;
  private final ObjectMapper json;
  public NotificationMessageService(DatabaseService database, ObjectMapper json) { this.database = database; this.json = json; }
  public record Snapshot(String message, List<String> cooldownSymbols) {}

  public Snapshot daily(String username, String kind, Supplier<Snapshot> generate) {
    String key = "open-fire:" + kind + ":" + username + ":" + LocalDate.now(ZoneId.of("Europe/Brussels"));
    try (var connection = database.connection()) {
      connection.setAutoCommit(false);
      try {
        // All channels and replicas resolve the same committed daily message before cooldown changes.
        try (var lock = connection.prepareStatement("select pg_advisory_xact_lock(hashtextextended(?, 0))")) {
          lock.setString(1, key); lock.execute();
        }
        try (var query = connection.prepareStatement("select content from notification_message_snapshots where event_key = ?")) {
          query.setString(1, key);
          try (var row = query.executeQuery()) { if (row.next()) { return json.readValue(row.getString(1), Snapshot.class); } }
        }
        Snapshot snapshot = generate.get();
        try (var insert = connection.prepareStatement("insert into notification_message_snapshots(event_key, username, content) values (?, ?, ?)")) {
          insert.setString(1, key); insert.setString(2, username); insert.setString(3, json.writeValueAsString(snapshot)); insert.executeUpdate();
        }
        connection.commit(); return snapshot;
      } finally { connection.rollback(); }
    } catch (Exception failure) { throw new IllegalStateException("Could not resolve the shared notification message.", failure); }
  }
}
