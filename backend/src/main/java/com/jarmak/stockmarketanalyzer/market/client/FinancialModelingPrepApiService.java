package com.jarmak.stockmarketanalyzer.market.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketApiUtils;
import com.jarmak.stockmarketanalyzer.market.MarketSnapshotCandidate;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import com.jarmak.stockmarketanalyzer.market.TimeSeriesPoint;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

@Component
public class FinancialModelingPrepApiService {
  private static final Logger LOGGER = LoggerFactory.getLogger(FinancialModelingPrepApiService.class);
  private static final long SNAPSHOT_CACHE_SECONDS = 300;
  private static final long CLOSES_CACHE_SECONDS = 900;
  private static final long HISTORY_CACHE_SECONDS = 86_400;
  private static final long SEARCH_PROVIDER_CACHE_SECONDS = 60;

  private final AppProperties properties;
  private final RestClient restClient;
  private final Map<String, CacheEntry<Optional<MarketSnapshotCandidate>>> snapshotCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<TimeSeriesPoint>>> closesCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<ChartPoint>>> historyCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> searchCache = new ConcurrentHashMap<>();

  public FinancialModelingPrepApiService(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public boolean configured() {
    return StringUtils.hasText(properties.market().financialModelingPrepApiKey());
  }

  public Optional<MarketSnapshotCandidate> companySnapshot(String symbol) {
    return cached(snapshotCache, "fmp|" + symbol, SNAPSHOT_CACHE_SECONDS, () -> snapshot(symbol, true), Optional.empty());
  }

  public Optional<MarketSnapshotCandidate> companyPriceSnapshot(String symbol) {
    return cached(snapshotCache, "fmp-price|" + symbol, SNAPSHOT_CACHE_SECONDS, () -> snapshot(symbol, false), Optional.empty());
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    return cached(closesCache, "fmp|" + symbol, CLOSES_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }
      String providerSymbol = providerSymbol(symbol);
      if (!StringUtils.hasText(providerSymbol)) {
        return List.of();
      }

      LocalDate endDate = LocalDate.now(ZoneOffset.UTC);
      LocalDate startDate = endDate.minusDays(90);
      JsonNode response = query("historical-price-eod/full", Map.of(
          "symbol", providerSymbol,
          "from", startDate.format(DateTimeFormatter.ISO_DATE),
          "to", endDate.format(DateTimeFormatter.ISO_DATE)
      ));
      List<ChartPoint> chartPoints = parseChartPoints(response, HistoryRange.ALL);
      List<TimeSeriesPoint> points = chartPoints.stream()
          .map(point -> new TimeSeriesPoint(LocalDateTime.ofInstant(point.timestamp(), ZoneOffset.UTC).toLocalDate(), point.value().doubleValue()))
          .sorted(Comparator.comparing(TimeSeriesPoint::date))
          .toList();
      return logListResult("daily closes", symbol, points);
    }, List.of());
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    return cached(searchCache, "fmp|" + MarketApiUtils.normalizeSearchText(keywords), SEARCH_PROVIDER_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }
      JsonNode response = query("search-symbol", Map.of(
          "query", keywords,
          "limit", "12"
      ));
      JsonNode results = arrayNode(response);
      List<SymbolSearchResult> symbols = new ArrayList<>();
      if (results.isArray()) {
        for (JsonNode result : results) {
          symbols.add(new SymbolSearchResult(
              result.path("symbol").asText(),
              MarketApiUtils.resolveName(
                  firstText(result, "name", "companyName"),
                  result.path("symbol").asText()
              ),
              firstText(result, "exchangeShortName", "exchange", "stockExchange"),
              result.path("currency").asText()
          ));
        }
      }
      return logListResult("symbol search", keywords, symbols);
    }, List.of());
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    if (!configured()) {
      LOGGER.debug("Skipping Financial Modeling Prep history for {} {} because FMP API key is not configured.", symbol, range.label());
      return List.of();
    }

    String providerSymbol = providerSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      LOGGER.debug("Skipping Financial Modeling Prep history for {} {} due to unsupported symbol format.", symbol, range.label());
      return List.of();
    }

    return cached(historyCache, "fmp|" + symbol + "|" + range.label(), historyCacheSeconds(range), () -> {
      JsonNode response = query(historyEndpoint(range), historyParams(providerSymbol, range));
      if (response == null) {
        return null;
      }

      List<ChartPoint> points = parseChartPoints(response, range);
      if (points.isEmpty()) {
        LOGGER.debug("Financial Modeling Prep history returned no parsed points for {} {} (provider symbol {}).", symbol, range.label(), providerSymbol);
      } else {
        LOGGER.debug("Financial Modeling Prep history returned {} points for {} {} (provider symbol {}).", points.size(), symbol, range.label(), providerSymbol);
      }
      return sample(points, 260);
    }, List.of());
  }

  private Optional<MarketSnapshotCandidate> snapshot(String symbol, boolean includeRiskFields) {
    if (!configured()) {
      return Optional.empty();
    }

    try {
      String providerSymbol = providerSymbol(symbol);
      if (!StringUtils.hasText(providerSymbol)) {
        return Optional.empty();
      }

      JsonNode quote = firstObject(query("quote", Map.of("symbol", providerSymbol)));
      BigDecimal latestPrice = firstPositiveMetric(quote, "price", "close", "previousClose");
      if (latestPrice == null) {
        return Optional.empty();
      }
      BigDecimal previousClose = firstPositiveMetric(quote, "previousClose", "prevClose");
      if (previousClose == null) {
        previousClose = latestPrice;
      }

      JsonNode profile = firstObject(query("profile", Map.of("symbol", providerSymbol)));
      String name = MarketApiUtils.resolveName(
          firstText(profile, "companyName", "companyName", "name"),
          MarketApiUtils.resolveName(firstText(quote, "name"), symbol)
      );
      String industry = firstText(profile, "industry", "sector");
      BigDecimal marketCap = firstPositiveMetric(profile, "marketCap", "mktCap");
      if (marketCap == null) {
        marketCap = firstPositiveMetric(quote, "marketCap");
      }

      return logSnapshotResult(includeRiskFields ? "snapshot" : "price snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
          name,
          industry,
          marketCap,
          includeRiskFields ? firstPositiveMetric(quote, "pe", "peRatio") : null,
          includeRiskFields ? firstDecimalMetric(profile, "beta") : null,
          latestPrice,
          previousClose,
          firstPositiveMetric(quote, "dayHigh", "high"),
          firstPositiveMetric(quote, "dayLow", "low"),
          includeRiskFields ? firstPositiveMetric(quote, "yearHigh", "fiftyTwoWeekHigh") : null
      )));
    } catch (RuntimeException exception) {
      return Optional.empty();
    }
  }

  private String historyEndpoint(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "historical-chart/5min";
      case ONE_DAY -> "historical-chart/1hour";
      default -> "historical-price-eod/full";
    };
  }

  private Map<String, String> historyParams(String providerSymbol, HistoryRange range) {
    Instant to = Instant.now();
    Instant from = range.allTime() ? Instant.EPOCH : to.minus(range.lookback());
    LocalDate fromDate = LocalDateTime.ofInstant(from, ZoneOffset.UTC).toLocalDate();
    LocalDate toDate = LocalDateTime.ofInstant(to, ZoneOffset.UTC).toLocalDate();
    Map<String, String> params = new LinkedHashMap<>();
    params.put("symbol", providerSymbol);
    params.put("from", fromDate.format(DateTimeFormatter.ISO_DATE));
    params.put("to", toDate.format(DateTimeFormatter.ISO_DATE));
    return params;
  }

  private String providerSymbol(String symbol) {
    String normalized = symbol == null ? "" : symbol.trim().toUpperCase();
    if (!StringUtils.hasText(normalized)) {
      return "";
    }
    if (normalized.contains(":")) {
      normalized = normalized.substring(normalized.indexOf(':') + 1);
    }
    return normalized.replace("/", "").replace("_", "");
  }

  private List<ChartPoint> parseChartPoints(JsonNode response, HistoryRange range) {
    JsonNode values = arrayNode(response);
    if (values == null || !values.isArray()) {
      return List.of();
    }

    List<ChartPoint> points = new ArrayList<>();
    for (JsonNode value : values) {
      BigDecimal close = firstPositiveMetric(value, "close", "price", "adjClose", "adj_close");
      Instant timestamp = MarketApiUtils.parseInstant(firstText(value, "date", "datetime"));
      if (close == null || timestamp == null) {
        continue;
      }
      points.add(new ChartPoint(timestamp, close));
    }

    Instant cutoff = range.allTime() ? Instant.EPOCH : Instant.now().minus(range.lookback());
    return points.stream()
        .filter(point -> range.allTime() || !point.timestamp().isBefore(cutoff))
        .sorted(Comparator.comparing(ChartPoint::timestamp))
        .toList();
  }

  private JsonNode query(String path, Map<String, String> params) {
    if (!configured()) {
      return null;
    }

    try {
      return restClient.get()
          .uri(uriBuilder -> {
            var builder = uriBuilder
                .scheme("https")
                .host("financialmodelingprep.com")
                .path("/stable/")
                .path(path);
            params.forEach((key, value) -> builder.queryParam(key, value));
            builder.queryParam("apikey", properties.market().financialModelingPrepApiKey());
            return builder.build();
          })
          .retrieve()
          .body(JsonNode.class);
    } catch (HttpClientErrorException.TooManyRequests exception) {
      LOGGER.debug("Financial Modeling Prep request was rate limited for {} with params {}: {}", path, params, exception.getMessage());
      return null;
    } catch (RuntimeException exception) {
      LOGGER.debug("Financial Modeling Prep request failed for {} with params {}: {}", path, params, exception.getMessage());
      return null;
    }
  }

  private JsonNode arrayNode(JsonNode response) {
    if (response == null) {
      return null;
    }
    if (response.isArray()) {
      return response;
    }
    if (response.path("historical").isArray()) {
      return response.path("historical");
    }
    if (response.path("data").isArray()) {
      return response.path("data");
    }
    return response;
  }

  private JsonNode firstObject(JsonNode response) {
    JsonNode values = arrayNode(response);
    if (values != null && values.isArray() && !values.isEmpty()) {
      return values.get(0);
    }
    return values == null ? null : values;
  }

  private BigDecimal firstPositiveMetric(JsonNode node, String... fields) {
    if (node == null) {
      return null;
    }
    for (String field : fields) {
      BigDecimal value = node.path(field).isTextual()
          ? MarketApiUtils.positiveMetricFromText(node.path(field))
          : MarketApiUtils.positiveMetric(node.path(field));
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  private BigDecimal firstDecimalMetric(JsonNode node, String... fields) {
    if (node == null) {
      return null;
    }
    for (String field : fields) {
      BigDecimal value = node.path(field).isTextual()
          ? MarketApiUtils.decimalMetricFromText(node.path(field))
          : MarketApiUtils.decimalMetric(node.path(field));
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  private String firstText(JsonNode node, String... fields) {
    if (node == null) {
      return "";
    }
    for (String field : fields) {
      String value = node.path(field).asText("");
      if (StringUtils.hasText(value) && !"null".equalsIgnoreCase(value)) {
        return value;
      }
    }
    return "";
  }

  private long historyCacheSeconds(HistoryRange range) {
    if (range.allTime()) {
      return HISTORY_CACHE_SECONDS;
    }
    return range.lookback().compareTo(java.time.Duration.ofDays(1)) > 0
        ? HISTORY_CACHE_SECONDS
        : CLOSES_CACHE_SECONDS;
  }

  private <T> T cached(
      Map<String, CacheEntry<T>> cache,
      String key,
      long ttlSeconds,
      java.util.function.Supplier<T> loader,
      T emptyValue
  ) {
    CacheEntry<T> existing = cache.get(key);
    if (existing != null && !existing.expired()) {
      return existing.value();
    }

    T value = loader.get();
    if (value == null) {
      return emptyValue;
    }

    cache.put(key, new CacheEntry<>(value, Instant.now().plusSeconds(ttlSeconds)));
    return value;
  }

  private List<ChartPoint> sample(List<ChartPoint> points, int maxPoints) {
    return MarketApiUtils.sample(points, maxPoints, ChartPoint::timestamp);
  }

  private Optional<MarketSnapshotCandidate> logSnapshotResult(
      String operation,
      String symbol,
      Optional<MarketSnapshotCandidate> result
  ) {
    result.ifPresent(ignored -> LOGGER.debug("Financial Modeling Prep {} found a result for {}.", operation, symbol));
    return result;
  }

  private <T> List<T> logListResult(String operation, String subject, List<T> results) {
    if (results != null && !results.isEmpty()) {
      LOGGER.debug("Financial Modeling Prep {} found {} result(s) for {}.", operation, results.size(), subject);
    }
    return results;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
