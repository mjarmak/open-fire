package com.jarmak.stockmarketanalyzer.config;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
    Security security,
    Market market,
    Database database,
    Telegram telegram,
    Cors cors
) {
  public record Security(String username, String fixedSalt, String passwordHash) {
  }

  public record Market(
      String fredApiKey,
      String finnhubApiKey,
      List<String> breadthSymbols,
      List<String> crossAssetSymbols,
      BigDecimal lowMarketCapThreshold,
      BigDecimal fastRisePercentThreshold,
      BigDecimal highVixThreshold,
      BigDecimal highPeThreshold,
      BigDecimal highBetaThreshold,
      BigDecimal highRealizedVolatilityThreshold,
      BigDecimal highDrawdownThreshold,
      BigDecimal stockFearScoreThreshold
  ) {
  }

  public record Database(
      String url,
      String username,
      String password
  ) {
  }

  public record Telegram(
      boolean enabled,
      String botUsername,
      String botToken
  ) {
  }

  public record Cors(
      List<String> allowedOriginPatterns
  ) {
  }
}
