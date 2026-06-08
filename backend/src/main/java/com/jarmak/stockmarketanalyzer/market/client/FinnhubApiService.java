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
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
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
public class FinnhubApiService {
  private static final Logger LOGGER = LoggerFactory.getLogger(FinnhubApiService.class);
  private static final long SEARCH_PROVIDER_CACHE_SECONDS = 60;
  private static final long SNAPSHOT_CACHE_SECONDS = 300;
  private static final long CLOSES_CACHE_SECONDS = 900;
  private static final long HISTORY_CACHE_SECONDS = 86_400;
  private static final long FINNHUB_HISTORY_ACCESS_BACKOFF_SECONDS = 3_600;
  private static final String FINNHUB_HISTORY_BACKOFF_KEY = "finnhub-history";
  private static final long MARKET_CAP_MILLION_MULTIPLIER = 1_000_000L;

  private final AppProperties properties;
  private final RestClient restClient;
  private final Map<String, CacheEntry<Optional<MarketSnapshotCandidate>>> snapshotCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<TimeSeriesPoint>>> dailyClosesCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<ChartPoint>>> historyCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> searchCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> symbolListCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<Boolean>> historyBackoff = new ConcurrentHashMap<>();

  public FinnhubApiService(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public boolean configured() {
    return StringUtils.hasText(properties.market().finnhubApiKey());
  }

  public Optional<MarketSnapshotCandidate> companySnapshot(String symbol) {
    return cached(snapshotCache, "finnhub|" + symbol, SNAPSHOT_CACHE_SECONDS, () -> {
      if (!configured()) {
        return Optional.empty();
      }

      try {
        MarketApiUtils.AssetClass assetClass = MarketApiUtils.assetClass(symbol);
        if (assetClass == MarketApiUtils.AssetClass.STOCK) {
          JsonNode quote = query("/quote", Map.of("symbol", symbol));
          BigDecimal latestPrice = MarketApiUtils.positiveMetric(quote.path("c"));
          if (latestPrice == null) {
            latestPrice = latestClose(symbol);
          }
          BigDecimal previousClose = MarketApiUtils.positiveMetric(quote.path("pc"));
          if (previousClose == null) {
            previousClose = previousClose(symbol, latestPrice);
          }
          BigDecimal dailyHigh = MarketApiUtils.positiveMetric(quote.path("h"));
          BigDecimal dailyLow = MarketApiUtils.positiveMetric(quote.path("l"));
          if (latestPrice == null || latestPrice.signum() <= 0) {
            return Optional.empty();
          }

          JsonNode profile = query("/stock/profile2", Map.of("symbol", symbol));
          JsonNode metrics = query("/stock/metric", Map.of("symbol", symbol, "metric", "all")).path("metric");

          BigDecimal marketCap = MarketApiUtils.positiveMetric(profile.path("marketCapitalization"));
          if (marketCap != null) {
            marketCap = marketCap.multiply(BigDecimal.valueOf(MARKET_CAP_MILLION_MULTIPLIER));
          }
          return logSnapshotResult("snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
              MarketApiUtils.resolveName(profile.path("name").asText(""), symbol),
              MarketApiUtils.assetClassLabel(assetClass, profile.path("finnhubIndustry").asText("")),
              marketCap,
              MarketApiUtils.positiveMetric(metrics.path("peBasicExclExtraTTM")),
              MarketApiUtils.decimalMetric(metrics.path("beta")),
              latestPrice,
              previousClose,
              dailyHigh,
              dailyLow,
              MarketApiUtils.positiveMetric(metrics.path("52WeekHigh"))
          )));
        }

        long to = Instant.now().getEpochSecond();
        long from = Instant.now().minus(Duration.ofDays(90)).getEpochSecond();
        JsonNode candles = query(candlePath(symbol), Map.of(
            "symbol", symbol,
            "resolution", "D",
            "from", Long.toString(from),
            "to", Long.toString(to)
        ));
        JsonNode closes = candles.path("c");
        JsonNode highs = candles.path("h");
        JsonNode lows = candles.path("l");
        if (!closes.isArray() || closes.isEmpty()) {
          return Optional.empty();
        }

        BigDecimal parsedLatest = null;
        BigDecimal parsedPreviousClose = null;
        BigDecimal parsedDailyHigh = null;
        BigDecimal parsedDailyLow = null;
        for (int i = closes.size() - 1; i >= 0; i--) {
          BigDecimal close = MarketApiUtils.positiveMetric(closes.get(i));
          if (close == null) {
            continue;
          }
          if (parsedLatest == null) {
            parsedLatest = close;
            parsedDailyHigh = highs.isArray() && i < highs.size() ? MarketApiUtils.positiveMetric(highs.get(i)) : null;
            parsedDailyLow = lows.isArray() && i < lows.size() ? MarketApiUtils.positiveMetric(lows.get(i)) : null;
            continue;
          }
          if (parsedPreviousClose == null) {
            parsedPreviousClose = close;
            break;
          }
        }

        if (parsedLatest == null || parsedLatest.signum() <= 0) {
          return Optional.empty();
        }
        if (parsedPreviousClose == null) {
          parsedPreviousClose = parsedLatest;
        }

        return logSnapshotResult("snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
            symbol,
            MarketApiUtils.assetClassLabel(assetClass, ""),
            null,
            null,
            null,
            parsedLatest,
            parsedPreviousClose,
            parsedDailyHigh,
            parsedDailyLow,
            null
        )));
      } catch (RuntimeException exception) {
        return Optional.empty();
      }
    });
  }

  public Optional<MarketSnapshotCandidate> companyPriceSnapshot(String symbol) {
    return cached(snapshotCache, "finnhub-price|" + symbol, SNAPSHOT_CACHE_SECONDS, () -> {
      if (!configured()) {
        return Optional.empty();
      }

      try {
        MarketApiUtils.AssetClass assetClass = MarketApiUtils.assetClass(symbol);
        JsonNode quote = query("/quote", Map.of("symbol", symbol));
        BigDecimal latestPrice = MarketApiUtils.positiveMetric(quote.path("c"));
        if (latestPrice == null || latestPrice.signum() <= 0) {
          return Optional.empty();
        }

        BigDecimal previousClose = MarketApiUtils.positiveMetric(quote.path("pc"));
        if (previousClose == null) {
          previousClose = latestPrice;
        }
        BigDecimal dailyHigh = MarketApiUtils.positiveMetric(quote.path("h"));
        BigDecimal dailyLow = MarketApiUtils.positiveMetric(quote.path("l"));

        String name = symbol;
        String industry = MarketApiUtils.assetClassLabel(assetClass, "");
        BigDecimal marketCap = null;
        if (assetClass == MarketApiUtils.AssetClass.STOCK) {
          try {
            JsonNode profile = query("/stock/profile2", Map.of("symbol", symbol));
            name = MarketApiUtils.resolveName(profile.path("name").asText(""), symbol);
            industry = MarketApiUtils.assetClassLabel(assetClass, profile.path("finnhubIndustry").asText(""));
            marketCap = MarketApiUtils.positiveMetric(profile.path("marketCapitalization"));
            if (marketCap != null) {
              marketCap = marketCap.multiply(BigDecimal.valueOf(MARKET_CAP_MILLION_MULTIPLIER));
            }
          } catch (RuntimeException ignored) {
            // Price previews should stay available even if provider profile metadata is unavailable.
          }
        }

        return logSnapshotResult("price snapshot", symbol, Optional.of(new MarketSnapshotCandidate(
            name,
            industry,
            marketCap,
            null,
            null,
            latestPrice,
            previousClose,
            dailyHigh,
            dailyLow,
            null
        )));
      } catch (RuntimeException exception) {
        return Optional.empty();
      }
    });
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    return cachedNonEmptyList(dailyClosesCache, symbol, CLOSES_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }

      try {
        long to = Instant.now().getEpochSecond();
        long from = Instant.now().minusSeconds(90L * 24 * 60 * 60).getEpochSecond();
        JsonNode candles = query(candlePath(symbol), Map.of(
            "symbol", symbol,
            "resolution", "D",
            "from", Long.toString(from),
            "to", Long.toString(to)
        ));

        if (!"ok".equalsIgnoreCase(candles.path("s").asText())
            || !candles.path("c").isArray()
            || !candles.path("t").isArray()) {
          return List.of();
        }

        List<TimeSeriesPoint> points = new ArrayList<>();
        JsonNode closes = candles.path("c");
        JsonNode timestamps = candles.path("t");
        int size = Math.min(closes.size(), timestamps.size());
        for (int i = 0; i < size; i++) {
          BigDecimal close = MarketApiUtils.positiveMetric(closes.get(i));
          if (close == null) {
            continue;
          }
          points.add(new TimeSeriesPoint(
              Instant.ofEpochSecond(timestamps.get(i).asLong()).atZone(ZoneOffset.UTC).toLocalDate(),
              close.doubleValue()
          ));
        }
        return logListResult("daily closes", symbol, points.stream().sorted(Comparator.comparing(TimeSeriesPoint::date)).toList());
      } catch (RuntimeException exception) {
        return List.of();
      }
    });
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    return cached(searchCache, "finnhub|" + MarketApiUtils.normalizeSearchText(keywords), SEARCH_PROVIDER_CACHE_SECONDS, () -> {
      if (!configured()) {
        return List.of();
      }
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
      return logListResult("symbol search", keywords, symbols);
    });
  }

  public List<SymbolSearchResult> symbolList(String type) {
    return cached(symbolListCache, type, 3_600, () -> fetchAssetSymbols(type));
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    CacheEntry<Boolean> accessBlocked = historyBackoff.get(FINNHUB_HISTORY_BACKOFF_KEY);
    if (accessBlocked != null && !accessBlocked.expired()) {
      LOGGER.debug("Skipping Finnhub history for {} {} due to recent access errors.", symbol, range.label());
      return List.of();
    }

    try {
      long to = Instant.now().getEpochSecond();
      long from = range.allTime() ? 0 : Instant.now().minus(range.lookback()).getEpochSecond();
      return cachedNonEmptyList(historyCache, symbol + "|" + range.label(), historyCacheSeconds(range), () -> {
        if (!configured()) {
          LOGGER.debug("Skipping Finnhub history for {} {} because Finnhub API key is not configured.", symbol, range.label());
          return List.<ChartPoint>of();
        }

        JsonNode candles = query(candlePath(symbol), Map.of(
            "symbol", symbol,
            "resolution", range.finnhubResolution(),
            "from", Long.toString(from),
            "to", Long.toString(to)
        ));

        if (!"ok".equalsIgnoreCase(candles.path("s").asText()) || !candles.path("c").isArray() || !candles.path("t").isArray()) {
          LOGGER.debug(
              "Finnhub history returned no candle payload for {} {}. status={}.",
              symbol,
              range.label(),
              candles.path("s").asText()
          );
          return List.<ChartPoint>of();
        }

        List<ChartPoint> points = new ArrayList<>();
        JsonNode closes = candles.path("c");
        JsonNode timestamps = candles.path("t");
        int size = Math.min(closes.size(), timestamps.size());
        for (int i = 0; i < size; i++) {
          double close = closes.get(i).asDouble(0);
          if (close > 0) {
            points.add(new ChartPoint(
                Instant.ofEpochSecond(timestamps.get(i).asLong()),
                BigDecimal.valueOf(close)
            ));
          }
        }

        List<ChartPoint> sorted = points.stream().sorted(Comparator.comparing(ChartPoint::timestamp)).toList();
        if (sorted.isEmpty()) {
          LOGGER.debug("Finnhub history returned empty data for {} {}.", symbol, range.label());
        } else {
          LOGGER.debug("Finnhub history returned {} points for {} {}.", sorted.size(), symbol, range.label());
        }
        return sample(sorted, 260);
      });
    } catch (HttpClientErrorException.Forbidden exception) {
      historyBackoff.put(
          FINNHUB_HISTORY_BACKOFF_KEY,
          new CacheEntry<>(true, Instant.now().plusSeconds(FINNHUB_HISTORY_ACCESS_BACKOFF_SECONDS))
      );
      LOGGER.debug(
          "Finnhub history returned 403 for {} {}. Disabling Finnhub history requests for {} seconds: {}",
          symbol,
          range.label(),
          FINNHUB_HISTORY_ACCESS_BACKOFF_SECONDS,
          exception.getMessage()
      );
      return List.of();
    } catch (HttpClientErrorException.TooManyRequests exception) {
      historyBackoff.put(
          FINNHUB_HISTORY_BACKOFF_KEY,
          new CacheEntry<>(true, Instant.now().plusSeconds(CLOSES_CACHE_SECONDS))
      );
      LOGGER.debug(
          "Finnhub history is rate limited for {} {}. Backing off Finnhub history requests for {} seconds: {}",
          symbol,
          range.label(),
          CLOSES_CACHE_SECONDS,
          exception.getMessage()
      );
      return List.of();
    } catch (RuntimeException exception) {
      LOGGER.debug("Finnhub history failed for {} {}: {}", symbol, range.label(), exception.getMessage());
      return List.of();
    }
  }

  private String candlePath(String symbol) {
    return MarketApiUtils.candlePath(symbol);
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

  private List<SymbolSearchResult> fetchAssetSymbols(String type) {
    List<String> exchanges = "crypto".equals(type) ? MarketApiUtils.CRYPTO_EXCHANGES : MarketApiUtils.FOREX_EXCHANGES;
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
          String name = "crypto".equals(type)
              ? MarketApiUtils.cryptoDescription(symbol, displaySymbol, description)
              : description;
          symbols.add(new SymbolSearchResult(
              symbol,
              StringUtils.hasText(name) ? name : displaySymbol,
              "crypto".equals(type) ? "Crypto" : "Currency",
              MarketApiUtils.currencyFromSymbol(displaySymbol, symbol)
          ));
        }
      } catch (RuntimeException ignored) {
        // Keep the other exchange/source results available if one provider endpoint fails.
      }
    }
    return logListResult(type + " symbol list", type, symbols);
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

  private long historyCacheSeconds(HistoryRange range) {
    if (range.allTime()) {
      return HISTORY_CACHE_SECONDS;
    }
    return range.lookback().compareTo(Duration.ofDays(1)) > 0
        ? HISTORY_CACHE_SECONDS
        : CLOSES_CACHE_SECONDS;
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

  private <T> List<T> cachedNonEmptyList(
      Map<String, CacheEntry<List<T>>> cache,
      String key,
      long ttlSeconds,
      java.util.function.Supplier<List<T>> loader
  ) {
    CacheEntry<List<T>> existing = cache.get(key);
    if (existing != null && !existing.expired()) {
      return existing.value();
    }

    List<T> value = loader.get();
    if (value == null || value.isEmpty()) {
      return List.of();
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
    result.ifPresent(ignored -> LOGGER.debug("Finnhub {} found a result for {}.", operation, symbol));
    return result;
  }

  private <T> List<T> logListResult(String operation, String subject, List<T> results) {
    if (results != null && !results.isEmpty()) {
      LOGGER.debug("Finnhub {} found {} result(s) for {}.", operation, results.size(), subject);
    }
    return results;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
