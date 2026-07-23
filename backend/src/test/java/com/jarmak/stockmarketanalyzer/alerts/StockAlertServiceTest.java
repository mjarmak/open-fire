package com.jarmak.stockmarketanalyzer.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.CompanySnapshot;
import com.jarmak.stockmarketanalyzer.market.FinnhubClient;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import com.jarmak.stockmarketanalyzer.market.MarketModels.StockAlert;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class StockAlertServiceTest {
  @Test
  void retriesAnUnavailableIndicatorSnapshotOnce() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(1L, "AAPL", "Apple Inc.", BigDecimal.ONE, BigDecimal.valueOf(100), false)
    ));
    when(finnhubClient.companySnapshot("AAPL"))
        .thenReturn(Optional.empty(), Optional.of(new CompanySnapshot(
            "AAPL",
            "Apple Inc.",
            "Technology",
            BigDecimal.valueOf(3_000_000_000_000L),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(1.1),
            BigDecimal.valueOf(20),
            BigDecimal.valueOf(5),
            BigDecimal.valueOf(110),
            BigDecimal.valueOf(108),
            BigDecimal.valueOf(100)
        )));

    StockAlert alert = service.evaluateWatchedStocks(null).get(0);

    assertThat(alert.latestPrice()).isEqualByComparingTo("110.00");
    assertThat(alert.peRatio()).isEqualByComparingTo("25.0");
    verify(finnhubClient, times(2)).companySnapshot("AAPL");
  }

  @Test
  void retriesAnUnavailablePortfolioPriceOnce() {
    AppProperties properties = mock(AppProperties.class);
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties, finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(1L, "AAPL", "Apple Inc.", BigDecimal.valueOf(2), BigDecimal.valueOf(100), false)
    ));
    when(finnhubClient.companyPriceSnapshot("AAPL"))
        .thenReturn(Optional.empty(), Optional.of(new CompanySnapshot(
            "AAPL",
            "Apple Inc.",
            "Technology",
            BigDecimal.valueOf(3_000_000_000_000L),
            null,
            null,
            null,
            null,
            BigDecimal.valueOf(110),
            BigDecimal.valueOf(108),
            null
        )));

    StockAlert alert = service.evaluateWatchedStockPrices().get(0);

    assertThat(alert.latestPrice()).isEqualByComparingTo("110.00");
    assertThat(alert.marketValue()).isEqualByComparingTo("220.00");
    assertThat(alert.unrealizedGainLoss()).isEqualByComparingTo("20.00");
    verify(finnhubClient, times(2)).companyPriceSnapshot("AAPL");
  }

  @Test
  void acceptsPartialForeignStockIndicatorsWithoutRetrying() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(2L, "3GP", "Xiaomi", BigDecimal.TEN, BigDecimal.valueOf(3), false)
    ));
    when(finnhubClient.companySnapshot("3GP")).thenReturn(Optional.of(new CompanySnapshot(
        "3GP",
        "Xiaomi",
        "Technology",
        null,
        null,
        null,
        null,
        null,
        BigDecimal.valueOf(4),
        BigDecimal.valueOf(3.9),
        null
    )));

    StockAlert alert = service.evaluateWatchedStocks(null).get(0);

    assertThat(alert.latestPrice()).isEqualByComparingTo("4.00");
    assertThat(alert.marketValue()).isEqualByComparingTo("40.00");
    assertThat(alert.peRatio()).isNull();
    assertThat(alert.beta()).isNull();
    verify(finnhubClient).companySnapshot("3GP");
  }

  @Test
  void calculatesHighRiskPositionIndicatorsAndReasons() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);

    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(1L, "RISK", "Risk Corp", BigDecimal.valueOf(3), BigDecimal.valueOf(90), false)
    ));
    when(finnhubClient.companySnapshot("RISK")).thenReturn(Optional.of(new CompanySnapshot(
        "RISK",
        "Risk Corp",
        "Technology",
        BigDecimal.valueOf(1_000_000_000L),
        BigDecimal.valueOf(50),
        BigDecimal.valueOf(2),
        BigDecimal.valueOf(50),
        BigDecimal.valueOf(30),
        BigDecimal.valueOf(120),
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(80)
    )));

    StockAlert alert = service.evaluateWatchedStocks(BigDecimal.valueOf(40)).get(0);

    assertThat(alert.symbol()).isEqualTo("RISK");
    assertThat(alert.positionType()).isEqualTo("Technology");
    assertThat(alert.latestPrice()).isEqualByComparingTo("120.00");
    assertThat(alert.marketCap()).isEqualByComparingTo("1000000000");
    assertThat(alert.peRatio()).isEqualByComparingTo("50.0");
    assertThat(alert.beta()).isEqualByComparingTo("2.00");
    assertThat(alert.realizedVolatilityPercent()).isEqualByComparingTo("50.0");
    assertThat(alert.drawdownPercent()).isEqualByComparingTo("30.0");
    assertThat(alert.fearScore()).isEqualByComparingTo("93");
    assertThat(alert.marketValue()).isEqualByComparingTo("360.00");
    assertThat(alert.costBasis()).isEqualByComparingTo("270.00");
    assertThat(alert.dayGainLoss()).isEqualByComparingTo("60.00");
    assertThat(alert.dayGainLossPercent()).isEqualByComparingTo("20.0");
    assertThat(alert.unrealizedGainLoss()).isEqualByComparingTo("90.00");
    assertThat(alert.unrealizedGainLossPercent()).isEqualByComparingTo("33.3");
    assertThat(alert.thirtyDayChangePercent()).isEqualByComparingTo("50.0");
    assertThat(alert.alert()).isTrue();
    assertThat(alert.reason())
        .contains("global VIX is above 25 at 40")
        .contains("stock fear score is 93/100")
        .contains("P/E is 50")
        .contains("beta is 2")
        .contains("realized volatility is 50%")
        .contains("30-day drawdown is 30%")
        .contains("up 50% over roughly 30 calendar days")
        .contains("market cap is below 2000000000");
  }

  @Test
  void calculatesCalmPositionIndicatorsWithoutTriggeringAlert() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);

    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(1L, "CALM", "Calm Corp", BigDecimal.valueOf(2), BigDecimal.valueOf(100), false)
    ));
    when(finnhubClient.companySnapshot("CALM")).thenReturn(Optional.of(new CompanySnapshot(
        "CALM",
        "Calm Corp",
        "Technology",
        BigDecimal.valueOf(3_000_000_000_000L),
        BigDecimal.valueOf(10),
        BigDecimal.ONE,
        BigDecimal.valueOf(10),
        BigDecimal.valueOf(2),
        BigDecimal.valueOf(105),
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(100)
    )));

    StockAlert alert = service.evaluateWatchedStocks(BigDecimal.valueOf(18)).get(0);

    assertThat(alert.latestPrice()).isEqualByComparingTo("105.00");
    assertThat(alert.peRatio()).isEqualByComparingTo("10.0");
    assertThat(alert.beta()).isEqualByComparingTo("1.00");
    assertThat(alert.realizedVolatilityPercent()).isEqualByComparingTo("10.0");
    assertThat(alert.drawdownPercent()).isEqualByComparingTo("2.0");
    assertThat(alert.fearScore()).isEqualByComparingTo("16");
    assertThat(alert.marketValue()).isEqualByComparingTo("210.00");
    assertThat(alert.costBasis()).isEqualByComparingTo("200.00");
    assertThat(alert.dayGainLoss()).isEqualByComparingTo("10.00");
    assertThat(alert.dayGainLossPercent()).isEqualByComparingTo("5.0");
    assertThat(alert.unrealizedGainLoss()).isEqualByComparingTo("10.00");
    assertThat(alert.unrealizedGainLossPercent()).isEqualByComparingTo("5.0");
    assertThat(alert.thirtyDayChangePercent()).isEqualByComparingTo("5.0");
    assertThat(alert.alert()).isFalse();
    assertThat(alert.reason()).isEqualTo("No watched stock alerts fired under current thresholds.");
  }

  @Test
  void includesRoundedVolatilityAndDrawdownInStockAlerts() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);

    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(1L, "AAPL", "Apple Inc.", BigDecimal.valueOf(2), BigDecimal.valueOf(100), false)
    ));
    when(finnhubClient.companySnapshot("AAPL")).thenReturn(Optional.of(new CompanySnapshot(
        "AAPL",
        "Apple Inc.",
        "Technology",
        BigDecimal.valueOf(3_000_000_000_000L),
        BigDecimal.valueOf(29.24),
        BigDecimal.valueOf(1.23),
        BigDecimal.valueOf(42.34),
        BigDecimal.valueOf(21.78),
        BigDecimal.valueOf(150),
        BigDecimal.valueOf(145),
        BigDecimal.valueOf(120)
    )));

    StockAlert alert = service.evaluateWatchedStocks(BigDecimal.valueOf(18)).get(0);

    assertThat(alert.realizedVolatilityPercent()).isEqualByComparingTo("42.3");
    assertThat(alert.drawdownPercent()).isEqualByComparingTo("21.8");
    assertThat(alert.reason()).contains("realized volatility is 42.3%");
    assertThat(alert.reason()).contains("30-day drawdown is 21.8%");
  }

  @Test
  void watchOnlyHoldingKeepsAlertsButExcludesPortfolioValueCalculations() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);

    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(1L, "AAPL", "Apple Inc.", BigDecimal.ZERO, BigDecimal.ZERO, true)
    ));
    when(finnhubClient.companySnapshot("AAPL")).thenReturn(Optional.of(new CompanySnapshot(
        "AAPL",
        "Apple Inc.",
        "Technology",
        BigDecimal.valueOf(3_000_000_000_000L),
        BigDecimal.valueOf(29.24),
        BigDecimal.valueOf(1.23),
        BigDecimal.valueOf(42.34),
        BigDecimal.valueOf(21.78),
        BigDecimal.valueOf(150),
        BigDecimal.valueOf(145),
        BigDecimal.valueOf(120)
    )));

    StockAlert alert = service.evaluateWatchedStocks(BigDecimal.valueOf(18)).get(0);

    assertThat(alert.watchOnly()).isTrue();
    assertThat(alert.alert()).isTrue();
    assertThat(alert.averageCost()).isEqualByComparingTo(BigDecimal.ZERO);
    assertThat(alert.marketValue()).isNull();
    assertThat(alert.costBasis()).isNull();
    assertThat(alert.dayGainLoss()).isEqualByComparingTo("5.00");
    assertThat(alert.dayGainLossPercent()).isEqualByComparingTo("3.4");
    assertThat(alert.unrealizedGainLoss()).isNull();
    assertThat(alert.unrealizedGainLossPercent()).isNull();
  }

  @Test
  void pricePreviewUsesLightweightSnapshotWithoutDailyOrHistoryEvaluation() {
    AppProperties properties = mock(AppProperties.class);
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties, finnhubClient, portfolioService);
    when(finnhubClient.companyPriceSnapshot("AAPL")).thenReturn(Optional.of(new CompanySnapshot(
        "AAPL",
        "Apple Inc.",
        "Technology",
        BigDecimal.valueOf(3_000_000_000_000L),
        null,
        null,
        null,
        null,
        BigDecimal.valueOf(110),
        BigDecimal.valueOf(106),
        null
    )));

    var preview = service.pricePreview("AAPL", "Apple Inc.");

    assertThat(preview.latestPrice()).isEqualByComparingTo("110.00");
    assertThat(preview.marketCap()).isEqualByComparingTo("3000000000000");
    assertThat(preview.dayGainLoss()).isNull();
    assertThat(preview.dayGainLossPercent()).isNull();
    assertThat(preview.fearScore()).isNull();
    assertThat(preview.thirtyDayChangePercent()).isNull();
    verify(finnhubClient).companyPriceSnapshot("AAPL");
    verify(finnhubClient, never()).companySnapshot("AAPL");
    verify(finnhubClient, never()).dailyCloses("AAPL");
  }

  @Test
  void loadsPositionPricesAndAccountingWithoutRiskHistory() {
    AppProperties properties = mock(AppProperties.class);
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties, finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(
        new PortfolioHolding(7L, "AAPL", "Apple Inc.", BigDecimal.valueOf(3), BigDecimal.valueOf(100), false)
    ));
    when(finnhubClient.companyPriceSnapshot("AAPL")).thenReturn(Optional.of(new CompanySnapshot(
        "AAPL",
        "Apple Inc.",
        "Technology",
        BigDecimal.valueOf(3_000_000_000_000L),
        null,
        null,
        null,
        null,
        BigDecimal.valueOf(110),
        BigDecimal.valueOf(106),
        null
    )));

    StockAlert price = service.evaluateWatchedStockPrices().get(0);

    assertThat(price.id()).isEqualTo(7L);
    assertThat(price.latestPrice()).isEqualByComparingTo("110.00");
    assertThat(price.marketValue()).isEqualByComparingTo("330.00");
    assertThat(price.costBasis()).isEqualByComparingTo("300.00");
    assertThat(price.dayGainLoss()).isEqualByComparingTo("12.00");
    assertThat(price.dayGainLossPercent()).isEqualByComparingTo("3.8");
    assertThat(price.unrealizedGainLoss()).isEqualByComparingTo("30.00");
    assertThat(price.unrealizedGainLossPercent()).isEqualByComparingTo("10.0");
    assertThat(price.peRatio()).isNull();
    assertThat(price.realizedVolatilityPercent()).isNull();
    assertThat(price.thirtyDayChangePercent()).isNull();
    verify(finnhubClient).companyPriceSnapshot("AAPL");
    verify(finnhubClient, never()).companySnapshot("AAPL");
    verify(finnhubClient, never()).dailyCloses("AAPL");
  }

  private AppProperties properties() {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            "finnhub",
            null,
            List.of(),
            List.of(),
            BigDecimal.valueOf(2_000_000_000L),
            BigDecimal.valueOf(35),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(1.5),
            BigDecimal.valueOf(40),
            BigDecimal.valueOf(20),
            BigDecimal.valueOf(65)
        ),
        null,
        null,
        null
    );
  }
}
