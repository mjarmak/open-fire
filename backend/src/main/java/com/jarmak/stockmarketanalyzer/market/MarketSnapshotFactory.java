package com.jarmak.stockmarketanalyzer.market;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

final class MarketSnapshotFactory {
  private MarketSnapshotFactory() {
  }

  static Optional<CompanySnapshot> fromCandidate(String symbol, MarketSnapshotCandidate candidate, List<TimeSeriesPoint> closes) {
    if (candidate == null) {
      return Optional.empty();
    }

    BigDecimal latestPrice = candidate.latestPrice();
    BigDecimal previousClose = candidate.previousClose();
    BigDecimal dailyHigh = candidate.dailyHigh();
    BigDecimal dailyLow = candidate.dailyLow();

    if (latestPrice == null || latestPrice.signum() <= 0) {
      return Optional.empty();
    }
    if (previousClose == null || previousClose.signum() <= 0) {
      previousClose = latestClose(closes);
      if (previousClose == null || previousClose.signum() <= 0) {
        previousClose = latestPrice;
      }
    }

    BigDecimal realizedVolatilityPercent = MarketRiskMetrics.realizedVolatilityPercent(closes);
    if (realizedVolatilityPercent == null) {
      realizedVolatilityPercent = MarketRiskMetrics.quoteVolatilityPercent(latestPrice, previousClose, dailyHigh, dailyLow);
    }
    BigDecimal drawdownPercent = MarketRiskMetrics.drawdownPercent(closes, latestPrice, LocalDate.now(ZoneOffset.UTC));
    if (drawdownPercent == null) {
      drawdownPercent = MarketRiskMetrics.drawdownFromHigh(latestPrice, candidate.fiftyTwoWeekHigh());
    }
    if (drawdownPercent == null) {
      drawdownPercent = MarketRiskMetrics.drawdownFromHigh(latestPrice, dailyHigh);
    }

    BigDecimal priceThirtyDaysAgo = MarketRiskMetrics.baselineCloseForChange(closes, LocalDate.now(ZoneOffset.UTC).minusDays(30));
    if (priceThirtyDaysAgo == null) {
      priceThirtyDaysAgo = previousClose;
    }

    return Optional.of(new CompanySnapshot(
        symbol,
        candidate.name(),
        candidate.industry(),
        candidate.marketCap(),
        candidate.peRatio(),
        candidate.beta(),
        realizedVolatilityPercent,
        drawdownPercent,
        latestPrice,
        previousClose,
        priceThirtyDaysAgo
    ));
  }

  static Optional<CompanySnapshot> fromPriceCandidate(String symbol, MarketSnapshotCandidate candidate) {
    if (candidate == null) {
      return Optional.empty();
    }

    BigDecimal latestPrice = candidate.latestPrice();
    if (latestPrice == null || latestPrice.signum() <= 0) {
      return Optional.empty();
    }

    BigDecimal previousClose = candidate.previousClose();
    if (previousClose == null || previousClose.signum() <= 0) {
      previousClose = latestPrice;
    }

    return Optional.of(new CompanySnapshot(
        symbol,
        candidate.name(),
        candidate.industry(),
        candidate.marketCap(),
        null,
        null,
        null,
        null,
        latestPrice,
        previousClose,
        null
    ));
  }

  private static BigDecimal latestClose(List<TimeSeriesPoint> closes) {
    if (closes == null || closes.isEmpty()) {
      return null;
    }
    return BigDecimal.valueOf(closes.get(closes.size() - 1).value());
  }
}
