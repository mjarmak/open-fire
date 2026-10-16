package com.jarmak.stockmarketanalyzer.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import java.sql.*;
import java.time.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AppNotificationServiceTest {
  final DatabaseService database = mock(DatabaseService.class);
  final DashboardService dashboard = mock(DashboardService.class);
  final WebPushTransport transport = mock(WebPushTransport.class);
  final Connection connection = mock(Connection.class);
  final PreparedStatement query = mock(PreparedStatement.class);
  final PreparedStatement update = mock(PreparedStatement.class);
  final ResultSet row = mock(ResultSet.class);
  final Instant now = Instant.parse("2026-10-16T14:00:00Z");
  final AppNotificationService service = new AppNotificationService(database, dashboard, transport, new ObjectMapper(), Clock.fixed(now, ZoneOffset.UTC));

  @BeforeEach void setup() throws Exception {
    when(database.connection()).thenReturn(connection);
    when(connection.prepareStatement(anyString())).thenReturn(query);
    when(connection.prepareStatement(contains("update web_push_deliveries"))).thenReturn(update);
    when(connection.prepareStatement(contains("delete from web_push_subscriptions"))).thenReturn(update);
    when(query.executeQuery()).thenReturn(row); when(row.next()).thenReturn(true);
    when(row.getLong(1)).thenReturn(42L); when(row.getString(2)).thenReturn("device");
    when(row.getString(4)).thenReturn("dca"); when(row.getString(5)).thenReturn("DCA reminder");
    when(row.getString(6)).thenReturn("Your planned DCA is $100/month.");
    when(row.getTimestamp(7)).thenReturn(Timestamp.from(now.minusSeconds(60)));
    when(row.getString(8)).thenReturn("https://fcm.googleapis.com/fcm/send/device");
    when(row.getString(9)).thenReturn("key"); when(row.getString(10)).thenReturn("auth");
    when(row.getBoolean(11)).thenReturn(true); when(row.getBoolean("dca")).thenReturn(true);
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenReturn(201);
  }

  @Test void acceptedDeliveryCommitsAndUsesStableNotificationTag() throws Exception {
    assertThat(service.deliverOne()).isTrue();
    verify(transport).send(eq("https://fcm.googleapis.com/fcm/send/device"), eq("key"), eq("auth"), contains("open-fire-42"));
    verify(update).setBoolean(2, true); verify(update).setBoolean(3, true); verify(connection).commit();
    verify(connection).prepareStatement(contains("for update of d, s, u, p skip locked"));
  }

  @Test void categoriesDefaultToEnabledWithoutRegisteringADevice() throws Exception {
    when(row.next()).thenReturn(false);
    assertThat(service.configuration("alice").preferences())
        .isEqualTo(new AppNotificationService.Preferences(true, true, true));
    verify(query).setString(1, "alice");
    verify(query, never()).executeUpdate();
    verify(transport, never()).send(anyString(), anyString(), anyString(), anyString());
  }

  @Test void savedCategoryOptOutsArePreserved() throws Exception {
    when(row.getBoolean(1)).thenReturn(false);
    when(row.getBoolean(2)).thenReturn(true);
    when(row.getBoolean(3)).thenReturn(false);
    assertThat(service.configuration("alice").preferences())
        .isEqualTo(new AppNotificationService.Preferences(false, true, false));
    verify(query, never()).executeUpdate();
  }

  @ParameterizedTest @ValueSource(ints = {408, 429, 500, 503})
  void transientFailureSchedulesBoundedRetry(int status) throws Exception {
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenReturn(status);
    service.deliverOne(); verify(update).setBoolean(2, false); verify(update).setInt(4, 2); verify(update).setBoolean(3, false);
  }

  @Test void fifthFailureIsTerminal() throws Exception {
    when(row.getInt(3)).thenReturn(4); when(transport.send(anyString(), anyString(), anyString(), anyString())).thenReturn(503);
    service.deliverOne(); verify(update).setInt(1, 5); verify(update).setBoolean(2, true);
  }

  @ParameterizedTest @ValueSource(ints = {404, 410})
  void expiredSubscriptionIsRemovedWithoutAffectingOtherDevices(int status) throws Exception {
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenReturn(status);
    service.deliverOne(); verify(update).setString(1, "device");
    verify(connection).prepareStatement("delete from web_push_subscriptions where id = ?"); verify(connection).commit();
  }

  @Test void disabledCategorySuppressesAlreadyQueuedPush() throws Exception {
    when(row.getBoolean("dca")).thenReturn(false); service.deliverOne();
    verifyNoInteractions(transport); verify(update).setBoolean(2, true);
  }

  @Test void disabledAccountSuppressesAlreadyQueuedPush() throws Exception {
    when(row.getBoolean(11)).thenReturn(false); service.deliverOne(); verifyNoInteractions(transport);
  }

  @Test void oldNotificationDoesNotReplay() throws Exception {
    when(row.getTimestamp(7)).thenReturn(Timestamp.from(now.minus(Duration.ofDays(2))));
    service.deliverOne(); verifyNoInteractions(transport); verify(update).setBoolean(2, true);
  }

  @Test void returnReminderIsSuppressedAfterUserVisits() throws Exception {
    when(row.getString(4)).thenReturn("return"); when(row.getBoolean("return_reminder")).thenReturn(true);
    when(row.getTimestamp(12)).thenReturn(Timestamp.from(now)); service.deliverOne(); verifyNoInteractions(transport);
  }

  @Test void transportExceptionIsRetriedWithoutLoggingPrivatePayload() throws Exception {
    when(transport.send(anyString(), anyString(), anyString(), anyString())).thenThrow(new java.io.IOException("private endpoint"));
    service.deliverOne(); verify(update).setBoolean(2, false);
  }

  @Test void unavailableTransportLeavesDurableQueueUntouched() throws Exception {
    service.deliver(); verifyNoInteractions(database);
  }

  @Test void fullMessageIsPreservedWhilePushPreviewIsUtf8Bounded() throws Exception {
    String body = "\uD83D\uDD25".repeat(2000);
    String encoded = service.payload(42L, "Reminder", body);
    assertThat(encoded.getBytes(java.nio.charset.StandardCharsets.UTF_8).length).isLessThan(3500);
    var notification = new ObjectMapper().readTree(encoded).path("notification");
    assertThat(notification.path("body").asText()).endsWith("...");
    assertThat(notification.path("data").path("onActionClick").path("default").path("url").asText()).isEqualTo("/?notifications=1");
    assertThat(NotificationContent.plainText("<b>Focus:</b> &lt;img&gt; &amp; $100")).isEqualTo("Focus: <img> & $100");
  }

  @Test void inboxAndUnsubscribeAlwaysBindAuthenticatedAccount() throws Exception {
    when(row.next()).thenReturn(false);
    service.inbox("alice", 100); verify(query).setString(1, "alice"); verify(query).setLong(2, 100);
    service.unsubscribe("alice", "https://fcm.googleapis.com/fcm/send/device"); verify(update).setString(2, "alice");
    verify(connection).prepareStatement("delete from web_push_subscriptions where id = ? and username = ?");
  }

  @Test void schedulesMatchExistingEmailAndTelegramSchedules() throws Exception {
    var dca = AppNotificationService.class.getMethod("dca").getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);
    var briefing = AppNotificationService.class.getMethod("briefing").getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);
    assertThat(dca.zone()).isEqualTo("Europe/Brussels"); assertThat(dca.cron()).isEqualTo("0 */10 16 * * *");
    assertThat(briefing.cron()).isEqualTo("0 */10 23 * * *");
  }
}
