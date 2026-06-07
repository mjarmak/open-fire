package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class MarketRiskMetricsTest {
  @Test
  void calculatesRealizedVolatilityFromRecentCloses() {
    BigDecimal volatility = MarketRiskMetrics.realizedVolatilityPercent(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 20), 100),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 21), 104),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 22), 101),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 23), 108)
    ));

    assertThat(volatility).isNotNull();
    assertThat(volatility).isGreaterThan(BigDecimal.ZERO);
  }

  @Test
  void calculatesDrawdownFromRecentHigh() {
    BigDecimal drawdown = MarketRiskMetrics.drawdownPercent(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 1), 100),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 10), 125),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 20), 110)
    ), BigDecimal.valueOf(100), LocalDate.of(2026, 5, 28));

    assertThat(drawdown).isEqualByComparingTo("20.0");
  }

  @Test
  void fallsBackToQuoteRangeVolatilityWhenClosesAreMissing() {
    BigDecimal volatility = MarketRiskMetrics.quoteVolatilityPercent(
        BigDecimal.valueOf(103),
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(106),
        BigDecimal.valueOf(99)
    );

    assertThat(volatility).isNotNull();
    assertThat(volatility).isGreaterThan(BigDecimal.ZERO);
  }

  @Test
  void fallsBackToKnownHighForDrawdownWhenClosesAreMissing() {
    BigDecimal drawdown = MarketRiskMetrics.drawdownFromHigh(BigDecimal.valueOf(80), BigDecimal.valueOf(100));

    assertThat(drawdown).isEqualByComparingTo("20.0");
  }

  @Test
  void usesCloseOnOrBeforeChangeCutoffInsteadOfNearestFutureClose() {
    BigDecimal baseline = MarketRiskMetrics.baselineCloseForChange(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 7), 100),
        new TimeSeriesPoint(LocalDate.of(2026, 5, 11), 130),
        new TimeSeriesPoint(LocalDate.of(2026, 6, 6), 110)
    ), LocalDate.of(2026, 5, 9));

    assertThat(baseline).isEqualByComparingTo("100.0");
  }

  @Test
  void fallsBackToEarliestPositiveCloseWhenNoCloseExistsBeforeChangeCutoff() {
    BigDecimal baseline = MarketRiskMetrics.baselineCloseForChange(List.of(
        new TimeSeriesPoint(LocalDate.of(2026, 5, 11), 130),
        new TimeSeriesPoint(LocalDate.of(2026, 6, 6), 140)
    ), LocalDate.of(2026, 5, 9));

    assertThat(baseline).isEqualByComparingTo("130.0");
  }
}
