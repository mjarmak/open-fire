package com.jarmak.stockmarketanalyzer.web;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jarmak.stockmarketanalyzer.market.DashboardService;
import com.jarmak.stockmarketanalyzer.market.FinnhubClient;
import com.jarmak.stockmarketanalyzer.market.MarketModels.DashboardResponse;
import com.jarmak.stockmarketanalyzer.market.MarketModels.IndicatorSnapshot;
import com.jarmak.stockmarketanalyzer.market.MarketModels.NotificationStatus;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import com.jarmak.stockmarketanalyzer.market.MarketModels.StockAlert;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import com.jarmak.stockmarketanalyzer.notification.TelegramNotificationService;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.DuplicateUsernameException;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserAccount;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserDcaSettings;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserRegistrationUnavailableException;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserRetirementSettings;
import com.jarmak.stockmarketanalyzer.security.UserAccountService.UserTelegramSettings;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DashboardController.class)
@AutoConfigureMockMvc(addFilters = false)
class DashboardControllerIntegrationTest {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @MockBean
  private DashboardService dashboardService;

  @MockBean
  private TelegramNotificationService telegramNotificationService;

  @MockBean
  private PortfolioService portfolioService;

  @MockBean
  private FinnhubClient finnhubClient;

  @MockBean
  private UserAccountService userAccountService;

  @Test
  void createsUser() throws Exception {
    when(userAccountService.createUser("alice", "strongpass")).thenReturn(new UserAccount("alice"));

    mockMvc.perform(post("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("username", "alice", "password", "strongpass"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value("alice"));
  }

  @Test
  void duplicateUserReturnsConflict() throws Exception {
    when(userAccountService.createUser("alice", "strongpass"))
        .thenThrow(new DuplicateUsernameException("Username already exists.", new RuntimeException()));

    mockMvc.perform(post("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("username", "alice", "password", "strongpass"))))
        .andExpect(status().isConflict());
  }

  @Test
  void unavailableUserRegistrationReturnsServiceUnavailable() throws Exception {
    when(userAccountService.createUser("alice", "strongpass"))
        .thenThrow(new UserRegistrationUnavailableException("Could not create user."));

    mockMvc.perform(post("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("username", "alice", "password", "strongpass"))))
        .andExpect(status().isServiceUnavailable());
  }

  @Test
  void getsDashboard() throws Exception {
    when(dashboardService.dashboard()).thenReturn(new DashboardResponse(
        Instant.parse("2026-06-03T10:00:00Z"),
        List.of(indicator()),
        List.of(stock()),
        List.of(holding()),
        "Daily report",
        new NotificationStatus(true, true, "Telegram @sma3141_bot")
    ));

    mockMvc.perform(get("/api/dashboard"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyReport").value("Daily report"))
        .andExpect(jsonPath("$.indicators[0].id").value("vix"))
        .andExpect(jsonPath("$.stocks[0].symbol").value("AAPL"))
        .andExpect(jsonPath("$.portfolio[0].symbol").value("AAPL"))
        .andExpect(jsonPath("$.notification.provider").value("Telegram @sma3141_bot"));
  }

  @Test
  void getsIndicators() throws Exception {
    when(dashboardService.indicators()).thenReturn(List.of(indicator()));

    mockMvc.perform(get("/api/indicators"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("vix"))
        .andExpect(jsonPath("$[0].status").value("watch"));
  }

  @Test
  void getsStocks() throws Exception {
    when(dashboardService.stocks()).thenReturn(List.of(stock()));

    mockMvc.perform(get("/api/stocks"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].symbol").value("AAPL"))
        .andExpect(jsonPath("$[0].marketValue").value(200));
  }

  @Test
  void getsNotificationStatus() throws Exception {
    when(dashboardService.notificationStatus()).thenReturn(new NotificationStatus(true, true, "Telegram"));

    mockMvc.perform(get("/api/notifications/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(true))
        .andExpect(jsonPath("$.configured").value(true))
        .andExpect(jsonPath("$.provider").value("Telegram"));
  }

  @Test
  void getsPortfolio() throws Exception {
    when(portfolioService.holdings()).thenReturn(List.of(holding()));

    mockMvc.perform(get("/api/portfolio"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].symbol").value("AAPL"))
        .andExpect(jsonPath("$[0].watchOnly").value(false));
  }

  @Test
  void exportsPortfolioCsv() throws Exception {
    when(dashboardService.stocks()).thenReturn(List.of(stock()));

    mockMvc.perform(get("/api/portfolio/export"))
        .andExpect(status().isOk())
        .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"portfolio-positions.csv\""))
        .andExpect(content().contentType("text/csv"))
        .andExpect(content().string(containsString("symbol,companyName,quantity,averageCost,watchOnly")))
        .andExpect(content().string(containsString("AAPL,Apple Inc.,2,100,false")));
  }

  @Test
  void importsPortfolioCsv() throws Exception {
    mockMvc.perform(post("/api/portfolio/import")
            .contentType("text/csv")
            .content("symbol,companyName,quantity,averageCost,watchOnly\nAAPL,Apple Inc.,2,100,true\n"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.imported").value(1))
        .andExpect(jsonPath("$.errors").isEmpty());

    verify(portfolioService).upsert(
        "AAPL",
        "Apple Inc.",
        new BigDecimal("2"),
        new BigDecimal("100"),
        true
    );
  }

  @Test
  void savePortfolioHoldingUsesSymbolLookup() throws Exception {
    when(finnhubClient.findExactSymbol("aapl"))
        .thenReturn(Optional.of(new SymbolSearchResult("AAPL", "Apple Inc.", "US", "USD")));
    when(portfolioService.upsert(anyString(), anyString(), any(BigDecimal.class), any(BigDecimal.class), eq(false)))
        .thenReturn(holding());

    mockMvc.perform(post("/api/portfolio")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of(
                "symbol", "aapl",
                "companyName", "ignored client name",
                "quantity", 2,
                "averageCost", 100,
                "watchOnly", false
            ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.symbol").value("AAPL"))
        .andExpect(jsonPath("$.averageCost").value(100));

    verify(portfolioService).upsert(
        eq("AAPL"),
        eq("Apple Inc."),
        any(BigDecimal.class),
        any(BigDecimal.class),
        eq(false)
    );
  }

  @Test
  void unknownPortfolioSymbolReturnsBadRequest() throws Exception {
    when(finnhubClient.findExactSymbol("NOPE")).thenReturn(Optional.empty());

    mockMvc.perform(post("/api/portfolio")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of(
                "symbol", "NOPE",
                "quantity", 1,
                "averageCost", 1,
                "watchOnly", false
            ))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void deletesPortfolioHolding() throws Exception {
    mockMvc.perform(delete("/api/portfolio/AAPL"))
        .andExpect(status().isOk());

    verify(portfolioService).delete("AAPL");
  }

  @Test
  void searchesSymbols() throws Exception {
    when(finnhubClient.searchSymbols("app"))
        .thenReturn(List.of(new SymbolSearchResult("AAPL", "Apple Inc.", "US", "USD")));

    mockMvc.perform(get("/api/symbols/search").param("keywords", "app"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].symbol").value("AAPL"))
        .andExpect(jsonPath("$[0].currency").value("USD"));
  }

  @Test
  void sendsTelegramNotification() throws Exception {
    when(telegramNotificationService.send("Hello"))
        .thenReturn(new TelegramNotificationService.NotificationResult(true, "Telegram message sent.", false));

    mockMvc.perform(post("/api/notifications/telegram")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("message", "Hello"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sent").value(true))
        .andExpect(jsonPath("$.message").value("Telegram message sent."))
        .andExpect(jsonPath("$.missingChatId").value(false));
  }

  @Test
  void getsTelegramSettings() throws Exception {
    when(userAccountService.currentTelegramChatId()).thenReturn(Optional.of("12345"));

    mockMvc.perform(get("/api/users/me/telegram"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.chatId").value("12345"));
  }

  @Test
  void updatesTelegramSettings() throws Exception {
    when(userAccountService.updateCurrentTelegramChatId("67890")).thenReturn(new UserTelegramSettings("67890"));

    mockMvc.perform(put("/api/users/me/telegram")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of("chatId", "67890"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.chatId").value("67890"));
  }

  @Test
  void getsDcaSettings() throws Exception {
    when(userAccountService.currentDcaSettings()).thenReturn(new UserDcaSettings(true, null));

    mockMvc.perform(get("/api/users/me/dca"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.telegramDcaEnabled").value(true))
        .andExpect(jsonPath("$.reminderNote").value(""));
  }

  @Test
  void updatesDcaSettings() throws Exception {
    when(userAccountService.updateCurrentDcaSettings(any(UserDcaSettings.class)))
        .thenReturn(new UserDcaSettings(true, "Buy monthly allocation"));

    mockMvc.perform(put("/api/users/me/dca")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of(
                "telegramDcaEnabled", true,
                "reminderNote", "Buy monthly allocation"
            ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.telegramDcaEnabled").value(true))
        .andExpect(jsonPath("$.reminderNote").value("Buy monthly allocation"));
  }

  @Test
  void getsRetirementSettings() throws Exception {
    when(userAccountService.getRetirementSettings()).thenReturn(retirementSettings());

    mockMvc.perform(get("/api/users/me/retirement"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.investingStartDate").value("2020-01-01"))
        .andExpect(jsonPath("$.safeWithdrawalRate").value(4));
  }

  @Test
  void updatesRetirementSettings() throws Exception {
    when(userAccountService.updateRetirementSettings(any(UserRetirementSettings.class))).thenReturn(retirementSettings());

    mockMvc.perform(put("/api/users/me/retirement")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json(Map.of(
                "investingStartDate", "2020-01-01",
                "desiredMonthlyIncome", 5000,
                "customReturnRate", 12,
                "monthlySavings", 500,
                "otherSavings", 10000,
                "yearlyInflationRate", 3,
                "safeWithdrawalRate", 4
            ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.desiredMonthlyIncome").value(5000))
        .andExpect(jsonPath("$.safeWithdrawalRate").value(4));
  }

  private String json(Object value) throws Exception {
    return objectMapper.writeValueAsString(value);
  }

  private IndicatorSnapshot indicator() {
    return new IndicatorSnapshot(
        "vix",
        "VIX",
        "volatility",
        BigDecimal.valueOf(18.5),
        "",
        BigDecimal.valueOf(1.2),
        "watch",
        "Finnhub",
        Instant.parse("2026-06-03T10:00:00Z"),
        "Volatility index"
    );
  }

  private StockAlert stock() {
    return new StockAlert(
        "AAPL",
        "Apple Inc.",
        "Core",
        BigDecimal.valueOf(2),
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(110),
        BigDecimal.valueOf(3000000000000L),
        BigDecimal.valueOf(30),
        BigDecimal.valueOf(1.2),
        BigDecimal.valueOf(20),
        BigDecimal.valueOf(-10),
        BigDecimal.valueOf(40),
        BigDecimal.valueOf(200),
        BigDecimal.valueOf(180),
        BigDecimal.valueOf(4),
        BigDecimal.valueOf(2),
        BigDecimal.valueOf(20),
        BigDecimal.valueOf(11.11),
        BigDecimal.valueOf(5),
        false,
        true,
        "Risk is elevated"
    );
  }

  private PortfolioHolding holding() {
    return new PortfolioHolding("AAPL", "Apple Inc.", BigDecimal.valueOf(2), BigDecimal.valueOf(100), false);
  }

  private UserRetirementSettings retirementSettings() {
    return new UserRetirementSettings(
        "2020-01-01",
        BigDecimal.valueOf(5000),
        BigDecimal.valueOf(12),
        BigDecimal.valueOf(500),
        BigDecimal.valueOf(10000),
        BigDecimal.valueOf(3),
        BigDecimal.valueOf(4)
    );
  }
}
