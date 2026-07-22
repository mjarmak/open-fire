package com.jarmak.stockmarketanalyzer.market.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketApiProvider;
import com.jarmak.stockmarketanalyzer.market.MarketApiRequestContext;
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
public class TwelveDataApiService {
  private static final Logger LOGGER = LoggerFactory.getLogger(TwelveDataApiService.class);
  private static final String RATE_LIMIT_BACKOFF_KEY = "twelvedata-rate-limit";
  private static final long TWELVE_DATA_RATE_LIMIT_BACKOFF_SECONDS = 60;
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
  private final Map<String, CacheEntry<Boolean>> rateLimitBackoff = new ConcurrentHashMap<>();

  public TwelveDataApiService(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public boolean configured() {
    return StringUtils.hasText(apiKey());
  }

  public Optional<MarketSnapshotCandidate> companySnapshot(String symbol) {
    return cached(snapshotCache, cacheKey("twelvedata|" + symbol), SNAPSHOT_CACHE_SECONDS, () -> {
      if (!configured()) {
        return Optional.empty();
      }
      try {
        String providerSymbol = MarketApiUtils.toTwelveDataSymbol(symbol);
        if (!StringUtils.hasText(providerSymbol)) {
          return Optional.empty();
        }

        JsonNode quote = query("quote", Map.of("symbol", providerSymbol));
        JsonNode values = quote.path("values");
        if (!values.isArray() || values.isEmpty()) {
          return Optional.empty();
        }

        JsonNode latest = values.get(0);
        BigDecimal latestPrice = MarketApiUtils.positiveMetricFromText(latest.path("close"));
        if (latestPrice == null) {
          return Optional.empty();
        }
        BigDecimal previousClose = MarketApiUtils.positiveMetricFromText(latest.path("previous_close"));
        if (previousClose == null && values.size() > 1) {
          previousClose = MarketApiUtils.positiveMetricFromText(values.get(1).path("close"));
        }
        BigDecimal high = MarketApiUtils.positiveMetricFromText(latest.path("high"));
        BigDecimal low = MarketApiUtils.positiveMetricFromText(latest.path("low"));

        JsonNode overview = query("quote", Map.of("symbol", providerSymbol, "outputsize", "1"));
        String name = MarketApiUtils.resolveName(
            StringUtils.hasText(overview.path("name").asText()) ? overview.path("name").asText() : quote.path("name").asText(),
            symbol
        );
        return logSnapshotResult("snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
            name,
            MarketApiUtils.assetClassLabel(MarketApiUtils.assetClass(symbol), quote.path("exchange").asText("")),
            MarketApiUtils.positiveMetricFromText(overview.path("market_cap")),
            MarketApiUtils.positiveMetricFromText(overview.path("pe_ratio")),
            MarketApiUtils.decimalMetricFromText(overview.path("beta")),
            latestPrice,
            previousClose,
            high,
            low,
            MarketApiUtils.positiveMetricFromText(quote.path("fifty_two_week_high"))
        )));
      } catch (RuntimeException exception) {
        return Optional.empty();
      }
    });
  }

  public Optional<MarketSnapshotCandidate> companyPriceSnapshot(String symbol) {
    return cached(snapshotCache, cacheKey("twelvedata-price|" + symbol), SNAPSHOT_CACHE_SECONDS, () -> {
      if (!configured()) {
        return Optional.empty();
      }
      try {
        String providerSymbol = MarketApiUtils.toTwelveDataSymbol(symbol);
        if (!StringUtils.hasText(providerSymbol)) {
          return Optional.empty();
        }

        JsonNode quote = query("quote", Map.of("symbol", providerSymbol));
        JsonNode values = quote.path("values");
        JsonNode latest = values.isArray() && !values.isEmpty() ? values.get(0) : quote;
        BigDecimal latestPrice = MarketApiUtils.positiveMetricFromText(latest.path("close"));
        if (latestPrice == null) {
          latestPrice = MarketApiUtils.positiveMetricFromText(latest.path("price"));
        }
        if (latestPrice == null) {
          return Optional.empty();
        }

        BigDecimal previousClose = MarketApiUtils.positiveMetricFromText(latest.path("previous_close"));
        if (previousClose == null && values.isArray() && values.size() > 1) {
          previousClose = MarketApiUtils.positiveMetricFromText(values.get(1).path("close"));
        }
        if (previousClose == null) {
          previousClose = latestPrice;
        }
        BigDecimal high = MarketApiUtils.positiveMetricFromText(latest.path("high"));
        BigDecimal low = MarketApiUtils.positiveMetricFromText(latest.path("low"));

        JsonNode overview = query("quote", Map.of("symbol", providerSymbol, "outputsize", "1"));
        JsonNode details = overview == null ? quote : overview;
        String name = MarketApiUtils.resolveName(
            StringUtils.hasText(details.path("name").asText()) ? details.path("name").asText() : quote.path("name").asText(),
            symbol
        );
        return logSnapshotResult("price snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
            name,
            MarketApiUtils.assetClassLabel(MarketApiUtils.assetClass(symbol), quote.path("exchange").asText("")),
            MarketApiUtils.positiveMetricFromText(details.path("market_cap")),
            null,
            null,
            latestPrice,
            previousClose,
            high,
            low,
            null
        )));
      } catch (RuntimeException exception) {
        return Optional.empty();
      }
    });
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    return cached(closesCache, cacheKey("symbol:" + symbol), CLOSES_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }

      String providerSymbol = MarketApiUtils.toTwelveDataSymbol(symbol);
      if (!StringUtils.hasText(providerSymbol)) {
        return List.of();
      }

      try {
        JsonNode response = query("time_series", Map.of(
            "symbol", providerSymbol,
            "interval", "1day",
            "outputsize", "90"
        ));
        JsonNode values = response.path("values");
        if (!values.isArray()) {
          return List.of();
        }

        List<TimeSeriesPoint> points = new ArrayList<>();
        for (JsonNode value : values) {
          BigDecimal close = MarketApiUtils.positiveMetricFromText(value.path("close"));
          LocalDate date = MarketApiUtils.parseDate(value.path("datetime").asText());
          if (close == null || date == null) {
            continue;
          }
          points.add(new TimeSeriesPoint(date, close.doubleValue()));
        }
        return logListResult("daily closes", symbol, points.stream().sorted(Comparator.comparing(TimeSeriesPoint::date)).toList());
      } catch (RuntimeException exception) {
        return List.of();
      }
    });
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    return cached(searchCache, cacheKey("twelvedata|" + MarketApiUtils.normalizeSearchText(keywords)), SEARCH_PROVIDER_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }

      JsonNode response = query("symbol_search", Map.of("symbol", keywords));
      JsonNode results = response.path("data");
      if (!results.isArray()) {
        results = response.path("symbols");
      }

      List<SymbolSearchResult> symbols = new ArrayList<>();
      if (results.isArray()) {
        for (JsonNode result : results) {
          symbols.add(new SymbolSearchResult(
              result.path("symbol").asText(),
              MarketApiUtils.resolveName(result.path("instrument_name").asText(), result.path("name").asText()),
              result.path("type").asText(),
              result.path("currency").asText()
          ));
        }
      }
      return logListResult("symbol search", keywords, symbols);
    });
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    if (!configured()) {
      LOGGER.debug("Skipping Twelve Data history for {} {} because Twelve Data API key is not configured.", symbol, range.label());
      return List.of();
    }
    if (rateLimited()) {
      LOGGER.debug("Skipping Twelve Data history for {} {} due to recent rate limiting.", symbol, range.label());
      return List.of();
    }
    String providerSymbol = MarketApiUtils.toTwelveDataSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      LOGGER.debug("Skipping Twelve Data history for {} {} due to unsupported symbol format.", symbol, range.label());
      return List.of();
    }

    try {
      long toMillis = Instant.now().toEpochMilli();
      Instant fromDate = range.allTime() ? Instant.EPOCH : Instant.now().minus(range.lookback());
      return cached(historyCache, cacheKey("twelvedata|" + symbol + "|" + range.label()), historyCacheSeconds(range), () -> {
        JsonNode response = query("time_series", Map.of(
            "symbol", providerSymbol,
            "interval", twelvedataHistoryInterval(range),
            "start_date", LocalDateTime.ofInstant(fromDate, ZoneOffset.UTC).format(DateTimeFormatter.ISO_DATE),
            "end_date", LocalDateTime.ofInstant(Instant.ofEpochMilli(toMillis), ZoneOffset.UTC).format(DateTimeFormatter.ISO_DATE),
            "outputsize", twelvedataHistoryOutputSize(range)
        ));
        if (response == null) {
          return null;
        }
        JsonNode values = response.path("values");
        if (!values.isArray()) {
          LOGGER.debug(
              "Twelve Data history returned no values array for {} {} (provider symbol {}).",
              symbol,
              range.label(),
              providerSymbol
          );
          return List.of();
        }

        List<ChartPoint> points = new ArrayList<>();
        for (JsonNode value : values) {
          BigDecimal close = MarketApiUtils.positiveMetricFromText(value.path("close"));
          Instant timestamp = MarketApiUtils.parseInstant(value.path("datetime").asText());
          if (close == null || timestamp == null) {
            continue;
          }
          points.add(new ChartPoint(timestamp, close));
        }

        List<ChartPoint> sorted = points.stream()
            .sorted(Comparator.comparing(ChartPoint::timestamp))
            .toList();
        if (sorted.isEmpty()) {
          LOGGER.debug("Twelve Data history returned no parsed points for {} {} (provider symbol {}).", symbol, range.label(), providerSymbol);
        } else {
          LOGGER.debug("Twelve Data history returned {} points for {} {} (provider symbol {}).", sorted.size(), symbol, range.label(), providerSymbol);
        }
        return sample(sorted, 260);
      });
    } catch (RuntimeException exception) {
      LOGGER.debug("Twelve Data history failed for {} {}: {}", symbol, range.label(), exception.getMessage());
      return List.of();
    }
  }

  private String twelvedataHistoryInterval(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "5min";
      case ONE_DAY -> "15min";
      case FIVE_DAYS -> "30min";
      case ONE_MONTH, ONE_YEAR, FIVE_YEARS, TEN_YEARS, ALL -> "1day";
    };
  }

  private String twelvedataHistoryOutputSize(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "120";
      case ONE_DAY -> "120";
      case FIVE_DAYS -> "300";
      case ONE_MONTH -> "60";
      case ONE_YEAR -> "400";
      case FIVE_YEARS -> "2000";
      case TEN_YEARS, ALL -> "5000";
    };
  }

  private long historyCacheSeconds(HistoryRange range) {
    if (range.allTime()) {
      return HISTORY_CACHE_SECONDS;
    }
    return range.lookback().compareTo(java.time.Duration.ofDays(1)) > 0
        ? HISTORY_CACHE_SECONDS
        : CLOSES_CACHE_SECONDS;
  }

  private JsonNode query(String function, Map<String, String> params) {
    if (!configured()) {
      return null;
    }
    if (rateLimited()) {
      LOGGER.debug("Skipping Twelve Data request for {} with params {} due to recent rate limiting.", function, params);
      return null;
    }

    try {
      return restClient.get()
          .uri(uriBuilder -> {
            var builder = uriBuilder
                .scheme("https")
                .host("api.twelvedata.com")
                .path("/")
                .path(function);
            params.forEach((key, value) -> builder.queryParam(key, value));
            builder.queryParam("apikey", apiKey());
            return builder.build();
          })
          .retrieve()
          .body(JsonNode.class);
    } catch (HttpClientErrorException.TooManyRequests exception) {
      rateLimitBackoff.put(
          RATE_LIMIT_BACKOFF_KEY,
          new CacheEntry<>(true, Instant.now().plusSeconds(TWELVE_DATA_RATE_LIMIT_BACKOFF_SECONDS))
      );
      LOGGER.debug(
          "Twelve Data request was rate limited for {} with params {}. Backing off requests for {} seconds: {}",
          function,
          params,
          TWELVE_DATA_RATE_LIMIT_BACKOFF_SECONDS,
          exception.getMessage()
      );
      return null;
    } catch (RuntimeException exception) {
      LOGGER.debug("Twelve Data request failed for {} with params {}: {}", function, params, exception.getMessage());
      return null;
    }
  }

  private String apiKey() {
    return MarketApiRequestContext.apiKey(MarketApiProvider.TWELVE_DATA, properties.market().twelveDataApiKey());
  }

  private String cacheKey(String key) {
    return MarketApiRequestContext.providerCacheSuffix(MarketApiProvider.TWELVE_DATA) + "|" + key;
  }

  private <T> T cached(Map<String, CacheEntry<T>> cache, String key, long ttlSeconds, java.util.function.Supplier<T> loader) {
    CacheEntry<T> existing = cache.get(key);
    if (existing != null && !existing.expired()) {
      return existing.value();
    }

    T value = loader.get();
    if (value == null) {
      return (T) List.of();
    }
    if (value instanceof Optional<?> optional && optional.isEmpty()) {
      return value;
    }
    cache.put(key, new CacheEntry<>(value, Instant.now().plusSeconds(ttlSeconds)));
    return value;
  }

  private boolean rateLimited() {
    CacheEntry<Boolean> rateLimited = rateLimitBackoff.get(RATE_LIMIT_BACKOFF_KEY);
    return rateLimited != null && !rateLimited.expired();
  }

  private List<ChartPoint> sample(List<ChartPoint> points, int maxPoints) {
    return MarketApiUtils.sample(points, maxPoints, ChartPoint::timestamp);
  }

  private Optional<MarketSnapshotCandidate> logSnapshotResult(
      String operation,
      String symbol,
      Optional<MarketSnapshotCandidate> result
  ) {
    result.ifPresent(ignored -> LOGGER.debug("Twelve Data {} found a result for {}.", operation, symbol));
    return result;
  }

  private <T> List<T> logListResult(String operation, String subject, List<T> results) {
    if (results != null && !results.isEmpty()) {
      LOGGER.debug("Twelve Data {} found {} result(s) for {}.", operation, results.size(), subject);
    }
    return results;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
