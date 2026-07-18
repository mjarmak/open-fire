package com.jarmak.stockmarketanalyzer.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.CompanySnapshot;
import com.jarmak.stockmarketanalyzer.market.FinnhubClient;
import com.jarmak.stockmarketanalyzer.market.MarketApiProvider;
import com.jarmak.stockmarketanalyzer.market.MarketApiRequestContext;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class StockAlertServicePositionFetchTest {
  @AfterEach
  void clearRequestContext() {
    MarketApiRequestContext.clear();
  }

  @Test
  void fetchesPositionSnapshotsConcurrentlyWithBoundedParallelismAndPreservesOrder() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);
    AtomicInteger activeFetches = new AtomicInteger();
    AtomicInteger maximumActiveFetches = new AtomicInteger();
    List<PortfolioHolding> holdings = List.of(
        holding(1, "AAA"),
        holding(2, "BBB"),
        holding(3, "CCC"),
        holding(4, "DDD"),
        holding(5, "EEE"),
        holding(6, "FFF")
    );
    when(portfolioService.holdings()).thenReturn(holdings);
    when(finnhubClient.companySnapshot(anyString())).thenAnswer(invocation -> {
      int active = activeFetches.incrementAndGet();
      maximumActiveFetches.accumulateAndGet(active, Math::max);
      try {
        Thread.sleep(40);
        return Optional.of(snapshot(invocation.getArgument(0)));
      } finally {
        activeFetches.decrementAndGet();
      }
    });

    var alerts = service.evaluateWatchedStocks(null);

    assertThat(alerts).extracting(alert -> alert.symbol()).containsExactly("AAA", "BBB", "CCC", "DDD", "EEE", "FFF");
    assertThat(maximumActiveFetches.get()).isBetween(2, 4);
  }

  @Test
  void fetchesEachDistinctPositionSymbolOnlyOnce() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(
        holding(1, "AAPL"),
        holding(2, " aapl "),
        holding(3, "MSFT")
    ));
    when(finnhubClient.companySnapshot("AAPL")).thenReturn(Optional.of(snapshot("AAPL")));
    when(finnhubClient.companySnapshot("MSFT")).thenReturn(Optional.of(snapshot("MSFT")));

    var alerts = service.evaluateWatchedStocks(null);

    assertThat(alerts).hasSize(3);
    assertThat(alerts).extracting(alert -> alert.symbol()).containsExactly("AAPL", "AAPL", "MSFT");
    verify(finnhubClient, times(1)).companySnapshot("AAPL");
    verify(finnhubClient, times(1)).companySnapshot("MSFT");
  }

  @Test
  void propagatesRequestApiTokensToPositionFetchWorkers() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(holding(1, "AAPL")));
    MarketApiRequestContext.set(Map.of(MarketApiProvider.FINNHUB, "user-token"));
    when(finnhubClient.companySnapshot("AAPL")).thenAnswer(invocation -> {
      assertThat(MarketApiRequestContext.apiKey(MarketApiProvider.FINNHUB, "app-token"))
          .isEqualTo("user-token");
      return Optional.of(snapshot("AAPL"));
    });

    var alerts = service.evaluateWatchedStocks(null);

    assertThat(alerts).singleElement().satisfies(alert -> assertThat(alert.symbol()).isEqualTo("AAPL"));
    assertThat(MarketApiRequestContext.apiKey(MarketApiProvider.FINNHUB, "app-token"))
        .isEqualTo("user-token");
  }

  @Test
  void isolatesAFailedPositionFetchFromOtherPositions() {
    FinnhubClient finnhubClient = mock(FinnhubClient.class);
    PortfolioService portfolioService = mock(PortfolioService.class);
    StockAlertService service = new StockAlertService(properties(), finnhubClient, portfolioService);
    when(portfolioService.holdings()).thenReturn(List.of(holding(1, "GOOD"), holding(2, "FAIL")));
    when(finnhubClient.companySnapshot("GOOD")).thenReturn(Optional.of(snapshot("GOOD")));
    when(finnhubClient.companySnapshot("FAIL")).thenThrow(new IllegalStateException("provider unavailable"));

    var alerts = service.evaluateWatchedStocks(null);

    assertThat(alerts).hasSize(2);
    assertThat(alerts.get(0).symbol()).isEqualTo("GOOD");
    assertThat(alerts.get(0).latestPrice()).isEqualByComparingTo("105.00");
    assertThat(alerts.get(1).symbol()).isEqualTo("FAIL");
    assertThat(alerts.get(1).latestPrice()).isNull();
    assertThat(alerts.get(1).reason()).contains("Live market data is not available");
  }

  private PortfolioHolding holding(long id, String symbol) {
    return new PortfolioHolding(
        id,
        symbol,
        symbol.trim() + " Corp",
        BigDecimal.valueOf(2),
        BigDecimal.valueOf(100),
        false
    );
  }

  private CompanySnapshot snapshot(String symbol) {
    return new CompanySnapshot(
        symbol.trim().toUpperCase(),
        symbol.trim().toUpperCase() + " Corp",
        "Technology",
        BigDecimal.valueOf(3_000_000_000_000L),
        BigDecimal.valueOf(10),
        BigDecimal.ONE,
        BigDecimal.valueOf(10),
        BigDecimal.valueOf(2),
        BigDecimal.valueOf(105),
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(100)
    );
  }

  private AppProperties properties() {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            "finnhub",
            null,
            null,
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
