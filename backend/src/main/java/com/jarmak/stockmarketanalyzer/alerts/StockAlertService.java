package com.jarmak.stockmarketanalyzer.alerts;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.CompanySnapshot;
import com.jarmak.stockmarketanalyzer.market.FinnhubClient;
import com.jarmak.stockmarketanalyzer.market.MarketModels.PortfolioHolding;
import com.jarmak.stockmarketanalyzer.market.MarketModels.StockAlert;
import com.jarmak.stockmarketanalyzer.portfolio.PortfolioService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class StockAlertService {
  private final AppProperties properties;
  private final FinnhubClient finnhubClient;
  private final PortfolioService portfolioService;

  public StockAlertService(AppProperties properties, FinnhubClient finnhubClient, PortfolioService portfolioService) {
    this.properties = properties;
    this.finnhubClient = finnhubClient;
    this.portfolioService = portfolioService;
  }

  public List<StockAlert> evaluateWatchedStocks(BigDecimal vixFearIndex) {
    return portfolioService.holdings().stream()
        .map(holding -> evaluate(holding, vixFearIndex))
        .toList();
  }

  public List<StockAlert> evaluateWatchedStocksForUser(String username, BigDecimal vixFearIndex) {
    return portfolioService.holdingsForUser(username).stream()
        .map(holding -> evaluate(holding, vixFearIndex))
        .toList();
  }

  public StockAlert preview(String symbol, String companyName) {
    PortfolioHolding holding = new PortfolioHolding(
        null,
        symbol,
        companyName,
        BigDecimal.ONE,
        BigDecimal.ZERO,
        true
    );
    return evaluate(holding, null);
  }

  public StockAlert pricePreview(String symbol, String companyName) {
    Optional<CompanySnapshot> maybeSnapshot = finnhubClient.companyPriceSnapshot(symbol);
    if (maybeSnapshot.isEmpty()) {
      return new StockAlert(
          null,
          symbol,
          companyName,
          "Unknown",
          BigDecimal.ONE,
          BigDecimal.ZERO,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          true,
          false,
          "Price details are unavailable."
      );
    }

    CompanySnapshot snapshot = maybeSnapshot.get();
    BigDecimal latestPrice = snapshot.latestPrice().setScale(2, RoundingMode.HALF_UP);
    BigDecimal previousClose = snapshot.previousClose() == null
        ? null
        : snapshot.previousClose().setScale(2, RoundingMode.HALF_UP);
    BigDecimal stockDayChange = previousClose == null
        ? null
        : latestPrice.subtract(previousClose).setScale(2, RoundingMode.HALF_UP);
    BigDecimal dayGainLossPercent = previousClose == null || previousClose.signum() == 0
        ? null
        : stockDayChange.divide(previousClose, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);

    return new StockAlert(
        null,
        snapshot.symbol(),
        snapshot.name() == null || snapshot.name().isBlank() ? companyName : snapshot.name(),
        positionType(snapshot),
        BigDecimal.ONE,
        BigDecimal.ZERO,
        latestPrice,
        snapshot.marketCap(),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        stockDayChange,
        dayGainLossPercent,
        null,
        null,
        null,
        true,
        false,
        "Price details loaded."
    );
  }

  private StockAlert evaluate(PortfolioHolding holding, BigDecimal vixFearIndex) {
    BigDecimal roundedVixFearIndex = vixFearIndex == null ? null : vixFearIndex.setScale(1, RoundingMode.HALF_UP);
    boolean highFear = aboveOrEqual(roundedVixFearIndex, properties.market().highVixThreshold());
    Optional<CompanySnapshot> maybeSnapshot = finnhubClient.companySnapshot(holding.symbol());
    if (maybeSnapshot.isEmpty()) {
      BigDecimal costBasis = holding.watchOnly() ? null : holding.quantity().multiply(holding.averageCost()).setScale(2, RoundingMode.HALF_UP);
      String reason = highFear
          ? "VIX fear index is high at " + roundedVixFearIndex + ". Live stock market data is not available yet."
          : "Live market data is not available for this symbol yet.";
      return new StockAlert(
          holding.id(),
          holding.symbol(),
          holding.companyName(),
          "Unknown",
          holding.quantity(),
          holding.averageCost(),
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          costBasis,
          null,
          null,
          null,
          null,
          null,
          holding.watchOnly(),
          highFear,
          reason
      );
    }

    CompanySnapshot snapshot = maybeSnapshot.get();
    BigDecimal change = snapshot.thirtyDayChangePercent().setScale(1, RoundingMode.HALF_UP);
    BigDecimal latestPrice = snapshot.latestPrice().setScale(2, RoundingMode.HALF_UP);
    BigDecimal previousClose = snapshot.previousClose().setScale(2, RoundingMode.HALF_UP);
    BigDecimal costBasis = holding.watchOnly() ? null : holding.quantity().multiply(holding.averageCost()).setScale(2, RoundingMode.HALF_UP);
    BigDecimal marketValue = holding.watchOnly() ? null : holding.quantity().multiply(latestPrice).setScale(2, RoundingMode.HALF_UP);
    BigDecimal stockDayChange = latestPrice.subtract(previousClose).setScale(2, RoundingMode.HALF_UP);
    BigDecimal dayGainLoss = holding.watchOnly() ? stockDayChange : holding.quantity().multiply(stockDayChange).setScale(2, RoundingMode.HALF_UP);
    BigDecimal dayGainLossPercent = previousClose.signum() == 0
        ? null
        : stockDayChange.divide(previousClose, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);
    BigDecimal gainLoss = holding.watchOnly() ? null : marketValue.subtract(costBasis).setScale(2, RoundingMode.HALF_UP);
    BigDecimal gainLossPercent = holding.watchOnly() || costBasis.signum() == 0
        ? null
        : gainLoss.divide(costBasis, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);
    BigDecimal peRatio = snapshot.peRatio() == null ? null : snapshot.peRatio().setScale(1, RoundingMode.HALF_UP);
    BigDecimal beta = round(snapshot.beta(), 2);
    BigDecimal realizedVolatility = round(snapshot.realizedVolatilityPercent(), 1);
    BigDecimal drawdown = round(snapshot.drawdownPercent(), 1);
    BigDecimal fearScore = stockFearScore(snapshot.marketCap(), peRatio, beta, realizedVolatility, drawdown, change);
    boolean highPe = above(peRatio, properties.market().highPeThreshold());
    boolean highBeta = above(beta, properties.market().highBetaThreshold());
    boolean highRealizedVolatility = above(realizedVolatility, properties.market().highRealizedVolatilityThreshold());
    boolean highDrawdown = above(drawdown, properties.market().highDrawdownThreshold());
    boolean movedTooFast = aboveOrEqual(change, properties.market().fastRisePercentThreshold());
    boolean lowMarketCap = below(snapshot.marketCap(), properties.market().lowMarketCapThreshold());
    boolean highFearScore = aboveOrEqual(fearScore, properties.market().stockFearScoreThreshold());
    boolean alert = highFear || highFearScore || highPe || highBeta || highRealizedVolatility || highDrawdown || movedTooFast || lowMarketCap;

    String reason = alertReason(
        highFear,
        roundedVixFearIndex,
        highFearScore,
        fearScore,
        highPe,
        peRatio,
        highBeta,
        beta,
        highRealizedVolatility,
        realizedVolatility,
        highDrawdown,
        drawdown,
        movedTooFast,
        change,
        lowMarketCap,
        snapshot.marketCap()
    );

    return new StockAlert(
        holding.id(),
        snapshot.symbol(),
        snapshot.name(),
        positionType(snapshot),
        holding.quantity(),
        holding.averageCost(),
        latestPrice,
        snapshot.marketCap(),
        peRatio,
        beta,
        realizedVolatility,
        drawdown,
        fearScore,
        marketValue,
        costBasis,
        dayGainLoss,
        dayGainLossPercent,
        gainLoss,
        gainLossPercent,
        change,
        holding.watchOnly(),
        alert,
        reason
    );
  }

  private String formatDecimal(BigDecimal value) {
    if (value == null) {
      return "-";
    }
    return value.setScale(2, java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
  }

  private String positionType(CompanySnapshot snapshot) {
    String industry = snapshot.industry() == null ? "" : snapshot.industry().toLowerCase();
    String symbol = snapshot.symbol() == null ? "" : snapshot.symbol().toUpperCase();
    if (symbol.contains("BTC") || symbol.contains("ETH") || symbol.contains("USDT") || industry.contains("crypto")) {
      return "Crypto";
    }
    if (industry.contains("currency") || industry.contains("forex")) {
      return "Currency";
    }
    if (industry.contains("technology") || industry.contains("software") || industry.contains("semiconductor")) {
      return "Technology";
    }
    if (industry.contains("real estate") || industry.contains("reit")) {
      return "Real Estate";
    }
    if (industry.contains("energy") || industry.contains("oil") || industry.contains("gas")) {
      return "Energy";
    }
    if (industry.contains("bank") || industry.contains("financial") || industry.contains("insurance") || industry.contains("capital markets")) {
      return "Financials";
    }
    if (industry.contains("health") || industry.contains("biotech") || industry.contains("pharmaceutical")) {
      return "Healthcare";
    }
    if (industry.contains("consumer") || industry.contains("retail") || industry.contains("restaurant") || industry.contains("auto")) {
      return "Consumer";
    }
    if (industry.contains("communication") || industry.contains("telecom") || industry.contains("media")) {
      return "Communication";
    }
    if (industry.contains("industrial") || industry.contains("aerospace") || industry.contains("machinery")) {
      return "Industrials";
    }
    if (industry.contains("material") || industry.contains("chemical") || industry.contains("metal") || industry.contains("mining")) {
      return "Materials";
    }
    if (industry.contains("utility")) {
      return "Utilities";
    }
    return "Other";
  }

  private String alertReason(
      boolean highFear,
      BigDecimal vixFearIndex,
      boolean highFearScore,
      BigDecimal fearScore,
      boolean highPe,
      BigDecimal peRatio,
      boolean highBeta,
      BigDecimal beta,
      boolean highRealizedVolatility,
      BigDecimal realizedVolatility,
      boolean highDrawdown,
      BigDecimal drawdown,
      boolean movedTooFast,
      BigDecimal thirtyDayChange,
      boolean lowMarketCap,
      BigDecimal marketCap
  ) {
    List<String> reasons = new java.util.ArrayList<>();
    if (highFear) {
      reasons.add("global VIX is above " + formatDecimal(properties.market().highVixThreshold()) + " at " + formatDecimal(vixFearIndex));
    }
    if (highFearScore) {
      reasons.add("stock fear score is " + formatDecimal(fearScore) + "/100 (threshold " + formatDecimal(properties.market().stockFearScoreThreshold()) + ")");
    }
    if (highPe) {
      reasons.add("P/E is " + formatDecimal(peRatio) + " (threshold " + formatDecimal(properties.market().highPeThreshold()) + ")");
    }
    if (highBeta) {
      reasons.add("beta is " + formatDecimal(beta) + " (threshold " + formatDecimal(properties.market().highBetaThreshold()) + ")");
    }
    if (highRealizedVolatility) {
      reasons.add("realized volatility is " + formatDecimal(realizedVolatility) + "% (threshold " + formatDecimal(properties.market().highRealizedVolatilityThreshold()) + "%)");
    }
    if (highDrawdown) {
      reasons.add("30-day drawdown is " + formatDecimal(drawdown) + "% (threshold " + formatDecimal(properties.market().highDrawdownThreshold()) + "%)");
    }
    if (movedTooFast) {
      reasons.add("up " + formatDecimal(thirtyDayChange) + "% over roughly 30 calendar days (threshold " + formatDecimal(properties.market().fastRisePercentThreshold()) + "%)");
    }
    if (lowMarketCap) {
      reasons.add("market cap is below " + formatDecimal(properties.market().lowMarketCapThreshold()) + " at " + formatDecimal(marketCap));
    }
    return reasons.isEmpty()
        ? "No watched stock alerts fired under current thresholds."
        : String.join("; ", reasons) + ".";
  }

  private BigDecimal stockFearScore(
      BigDecimal marketCap,
      BigDecimal peRatio,
      BigDecimal beta,
      BigDecimal realizedVolatility,
      BigDecimal drawdown,
      BigDecimal thirtyDayChange
  ) {
    double score = 0;
    score += 10 * cappedRatio(beta == null ? null : beta.subtract(BigDecimal.ONE), properties.market().highBetaThreshold().subtract(BigDecimal.ONE));
    score += 25 * cappedRatio(realizedVolatility, properties.market().highRealizedVolatilityThreshold());
    score += 20 * cappedRatio(drawdown, properties.market().highDrawdownThreshold());
    score += 15 * cappedRatio(thirtyDayChange.max(BigDecimal.ZERO), properties.market().fastRisePercentThreshold());
    score += 15 * cappedRatio(peRatio, properties.market().highPeThreshold());
    score += 15 * lowMarketCapRatio(marketCap, properties.market().lowMarketCapThreshold());
    return BigDecimal.valueOf(Math.round(score));
  }

  private double lowMarketCapRatio(BigDecimal marketCap, BigDecimal threshold) {
    if (marketCap == null || threshold == null || threshold.signum() <= 0 || marketCap.signum() <= 0 || marketCap.compareTo(threshold) >= 0) {
      return 0;
    }
    return threshold.subtract(marketCap).divide(threshold, 6, RoundingMode.HALF_UP).doubleValue();
  }

  private double cappedRatio(BigDecimal value, BigDecimal threshold) {
    if (value == null || threshold == null || threshold.signum() <= 0 || value.signum() <= 0) {
      return 0;
    }
    return Math.min(1, value.divide(threshold, 6, RoundingMode.HALF_UP).doubleValue());
  }

  private BigDecimal round(BigDecimal value, int scale) {
    return value == null ? null : value.setScale(scale, RoundingMode.HALF_UP);
  }

  private boolean above(BigDecimal value, BigDecimal threshold) {
    return value != null && threshold != null && value.compareTo(threshold) > 0;
  }

  private boolean aboveOrEqual(BigDecimal value, BigDecimal threshold) {
    return value != null && threshold != null && value.compareTo(threshold) >= 0;
  }

  private boolean below(BigDecimal value, BigDecimal threshold) {
    return value != null && threshold != null && value.signum() > 0 && value.compareTo(threshold) < 0;
  }
}
