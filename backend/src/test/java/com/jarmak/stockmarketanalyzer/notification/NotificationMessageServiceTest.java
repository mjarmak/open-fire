package com.jarmak.stockmarketanalyzer.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import java.sql.*;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class NotificationMessageServiceTest {
  @Test void reusesCommittedMessageWithoutReevaluatingPricesOrCooldowns() throws Exception {
    var database = mock(DatabaseService.class); var connection = mock(Connection.class);
    var query = mock(PreparedStatement.class); var rows = mock(ResultSet.class);
    when(database.connection()).thenReturn(connection); when(connection.prepareStatement(anyString())).thenReturn(query);
    when(query.executeQuery()).thenReturn(rows); when(rows.next()).thenReturn(true);
    when(rows.getString(1)).thenReturn("{\"message\":\"Exact shared briefing\",\"cooldownSymbols\":[\"AAPL\"]}");
    Supplier<NotificationMessageService.Snapshot> generate = mock(Supplier.class);
    var message = new NotificationMessageService(database, new ObjectMapper()).daily("alice", "briefing", generate);
    assertThat(message.message()).isEqualTo("Exact shared briefing"); assertThat(message.cooldownSymbols()).containsExactly("AAPL");
    verifyNoInteractions(generate); verify(connection).prepareStatement(contains("pg_advisory_xact_lock"));
  }

  @Test void atomicallyCommitsNewSharedMessage() throws Exception {
    var database = mock(DatabaseService.class); var connection = mock(Connection.class);
    var query = mock(PreparedStatement.class); var rows = mock(ResultSet.class);
    when(database.connection()).thenReturn(connection); when(connection.prepareStatement(anyString())).thenReturn(query);
    when(query.executeQuery()).thenReturn(rows); when(rows.next()).thenReturn(false);
    var expected = new NotificationMessageService.Snapshot("DCA note", List.of());
    assertThat(new NotificationMessageService(database, new ObjectMapper()).daily("alice", "dca", () -> expected)).isEqualTo(expected);
    verify(connection).commit(); verify(query).setString(2, "alice");
  }
}
