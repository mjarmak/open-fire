package com.jarmak.stockmarketanalyzer.market;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.client.BinanceApiService;
import com.jarmak.stockmarketanalyzer.market.client.FinnhubApiService;
import com.jarmak.stockmarketanalyzer.market.client.TwelveDataApiService;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class FinnhubClient {
  private static final Logger LOGGER = LoggerFactory.getLogger(FinnhubClient.class);
  private static final long SEARCH_CACHE_SECONDS = 600;
  private static final long SNAPSHOT_CACHE_SECONDS = 300;
  private static final long SNAPSHOT_STALE_FALLBACK_SECONDS = 86_400;
  private static final long CLOSES_CACHE_SECONDS = 900;
  private static final long HISTORY_CACHE_SECONDS = 86_400;
  private static final long SYMBOL_LIST_CACHE_SECONDS = 3600;
  private static final String SYMBOL_LIST_KEY = "symbol-list";

  private final FinnhubApiService finnhubApiService;
  private final TwelveDataApiService twelveDataApiService;
  private final BinanceApiService binanceApiService;
  private final long snapshotCacheSeconds;
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> searchCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<Optional<CompanySnapshot>>> snapshotCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<Optional<CompanySnapshot>>> priceSnapshotCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<TimeSeriesPoint>>> closesCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<ChartPoint>>> historyCache = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<SymbolSearchResult>>> symbolListCache = new ConcurrentHashMap<>();

  @Autowired
  public FinnhubClient(AppProperties properties, RestClient restClient) {
    this(
        new FinnhubApiService(properties, restClient),
        new TwelveDataApiService(properties, restClient),
        new BinanceApiService(restClient)
    );
  }

  FinnhubClient(
      FinnhubApiService finnhubApiService,
      TwelveDataApiService twelveDataApiService,
      BinanceApiService binanceApiService
  ) {
    this(
        finnhubApiService,
        twelveDataApiService,
        binanceApiService,
        SNAPSHOT_CACHE_SECONDS
    );
  }

  FinnhubClient(
      FinnhubApiService finnhubApiService,
      TwelveDataApiService twelveDataApiService,
      BinanceApiService binanceApiService,
      long snapshotCacheSeconds
  ) {
    this.finnhubApiService = finnhubApiService;
    this.twelveDataApiService = twelveDataApiService;
    this.binanceApiService = binanceApiService;
    this.snapshotCacheSeconds = snapshotCacheSeconds;
  }

  public Optional<CompanySnapshot> companySnapshot(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return Optional.empty();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    return cachedSnapshot(
        snapshotCache,
        MarketApiRequestContext.requestCacheSuffix() + "|" + normalizedSymbol,
        normalizedSymbol,
        SNAPSHOT_STALE_FALLBACK_SECONDS,
        () -> fetchCompanySnapshot(normalizedSymbol)
    );
  }

  public Optional<CompanySnapshot> companyPriceSnapshot(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return Optional.empty();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    return cachedSnapshot(
        priceSnapshotCache,
        MarketApiRequestContext.requestCacheSuffix() + "|" + normalizedSymbol,
        normalizedSymbol,
        0,
        () -> fetchCompanyPriceSnapshot(normalizedSymbol)
    );
  }

  public Optional<Boolean> isAdvancingToday(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return Optional.empty();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    return firstPresent(
        () -> directionFromCandidate(finnhubApiService.priceQuote(normalizedSymbol)),
        () -> directionFromCandidate(twelveDataApiService.companyPriceSnapshot(normalizedSymbol))
    );
  }

  public List<TimeSeriesPoint> dailyCloses(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return List.of();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    return cachedNonEmptyList(closesCache, MarketApiRequestContext.requestCacheSuffix() + "|" + normalizedSymbol, CLOSES_CACHE_SECONDS, () -> fetchDailyCloses(normalizedSymbol));
  }

  public List<ChartPoint> historicalCandles(String symbol, HistoryRange range) {
    if (!StringUtils.hasText(symbol) || range == null) {
      return List.of();
    }

    String normalizedSymbol = symbol.trim().toUpperCase();
    String cacheKey = MarketApiRequestContext.requestCacheSuffix() + "|" + normalizedSymbol + "|" + range.label();
    CacheEntry<List<ChartPoint>> existing = historyCache.get(cacheKey);
    if (existing != null && !existing.expired()) {
      LOGGER.debug(
          "Stock history cache hit for {} {} ({} points).",
          normalizedSymbol,
          range.label(),
          existing.value().size()
      );
      return existing.value();
    }

    List<ChartPoint> points = fetchHistoricalCandles(normalizedSymbol, range);
    if (points.isEmpty()) {
      points = fallbackHistoricalCandles(normalizedSymbol, range);
    }

    if (points.isEmpty()) {
      LOGGER.debug("No historical points available for {} {} after all providers and fallbacks.", normalizedSymbol, range.label());
      return List.of();
    }

    historyCache.put(cacheKey, new CacheEntry<>(points, Instant.now().plusSeconds(historyCacheSeconds(range))));
    return points;
  }

  public List<SymbolSearchResult> searchSymbols(String keywords) {
    if (!StringUtils.hasText(keywords)) {
      return List.of();
    }

    String query = keywords.trim().toLowerCase();
    return cached(searchCache, MarketApiRequestContext.requestCacheSuffix() + "|" + query, SEARCH_CACHE_SECONDS, () -> fetchSymbols(query));
  }

  public Optional<SymbolSearchResult> findExactSymbol(String symbol) {
    if (!StringUtils.hasText(symbol)) {
      return Optional.empty();
    }

    return searchSymbols(symbol).stream()
        .filter(result -> exactSymbolMatch(symbol, result))
        .findFirst();
  }

  static long historyCacheSeconds(HistoryRange range) {
    if (range.allTime()) {
      return HISTORY_CACHE_SECONDS;
    }
    return range.lookback().compareTo(Duration.ofDays(1)) > 0
        ? HISTORY_CACHE_SECONDS
        : CLOSES_CACHE_SECONDS;
  }

  private Optional<CompanySnapshot> fetchCompanySnapshot(String symbol) {
    return firstPresent(
        () -> fromSnapshotCandidate(symbol, finnhubApiService.companySnapshot(symbol)),
        () -> fromSnapshotCandidate(symbol, twelveDataApiService.companySnapshot(symbol))
    );
  }

  private Optional<CompanySnapshot> fetchCompanyPriceSnapshot(String symbol) {
    return firstPresent(
        () -> fromPriceSnapshotCandidate(symbol, finnhubApiService.companyPriceSnapshot(symbol)),
        () -> fromPriceSnapshotCandidate(symbol, twelveDataApiService.companyPriceSnapshot(symbol))
    );
  }

  private Optional<CompanySnapshot> fromSnapshotCandidate(
      String symbol,
      Optional<MarketSnapshotCandidate> candidate
  ) {
    if (candidate.isEmpty()) {
      return Optional.empty();
    }

    List<TimeSeriesPoint> closes = MarketApiUtils.assetClass(symbol) == MarketApiUtils.AssetClass.STOCK
        ? dailyCloses(symbol)
        : List.of();
    return MarketSnapshotFactory.fromCandidate(symbol, candidate.orElseThrow(), closes);
  }

  private Optional<CompanySnapshot> fromPriceSnapshotCandidate(
      String symbol,
      Optional<MarketSnapshotCandidate> candidate
  ) {
    return candidate.map(value -> MarketSnapshotFactory.fromPriceCandidate(symbol, value))
        .orElse(Optional.empty());
  }

  private Optional<Boolean> directionFromCandidate(Optional<MarketSnapshotCandidate> candidate) {
    if (candidate.isEmpty()) {
      return Optional.empty();
    }

    BigDecimal latestPrice = candidate.orElseThrow().latestPrice();
    BigDecimal previousClose = candidate.orElseThrow().previousClose();
    if (latestPrice == null || latestPrice.signum() <= 0 || previousClose == null || previousClose.signum() <= 0) {
      return Optional.empty();
    }

    int comparison = latestPrice.compareTo(previousClose);
    return comparison == 0 ? Optional.empty() : Optional.of(comparison > 0);
  }

  private List<TimeSeriesPoint> fetchDailyCloses(String symbol) {
    if (MarketApiUtils.assetClass(symbol) == MarketApiUtils.AssetClass.CRYPTO) {
      return firstNonEmpty(
          () -> binanceApiService.dailyCloses(symbol),
          () -> finnhubApiService.dailyCloses(symbol),
          () -> twelveDataApiService.dailyCloses(symbol)
      );
    }

    return firstNonEmpty(
        () -> finnhubApiService.dailyCloses(symbol),
        () -> twelveDataApiService.dailyCloses(symbol)
    );
  }

  private List<ChartPoint> fetchHistoricalCandles(String symbol, HistoryRange range) {
    if (MarketApiUtils.assetClass(symbol) == MarketApiUtils.AssetClass.CRYPTO) {
      return firstNonEmpty(
          () -> binanceApiService.historicalCandles(symbol, range),
          () -> finnhubApiService.historicalCandles(symbol, range),
          () -> twelveDataApiService.historicalCandles(symbol, range)
      );
    }

    return firstNonEmpty(
        () -> finnhubApiService.historicalCandles(symbol, range),
        () -> twelveDataApiService.historicalCandles(symbol, range)
    );
  }

  private List<SymbolSearchResult> fetchSymbols(String keywords) {
    try {
      List<SymbolSearchResult> symbols = fetchSymbolsFromFinnhub(keywords);
      if (!symbols.isEmpty()) {
        return symbols;
      }
    } catch (RuntimeException ignored) {
      // keep trying alternate providers
    }
    if (looksLikeCryptoSearch(keywords)) {
      try {
        List<SymbolSearchResult> symbols = fetchSymbolsFromBinance(keywords);
        if (!symbols.isEmpty()) {
          return symbols;
        }
      } catch (RuntimeException ignored) {
        // keep trying alternate providers
      }
    }
    try {
      List<SymbolSearchResult> symbols = fetchSymbolsFromTwelveData(keywords);
      if (!symbols.isEmpty()) {
        return symbols;
      }
    } catch (RuntimeException ignored) {
      // keep trying alternate providers
    }
    return List.of();
  }

  private List<SymbolSearchResult> fetchSymbolsFromFinnhub(String keywords) {
    List<SymbolSearchResult> finnhubResults = new ArrayList<>(finnhubApiService.searchSymbols(keywords))
        .stream()
        .filter(result -> StringUtils.hasText(result.symbol()))
        .collect(java.util.stream.Collectors.toMap(
            result -> result.symbol().toUpperCase(),
            result -> result,
            (first, ignored) -> first,
            java.util.LinkedHashMap::new
        ))
        .values()
        .stream()
        .toList();

    if (hasSecondarySearchProvider()) {
      if (!looksLikeCryptoSearch(keywords)) {
        return sortAndLimitSearchResults(finnhubResults, keywords);
      }
      return sortAndLimitSearchResults(
          finnhubResults,
          keywords,
          () -> fetchSymbolsFromBinance(keywords)
      );
    }

    if (looksLikeCryptoSearch(keywords)) {
      List<SymbolSearchResult> finnhubCryptoResults = sortAndLimitSearchResults(
          finnhubResults,
          keywords,
          () -> matchingSymbols("crypto", keywords)
      );
      if (!finnhubCryptoResults.isEmpty()) {
        return finnhubCryptoResults;
      }
      return sortAndLimitSearchResults(
          finnhubResults,
          keywords,
          () -> fetchSymbolsFromBinance(keywords)
      );
    }

    return sortAndLimitSearchResults(
        finnhubResults,
        keywords,
        () -> matchingSymbols("crypto", keywords),
        () -> matchingSymbols("forex", keywords)
    );
  }

  private boolean hasSecondarySearchProvider() {
    return twelveDataApiService.configured();
  }

  private List<SymbolSearchResult> fetchSymbolsFromTwelveData(String keywords) {
    return sortAndLimitSearchResults(twelveDataApiService.searchSymbols(keywords), keywords);
  }

  private List<SymbolSearchResult> fetchSymbolsFromBinance(String keywords) {
    return sortAndLimitSearchResults(binanceApiService.searchSymbols(keywords), keywords);
  }

  private List<SymbolSearchResult> matchingSymbols(String type, String keywords) {
      return cached(symbolListCache, MarketApiRequestContext.requestCacheSuffix() + "|" + SYMBOL_LIST_KEY + "-" + type, SYMBOL_LIST_CACHE_SECONDS, () -> finnhubApiService.symbolList(type))
          .stream()
          .filter(result -> matchesSearch(result, keywords))
          .toList();
  }

  private List<ChartPoint> fallbackHistoricalCandles(String symbol, HistoryRange range) {
    List<ChartPoint> dailyPoints = dailyCloseChartPoints(symbol, range);
    if (dailyPoints.size() > 1) {
      LOGGER.debug("History fallback resolved with daily closes for {} {}.", symbol, range.label());
      return sample(dailyPoints, 260);
    }
    LOGGER.debug("History fallback found no reliable points for {} {}.", symbol, range.label());
    return List.of();
  }

  private List<ChartPoint> dailyCloseChartPoints(String symbol, HistoryRange range) {
    List<ChartPoint> points = dailyCloses(symbol).stream()
        .filter(point -> point.value() > 0)
        .map(point -> new ChartPoint(point.date().atStartOfDay().toInstant(ZoneOffset.UTC), BigDecimal.valueOf(point.value())))
        .sorted(Comparator.comparing(ChartPoint::timestamp))
        .toList();

    if (points.size() <= 1) {
      return points;
    }

    int minimumRecentPoints = switch (range) {
      case ONE_HOUR, ONE_DAY -> 2;
      case FIVE_DAYS -> 5;
      default -> 0;
    };
    if (minimumRecentPoints > 0) {
      return points.subList(Math.max(0, points.size() - minimumRecentPoints), points.size());
    }

    if (range.allTime()) {
      return points;
    }

    Instant cutoff = Instant.now().minus(range.lookback());
    List<ChartPoint> filtered = points.stream()
        .filter(point -> !point.timestamp().isBefore(cutoff))
        .toList();
    if (filtered.size() > 1) {
      return filtered;
    }
    return points.subList(Math.max(0, points.size() - 2), points.size());
  }

  private List<SymbolSearchResult> sortAndLimitSearchResults(List<SymbolSearchResult> symbols, String keywords) {
    return sortAndLimitSearchResults(symbols, keywords, List::of, List::of);
  }

  private List<SymbolSearchResult> sortAndLimitSearchResults(
      List<SymbolSearchResult> symbols,
      String keywords,
      java.util.function.Supplier<List<SymbolSearchResult>>... extra
  ) {
    List<SymbolSearchResult> all = new ArrayList<>(symbols);
    for (java.util.function.Supplier<List<SymbolSearchResult>> supplier : extra) {
      try {
        all.addAll(supplier.get());
      } catch (RuntimeException ignored) {
        // ignore
      }
    }
    return all.stream()
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
  }

  private List<ChartPoint> sample(List<ChartPoint> points, int maxPoints) {
    return MarketApiUtils.sample(points, maxPoints, ChartPoint::timestamp);
  }

  private boolean matchesSearch(SymbolSearchResult result, String keywords) {
    String query = keywords.trim().toLowerCase();
    String normalizedQuery = MarketApiUtils.normalizeSearchText(query);
    String haystack = MarketApiUtils.normalizeSearchText(result.symbol() + " " + result.name() + " " + result.region() + " " + result.currency());
    return haystack.contains(normalizedQuery)
        || MarketApiUtils.cryptoPairMatches(keywords, result.symbol());
  }

  private int searchRank(SymbolSearchResult result, String keywords) {
    String query = MarketApiUtils.normalizeSearchText(keywords);
    String symbol = MarketApiUtils.normalizeSearchText(result.symbol());
    String name = MarketApiUtils.normalizeSearchText(result.name());

    if (symbol.equals(query)) {
      return 0;
    }
    if (MarketApiUtils.cryptoPairMatches(keywords, result.symbol())) {
      return 1;
    }
    if (symbol.startsWith(query)) {
      return 2;
    }
    if (name.startsWith(query)) {
      return 3;
    }
    if ("Common Stock".equalsIgnoreCase(result.region()) || "EQS".equalsIgnoreCase(result.region())) {
      return 4;
    }
    return 5;
  }

  private boolean looksLikeCryptoSearch(String keywords) {
    if (!StringUtils.hasText(MarketApiUtils.normalizeSearchText(keywords))) {
      return false;
    }

    return MarketApiUtils.isKnownCryptoSearchTerm(keywords)
        || MarketApiUtils.cryptoPair(keywords).isPresent();
  }

  private boolean exactSymbolMatch(String requestedSymbol, SymbolSearchResult result) {
    return requestedSymbol.equalsIgnoreCase(result.symbol())
        || MarketApiUtils.cryptoPairMatches(requestedSymbol, result.symbol());
  }

  private <T> T firstPresent(java.util.function.Supplier<T>... suppliers) {
    for (java.util.function.Supplier<T> supplier : suppliers) {
      try {
        T value = supplier.get();
        if (value instanceof Optional<?> optional && optional.isPresent()) {
          return value;
        }
      } catch (RuntimeException exception) {
        LOGGER.debug("Provider fetch failed while selecting first present result.", exception);
      }
    }
    return (T) Optional.empty();
  }

  private <T> List<T> firstNonEmpty(java.util.function.Supplier<List<T>>... suppliers) {
    for (java.util.function.Supplier<List<T>> supplier : suppliers) {
      try {
        List<T> values = supplier.get();
        if (values != null && !values.isEmpty()) {
          return values;
        }
      } catch (RuntimeException exception) {
        LOGGER.debug("Provider fetch failed while selecting first non-empty result.", exception);
      }
    }
    return List.of();
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

  private <T> Optional<T> cachedSnapshot(
      Map<String, CacheEntry<Optional<T>>> cache,
      String key,
      String symbol,
      long staleFallbackSeconds,
      java.util.function.Supplier<Optional<T>> loader
  ) {
    CacheEntry<Optional<T>> existing = cache.get(key);
    if (existing != null && !existing.expired()) {
      return existing.value();
    }

    Optional<T> value = loader.get();
    if (value.isPresent()) {
      cache.put(key, new CacheEntry<>(value, Instant.now().plusSeconds(snapshotCacheSeconds)));
      return value;
    }

    if (existing != null
        && existing.value().isPresent()
        && !existing.staleFallbackExpired(staleFallbackSeconds)) {
      LOGGER.warn("All market providers failed for {}. Reusing the last successful snapshot.", symbol);
      return existing.value();
    }

    if (existing != null) {
      cache.remove(key, existing);
    }
    return Optional.empty();
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

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }

    boolean staleFallbackExpired(long staleFallbackSeconds) {
      return Instant.now().isAfter(expiresAt.plusSeconds(staleFallbackSeconds));
    }
  }
}
