package com.jarmak.stockmarketanalyzer.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CacheConfig {
  public static final String MARKET_INDICATORS_CACHE = "marketIndicators";
  public static final String STOCK_ALERTS_CACHE = "stockAlerts";

  @Bean
  CacheManager cacheManager() {
    CaffeineCacheManager cacheManager = new CaffeineCacheManager(MARKET_INDICATORS_CACHE, STOCK_ALERTS_CACHE);
    cacheManager.registerCustomCache(MARKET_INDICATORS_CACHE, Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofHours(1))
        .maximumSize(16)
        .build());
    cacheManager.registerCustomCache(STOCK_ALERTS_CACHE, Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(5))
        .maximumSize(512)
        .build());
    return cacheManager;
  }
}
