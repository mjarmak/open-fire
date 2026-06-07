package com.jarmak.stockmarketanalyzer.market;

import com.jarmak.stockmarketanalyzer.config.CacheConfig;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartSeries;
import com.jarmak.stockmarketanalyzer.market.MarketModels.IndicatorSnapshot;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
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
      default -> throw new IllegalArgumentException("Unsupported indicator history: " + indicatorId);
    };

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
