package com.jarmak.stockmarketanalyzer.market;

import java.math.BigDecimal;

public record CompanySnapshot(
    String symbol,
    String name,
    String industry,
    BigDecimal marketCap,
    BigDecimal peRatio,
    BigDecimal beta,
    BigDecimal realizedVolatilityPercent,
    BigDecimal drawdownPercent,
    BigDecimal latestPrice,
    BigDecimal previousClose,
    BigDecimal priceThirtyDaysAgo
) {
  public BigDecimal thirtyDayChangePercent() {
    if (priceThirtyDaysAgo == null || latestPrice == null || priceThirtyDaysAgo.signum() == 0) {
      return BigDecimal.ZERO;
    }

    return latestPrice
        .subtract(priceThirtyDaysAgo)
        .divide(priceThirtyDaysAgo, 6, java.math.RoundingMode.HALF_UP)
        .multiply(BigDecimal.valueOf(100));
  }
}
