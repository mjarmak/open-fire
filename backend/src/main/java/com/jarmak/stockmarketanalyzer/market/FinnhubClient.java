package com.jarmak.stockmarketanalyzer.market;

import com.fasterxml.jackson.databind.JsonNode;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class FinnhubClient {
  private static final long MARKET_CAP_MILLION_MULTIPLIER = 1_000_000L;
  private static final long SEARCH_CACHE_SECONDS = 600;
  private static final long SNAPSHOT_CACHE_SECONDS = 300;
  private static final long CLOSES_CACHE_SECONDS = 900;

  private final AppProperties properties;
  private final RestClient restClient;
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> searchCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<Optional<CompanySnapshot>>> snapshotCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<TimeSeriesPoint>>> closesCache = new ConcurrentHashMap<>();

  public FinnhubClient(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public Optional<CompanySnapshot> companySnapshot(String symbol) {
    if (!configured() || !StringUtils.hasText(symbol)) {
      return Optional.empty();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    return cached(snapshotCache, normalizedSymbol, SNAPSHOT_CACHE_SECONDS, () -> fetchCompanySnapshot(normalizedSymbol));
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    if (!configured() || !StringUtils.hasText(symbol)) {
      return List.of();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    return cached(closesCache, normalizedSymbol, CLOSES_CACHE_SECONDS, () -> fetchDailyCloses(normalizedSymbol));
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    if (!configured() || !StringUtils.hasText(keywords)) {
      return List.of();
    }

    String query = keywords.trim().toLowerCase();
    return cached(searchCache, query, SEARCH_CACHE_SECONDS, () -> fetchSymbols(query));
  }

  public Optional<SymbolSearchResult> findExactSymbol(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return Optional.empty();
    }

    return searchSymbols(symbol).stream()
        .filter(result -> symbol.equalsIgnoreCase(result.symbol()))
        .findFirst();
  }

  private Optional<CompanySnapshot> fetchCompanySnapshot(String symbol) {
    try {
      JsonNode quote = query("/quote", Map.of("symbol", symbol));
      BigDecimal latestPrice = BigDecimal.valueOf(quote.path("c").asDouble(0));
      if (latestPrice.signum() <= 0) {
        return Optional.empty();
      }
      BigDecimal previousClose = BigDecimal.valueOf(quote.path("pc").asDouble(0));
      if (previousClose.signum() <= 0) {
        previousClose = latestPrice;
      }
      BigDecimal dailyHigh = positiveMetric(quote.path("h"));
      BigDecimal dailyLow = positiveMetric(quote.path("l"));

      JsonNode profile = query("/stock/profile2", Map.of("symbol", symbol));
      String name = profile.path("name").asText(symbol);
      String industry = profile.path("finnhubIndustry").asText("");
      BigDecimal marketCap = BigDecimal.valueOf(profile.path("marketCapitalization").asDouble(0))
          .multiply(BigDecimal.valueOf(MARKET_CAP_MILLION_MULTIPLIER));
      JsonNode metrics = query("/stock/metric", Map.of("symbol", symbol, "metric", "all")).path("metric");
      BigDecimal peRatio = positiveMetric(metrics.path("peBasicExclExtraTTM"));
      BigDecimal beta = decimalMetric(metrics.path("beta"));
      BigDecimal fiftyTwoWeekHigh = positiveMetric(metrics.path("52WeekHigh"));
      List<TimeSeriesPoint> closes = dailyCloses(symbol);
      BigDecimal realizedVolatilityPercent = MarketRiskMetrics.realizedVolatilityPercent(closes);
      if (realizedVolatilityPercent == null) {
        realizedVolatilityPercent = MarketRiskMetrics.quoteVolatilityPercent(latestPrice, previousClose, dailyHigh, dailyLow);
      }
      BigDecimal drawdownPercent = MarketRiskMetrics.drawdownPercent(closes, latestPrice, LocalDate.now(ZoneOffset.UTC));
      if (drawdownPercent == null) {
        drawdownPercent = MarketRiskMetrics.drawdownFromHigh(latestPrice, fiftyTwoWeekHigh);
      }
      if (drawdownPercent == null) {
        drawdownPercent = MarketRiskMetrics.drawdownFromHigh(latestPrice, dailyHigh);
      }
      BigDecimal priceThirtyDaysAgo = closes.stream()
          .filter(point -> !point.date().isAfter(LocalDate.now(ZoneOffset.UTC).minusDays(30)))
          .reduce((previous, current) -> current)
          .map(point -> BigDecimal.valueOf(point.value()))
          .orElse(latestPrice);

      return Optional.of(new CompanySnapshot(
          symbol,
          name,
          industry,
          marketCap,
          peRatio,
          beta,
          realizedVolatilityPercent,
          drawdownPercent,
          latestPrice,
          previousClose,
          priceThirtyDaysAgo
      ));
    } catch (RuntimeException exception) {
      return Optional.empty();
    }
  }

  private BigDecimal positiveMetric(JsonNode node) {
    BigDecimal value = BigDecimal.valueOf(node.asDouble(0));
    return value.signum() > 0 ? value : null;
  }

  private BigDecimal decimalMetric(JsonNode node) {
    double value = node.asDouble(Double.NaN);
    return Double.isFinite(value) ? BigDecimal.valueOf(value) : null;
  }

  private List<TimeSeriesPoint> fetchDailyCloses(String symbol) {
    try {
      long to = Instant.now().getEpochSecond();
      long from = Instant.now().minusSeconds(90L * 24 * 60 * 60).getEpochSecond();
      JsonNode candles = query("/stock/candle", Map.of(
          "symbol", symbol,
          "resolution", "D",
          "from", Long.toString(from),
          "to", Long.toString(to)
      ));

      if (!"ok".equalsIgnoreCase(candles.path("s").asText()) || !candles.path("c").isArray() || !candles.path("t").isArray()) {
        return List.of();
      }

      List<TimeSeriesPoint> points = new ArrayList<>();
      JsonNode closes = candles.path("c");
      JsonNode timestamps = candles.path("t");
      int size = Math.min(closes.size(), timestamps.size());
      for (int i = 0; i < size; i++) {
        points.add(new TimeSeriesPoint(
            Instant.ofEpochSecond(timestamps.get(i).asLong()).atZone(ZoneOffset.UTC).toLocalDate(),
            closes.get(i).asDouble()
        ));
      }

      return points.stream().sorted(Comparator.comparing(TimeSeriesPoint::date)).toList();
    } catch (RuntimeException exception) {
      return List.of();
    }
  }

  private List<SymbolSearchResult> fetchSymbols(String keywords) {
    try {
      JsonNode results = query("/search", Map.of("q", keywords)).path("result");
      if (!results.isArray()) {
        return List.of();
      }

      List<SymbolSearchResult> symbols = new ArrayList<>();
      for (JsonNode result : results) {
        symbols.add(new SymbolSearchResult(
            result.path("symbol").asText(),
            result.path("description").asText(),
            result.path("type").asText(),
            result.path("currency").asText()
        ));
      }

      return symbols.stream()
          .filter(result -> StringUtils.hasText(result.symbol()))
          .filter(result -> !result.symbol().contains("."))
          .limit(8)
          .toList();
    } catch (RuntimeException exception) {
      return List.of();
    }
  }

  private JsonNode query(String path, Map<String, String> params) {
    return restClient.get()
        .uri(uriBuilder -> {
          var builder = uriBuilder
              .scheme("https")
              .host("finnhub.io")
              .path("/api/v1")
              .path(path);
          params.forEach((key, value) -> builder.queryParam(key, value));
          builder.queryParam("token", properties.market().finnhubApiKey());
          return builder.build();
        })
        .retrieve()
        .body(JsonNode.class);
  }

  private boolean configured() {
    return StringUtils.hasText(properties.market().finnhubApiKey());
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
