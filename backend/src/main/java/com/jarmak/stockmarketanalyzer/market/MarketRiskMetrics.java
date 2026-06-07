package com.jarmak.stockmarketanalyzer.market;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class MarketRiskMetrics {
  private MarketRiskMetrics() {
  }

  static BigDecimal realizedVolatilityPercent(List<TimeSeriesPoint> closes) {
    List<Double> recentCloses = closes.stream()
        .skip(Math.max(0, closes.size() - 31))
        .map(TimeSeriesPoint::value)
        .filter(value -> value > 0)
        .toList();
    if (recentCloses.size() < 3) {
      return null;
    }

    List<Double> returns = new ArrayList<>();
    for (int i = 1; i < recentCloses.size(); i++) {
      returns.add(Math.log(recentCloses.get(i) / recentCloses.get(i - 1)));
    }

    double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    double variance = returns.stream()
        .mapToDouble(value -> Math.pow(value - mean, 2))
        .sum() / Math.max(1, returns.size() - 1);
    double annualizedPercent = Math.sqrt(variance) * Math.sqrt(252) * 100;
    return Double.isFinite(annualizedPercent) ? BigDecimal.valueOf(annualizedPercent) : null;
  }

  static BigDecimal quoteVolatilityPercent(BigDecimal latestPrice, BigDecimal previousClose, BigDecimal high, BigDecimal low) {
    if (positive(high) && positive(low) && high.compareTo(low) > 0) {
      double rangeVolatility = Math.sqrt(Math.pow(Math.log(high.doubleValue() / low.doubleValue()), 2) / (4 * Math.log(2)));
      double annualizedPercent = rangeVolatility * Math.sqrt(252) * 100;
      return Double.isFinite(annualizedPercent) ? BigDecimal.valueOf(annualizedPercent) : null;
    }

    if (!positive(latestPrice) || !positive(previousClose)) {
      return null;
    }

    double oneDayMove = Math.abs(Math.log(latestPrice.doubleValue() / previousClose.doubleValue()));
    double annualizedPercent = oneDayMove * Math.sqrt(252) * 100;
    return Double.isFinite(annualizedPercent) ? BigDecimal.valueOf(annualizedPercent) : null;
  }

  static BigDecimal drawdownPercent(List<TimeSeriesPoint> closes, BigDecimal latestPrice, LocalDate asOf) {
    if (!positive(latestPrice) || closes.isEmpty()) {
      return null;
    }

    LocalDate cutoff = asOf.minusDays(30);
    double high = closes.stream()
        .filter(point -> !point.date().isBefore(cutoff))
        .mapToDouble(TimeSeriesPoint::value)
        .filter(value -> value > 0)
        .max()
        .orElse(Double.NaN);
    if (!Double.isFinite(high)) {
      return null;
    }

    return drawdownFromHigh(latestPrice, BigDecimal.valueOf(Math.max(high, latestPrice.doubleValue())));
  }

  static BigDecimal drawdownFromHigh(BigDecimal latestPrice, BigDecimal high) {
    if (!positive(latestPrice) || !positive(high)) {
      return null;
    }

    double normalizedHigh = Math.max(high.doubleValue(), latestPrice.doubleValue());
    double drawdown = Math.max(0, (normalizedHigh - latestPrice.doubleValue()) / normalizedHigh * 100);
    return Double.isFinite(drawdown) ? BigDecimal.valueOf(drawdown) : null;
  }

  static BigDecimal baselineCloseForChange(List<TimeSeriesPoint> closes, LocalDate targetDate) {
    if (closes.isEmpty()) {
      return null;
    }

    return closes.stream()
        .filter(point -> point.value() > 0)
        .filter(point -> !point.date().isAfter(targetDate))
        .max(Comparator.comparing(TimeSeriesPoint::date))
        .or(() -> closes.stream()
            .filter(point -> point.value() > 0)
            .min(Comparator.comparing(TimeSeriesPoint::date)))
        .map(point -> BigDecimal.valueOf(point.value()))
        .orElse(null);
  }

  private static boolean positive(BigDecimal value) {
    return value != null && value.signum() > 0;
  }
}
