package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.client.AlphaVantageApiService;
import com.jarmak.stockmarketanalyzer.market.client.EodHistoricalDataApiService;
import com.jarmak.stockmarketanalyzer.market.client.FinancialModelingPrepApiService;
import com.jarmak.stockmarketanalyzer.market.client.FinnhubApiService;
import com.jarmak.stockmarketanalyzer.market.client.TwelveDataApiService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

class MarketApiPositionRiskSmokeTest {
  private static final String STOCK_SYMBOL = "AAPL";

  @Test
  void finnhubLiveSnapshotProducesCalculatedPositionRiskIndicators() {
    String apiKey = liveApiKey("FINNHUB_API_KEY");
    FinnhubApiService service = new FinnhubApiService(properties(apiKey, null, null, null, null), RestClient.create());

    assertLiveRiskIndicators(service.companySnapshot(STOCK_SYMBOL), service.dailyCloses(STOCK_SYMBOL));
  }

  @Test
  void twelveDataLiveSnapshotProducesCalculatedPositionRiskIndicators() {
    String apiKey = liveApiKey("TWELVEDATA_API_KEY");
    TwelveDataApiService service = new TwelveDataApiService(properties(null, apiKey, null, null, null), RestClient.create());

    assertLiveRiskIndicators(service.companySnapshot(STOCK_SYMBOL), service.dailyCloses(STOCK_SYMBOL));
  }

  @Test
  void financialModelingPrepLiveSnapshotProducesCalculatedPositionRiskIndicators() {
    String apiKey = liveApiKey("FINANCIAL_MODELING_PREP_API_KEY");
    FinancialModelingPrepApiService service =
        new FinancialModelingPrepApiService(properties(null, null, null, apiKey, null), RestClient.create());

    assertLiveRiskIndicators(service.companySnapshot(STOCK_SYMBOL), service.dailyCloses(STOCK_SYMBOL));
  }

  @Test
  void eodHistoricalDataLiveSnapshotProducesCalculatedPositionRiskIndicators() {
    String apiKey = liveApiKey("EODHD_API_KEY");
    EodHistoricalDataApiService service = new EodHistoricalDataApiService(properties(null, null, null, null, apiKey), RestClient.create());

    assertLiveRiskIndicators(service.companySnapshot(STOCK_SYMBOL), service.dailyCloses(STOCK_SYMBOL));
  }

  @Test
  void alphaVantageLiveSnapshotProducesCalculatedPositionRiskIndicators() {
    String apiKey = liveApiKey("ALPHA_VANTAGE_API_KEY");
    AlphaVantageApiService service = new AlphaVantageApiService(properties(null, null, apiKey, null, null), RestClient.create());

    assertLiveRiskIndicators(service.companySnapshot(STOCK_SYMBOL), service.dailyCloses(STOCK_SYMBOL));
  }

  private void assertLiveRiskIndicators(Optional<MarketSnapshotCandidate> candidate, List<TimeSeriesPoint> closes) {
    assertThat(candidate).isPresent();
    assertThat(closes).hasSizeGreaterThanOrEqualTo(3);

    CompanySnapshot snapshot = MarketSnapshotFactory.fromCandidate(STOCK_SYMBOL, candidate.orElseThrow(), closes)
        .orElseThrow();

    assertThat(snapshot.latestPrice()).isNotNull().isPositive();
    assertThat(snapshot.previousClose()).isNotNull().isPositive();
    assertThat(snapshot.realizedVolatilityPercent()).isNotNull().isGreaterThanOrEqualTo(BigDecimal.ZERO);
    assertThat(snapshot.drawdownPercent()).isNotNull().isGreaterThanOrEqualTo(BigDecimal.ZERO);
    assertThat(snapshot.priceThirtyDaysAgo()).isNotNull().isPositive();

    assertThat(snapshot.realizedVolatilityPercent().setScale(2, RoundingMode.HALF_UP))
        .isEqualByComparingTo(expectedRealizedVolatilityPercent(closes).setScale(2, RoundingMode.HALF_UP));
    assertThat(snapshot.drawdownPercent().setScale(2, RoundingMode.HALF_UP))
        .isEqualByComparingTo(expectedDrawdownPercent(closes, snapshot.latestPrice()).setScale(2, RoundingMode.HALF_UP));
    assertThat(snapshot.priceThirtyDaysAgo())
        .isEqualByComparingTo(expectedBaselineClose(closes, LocalDate.now(ZoneOffset.UTC).minusDays(30)));
    assertThat(snapshot.thirtyDayChangePercent().setScale(2, RoundingMode.HALF_UP))
        .isEqualByComparingTo(expectedThirtyDayChangePercent(snapshot.latestPrice(), snapshot.priceThirtyDaysAgo())
            .setScale(2, RoundingMode.HALF_UP));
  }

  private BigDecimal expectedRealizedVolatilityPercent(List<TimeSeriesPoint> closes) {
    List<Double> recentCloses = closes.stream()
        .skip(Math.max(0, closes.size() - 31))
        .map(TimeSeriesPoint::value)
        .filter(value -> value > 0)
        .toList();
    assertThat(recentCloses).hasSizeGreaterThanOrEqualTo(3);

    List<Double> returns = new ArrayList<>();
    for (int i = 1; i < recentCloses.size(); i++) {
      returns.add(Math.log(recentCloses.get(i) / recentCloses.get(i - 1)));
    }

    double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    double variance = returns.stream()
        .mapToDouble(value -> Math.pow(value - mean, 2))
        .sum() / Math.max(1, returns.size() - 1);
    return BigDecimal.valueOf(Math.sqrt(variance) * Math.sqrt(252) * 100);
  }

  private BigDecimal expectedDrawdownPercent(List<TimeSeriesPoint> closes, BigDecimal latestPrice) {
    LocalDate cutoff = LocalDate.now(ZoneOffset.UTC).minusDays(30);
    double high = closes.stream()
        .filter(point -> !point.date().isBefore(cutoff))
        .mapToDouble(TimeSeriesPoint::value)
        .filter(value -> value > 0)
        .max()
        .orElseThrow();

    double normalizedHigh = Math.max(high, latestPrice.doubleValue());
    return BigDecimal.valueOf(Math.max(0, (normalizedHigh - latestPrice.doubleValue()) / normalizedHigh * 100));
  }

  private BigDecimal expectedBaselineClose(List<TimeSeriesPoint> closes, LocalDate targetDate) {
    List<TimeSeriesPoint> positiveCloses = closes.stream()
        .filter(point -> point.value() > 0)
        .toList();

    Optional<TimeSeriesPoint> firstInsideWindow = positiveCloses.stream()
        .filter(point -> !point.date().isBefore(targetDate))
        .min(Comparator.comparing(TimeSeriesPoint::date));
    if (firstInsideWindow.isPresent()) {
      return BigDecimal.valueOf(firstInsideWindow.orElseThrow().value());
    }

    return positiveCloses.stream()
        .max(Comparator.comparing(TimeSeriesPoint::date))
        .map(point -> BigDecimal.valueOf(point.value()))
        .orElseThrow();
  }

  private BigDecimal expectedThirtyDayChangePercent(BigDecimal latestPrice, BigDecimal baselinePrice) {
    return latestPrice
        .subtract(baselinePrice)
        .divide(baselinePrice, 6, RoundingMode.HALF_UP)
        .multiply(BigDecimal.valueOf(100));
  }

  private String liveApiKey(String envVar) {
    assumeTrue(
        "true".equalsIgnoreCase(System.getenv("LIVE_MARKET_API_TESTS")),
        "Set LIVE_MARKET_API_TESTS=true to run live market API risk smoke tests."
    );
    String apiKey = System.getenv(envVar);
    assumeTrue(StringUtils.hasText(apiKey), "Set " + envVar + " to run this live provider risk smoke test.");
    return apiKey;
  }

  private AppProperties properties(
      String finnhubApiKey,
      String twelveDataApiKey,
      String alphaVantageApiKey,
      String financialModelingPrepApiKey,
      String eodHistoricalDataApiKey
  ) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            finnhubApiKey,
            twelveDataApiKey,
            alphaVantageApiKey,
            financialModelingPrepApiKey,
            eodHistoricalDataApiKey,
            List.of(),
            List.of(),
            BigDecimal.valueOf(2_000_000_000L),
            BigDecimal.valueOf(35),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(1.5),
            BigDecimal.valueOf(40),
            BigDecimal.valueOf(20),
            BigDecimal.valueOf(65)
        ),
        null,
        null,
        null
    );
  }
}
