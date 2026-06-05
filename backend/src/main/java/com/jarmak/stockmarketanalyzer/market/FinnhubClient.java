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
import java.time.temporal.ChronoUnit;
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
  private static final long SYMBOL_LIST_CACHE_SECONDS = 3600;
  private static final List<String> CRYPTO_EXCHANGES = List.of("binance", "coinbase");
  private static final List<String> FOREX_EXCHANGES = List.of("oanda", "fxcm");

  private final AppProperties properties;
  private final RestClient restClient;
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> searchCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<Optional<CompanySnapshot>>> snapshotCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<TimeSeriesPoint>>> closesCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> symbolListCache = new ConcurrentHashMap<>();

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
      AssetClass assetClass = assetClass(symbol);
      JsonNode quote = assetClass == AssetClass.STOCK
          ? query("/quote", Map.of("symbol", symbol))
          : nullNode();
      BigDecimal latestPrice = BigDecimal.valueOf(quote.path("c").asDouble(0));
      if (latestPrice.signum() <= 0) {
        latestPrice = latestClose(symbol);
      }
      if (latestPrice == null || latestPrice.signum() <= 0) {
        return Optional.empty();
      }
      BigDecimal previousClose = BigDecimal.valueOf(quote.path("pc").asDouble(0));
      if (previousClose.signum() <= 0) {
        previousClose = previousClose(symbol, latestPrice);
      }
      BigDecimal dailyHigh = positiveMetric(quote.path("h"));
      BigDecimal dailyLow = positiveMetric(quote.path("l"));

      JsonNode profile = assetClass == AssetClass.STOCK
          ? query("/stock/profile2", Map.of("symbol", symbol))
          : nullNode();
      String name = StringUtils.hasText(profile.path("name").asText("")) ? profile.path("name").asText() : symbol;
      String industry = assetClassLabel(assetClass, profile.path("finnhubIndustry").asText(""));
      BigDecimal marketCap = positiveMetric(profile.path("marketCapitalization"));
      if (marketCap != null) {
        marketCap = marketCap.multiply(BigDecimal.valueOf(MARKET_CAP_MILLION_MULTIPLIER));
      }
      JsonNode metrics = assetClass == AssetClass.STOCK
          ? query("/stock/metric", Map.of("symbol", symbol, "metric", "all")).path("metric")
          : nullNode();
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
          .filter(point -> point.value() > 0)
          .min(Comparator.comparingLong(point -> Math.abs(ChronoUnit.DAYS.between(point.date(), LocalDate.now(ZoneOffset.UTC).minusDays(30)))))
          .map(point -> BigDecimal.valueOf(point.value()))
          .orElse(previousClose);

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
      JsonNode candles = query(candlePath(symbol), Map.of(
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
      List<SymbolSearchResult> symbols = new ArrayList<>();
      JsonNode results = query("/search", Map.of("q", keywords)).path("result");
      if (results.isArray()) {
        for (JsonNode result : results) {
          symbols.add(new SymbolSearchResult(
              result.path("symbol").asText(),
              result.path("description").asText(),
              result.path("type").asText(),
              result.path("currency").asText()
          ));
        }
      }

      symbols.addAll(matchingSymbols("crypto", keywords));
      symbols.addAll(matchingSymbols("forex", keywords));

      return symbols.stream()
          .filter(result -> StringUtils.hasText(result.symbol()))
          .filter(result -> matchesSearch(result, keywords))
          .collect(java.util.stream.Collectors.toMap(
              result -> result.symbol().toUpperCase(),
              result -> result,
              (first, ignored) -> first,
              java.util.LinkedHashMap::new
          ))
          .values()
          .stream()
          .sorted(Comparator
              .comparing((SymbolSearchResult result) -> searchRank(result, keywords))
              .thenComparing(SymbolSearchResult::symbol))
          .limit(12)
          .toList();
    } catch (RuntimeException exception) {
      return List.of();
    }
  }

  private List<SymbolSearchResult> matchingSymbols(String type, String keywords) {
    return cached(symbolListCache, type, SYMBOL_LIST_CACHE_SECONDS, () -> fetchAssetSymbols(type)).stream()
        .filter(result -> matchesSearch(result, keywords))
        .toList();
  }

  private List<SymbolSearchResult> fetchAssetSymbols(String type) {
    List<String> exchanges = "crypto".equals(type) ? CRYPTO_EXCHANGES : FOREX_EXCHANGES;
    List<SymbolSearchResult> symbols = new ArrayList<>();
    for (String exchange : exchanges) {
      try {
        JsonNode results = query("/" + type + "/symbol", Map.of("exchange", exchange));
        if (!results.isArray()) {
          continue;
        }
        for (JsonNode result : results) {
          String symbol = result.path("symbol").asText();
          String displaySymbol = result.path("displaySymbol").asText(symbol);
          String description = result.path("description").asText(displaySymbol);
          symbols.add(new SymbolSearchResult(
              symbol,
              StringUtils.hasText(description) ? description : displaySymbol,
              "crypto".equals(type) ? "Crypto" : "Currency",
              currencyFromSymbol(displaySymbol, symbol)
          ));
        }
      } catch (RuntimeException ignored) {
        // Keep the other exchange/source results available if one provider endpoint fails.
      }
    }
    return symbols;
  }

  private boolean matchesSearch(SymbolSearchResult result, String keywords) {
    String query = keywords.trim().toLowerCase();
    String normalizedQuery = normalizeSearchText(query);
    String haystack = normalizeSearchText(result.symbol() + " " + result.name() + " " + result.region() + " " + result.currency());
    return haystack.contains(normalizedQuery);
  }

  private int searchRank(SymbolSearchResult result, String keywords) {
    String query = normalizeSearchText(keywords);
    String symbol = normalizeSearchText(result.symbol());
    String name = normalizeSearchText(result.name());

    if (symbol.equals(query)) {
      return 0;
    }
    if (symbol.startsWith(query)) {
      return 1;
    }
    if (name.startsWith(query)) {
      return 2;
    }
    if ("Common Stock".equalsIgnoreCase(result.region()) || "EQS".equalsIgnoreCase(result.region())) {
      return 3;
    }
    return 4;
  }

  private String normalizeSearchText(String value) {
    return (value == null ? "" : value)
        .toLowerCase()
        .replaceAll("[^a-z0-9]+", "");
  }

  private String currencyFromSymbol(String displaySymbol, String symbol) {
    String candidate = StringUtils.hasText(displaySymbol) ? displaySymbol : symbol;
    int separator = Math.max(candidate.lastIndexOf('/'), Math.max(candidate.lastIndexOf('-'), candidate.lastIndexOf('_')));
    if (separator >= 0 && separator + 1 < candidate.length()) {
      return candidate.substring(separator + 1).toUpperCase();
    }

    if (candidate.length() >= 6) {
      return candidate.substring(candidate.length() - 3).toUpperCase();
    }
    return "";
  }

  private BigDecimal latestClose(String symbol) {
    List<TimeSeriesPoint> closes = dailyCloses(symbol);
    if (closes.isEmpty()) {
      return null;
    }
    return BigDecimal.valueOf(closes.get(closes.size() - 1).value());
  }

  private BigDecimal previousClose(String symbol, BigDecimal latestPrice) {
    List<TimeSeriesPoint> closes = dailyCloses(symbol);
    if (closes.size() < 2) {
      return latestPrice;
    }
    return BigDecimal.valueOf(closes.get(closes.size() - 2).value());
  }

  private String candlePath(String symbol) {
    return switch (assetClass(symbol)) {
      case CRYPTO -> "/crypto/candle";
      case FOREX -> "/forex/candle";
      case STOCK -> "/stock/candle";
    };
  }

  private AssetClass assetClass(String symbol) {
    String normalized = symbol == null ? "" : symbol.toUpperCase();
    if (normalized.contains(":")) {
      String prefix = normalized.substring(0, normalized.indexOf(':'));
      if (List.of("BINANCE", "COINBASE", "KRAKEN", "BITFINEX", "KUCOIN", "HUOBI").contains(prefix)) {
        return AssetClass.CRYPTO;
      }
      return AssetClass.FOREX;
    }
    if (normalized.contains("_")) {
      return AssetClass.FOREX;
    }
    return AssetClass.STOCK;
  }

  private String assetClassLabel(AssetClass assetClass, String stockIndustry) {
    return switch (assetClass) {
      case CRYPTO -> "Crypto";
      case FOREX -> "Currency";
      case STOCK -> stockIndustry == null ? "" : stockIndustry;
    };
  }

  private JsonNode nullNode() {
    return com.fasterxml.jackson.databind.node.NullNode.getInstance();
  }

  private enum AssetClass {
    STOCK,
    CRYPTO,
    FOREX
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
