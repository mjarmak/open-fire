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
public class EodHistoricalDataApiService {
  private static final Logger LOGGER = LoggerFactory.getLogger(EodHistoricalDataApiService.class);
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

  public EodHistoricalDataApiService(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public boolean configured() {
    return StringUtils.hasText(properties.market().eodHistoricalDataApiKey());
  }

  public Optional<MarketSnapshotCandidate> companySnapshot(String symbol) {
    return cached(snapshotCache, "eodhd|" + symbol, SNAPSHOT_CACHE_SECONDS, () -> snapshot(symbol, true), Optional.empty());
  }

  public Optional<MarketSnapshotCandidate> companyPriceSnapshot(String symbol) {
    return cached(snapshotCache, "eodhd-price|" + symbol, SNAPSHOT_CACHE_SECONDS, () -> snapshot(symbol, false), Optional.empty());
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    return cached(closesCache, "eodhd|" + symbol, CLOSES_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }
      String providerSymbol = providerSymbol(symbol);
      if (!StringUtils.hasText(providerSymbol)) {
        return List.of();
      }

      LocalDate endDate = LocalDate.now(ZoneOffset.UTC);
      LocalDate startDate = endDate.minusDays(90);
      JsonNode response = query("eod", providerSymbol, Map.of(
          "from", startDate.format(DateTimeFormatter.ISO_DATE),
          "to", endDate.format(DateTimeFormatter.ISO_DATE),
          "period", "d",
          "order", "a"
      ));
      List<TimeSeriesPoint> points = parseChartPoints(response, HistoryRange.ALL).stream()
          .map(point -> new TimeSeriesPoint(LocalDateTime.ofInstant(point.timestamp(), ZoneOffset.UTC).toLocalDate(), point.value().doubleValue()))
          .sorted(Comparator.comparing(TimeSeriesPoint::date))
          .toList();
      return logListResult("daily closes", symbol, points);
    }, List.of());
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    return cached(searchCache, "eodhd|" + MarketApiUtils.normalizeSearchText(keywords), SEARCH_PROVIDER_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }
      JsonNode response = query("search", keywords, Map.of());
      JsonNode results = arrayNode(response);
      List<SymbolSearchResult> symbols = new ArrayList<>();
      if (results != null && results.isArray()) {
        for (JsonNode result : results) {
          String symbol = firstText(result, "Code", "code", "Symbol", "symbol");
          symbols.add(new SymbolSearchResult(
              symbol,
              MarketApiUtils.resolveName(firstText(result, "Name", "name"), symbol),
              firstText(result, "Exchange", "exchange", "Type", "type"),
              firstText(result, "Currency", "currency")
          ));
        }
      }
      return logListResult("symbol search", keywords, symbols);
    }, List.of());
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    if (!configured()) {
      LOGGER.debug("Skipping EODHD history for {} {} because EODHD API key is not configured.", symbol, range.label());
      return List.of();
    }

    String providerSymbol = providerSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      LOGGER.debug("Skipping EODHD history for {} {} due to unsupported symbol format.", symbol, range.label());
      return List.of();
    }

    return cached(historyCache, "eodhd|" + symbol + "|" + range.label(), historyCacheSeconds(range), () -> {
      JsonNode response = query(historyEndpoint(range), providerSymbol, historyParams(range));
      if (response == null) {
        return null;
      }

      List<ChartPoint> points = parseChartPoints(response, range);
      if (points.isEmpty()) {
        LOGGER.debug("EODHD history returned no parsed points for {} {} (provider symbol {}).", symbol, range.label(), providerSymbol);
      } else {
        LOGGER.debug("EODHD history returned {} points for {} {} (provider symbol {}).", points.size(), symbol, range.label(), providerSymbol);
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

      JsonNode quote = query("real-time", providerSymbol, Map.of());
      BigDecimal latestPrice = firstPositiveMetric(quote, "close", "last", "price");
      if (latestPrice == null) {
        return Optional.empty();
      }
      BigDecimal previousClose = firstPositiveMetric(quote, "previousClose", "previous_close", "prev_close");
      if (previousClose == null) {
        previousClose = latestPrice;
      }

      JsonNode fundamentals = query("fundamentals", providerSymbol, Map.of());
      JsonNode general = fundamentals == null ? null : fundamentals.path("General");
      JsonNode highlights = fundamentals == null ? null : fundamentals.path("Highlights");
      JsonNode technicals = fundamentals == null ? null : fundamentals.path("Technicals");
      String name = MarketApiUtils.resolveName(
          firstText(general, "Name", "name"),
          MarketApiUtils.resolveName(firstText(quote, "name", "code"), symbol)
      );
      String industry = firstText(general, "Industry", "Sector");

      return logSnapshotResult(includeRiskFields ? "snapshot" : "price snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
          name,
          industry,
          firstPositiveMetric(highlights, "MarketCapitalization", "marketCapitalization"),
          includeRiskFields ? firstPositiveMetric(highlights, "PERatio", "peRatio") : null,
          includeRiskFields ? firstDecimalMetric(technicals, "Beta", "beta") : null,
          latestPrice,
          previousClose,
          firstPositiveMetric(quote, "high", "dayHigh"),
          firstPositiveMetric(quote, "low", "dayLow"),
          includeRiskFields ? firstPositiveMetric(technicals, "52WeekHigh", "fiftyTwoWeekHigh") : null
      )));
    } catch (RuntimeException exception) {
      return Optional.empty();
    }
  }

  private String providerSymbol(String symbol) {
    if (MarketApiUtils.assetClass(symbol) != MarketApiUtils.AssetClass.STOCK) {
      return "";
    }

    String normalized = symbol == null ? "" : symbol.trim().toUpperCase();
    if (!StringUtils.hasText(normalized)) {
      return "";
    }
    if (normalized.contains(".")) {
      return normalized;
    }
    return normalized + ".US";
  }

  private String historyEndpoint(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR, ONE_DAY -> "intraday";
      default -> "eod";
    };
  }

  private Map<String, String> historyParams(HistoryRange range) {
    Instant to = Instant.now();
    Instant from = range.allTime() ? Instant.EPOCH : to.minus(range.lookback());
    Map<String, String> params = new LinkedHashMap<>();
    if (range == HistoryRange.ONE_HOUR || range == HistoryRange.ONE_DAY) {
      params.put("interval", range == HistoryRange.ONE_HOUR ? "5m" : "1h");
      params.put("from", String.valueOf(from.getEpochSecond()));
      params.put("to", String.valueOf(to.getEpochSecond()));
      return params;
    }

    params.put("from", LocalDateTime.ofInstant(from, ZoneOffset.UTC).format(DateTimeFormatter.ISO_DATE));
    params.put("to", LocalDateTime.ofInstant(to, ZoneOffset.UTC).format(DateTimeFormatter.ISO_DATE));
    params.put("period", "d");
    params.put("order", "a");
    return params;
  }

  private List<ChartPoint> parseChartPoints(JsonNode response, HistoryRange range) {
    JsonNode values = arrayNode(response);
    if (values == null || !values.isArray()) {
      return List.of();
    }

    List<ChartPoint> points = new ArrayList<>();
    for (JsonNode value : values) {
      BigDecimal close = firstPositiveMetric(value, "close", "adjusted_close", "last_close", "price");
      Instant timestamp = MarketApiUtils.parseInstant(firstText(value, "datetime", "date", "timestamp"));
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

  private JsonNode query(String endpoint, String pathValue, Map<String, String> params) {
    if (!configured()) {
      return null;
    }

    try {
      return restClient.get()
          .uri(uriBuilder -> {
            var builder = uriBuilder
                .scheme("https")
                .host("eodhd.com")
                .pathSegment("api", endpoint, pathValue);
            params.forEach((key, value) -> builder.queryParam(key, value));
            builder.queryParam("api_token", properties.market().eodHistoricalDataApiKey());
            builder.queryParam("fmt", "json");
            return builder.build();
          })
          .retrieve()
          .body(JsonNode.class);
    } catch (HttpClientErrorException.TooManyRequests exception) {
      LOGGER.debug("EODHD request was rate limited for {} with params {}: {}", endpoint, params, exception.getMessage());
      return null;
    } catch (RuntimeException exception) {
      LOGGER.debug("EODHD request failed for {} with params {}: {}", endpoint, params, exception.getMessage());
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
    if (response.path("data").isArray()) {
      return response.path("data");
    }
    return response;
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
    result.ifPresent(ignored -> LOGGER.debug("EODHD {} found a result for {}.", operation, symbol));
    return result;
  }

  private <T> List<T> logListResult(String operation, String subject, List<T> results) {
    if (results != null && !results.isEmpty()) {
      LOGGER.debug("EODHD {} found {} result(s) for {}.", operation, results.size(), subject);
    }
    return results;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
