package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jarmak.stockmarketanalyzer.alerts.StockAlertService;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.MarketModels.StockAlert;
import com.jarmak.stockmarketanalyzer.notification.TelegramNotificationService;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import java.math.BigDecimal;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.scheduling.annotation.Scheduled;

class DashboardServiceScheduledNotificationTest {
  private final MarketIndicatorService marketIndicatorService = mock(MarketIndicatorService.class);
  private final StockAlertService stockAlertService = mock(StockAlertService.class);
  private final TelegramNotificationService telegramNotificationService = mock(TelegramNotificationService.class);
  private final PortfolioService portfolioService = mock(PortfolioService.class);
  private final UserAccountService userAccountService = mock(UserAccountService.class);

  @Test
  void sendsDcaReminderToEveryConfiguredTelegramUser() {
    when(userAccountService.allUserTelegramSettingsForDcaEnabled()).thenReturn(Map.of(
        "alice", "111",
        "bob", "222"
    ));
    when(userAccountService.getRetirementSettingsForUser(anyString())).thenReturn(retirementSettings());
    when(userAccountService.getDcaSettingsForUser(anyString())).thenReturn(new UserAccountService.UserDcaSettings(true, ""));
    when(stockAlertService.evaluateWatchedStocksForUser(anyString(), org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(stockAlert("VOO", "100000")));
    when(telegramNotificationService.sendToChat(anyString(), anyString()))
        .thenReturn(new TelegramNotificationService.NotificationResult(true, "sent", false));
    DashboardService service = dashboardService(true);

    service.sendDcaReminder();

    ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
    verify(telegramNotificationService).sendToChat(org.mockito.ArgumentMatchers.eq("111"), messageCaptor.capture());
    verify(telegramNotificationService).sendToChat(org.mockito.ArgumentMatchers.eq("222"), messageCaptor.capture());
    assertThat(messageCaptor.getAllValues())
        .allSatisfy(message -> assertThat(message)
            .contains("DCA reminder", "4 PM in Belgium")
            .contains("Planned DCA:</b> $1,000/month")
            .contains("Current retirement assets:</b> $100,000")
            .contains("Retirement target:</b> $1,500,000 using 4% SWR")
            .contains("More money needed to retire:</b> $1,400,000")
            .contains("Estimated time to retire:</b>"));
  }

  @Test
  void skipsDcaReminderWhenTelegramIsDisabled() {
    DashboardService service = dashboardService(false);

    service.sendDcaReminder();

    verify(userAccountService, never()).allUserTelegramSettingsForDcaEnabled();
    verify(telegramNotificationService, never()).sendToChat(anyString(), anyString());
  }

  @Test
  void skipsAlertSymbolsAlreadySentWithinTheLastWeek() {
    when(userAccountService.allUserTelegramSettings()).thenReturn(Map.of("alice", "111"));
    when(marketIndicatorService.indicators()).thenReturn(List.of());
    when(portfolioService.recentlyAlertedSymbolsForUser(
        org.mockito.ArgumentMatchers.eq("alice"),
        org.mockito.ArgumentMatchers.any(Instant.class)
    )).thenReturn(Set.of("AAPL"));
    when(stockAlertService.evaluateWatchedStocksForUser(
        org.mockito.ArgumentMatchers.eq("alice"),
        org.mockito.ArgumentMatchers.isNull()
    )).thenReturn(List.of(alertStock("AAPL", "100000"), alertStock("MSFT", "120000")));
    when(telegramNotificationService.sendToChat(anyString(), anyString()))
        .thenReturn(new TelegramNotificationService.NotificationResult(true, "sent", false));
    DashboardService service = dashboardService(true);

    service.sendDailyBriefing();

    ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
    verify(telegramNotificationService).sendToChat(org.mockito.ArgumentMatchers.eq("111"), messageCaptor.capture());
    assertThat(messageCaptor.getValue()).contains("MSFT").doesNotContain("AAPL");
    verify(portfolioService).markAlertsSentForUser(
        org.mockito.ArgumentMatchers.eq("alice"),
        org.mockito.ArgumentMatchers.argThat((Collection<String> symbols) -> symbols.size() == 1 && symbols.contains("MSFT")),
        org.mockito.ArgumentMatchers.any(Instant.class)
    );
  }

  @Test
  void dcaReminderExcludesWatchOnlyStocksFromCurrentRetirementAssets() {
    when(userAccountService.allUserTelegramSettingsForDcaEnabled()).thenReturn(Map.of("alice", "111"));
    when(userAccountService.getRetirementSettingsForUser("alice")).thenReturn(retirementSettings());
    when(userAccountService.getDcaSettingsForUser("alice")).thenReturn(new UserAccountService.UserDcaSettings(true, ""));
    when(stockAlertService.evaluateWatchedStocksForUser("alice", null))
        .thenReturn(List.of(watchOnlyStock("AAPL", "100000")));
    when(telegramNotificationService.sendToChat(anyString(), anyString()))
        .thenReturn(new TelegramNotificationService.NotificationResult(true, "sent", false));
    DashboardService service = dashboardService(true);

    service.sendDcaReminder();

    ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
    verify(telegramNotificationService).sendToChat(org.mockito.ArgumentMatchers.eq("111"), messageCaptor.capture());
    assertThat(messageCaptor.getValue())
        .contains("Current retirement assets:</b> $10,000")
        .doesNotContain("Current retirement assets:</b> $100,000");
  }


  @Test
  void schedulesDcaReminderOnWednesdayAndFridayAtFourPmBelgiumTime() throws NoSuchMethodException {
    Method method = DashboardService.class.getMethod("sendDcaReminder");
    Scheduled scheduled = method.getAnnotation(Scheduled.class);

    assertThat(scheduled.cron()).isEqualTo("0 0 16 * * WED,FRI");
    assertThat(scheduled.zone()).isEqualTo("Europe/Brussels");
  }

  private DashboardService dashboardService(boolean telegramEnabled) {
    AppProperties properties = new AppProperties(
        null,
        null,
        null,
        new AppProperties.Telegram(telegramEnabled, "sma3141_bot", "test-token"),
        null
    );
    return new DashboardService(
        properties,
        marketIndicatorService,
        stockAlertService,
        telegramNotificationService,
        portfolioService,
        userAccountService
    );
  }

  private UserAccountService.UserRetirementSettings retirementSettings() {
    return new UserAccountService.UserRetirementSettings(
        "2026-01-01",
        BigDecimal.valueOf(5000),
        BigDecimal.valueOf(8),
        BigDecimal.valueOf(1000),
        BigDecimal.valueOf(10000),
        BigDecimal.valueOf(3),
        BigDecimal.valueOf(4)
    );
  }

  private StockAlert alertStock(String symbol, String marketValue) {
    BigDecimal value = new BigDecimal(marketValue);
    return new StockAlert(
        1L,
        symbol,
        symbol,
        "Technology",
        BigDecimal.ONE,
        value,
        value,
        null,
        null,
        null,
        null,
        null,
        BigDecimal.valueOf(80),
        value,
        value,
        null,
        null,
        null,
        null,
        null,
        false,
        true,
        "Risk threshold crossed."
    );
  }

  private StockAlert stockAlert(String symbol, String marketValue) {
    BigDecimal value = new BigDecimal(marketValue);
    return new StockAlert(
        2L,
        symbol,
        symbol,
        "Technology",
        BigDecimal.ONE,
        value,
        value,
        null,
        null,
        null,
        null,
        null,
        null,
        value,
        value,
        null,
        null,
        null,
        null,
        null,
        false,
        false,
        "No watched stock alerts fired under current thresholds."
    );
  }

  private StockAlert watchOnlyStock(String symbol, String marketValue) {
    BigDecimal value = new BigDecimal(marketValue);
    return new StockAlert(
        3L,
        symbol,
        symbol,
        "Technology",
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        value,
        null,
        null,
        null,
        null,
        null,
        null,
        value,
        value,
        null,
        null,
        null,
        null,
        null,
        true,
        true,
        "Risk threshold crossed."
    );
  }
}
