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
import org.springframework.web.client.RestClient;

@Component
public class AlphaVantageApiService {
  private static final Logger LOGGER = LoggerFactory.getLogger(AlphaVantageApiService.class);
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

  public AlphaVantageApiService(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public boolean configured() {
    return StringUtils.hasText(apiKey());
  }

  public Optional<MarketSnapshotCandidate> companySnapshot(String symbol) {
    return cached(snapshotCache, cacheKey("alphavantage|" + symbol), SNAPSHOT_CACHE_SECONDS, () -> {
      if (!configured()) {
        return Optional.empty();
      }
      try {
        String providerSymbol = MarketApiUtils.toAlphaVantageSymbol(symbol);
        if (!StringUtils.hasText(providerSymbol)) {
          return Optional.empty();
        }

        JsonNode quote = query("GLOBAL_QUOTE", Map.of("symbol", providerSymbol));
        JsonNode globalQuote = quote.path("Global Quote");
        BigDecimal latestPrice = MarketApiUtils.positiveMetricFromText(globalQuote.path("05. price"));
        if (latestPrice == null) {
          return Optional.empty();
        }
        BigDecimal previousClose = MarketApiUtils.positiveMetricFromText(globalQuote.path("08. previous close"));
        if (previousClose == null) {
          previousClose = latestPrice;
        }
        BigDecimal high = MarketApiUtils.positiveMetricFromText(globalQuote.path("03. high"));
        BigDecimal low = MarketApiUtils.positiveMetricFromText(globalQuote.path("04. low"));
        JsonNode overview = query("OVERVIEW", Map.of("symbol", providerSymbol));
        String name = MarketApiUtils.resolveName(overview.path("Name").asText(), quote.path("01. symbol").asText());
        return logSnapshotResult("snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
            MarketApiUtils.resolveName(name, symbol),
            overview.path("Industry").asText(""),
            MarketApiUtils.decimalMetricFromText(overview.path("MarketCapitalization")),
            MarketApiUtils.positiveMetricFromText(overview.path("PERatio")),
            MarketApiUtils.decimalMetricFromText(overview.path("Beta")),
            latestPrice,
            previousClose,
            high,
            low,
            MarketApiUtils.positiveMetricFromText(overview.path("52WeekHigh"))
        )));
      } catch (RuntimeException exception) {
        return Optional.empty();
      }
    });
  }

  public Optional<MarketSnapshotCandidate> companyPriceSnapshot(String symbol) {
    return cached(snapshotCache, cacheKey("alphavantage-price|" + symbol), SNAPSHOT_CACHE_SECONDS, () -> {
      if (!configured()) {
        return Optional.empty();
      }
      try {
        String providerSymbol = MarketApiUtils.toAlphaVantageSymbol(symbol);
        if (!StringUtils.hasText(providerSymbol)) {
          return Optional.empty();
        }

        JsonNode quote = query("GLOBAL_QUOTE", Map.of("symbol", providerSymbol));
        JsonNode globalQuote = quote.path("Global Quote");
        BigDecimal latestPrice = MarketApiUtils.positiveMetricFromText(globalQuote.path("05. price"));
        if (latestPrice == null) {
          return Optional.empty();
        }
        BigDecimal previousClose = MarketApiUtils.positiveMetricFromText(globalQuote.path("08. previous close"));
        if (previousClose == null) {
          previousClose = latestPrice;
        }
        BigDecimal high = MarketApiUtils.positiveMetricFromText(globalQuote.path("03. high"));
        BigDecimal low = MarketApiUtils.positiveMetricFromText(globalQuote.path("04. low"));

        JsonNode overview = query("OVERVIEW", Map.of("symbol", providerSymbol));
        String name = MarketApiUtils.resolveName(globalQuote.path("01. symbol").asText(), symbol);
        String industry = "";
        BigDecimal marketCap = null;
        if (overview != null) {
          name = MarketApiUtils.resolveName(overview.path("Name").asText(), name);
          industry = overview.path("Industry").asText("");
          marketCap = MarketApiUtils.decimalMetricFromText(overview.path("MarketCapitalization"));
        }
        return logSnapshotResult("price snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
            MarketApiUtils.resolveName(name, symbol),
            industry,
            marketCap,
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
      String providerSymbol = MarketApiUtils.toAlphaVantageSymbol(symbol);
      if (!StringUtils.hasText(providerSymbol)) {
        return List.of();
      }

      try {
        JsonNode response = query("TIME_SERIES_DAILY", Map.of(
            "symbol", providerSymbol,
            "outputsize", "compact"
        ));
        JsonNode series = response.path("Time Series (Daily)");
        if (!series.isObject()) {
          return List.of();
        }

        List<TimeSeriesPoint> points = new ArrayList<>();
        series.fields().forEachRemaining(entry -> {
          LocalDate date = MarketApiUtils.parseDate(entry.getKey());
          BigDecimal close = MarketApiUtils.positiveMetricFromText(entry.getValue().path("4. close"));
          if (date == null || close == null) {
            return;
          }
          points.add(new TimeSeriesPoint(date, close.doubleValue()));
        });
        return logListResult("daily closes", symbol, points.stream().sorted(Comparator.comparing(TimeSeriesPoint::date)).toList());
      } catch (RuntimeException exception) {
        return List.of();
      }
    });
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    return cached(searchCache, cacheKey("alphavantage|" + MarketApiUtils.normalizeSearchText(keywords)), SEARCH_PROVIDER_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }
      JsonNode response = query("SYMBOL_SEARCH", Map.of("keywords", keywords));
      JsonNode matches = response.path("bestMatches");
      List<SymbolSearchResult> symbols = new ArrayList<>();
      if (matches.isArray()) {
        for (JsonNode match : matches) {
          symbols.add(new SymbolSearchResult(
              match.path("1. symbol").asText(),
              match.path("2. name").asText(),
              match.path("3. type").asText(),
              match.path("8. currency").asText()
          ));
        }
      }
      return logListResult("symbol search", keywords, symbols);
    });
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    if (!configured()) {
      LOGGER.debug("Skipping Alpha Vantage history for {} {} because Alpha Vantage API key is not configured.", symbol, range.label());
      return List.of();
    }
    String providerSymbol = MarketApiUtils.toAlphaVantageSymbol(symbol);
    if (!StringUtils.hasText(providerSymbol)) {
      LOGGER.debug("Skipping Alpha Vantage history for {} {} due to unsupported symbol format.", symbol, range.label());
      return List.of();
    }

    boolean intraday = range == HistoryRange.ONE_HOUR || range == HistoryRange.ONE_DAY;
    String defaultFunction = intraday ? "TIME_SERIES_INTRADAY" : "TIME_SERIES_DAILY";
    String defaultInterval = alphaVantageHistoryInterval(range);
    String outputSize = alphaVantageHistoryOutputSize(range);

    try {
      return cached(historyCache, cacheKey("alphavantage|" + symbol + "|" + range.label()), historyCacheSeconds(range), () -> {
        String function = defaultFunction;
        String interval = defaultInterval;
        JsonNode response = query(function, alphaVantageHistoryParams(providerSymbol, outputSize, interval));
        if (response == null) {
          return null;
        }
        JsonNode series = response.path(seriesKey(function, interval));
        if (!series.isObject() && intraday) {
          String providerMessage = alphaVantageProviderMessage(response);
          if (StringUtils.hasText(providerMessage)) {
            LOGGER.debug(
                "Alpha Vantage intraday history returned provider message for {} {}: {}",
                symbol,
                range.label(),
                providerMessage
            );
            return null;
          }
          LOGGER.debug(
              "Alpha Vantage intraday history unsupported for {} {}. Falling back to daily history.",
              symbol,
              range.label()
          );
          function = "TIME_SERIES_DAILY";
          response = query(function, Map.of(
              "symbol", providerSymbol,
              "outputsize", outputSize
          ));
          if (response == null) {
            return null;
          }
          interval = "";
          series = response.path(seriesKey(function, interval));
        }
        if (!series.isObject()) {
          String providerMessage = alphaVantageProviderMessage(response);
          if (StringUtils.hasText(providerMessage)) {
            LOGGER.debug(
                "Alpha Vantage history returned provider message for {} {} (provider symbol {}, function {}, interval {}): {}",
                symbol,
                range.label(),
                providerSymbol,
                function,
                interval,
                providerMessage
            );
            return null;
          }
          LOGGER.debug(
              "Alpha Vantage history returned unsupported payload for {} {} (provider symbol {}, function {}, interval {}).",
              symbol,
              range.label(),
              providerSymbol,
              function,
              interval
          );
          return List.<ChartPoint>of();
        }

        List<ChartPoint> points = new ArrayList<>();
        series.fields().forEachRemaining(entry -> {
          BigDecimal close = MarketApiUtils.positiveMetricFromText(entry.getValue().path("4. close"));
          if (close == null) {
            return;
          }
          Instant instant = MarketApiUtils.parseInstant(entry.getKey());
          if (instant == null) {
            return;
          }
          points.add(new ChartPoint(instant, close));
        });

        List<ChartPoint> filtered = points.stream()
            .filter(point -> !range.allTime() && point.timestamp().isAfter(Instant.now().minus(range.lookback()))
                || range.allTime())
            .sorted(Comparator.comparing(ChartPoint::timestamp))
            .toList();
        if (filtered.isEmpty()) {
          LOGGER.debug(
              "Alpha Vantage history parsed zero points for {} {} (provider symbol {}, function {}, interval {}).",
              symbol,
              range.label(),
              providerSymbol,
              function,
              interval
          );
        } else {
          LOGGER.debug(
              "Alpha Vantage history returned {} points for {} {} (provider symbol {}, function {}, interval {}).",
              filtered.size(),
              symbol,
              range.label(),
              providerSymbol,
              function,
              interval
          );
        }
        return sample(filtered, 260);
      });
    } catch (RuntimeException exception) {
      LOGGER.debug("Alpha Vantage history failed for {} {}: {}", symbol, range.label(), exception.getMessage());
      return List.of();
    }
  }

  private String alphaVantageHistoryInterval(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "5min";
      case ONE_DAY -> "30min";
      default -> "1day";
    };
  }

  private String alphaVantageHistoryOutputSize(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR, ONE_DAY, FIVE_DAYS, ONE_MONTH -> "compact";
      case ONE_YEAR, FIVE_YEARS, TEN_YEARS, ALL -> "full";
    };
  }

  private Map<String, String> alphaVantageHistoryParams(String providerSymbol, String outputSize, String interval) {
    if (StringUtils.hasText(interval) && !"1day".equals(interval)) {
      return Map.of(
          "symbol", providerSymbol,
          "interval", interval,
          "outputsize", outputSize
      );
    }

    return Map.of(
        "symbol", providerSymbol,
        "outputsize", outputSize
    );
  }

  private String seriesKey(String function, String interval) {
    if ("TIME_SERIES_DAILY".equals(function)) {
      return "Time Series (Daily)";
    }
    return "Time Series (%s)".formatted(interval);
  }

  private String alphaVantageProviderMessage(JsonNode response) {
    if (response == null) {
      return "";
    }
    for (String key : List.of("Error Message", "Note", "Information")) {
      String message = response.path(key).asText("");
      if (StringUtils.hasText(message)) {
        return message;
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

  private JsonNode query(String function, Map<String, String> params) {
    if (!configured()) {
      return null;
    }
    try {
      return restClient.get()
          .uri(uriBuilder -> {
            var builder = uriBuilder
                .scheme("https")
                .host("www.alphavantage.co")
                .path("/query")
                .queryParam("function", function);
            params.forEach((key, value) -> builder.queryParam(key, value));
            builder.queryParam("apikey", apiKey());
            return builder.build();
          })
          .retrieve()
          .body(JsonNode.class);
    } catch (RuntimeException exception) {
      LOGGER.debug("Alpha Vantage request failed for {} with params {}: {}", function, params, exception.getMessage());
      return null;
    }
  }

  private String apiKey() {
    return MarketApiRequestContext.apiKey(MarketApiProvider.ALPHA_VANTAGE, properties.market().alphaVantageApiKey());
  }

  private String cacheKey(String key) {
    return MarketApiRequestContext.providerCacheSuffix(MarketApiProvider.ALPHA_VANTAGE) + "|" + key;
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
    result.ifPresent(ignored -> LOGGER.debug("Alpha Vantage {} found a result for {}.", operation, symbol));
    return result;
  }

  private <T> List<T> logListResult(String operation, String subject, List<T> results) {
    if (results != null && !results.isEmpty()) {
      LOGGER.debug("Alpha Vantage {} found {} result(s) for {}.", operation, results.size(), subject);
    }
    return results;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
