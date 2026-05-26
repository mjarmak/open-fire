package com.jarmak.stockmarketanalyzer.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class MarketModels {
  private MarketModels() {
  }

  public record IndicatorSnapshot(
      String id,
      String name,
      String category,
      BigDecimal value,
      String unit,
      BigDecimal change,
      String status,
      String source,
      Instant lastUpdated,
      String description
  ) {
  }

  public record StockAlert(
      String symbol,
      String companyName,
      String positionType,
      BigDecimal quantity,
      BigDecimal averageCost,
      BigDecimal latestPrice,
      BigDecimal marketCap,
      BigDecimal peRatio,
      BigDecimal beta,
      BigDecimal realizedVolatilityPercent,
      BigDecimal drawdownPercent,
      BigDecimal fearScore,
      BigDecimal marketValue,
      BigDecimal costBasis,
      BigDecimal dayGainLoss,
      BigDecimal dayGainLossPercent,
      BigDecimal unrealizedGainLoss,
      BigDecimal unrealizedGainLossPercent,
      BigDecimal thirtyDayChangePercent,
      boolean watchOnly,
      boolean alert,
      String reason
  ) {
  }

  public record PortfolioHolding(
      String symbol,
      String companyName,
      BigDecimal quantity,
      BigDecimal averageCost,
      boolean watchOnly
  ) {
  }

  public record SymbolSearchResult(
      String symbol,
      String name,
      String region,
      String currency
  ) {
  }

  public record NotificationStatus(boolean enabled, boolean configured, String provider) {
  }

  public record DashboardResponse(
      Instant asOf,
      List<IndicatorSnapshot> indicators,
      List<StockAlert> stocks,
      List<PortfolioHolding> portfolio,
      String dailyReport,
      NotificationStatus notification
  ) {
  }
}
