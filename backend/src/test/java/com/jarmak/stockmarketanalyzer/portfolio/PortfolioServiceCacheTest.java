package com.jarmak.stockmarketanalyzer.portfolio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.jarmak.stockmarketanalyzer.config.CacheConfig;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

@SpringJUnitConfig(PortfolioServiceCacheTest.TestConfig.class)
class PortfolioServiceCacheTest {
  @Autowired
  private PortfolioService portfolioService;

  @Autowired
  private DatabaseService databaseService;

  @Autowired
  private CacheManager cacheManager;

  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void upsertEvictsStockCacheUsingAuthenticatedUsername() throws Exception {
    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("alice", "password"));
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    when(databaseService.connection()).thenReturn(connection);
    when(connection.prepareStatement(any(String.class))).thenReturn(statement);
    mockInsertedId(statement);

    portfolioService.upsert("AAPL", "Apple Inc.", BigDecimal.ONE, BigDecimal.TEN);

    verify(statement).setString(1, "alice");
    verify(statement).setString(2, "AAPL");
    verify(statement).setString(eq(3), eq("Apple Inc."));
    verify(statement).executeQuery();
  }

  @Test
  void watchOnlyUpsertPersistsZeroQuantityAndAverageCost() throws Exception {
    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("alice", "password"));
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    when(databaseService.connection()).thenReturn(connection);
    when(connection.prepareStatement(any(String.class))).thenReturn(statement);
    mockInsertedId(statement);

    portfolioService.upsert("AAPL", "Apple Inc.", BigDecimal.valueOf(12), BigDecimal.valueOf(170.25), true);

    verify(statement).setBigDecimal(4, BigDecimal.ZERO);
    verify(statement).setBigDecimal(5, BigDecimal.ZERO);
    verify(statement).setBoolean(6, true);
    verify(statement).executeQuery();
  }

  @Test
  void watchOnlyUpsertEvictsStockCacheUsingAuthenticatedUsername() throws Exception {
    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("alice", "password"));
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    when(databaseService.connection()).thenReturn(connection);
    when(connection.prepareStatement(any(String.class))).thenReturn(statement);
    mockInsertedId(statement);
    Cache cache = cacheManager.getCache(CacheConfig.STOCK_ALERTS_CACHE);
    assertThat(cache).isNotNull();
    cache.put("alice", "cached-stocks");

    portfolioService.upsert("AAPL", "Apple Inc.", BigDecimal.valueOf(12), BigDecimal.valueOf(170.25), true);

    assertThat(cache.get("alice")).isNull();
  }

  private void mockInsertedId(PreparedStatement statement) throws Exception {
    ResultSet resultSet = mock(ResultSet.class);
    when(resultSet.next()).thenReturn(true);
    when(resultSet.getLong("id")).thenReturn(1L);
    when(statement.executeQuery()).thenReturn(resultSet);
  }

  @Configuration
  @EnableCaching
  static class TestConfig {
    @Bean
    PortfolioService portfolioService(DatabaseService databaseService) {
      return new PortfolioService(databaseService);
    }

    @Bean
    DatabaseService databaseService() {
      return mock(DatabaseService.class);
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
