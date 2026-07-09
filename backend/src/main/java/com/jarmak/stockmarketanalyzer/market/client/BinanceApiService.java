package com.jarmak.stockmarketanalyzer.market.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketApiUtils;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import com.jarmak.stockmarketanalyzer.market.TimeSeriesPoint;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class BinanceApiService {
  private static final Logger LOGGER = LoggerFactory.getLogger(BinanceApiService.class);
  private static final long SYMBOL_LIST_CACHE_SECONDS = 3600;
  private static final long HISTORY_CACHE_SECONDS = 900;
  private static final String DEFAULT_QUOTE_ASSET = "USDT";

  private final RestClient restClient;
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> searchCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<ChartPoint>>> historyCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<TimeSeriesPoint>>> closesCache = new ConcurrentHashMap<>();

  public BinanceApiService(RestClient restClient) {
    this.restClient = restClient;
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    if (!StringUtils.hasText(keywords)) {
      return List.of();
    }

    String normalizedKeywords = MarketApiUtils.normalizeSearchText(keywords);
    return cached(searchCache, normalizedKeywords, SYMBOL_LIST_CACHE_SECONDS, () -> exchangeSymbols().stream()
        .filter(result -> matches(result, normalizedKeywords))
        .sorted(Comparator
            .comparing((SymbolSearchResult result) -> searchRank(result, normalizedKeywords))
            .thenComparing(SymbolSearchResult::symbol))
        .limit(12)
        .toList());
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    if (MarketApiUtils.assetClass(symbol) != MarketApiUtils.AssetClass.CRYPTO || range == null) {
      return List.of();
    }

    String providerSymbol = providerSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      return List.of();
    }

    return cached(historyCache, providerSymbol + "|" + range.label(), historyCacheSeconds(range), () -> {
      Instant end = Instant.now();
      Instant start = range.allTime() ? Instant.EPOCH : end.minus(range.lookback());
      List<ChartPoint> points = queryKlines(providerSymbol, interval(range), start, end, limit(range));
      return points.stream()
          .filter(point -> range.allTime() || !point.timestamp().isBefore(start))
          .sorted(Comparator.comparing(ChartPoint::timestamp))
          .toList();
    });
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    if (MarketApiUtils.assetClass(symbol) != MarketApiUtils.AssetClass.CRYPTO) {
      return List.of();
    }

    String providerSymbol = providerSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      return List.of();
    }

    return cached(closesCache, providerSymbol, HISTORY_CACHE_SECONDS, () -> {
      Instant end = Instant.now();
      Instant start = end.minus(java.time.Duration.ofDays(90));
      return queryKlines(providerSymbol, "1d", start, end, 1000).stream()
          .map(point -> new TimeSeriesPoint(LocalDateTime.ofInstant(point.timestamp(), ZoneOffset.UTC).toLocalDate(), point.value().doubleValue()))
          .sorted(Comparator.comparing(TimeSeriesPoint::date))
          .toList();
    });
  }

  public List<ChartPoint> dailyCandles(String symbol, LocalDate startDate, LocalDate endDate) {
    if (MarketApiUtils.assetClass(symbol) != MarketApiUtils.AssetClass.CRYPTO || startDate == null || endDate == null) {
      return List.of();
    }
    if (endDate.isBefore(startDate)) {
      return List.of();
    }

    String providerSymbol = providerSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      return List.of();
    }

    Instant start = startDate.atStartOfDay().toInstant(ZoneOffset.UTC);
    Instant end = endDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    long days = java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
    return queryKlines(providerSymbol, "1d", start, end, Math.toIntExact(Math.min(1000, Math.max(1, days))));
  }

  private List<SymbolSearchResult> exchangeSymbols() {
    try {
      JsonNode symbols = restClient.get()
          .uri(uriBuilder -> uriBuilder
              .scheme("https")
              .host("api.binance.com")
              .path("/api/v3/exchangeInfo")
              .queryParam("symbolStatus", "TRADING")
              .queryParam("showPermissionSets", "false")
              .build())
          .retrieve()
          .body(JsonNode.class)
          .path("symbols");

      if (!symbols.isArray()) {
        return List.of();
      }

      List<SymbolSearchResult> results = new ArrayList<>();
      for (JsonNode symbol : symbols) {
        if (!symbol.path("isSpotTradingAllowed").asBoolean(false)) {
          continue;
        }

        String providerSymbol = symbol.path("symbol").asText("");
        String baseAsset = symbol.path("baseAsset").asText("");
        String quoteAsset = symbol.path("quoteAsset").asText("");
        if (!StringUtils.hasText(providerSymbol) || !StringUtils.hasText(baseAsset) || !StringUtils.hasText(quoteAsset)) {
          continue;
        }

        String displaySymbol = baseAsset + "/" + quoteAsset;
        results.add(new SymbolSearchResult(
            "BINANCE:" + providerSymbol,
            MarketApiUtils.cryptoDescription("BINANCE:" + providerSymbol, displaySymbol, displaySymbol),
            "Crypto",
            quoteAsset
        ));
      }
      return logListResult(results);
    } catch (RuntimeException exception) {
      LOGGER.debug("Binance exchange info request failed: {}", exception.getMessage());
      return List.of();
    }
  }

  private List<ChartPoint> queryKlines(String providerSymbol, String interval, Instant start, Instant end, int limit) {
    try {
      JsonNode response = restClient.get()
          .uri(uriBuilder -> uriBuilder
              .scheme("https")
              .host("api.binance.com")
              .path("/api/v3/klines")
              .queryParam("symbol", providerSymbol)
              .queryParam("interval", interval)
              .queryParam("startTime", start.toEpochMilli())
              .queryParam("endTime", end.toEpochMilli())
              .queryParam("limit", limit)
              .build())
          .retrieve()
          .body(JsonNode.class);

      if (!response.isArray()) {
        return List.of();
      }

      List<ChartPoint> points = new ArrayList<>();
      for (JsonNode candle : response) {
        if (!candle.isArray() || candle.size() < 5) {
          continue;
        }
        BigDecimal close = MarketApiUtils.positiveMetricFromText(candle.get(4));
        if (close == null) {
          continue;
        }
        points.add(new ChartPoint(Instant.ofEpochMilli(candle.get(0).asLong()), close));
      }
      return points.stream().sorted(Comparator.comparing(ChartPoint::timestamp)).toList();
    } catch (RuntimeException exception) {
      LOGGER.debug("Binance kline request failed for {} {}: {}", providerSymbol, interval, exception.getMessage());
      return List.of();
    }
  }

  private boolean matches(SymbolSearchResult result, String normalizedKeywords) {
    String haystack = MarketApiUtils.normalizeSearchText(
        result.symbol() + " " + result.name() + " " + result.region() + " " + result.currency()
    );
    return haystack.contains(normalizedKeywords);
  }

  private int searchRank(SymbolSearchResult result, String normalizedKeywords) {
    String symbol = MarketApiUtils.normalizeSearchText(result.symbol());
    String name = MarketApiUtils.normalizeSearchText(result.name());
    String baseSymbol = MarketApiUtils.normalizeSearchText(
        MarketApiUtils.baseCryptoSymbol(result.symbol(), result.symbol())
    );

    if (baseSymbol.equals(normalizedKeywords)) {
      return 0;
    }
    if (symbol.endsWith(normalizedKeywords + DEFAULT_QUOTE_ASSET.toLowerCase())) {
      return 1;
    }
    if (symbol.contains(normalizedKeywords) && DEFAULT_QUOTE_ASSET.equalsIgnoreCase(result.currency())) {
      return 2;
    }
    if (name.startsWith(normalizedKeywords)) {
      return 3;
    }
    if (symbol.contains(normalizedKeywords)) {
      return 4;
    }
    return 5;
  }

  private String providerSymbol(String symbol) {
    String normalized = symbol == null ? "" : symbol.trim().toUpperCase();
    if (!StringUtils.hasText(normalized)) {
      return "";
    }
    if (normalized.contains(":")) {
      String exchange = normalized.substring(0, normalized.indexOf(':'));
      if (!"BINANCE".equals(exchange)) {
        return "";
      }
      normalized = normalized.substring(normalized.indexOf(':') + 1);
    }
    return normalized.replace("/", "").replace("-", "").replace("_", "");
  }

  private String interval(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "1m";
      case ONE_DAY -> "15m";
      case FIVE_DAYS -> "1h";
      case ONE_MONTH, ONE_YEAR -> "1d";
      case FIVE_YEARS, TEN_YEARS, ALL -> "1w";
    };
  }

  private int limit(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> 60;
      case ONE_DAY -> 96;
      case FIVE_DAYS -> 120;
      case ONE_MONTH -> 31;
      case ONE_YEAR -> 366;
      case FIVE_YEARS, TEN_YEARS, ALL -> 1000;
    };
  }

  private long historyCacheSeconds(HistoryRange range) {
    return range.lookback() != null && range.lookback().compareTo(java.time.Duration.ofDays(1)) <= 0
        ? HISTORY_CACHE_SECONDS
        : 86_400;
  }

  private List<SymbolSearchResult> logListResult(List<SymbolSearchResult> results) {
    if (!results.isEmpty()) {
      LOGGER.debug("Binance symbol search loaded {} crypto symbol(s).", results.size());
    }
    return results;
  }

  private <T> T cached(Map<String, CacheEntry<T>> cache, String key, long ttlSeconds, java.util.function.Supplier<T> loader) {
    CacheEntry<T> existing = cache.get(key);
    if (existing != null && !existing.expired()) {
      return existing.value();
    }

    T value = loader.get();
    cache.put(key, new CacheEntry<>(value, Instant.now().plusSeconds(ttlSeconds)));
    return value;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
