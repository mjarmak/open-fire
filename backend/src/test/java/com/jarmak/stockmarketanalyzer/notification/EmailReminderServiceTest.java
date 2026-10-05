package com.jarmak.stockmarketanalyzer.notification;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import java.sql.*;
import java.time.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EmailReminderServiceTest {
  final DatabaseService database = mock(DatabaseService.class);
  final DashboardService dashboard = mock(DashboardService.class);
  final EmailNotificationService email = mock(EmailNotificationService.class);
  final Connection candidates = mock(Connection.class);
  final Connection delivery = mock(Connection.class);
  final PreparedStatement query = mock(PreparedStatement.class);
  final PreparedStatement lock = mock(PreparedStatement.class);
  final PreparedStatement insert = mock(PreparedStatement.class);
  final ResultSet users = mock(ResultSet.class);
  final ResultSet account = mock(ResultSet.class);
  final EmailReminderService service = new EmailReminderService(database, dashboard, email);

  @BeforeEach
  void setup() throws Exception {
    when(email.enabled()).thenReturn(true);
    when(database.connection()).thenReturn(candidates, delivery);
    when(candidates.prepareStatement(anyString())).thenReturn(query);
    when(query.executeQuery()).thenReturn(users);
    when(users.next()).thenReturn(true, false);
    when(users.getString("username")).thenReturn("alice");
    when(delivery.prepareStatement(contains("for update"))).thenReturn(lock);
    when(delivery.prepareStatement(contains("email_deliveries"))).thenReturn(insert);
    when(lock.executeQuery()).thenReturn(account);
    when(account.next()).thenReturn(true);
    when(account.getBoolean("enabled")).thenReturn(true);
    when(account.getBoolean("email_verified")).thenReturn(true);
    when(account.getString("email_address")).thenReturn("alice@example.com");
    when(account.getBoolean("email_dca_enabled")).thenReturn(true);
    when(account.getBoolean("email_return_enabled")).thenReturn(true);
    when(account.getString("telegram_dca_days")).thenReturn("MON,TUE,WED,THU,FRI,SAT,SUN");
    when(account.getTimestamp("last_app_visit")).thenReturn(Timestamp.from(Instant.now().minus(Duration.ofDays(8))));
    when(insert.executeUpdate()).thenReturn(1);
    when(dashboard.generateDcaReminderForUser("alice")).thenReturn("<b>Planned DCA:</b> $100/month");
  }

  @Test void disabledDeliveryDoesNotReadDatabase() throws Exception {
    when(email.enabled()).thenReturn(false);
    service.sendDca();
    service.sendReturn();
    verifyNoInteractions(database, dashboard);
  }

  @Test void sendsSharedDcaContentAndCommitsAcceptance() throws Exception {
    service.sendDca();
    verify(email).send(startsWith("open-fire:dca:alice:"), eq("alice"), eq("alice@example.com"), eq("dca"), contains("$100/month"));
    verify(delivery).commit();
    verify(query).setString(eq(1), matches("MON|TUE|WED|THU|FRI|SAT|SUN"));
  }

  @Test void acceptedEventDoesNotSendAgain() throws Exception {
    when(insert.executeUpdate()).thenReturn(0);
    service.sendDca();
    verify(email, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
    verifyNoInteractions(dashboard);
    verify(delivery, never()).commit();
  }

  @Test void failureRollsBackForRetry() throws Exception {
    doThrow(new IllegalStateException("provider down")).when(email).send(anyString(), anyString(), anyString(), anyString(), anyString());
    service.sendDca();
    verify(delivery).rollback();
    verify(delivery, never()).commit();
  }

  @Test void unverifiedAddressCannotReceiveEmail() throws Exception {
    when(account.getBoolean("email_verified")).thenReturn(false);
    service.sendDca();
    verifyNoInteractions(dashboard);
    verify(email, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
  }

  @Test void changedScheduleSuppressesEmail() throws Exception {
    when(account.getString("telegram_dca_days")).thenReturn("");
    service.sendDca();
    verify(email, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
  }

  @Test void returnReminderUsesAbsenceAsStableKey() throws Exception {
    service.sendReturn();
    verify(email).send(startsWith("open-fire:return:alice:"), eq("alice"), eq("alice@example.com"), eq("return"), contains("update your profile"));
    verifyNoInteractions(dashboard);
    verify(delivery).commit();
  }

  @Test void recentActivitySuppressesReturnReminder() throws Exception {
    when(account.getTimestamp("last_app_visit")).thenReturn(Timestamp.from(Instant.now().minus(Duration.ofDays(6))));
    service.sendReturn();
    verify(email, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
  }

  @Test void optOutSuppressesReturnReminder() throws Exception {
    when(account.getBoolean("email_return_enabled")).thenReturn(false);
    service.sendReturn();
    verify(email, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
  }

  @Test void scheduleMatchesTelegramTimeZone() throws Exception {
    var schedule = EmailReminderService.class.getMethod("sendDca").getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);
    assertThat(schedule.zone()).isEqualTo("Europe/Brussels");
    assertThat(schedule.cron()).isEqualTo("0 */10 16 * * *");
  }
}
