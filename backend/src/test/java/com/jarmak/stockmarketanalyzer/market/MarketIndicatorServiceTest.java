package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
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
    verify(finnhubClient, times(2)).dailyCloses("SPY");
    verify(finnhubClient, times(1)).dailyCloses("TLT");
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
      return new AppProperties(
          null,
          new AppProperties.Market(
              "fred",
              "finnhub",
              List.of("SPY"),
              List.of("SPY", "TLT"),
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
          null
      );
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
