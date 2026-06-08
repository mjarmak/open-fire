package com.jarmak.stockmarketanalyzer.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
  void pricePreviewUsesLightweightSnapshotWithoutFullHistoryEvaluation() {
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
    assertThat(preview.dayGainLoss()).isEqualByComparingTo("4.00");
    assertThat(preview.dayGainLossPercent()).isEqualByComparingTo("3.8");
    assertThat(preview.fearScore()).isNull();
    assertThat(preview.thirtyDayChangePercent()).isNull();
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
