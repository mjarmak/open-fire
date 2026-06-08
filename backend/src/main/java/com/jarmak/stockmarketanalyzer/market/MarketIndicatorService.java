package com.jarmak.stockmarketanalyzer.market;

import com.jarmak.stockmarketanalyzer.config.CacheConfig;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.client.FredClient;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartSeries;
import com.jarmak.stockmarketanalyzer.market.MarketModels.IndicatorSnapshot;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class MarketIndicatorService {
  private final AppProperties properties;
  private final FredClient fredClient;
  private final FinnhubClient finnhubClient;

  public MarketIndicatorService(AppProperties properties, FredClient fredClient, FinnhubClient finnhubClient) {
    this.properties = properties;
    this.fredClient = fredClient;
    this.finnhubClient = finnhubClient;
  }

  @Cacheable(CacheConfig.MARKET_INDICATORS_CACHE)
  public List<IndicatorSnapshot> indicators() {
    List<IndicatorSnapshot> indicators = new ArrayList<>();
    CompletableFuture<Optional<IndicatorSnapshot>> vixFuture = indicatorFuture(() -> fredIndicator("vix", "Fear Index / VIX", "Volatility", "VIXCLS", "index points", "CBOE VIX via FRED"));
    CompletableFuture<Optional<IndicatorSnapshot>> creditFuture = indicatorFuture(() -> fredIndicator("credit", "Credit Market", "Credit", "BAMLC0A0CM", "spread %", "ICE BofA corporate OAS via FRED"));
    CompletableFuture<Optional<IndicatorSnapshot>> breadthFuture = indicatorFuture(this::breadthIndicator);
    CompletableFuture<Optional<IndicatorSnapshot>> correlationFuture = indicatorFuture(this::crossAssetCorrelation);

    Optional<IndicatorSnapshot> vix = vixFuture.join();
    Optional<IndicatorSnapshot> credit = creditFuture.join();
    Optional<IndicatorSnapshot> breadth = breadthFuture.join();
    Optional<IndicatorSnapshot> correlation = correlationFuture.join();

    vix.ifPresent(indicators::add);
    fearGreedComposite(vix, credit, breadth, correlation).ifPresent(indicators::add);
    breadth.ifPresent(indicators::add);
    credit.ifPresent(indicators::add);
    correlation.ifPresent(indicators::add);
    return List.copyOf(indicators);
  }

  public ChartSeries indicatorHistory(String indicatorId, HistoryRange range) {
    String normalizedId = indicatorId == null ? "" : indicatorId.trim().toLowerCase();
    String seriesId = switch (normalizedId) {
      case "vix" -> "VIXCLS";
      case "credit" -> "BAMLC0A0CM";
      case "breadth" -> null;
      case "fear-greed" -> null;
      case "correlation" -> null;
      default -> throw new IllegalArgumentException("Unsupported indicator history: " + indicatorId);
    };

    if (seriesId == null) {
      List<MarketModels.ChartPoint> points = switch (normalizedId) {
        case "breadth" -> historicalBreadth(range);
        case "fear-greed" -> historicalFearGreed(range);
        case "correlation" -> historicalCorrelation(range);
        default -> List.of();
      };
      return new ChartSeries(normalizedId, range.label(), points);
    }

    return new ChartSeries(normalizedId, range.label(), fredClient.observations(seriesId, range));
  }

  private CompletableFuture<Optional<IndicatorSnapshot>> indicatorFuture(java.util.function.Supplier<Optional<IndicatorSnapshot>> supplier) {
    return CompletableFuture.supplyAsync(supplier)
        .completeOnTimeout(Optional.empty(), 30, TimeUnit.SECONDS)
        .exceptionally(exception -> Optional.empty());
  }

  private Optional<IndicatorSnapshot> fredIndicator(
      String id,
      String name,
      String category,
      String seriesId,
      String unit,
      String source
  ) {
    List<TimeSeriesPoint> points = fredClient.latestObservations(seriesId);
    if (points.size() < 2) {
      return Optional.empty();
    }

    double latest = points.get(0).value();
    double previous = points.get(1).value();
    BigDecimal change = rounded(latest - previous);

    return Optional.of(new IndicatorSnapshot(
        id,
        name,
        category,
        rounded(latest),
        unit,
        change,
        riskStatus(id, latest, change.doubleValue()),
        source,
        Instant.now(),
        id.equals("vix")
            ? "Measures expected S&P 500 volatility; spikes usually mean risk-off behavior."
            : "Tracks corporate bond stress; widening spreads often signal tighter financial conditions."
    ));
  }

  private Optional<IndicatorSnapshot> breadthIndicator() {
    int advancing = 0;
    int total = 0;

    for (String symbol : properties.market().breadthSymbols()) {
      List<TimeSeriesPoint> closes = finnhubClient.dailyCloses(symbol);
      if (closes.size() >= 2) {
        TimeSeriesPoint latest = closes.get(closes.size() - 1);
        TimeSeriesPoint previous = closes.get(closes.size() - 2);
        advancing += latest.value() > previous.value() ? 1 : 0;
        total++;
      }
    }

    if (total == 0) {
      return Optional.empty();
    }

    double breadth = advancing * 100.0 / total;
    BigDecimal value = rounded(breadth);
    return Optional.of(new IndicatorSnapshot(
        "breadth",
        "Market Breadth",
        "Participation",
        value,
        "% advancing basket",
        BigDecimal.ZERO,
        breadth >= 55 ? "supportive" : breadth >= 45 ? "neutral" : "risk",
        "Finnhub ETF basket",
        Instant.now(),
        "Shows whether gains are broad or concentrated across a configurable ETF basket."
    ));
  }

  private List<MarketModels.ChartPoint> historicalBreadth(HistoryRange range) {
    if (properties.market().breadthSymbols() == null || properties.market().breadthSymbols().isEmpty()) {
      return List.of();
    }

    Map<LocalDate, int[]> countsByDate = new LinkedHashMap<>();
    for (List<TimeSeriesPoint> points : historicalCloses(properties.market().breadthSymbols(), range)) {
      if (points.size() < 2) {
        continue;
      }

      for (int index = 1; index < points.size(); index++) {
        TimeSeriesPoint previous = points.get(index - 1);
        TimeSeriesPoint current = points.get(index);
        if (current.value() <= 0 || previous.value() <= 0) {
          continue;
        }

        LocalDate date = current.date();
        int[] counts = countsByDate.computeIfAbsent(date, ignored -> new int[2]);
        counts[0]++; // total
        if (current.value() > previous.value()) {
          counts[1]++; // advancing
        }
      }
    }

    if (countsByDate.isEmpty()) {
      return List.of();
    }

    List<MarketModels.ChartPoint> points = countsByDate.entrySet().stream()
        .filter(entry -> entry.getValue()[0] > 0)
        .sorted(Map.Entry.comparingByKey())
        .map(entry -> {
          int total = entry.getValue()[0];
          double value = total == 0 ? 0 : (entry.getValue()[1] * 100.0) / total;
          return new MarketModels.ChartPoint(
              entry.getKey().atStartOfDay().toInstant(ZoneOffset.UTC),
              rounded(value)
          );
        })
        .toList();

    return sample(points, 260);
  }

  private List<MarketModels.ChartPoint> historicalFearGreed(HistoryRange range) {
    CompletableFuture<Map<LocalDate, Double>> vixFuture = historyFuture(() -> chartPointsByDate(fredClient.observations("VIXCLS", range)));
    CompletableFuture<Map<LocalDate, Double>> creditFuture = historyFuture(() -> chartPointsByDate(fredClient.observations("BAMLC0A0CM", range)));
    CompletableFuture<Map<LocalDate, Double>> breadthFuture = historyFuture(() -> chartPointsByDate(historicalBreadth(range)));
    CompletableFuture<Map<LocalDate, Double>> correlationFuture = historyFuture(() -> chartPointsByDate(historicalCorrelation(range)));

    Map<LocalDate, Double> vix = emptyIfNull(vixFuture.join());
    Map<LocalDate, Double> credit = emptyIfNull(creditFuture.join());
    Map<LocalDate, Double> breadth = emptyIfNull(breadthFuture.join());

    if (vix.isEmpty() || credit.isEmpty() || breadth.isEmpty()) {
      return List.of();
    }

    Map<LocalDate, Double> correlation = emptyIfNull(correlationFuture.join());
    double fallbackCorrelation = crossAssetCorrelation()
        .map(indicator -> indicator.value().doubleValue())
        .orElse(0d);

    List<MarketModels.ChartPoint> points = Stream.of(vix.keySet(), credit.keySet(), breadth.keySet())
        .flatMap(Set::stream)
        .collect(java.util.stream.Collectors.toCollection(java.util.TreeSet::new))
        .stream()
        .map((LocalDate date) -> {
          Double vixValue = vix.get(date);
          Double creditValue = credit.get(date);
          Double breadthValue = breadth.get(date);
          if (vixValue == null || creditValue == null || breadthValue == null) {
            return null;
          }

          double correlationValue = correlation.getOrDefault(date, fallbackCorrelation);
          double score = fearGreedScore(vixValue, creditValue, breadthValue, correlationValue);
          return new MarketModels.ChartPoint(
              date.atStartOfDay().toInstant(ZoneOffset.UTC),
              rounded(score)
          );
        })
        .filter(java.util.Objects::nonNull)
        .toList();

    return sample(points, 260);
  }

  private Optional<IndicatorSnapshot> crossAssetCorrelation() {
    List<List<Double>> returns = properties.market().crossAssetSymbols().stream()
        .map(symbol -> {
          List<TimeSeriesPoint> closes = finnhubClient.dailyCloses(symbol);
          return closes.stream()
              .skip(Math.max(0, closes.size() - 31))
              .map(TimeSeriesPoint::value)
              .toList();
        })
        .filter(values -> values.size() >= 10)
        .map(this::returns)
        .toList();

    if (returns.size() < 2) {
      return Optional.empty();
    }

    double averageCorrelation = averageAbsoluteCorrelation(returns);
    return Optional.of(new IndicatorSnapshot(
        "correlation",
        "Cross-Asset Correlation",
        "Risk regime",
        rounded(averageCorrelation),
        "avg abs corr",
        BigDecimal.ZERO,
        averageCorrelation < 0.45 ? "diversified" : averageCorrelation < 0.70 ? "watch" : "risk",
        "Finnhub SPY/TLT/GLD/UUP closes",
        Instant.now(),
        "Rising correlation can mean diversification is weakening during stress."
    ));
  }

  private List<MarketModels.ChartPoint> historicalCorrelation(HistoryRange range) {
    List<Map<LocalDate, Double>> symbolReturns = historicalCloses(properties.market().crossAssetSymbols(), range).stream()
        .map(points -> historicalDailyReturns(points, range))
        .filter(returns -> returns.size() >= 5)
        .toList();

    if (symbolReturns.size() < 2) {
      return List.of();
    }

    Set<LocalDate> allDates = symbolReturns.stream()
        .flatMap(symbol -> symbol.keySet().stream())
        .collect(java.util.stream.Collectors.toCollection(java.util.TreeSet::new));
    if (allDates.isEmpty()) {
      return List.of();
    }

    List<MarketModels.ChartPoint> points = allDates.stream()
        .map(date -> {
          List<List<Double>> returns = symbolReturns.stream()
              .map(symbol -> trailingValues(symbol, date, 30))
              .filter(values -> values.size() >= 2)
              .toList();
          if (returns.size() < 2) {
            return null;
          }

          double average = averageAbsoluteCorrelation(returns);
          return new MarketModels.ChartPoint(
              date.atStartOfDay().toInstant(ZoneOffset.UTC),
              rounded(average)
          );
        })
        .filter(java.util.Objects::nonNull)
        .sorted(Comparator.comparing(MarketModels.ChartPoint::timestamp))
        .toList();

    return sample(points, 260);
  }

  private double fearGreedScore(double vixValue, double creditValue, double breadthValue, double correlationValue) {
    double vixScore = clamp(100 - (vixValue - 12) * 4);
    double creditScore = clamp(100 - (creditValue - 0.8) * 35);
    double breadthScore = clamp(breadthValue);
    double correlationScore = clamp(100 - correlationValue * 80);
    return (vixScore + creditScore + breadthScore + correlationScore) / 4.0;
  }

  private Map<LocalDate, Double> chartPointsByDate(List<MarketModels.ChartPoint> points) {
    Map<LocalDate, Double> values = new HashMap<>();
    for (MarketModels.ChartPoint point : points) {
      LocalDate date = point.timestamp().atZone(ZoneOffset.UTC).toLocalDate();
      values.put(date, point.value().doubleValue());
    }
    return values;
  }

  private Map<LocalDate, Double> historicalDailyReturns(List<TimeSeriesPoint> points, HistoryRange range) {
    List<TimeSeriesPoint> filtered = historicalWindow(points, range);
    if (filtered.size() < 2) {
      return Map.of();
    }

    Map<LocalDate, Double> returns = new LinkedHashMap<>();
    for (int index = 1; index < filtered.size(); index++) {
      TimeSeriesPoint previous = filtered.get(index - 1);
      TimeSeriesPoint current = filtered.get(index);
      if (previous.value() <= 0 || current.value() <= 0) {
        continue;
      }
      returns.put(current.date(), (current.value() - previous.value()) / previous.value());
    }
    return returns;
  }

  private List<List<TimeSeriesPoint>> historicalCloses(List<String> symbols, HistoryRange range) {
    if (symbols == null || symbols.isEmpty()) {
      return List.of();
    }

    List<CompletableFuture<List<TimeSeriesPoint>>> futures = symbols.stream()
        .map(symbol -> historyFuture(() -> historicalCloses(symbol, range)))
        .toList();
    return futures.stream()
        .map(CompletableFuture::join)
        .filter(java.util.Objects::nonNull)
        .filter(points -> !points.isEmpty())
        .toList();
  }

  private List<TimeSeriesPoint> historicalCloses(String symbol, HistoryRange range) {
    if (range == HistoryRange.ONE_HOUR || range == HistoryRange.ONE_DAY || range == HistoryRange.FIVE_DAYS) {
      return historicalWindow(finnhubClient.dailyCloses(symbol), range);
    }

    List<MarketModels.ChartPoint> history = finnhubClient.historicalCandles(symbol, range);
    if (history.isEmpty()) {
      return historicalWindow(finnhubClient.dailyCloses(symbol), range);
    }

    Map<LocalDate, TimeSeriesPoint> pointsByDate = new LinkedHashMap<>();
    history.stream()
        .filter(point -> point.value() != null && point.value().signum() > 0)
        .sorted(Comparator.comparing(MarketModels.ChartPoint::timestamp))
        .forEach(point -> {
          LocalDate date = point.timestamp().atZone(ZoneOffset.UTC).toLocalDate();
          pointsByDate.put(date, new TimeSeriesPoint(date, point.value().doubleValue()));
        });
    return pointsByDate.values().stream()
        .sorted(Comparator.comparing(TimeSeriesPoint::date))
        .toList();
  }

  private <T> CompletableFuture<T> historyFuture(java.util.function.Supplier<T> supplier) {
    return CompletableFuture.supplyAsync(supplier)
        .completeOnTimeout(null, 30, TimeUnit.SECONDS)
        .exceptionally(exception -> null);
  }

  private Map<LocalDate, Double> emptyIfNull(Map<LocalDate, Double> values) {
    return values == null ? Map.of() : values;
  }

  private List<Double> trailingValues(Map<LocalDate, Double> valuesByDate, LocalDate date, int maxValues) {
    List<Double> values = valuesByDate.entrySet().stream()
        .filter(entry -> !entry.getKey().isAfter(date))
        .map(Map.Entry::getValue)
        .toList();

    if (values.size() <= maxValues) {
      return values;
    }

    return values.subList(values.size() - maxValues, values.size());
  }

  private List<TimeSeriesPoint> historicalWindow(List<TimeSeriesPoint> closes, HistoryRange range) {
    List<TimeSeriesPoint> sorted = closes.stream()
        .filter(point -> point.value() > 0)
        .sorted(Comparator.comparing(TimeSeriesPoint::date))
        .toList();

    if (sorted.size() <= 1) {
      return sorted;
    }

    int minimumRecentPoints = switch (range) {
      case ONE_HOUR, ONE_DAY -> 2;
      case FIVE_DAYS -> 5;
      default -> 0;
    };

    if (minimumRecentPoints > 0) {
      return sorted.subList(Math.max(0, sorted.size() - minimumRecentPoints), sorted.size());
    }

    if (range.allTime()) {
      return sorted;
    }

    LocalDate cutoff = LocalDate.now(ZoneOffset.UTC).minusDays(range.lookback().toDays());
    List<TimeSeriesPoint> filtered = sorted.stream()
        .filter(point -> !point.date().isBefore(cutoff))
        .toList();
    if (filtered.size() > 1) {
      return filtered;
    }

    return sorted.subList(Math.max(0, sorted.size() - 2), sorted.size());
  }

  private List<MarketModels.ChartPoint> sample(List<MarketModels.ChartPoint> points, int maxPoints) {
    return MarketApiUtils.sample(points, maxPoints, MarketModels.ChartPoint::timestamp);
  }

  private Optional<IndicatorSnapshot> fearGreedComposite(
      Optional<IndicatorSnapshot> vix,
      Optional<IndicatorSnapshot> credit,
      Optional<IndicatorSnapshot> breadth,
      Optional<IndicatorSnapshot> correlation
  ) {
    if (vix.isEmpty() || credit.isEmpty() || breadth.isEmpty() || correlation.isEmpty()) {
      return Optional.empty();
    }

    double vixScore = clamp(100 - (vix.get().value().doubleValue() - 12) * 4);
    double creditScore = clamp(100 - (credit.get().value().doubleValue() - 0.8) * 35);
    double breadthScore = clamp(breadth.get().value().doubleValue());
    double correlationScore = clamp(100 - correlation.get().value().doubleValue() * 80);
    double score = (vixScore + creditScore + breadthScore + correlationScore) / 4;

    return Optional.of(new IndicatorSnapshot(
        "fear-greed",
        "Fear & Greed Index",
        "Composite",
        rounded(score),
        "0 fear / 100 greed",
        BigDecimal.ZERO,
        score >= 70 ? "greed" : score <= 35 ? "fear" : "neutral",
        "Internal composite from VIX, credit, breadth, and cross-asset correlation",
        Instant.now(),
        "Explainable live composite from VIX, credit, breadth, and cross-asset correlation."
    ));
  }

  private String riskStatus(String id, double value, double change) {
    if ("vix".equals(id)) {
      return value >= 25 || change >= 3 ? "risk" : value <= 15 ? "calm" : "watch";
    }
    return value >= 2.0 || change >= 0.15 ? "risk" : value <= 1.25 ? "supportive" : "watch";
  }

  private List<Double> returns(List<Double> closes) {
    List<Double> result = new ArrayList<>();
    for (int i = 1; i < closes.size(); i++) {
      if (closes.get(i - 1) != 0) {
        result.add((closes.get(i) - closes.get(i - 1)) / closes.get(i - 1));
      }
    }
    return result;
  }

  private double averageAbsoluteCorrelation(List<List<Double>> series) {
    double sum = 0;
    int count = 0;
    for (int i = 0; i < series.size(); i++) {
      for (int j = i + 1; j < series.size(); j++) {
        sum += Math.abs(correlation(series.get(i), series.get(j)));
        count++;
      }
    }
    return count == 0 ? 0 : sum / count;
  }

  private double correlation(List<Double> left, List<Double> right) {
    int size = Math.min(left.size(), right.size());
    double leftMean = left.stream().limit(size).mapToDouble(Double::doubleValue).average().orElse(0);
    double rightMean = right.stream().limit(size).mapToDouble(Double::doubleValue).average().orElse(0);
    double numerator = 0;
    double leftVariance = 0;
    double rightVariance = 0;

    for (int i = 0; i < size; i++) {
      double leftDelta = left.get(i) - leftMean;
      double rightDelta = right.get(i) - rightMean;
      numerator += leftDelta * rightDelta;
      leftVariance += leftDelta * leftDelta;
      rightVariance += rightDelta * rightDelta;
    }

    double denominator = Math.sqrt(leftVariance * rightVariance);
    return denominator == 0 ? 0 : numerator / denominator;
  }

  private double clamp(double value) {
    return Math.max(0, Math.min(100, value));
  }

  private BigDecimal rounded(double value) {
    return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
  }
}
