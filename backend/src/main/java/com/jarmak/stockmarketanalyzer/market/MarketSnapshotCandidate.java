package com.jarmak.stockmarketanalyzer.market;

import java.math.BigDecimal;

record MarketSnapshotCandidate(
    String name,
    String industry,
    BigDecimal marketCap,
    BigDecimal peRatio,
    BigDecimal beta,
    BigDecimal latestPrice,
    BigDecimal previousClose,
    BigDecimal dailyHigh,
    BigDecimal dailyLow,
    BigDecimal fiftyTwoWeekHigh
) {
}
