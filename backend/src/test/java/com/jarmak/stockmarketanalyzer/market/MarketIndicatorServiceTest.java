package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.client.FredClient;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

@SpringJUnitConfig(MarketIndicatorServiceTest.TestConfig.class)
class MarketIndicatorServiceTest {
  @Autowired
  private MarketIndicatorService service;

  @Autowired
  private FredClient fredClient;

  @Autowired
  private FinnhubClient finnhubClient;

  @Test
  void cachesIndicatorsForRepeatedReads() {
    when(fredClient.latestObservations("VIXCLS")).thenReturn(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 30), 18.0),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 29), 17.0)
    ));
    when(fredClient.latestObservations("BAMLC0A0CM")).thenReturn(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 30), 1.1),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 29), 1.0)
    ));
    when(finnhubClient.dailyCloses("SPY")).thenReturn(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 29), 100),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 30), 101)
    ));
    when(finnhubClient.dailyCloses("TLT")).thenReturn(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 20), 100),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 21), 101),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 22), 102),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 23), 103),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 24), 104),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 25), 105),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 26), 106),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 27), 107),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 28), 108),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 29), 109),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 30), 110)
    ));

    List<MarketModels.IndicatorSnapshot> first = service.indicators();
    List<MarketModels.IndicatorSnapshot> second = service.indicators();

    assertThat(first).isNotEmpty();
    assertThat(second).isEqualTo(first);
    verify(fredClient, times(1)).latestObservations("VIXCLS");
    verify(fredClient, times(1)).latestObservations("BAMLC0A0CM");
    verify(finnhubClient, atLeast(1)).dailyCloses("SPY");
    verify(finnhubClient, atLeast(1)).dailyCloses("TLT");
  }

  @Test
  void supportsBreadthHistory() {
    when(finnhubClient.historicalCandles("SPY", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        chartPoint("2024-01-01T00:00:00Z", 100),
        chartPoint("2024-01-02T00:00:00Z", 101),
        chartPoint("2024-01-03T00:00:00Z", 102)
    ));

    var series = service.indicatorHistory("breadth", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS);

    assertThat(series.id()).isEqualTo("breadth");
    assertThat(series.range()).isEqualTo("10y");
    assertThat(series.points()).hasSize(2);
    assertThat(series.points().get(0).timestamp()).isEqualTo(java.time.Instant.parse("2024-01-02T00:00:00Z"));
  }

  @Test
  void supportsFearGreedHistory() {
    when(fredClient.observations("VIXCLS", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        new MarketModels.ChartPoint(java.time.Instant.parse("2026-05-02T00:00:00Z"), BigDecimal.valueOf(18.0)),
        new MarketModels.ChartPoint(java.time.Instant.parse("2026-05-03T00:00:00Z"), BigDecimal.valueOf(17.5))
    ));
    when(fredClient.observations("BAMLC0A0CM", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        new MarketModels.ChartPoint(java.time.Instant.parse("2026-05-02T00:00:00Z"), BigDecimal.valueOf(1.1)),
        new MarketModels.ChartPoint(java.time.Instant.parse("2026-05-03T00:00:00Z"), BigDecimal.valueOf(1.0))
    ));
    when(finnhubClient.historicalCandles("SPY", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        chartPoint("2026-05-01T00:00:00Z", 100),
        chartPoint("2026-05-02T00:00:00Z", 101),
        chartPoint("2026-05-03T00:00:00Z", 102)
    ));
    when(finnhubClient.historicalCandles("TLT", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        chartPoint("2026-05-01T00:00:00Z", 200),
        chartPoint("2026-05-02T00:00:00Z", 201),
        chartPoint("2026-05-03T00:00:00Z", 204)
    ));

    var series = service.indicatorHistory("fear-greed", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS);

    assertThat(series.id()).isEqualTo("fear-greed");
    assertThat(series.range()).isEqualTo("10y");
    assertThat(series.points()).isNotEmpty();
  }

  @Test
  void supportsCorrelationHistory() {
    when(finnhubClient.historicalCandles("SPY", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        chartPoint("2024-01-01T00:00:00Z", 100),
        chartPoint("2024-01-02T00:00:00Z", 101),
        chartPoint("2024-01-03T00:00:00Z", 102),
        chartPoint("2024-01-04T00:00:00Z", 101),
        chartPoint("2024-01-05T00:00:00Z", 103),
        chartPoint("2024-01-06T00:00:00Z", 102)
    ));
    when(finnhubClient.historicalCandles("TLT", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS)).thenReturn(List.of(
        chartPoint("2024-01-01T00:00:00Z", 200),
        chartPoint("2024-01-02T00:00:00Z", 198),
        chartPoint("2024-01-03T00:00:00Z", 199),
        chartPoint("2024-01-04T00:00:00Z", 202),
        chartPoint("2024-01-05T00:00:00Z", 201),
        chartPoint("2024-01-06T00:00:00Z", 199)
    ));

    var series = service.indicatorHistory("correlation", com.jarmak.stockmarketanalyzer.market.HistoryRange.TEN_YEARS);

    assertThat(series.id()).isEqualTo("correlation");
    assertThat(series.range()).isEqualTo("10y");
    assertThat(series.points()).isNotEmpty();
    assertThat(series.points().get(0).timestamp()).isEqualTo(java.time.Instant.parse("2024-01-03T00:00:00Z"));
  }

  @Test
  void loadsHistoryBackedBreadthSymbolsConcurrently() {
    FinnhubClient concurrentFinnhubClient = mock(FinnhubClient.class);
    MarketIndicatorService concurrentService = new MarketIndicatorService(
        properties(List.of("SPY", "QQQ"), List.of("SPY", "TLT")),
        fredClient,
        concurrentFinnhubClient
    );
    AtomicInteger activeCalls = new AtomicInteger();
    AtomicInteger maxActiveCalls = new AtomicInteger();
    when(concurrentFinnhubClient.historicalCandles(anyString(), eq(HistoryRange.TEN_YEARS))).thenAnswer(invocation -> {
      int active = activeCalls.incrementAndGet();
      maxActiveCalls.accumulateAndGet(active, Math::max);
      try {
        Thread.sleep(150);
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
      } finally {
        activeCalls.decrementAndGet();
      }
      return List.of(
          chartPoint("2024-01-01T00:00:00Z", 100),
          chartPoint("2024-01-02T00:00:00Z", 101),
          chartPoint("2024-01-03T00:00:00Z", 102)
      );
    });

    var series = concurrentService.indicatorHistory("breadth", HistoryRange.TEN_YEARS);

    assertThat(series.points()).hasSize(2);
    assertThat(maxActiveCalls.get()).isGreaterThan(1);
    verify(concurrentFinnhubClient).historicalCandles("SPY", HistoryRange.TEN_YEARS);
    verify(concurrentFinnhubClient).historicalCandles("QQQ", HistoryRange.TEN_YEARS);
  }

  private static MarketModels.ChartPoint chartPoint(String timestamp, double value) {
    return new MarketModels.ChartPoint(java.time.Instant.parse(timestamp), BigDecimal.valueOf(value));
  }

  private static AppProperties properties(List<String> breadthSymbols, List<String> crossAssetSymbols) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            "finnhub",
            null,
            null,
            null,
            null,
            breadthSymbols,
            crossAssetSymbols,
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

  @Configuration
  @EnableCaching
  static class TestConfig {
    @Bean
    MarketIndicatorService marketIndicatorService(AppProperties properties, FredClient fredClient, FinnhubClient finnhubClient) {
      return new MarketIndicatorService(properties, fredClient, finnhubClient);
    }

    @Bean
    AppProperties properties() {
      return MarketIndicatorServiceTest.properties(List.of("SPY"), List.of("SPY", "TLT"));
    }

    @Bean
    FredClient fredClient() {
      return mock(FredClient.class);
    }

    @Bean
    FinnhubClient finnhubClient() {
      return mock(FinnhubClient.class);
    }

    @Bean
    CacheManager cacheManager() {
      CaffeineCacheManager cacheManager = new CaffeineCacheManager("marketIndicators");
      cacheManager.setCaffeine(Caffeine.newBuilder()
          .expireAfterWrite(Duration.ofHours(1))
          .maximumSize(16));
      return cacheManager;
    }
  }
}
