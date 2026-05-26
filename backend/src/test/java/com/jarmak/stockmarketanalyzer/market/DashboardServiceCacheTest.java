package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.jarmak.stockmarketanalyzer.alerts.StockAlertService;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.config.CacheConfig;
import com.jarmak.stockmarketanalyzer.notification.TelegramNotificationService;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

@SpringJUnitConfig(DashboardServiceCacheTest.TestConfig.class)
class DashboardServiceCacheTest {
  @Autowired
  private DashboardService dashboardService;

  @Autowired
  private StockAlertService stockAlertService;

  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void cachesStocksByAuthenticatedUser() {
    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("alice", "password"));
    when(stockAlertService.evaluateWatchedStocks(null)).thenReturn(List.of());

    List<MarketModels.StockAlert> first = dashboardService.stocks();
    List<MarketModels.StockAlert> second = dashboardService.stocks();

    assertThat(second).isEqualTo(first);
    verify(stockAlertService, times(1)).evaluateWatchedStocks(null);

    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("bob", "password"));
    dashboardService.stocks();

    verify(stockAlertService, times(2)).evaluateWatchedStocks(null);
  }

  @Configuration
  @EnableCaching
  static class TestConfig {
    @Bean
    DashboardService dashboardService(
        AppProperties properties,
        MarketIndicatorService marketIndicatorService,
        StockAlertService stockAlertService,
        TelegramNotificationService telegramNotificationService,
        PortfolioService portfolioService,
        UserAccountService userAccountService
    ) {
      return new DashboardService(properties, marketIndicatorService, stockAlertService, telegramNotificationService, portfolioService, userAccountService);
    }

    @Bean
    AppProperties properties() {
      return mock(AppProperties.class);
    }

    @Bean
    MarketIndicatorService marketIndicatorService() {
      return mock(MarketIndicatorService.class);
    }

    @Bean
    StockAlertService stockAlertService() {
      return mock(StockAlertService.class);
    }

    @Bean
    TelegramNotificationService telegramNotificationService() {
      return mock(TelegramNotificationService.class);
    }

    @Bean
    PortfolioService portfolioService() {
      return mock(PortfolioService.class);
    }

    @Bean
    UserAccountService userAccountService() {
      return mock(UserAccountService.class);
    }

    @Bean
    CacheManager cacheManager() {
      CaffeineCacheManager cacheManager = new CaffeineCacheManager(CacheConfig.STOCK_ALERTS_CACHE);
      cacheManager.setCaffeine(Caffeine.newBuilder()
          .expireAfterWrite(Duration.ofMinutes(5))
          .maximumSize(512));
      return cacheManager;
    }
  }
}
