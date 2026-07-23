package com.jarmak.stockmarketanalyzer.market;

import java.util.List;
import java.util.Locale;
import org.springframework.util.StringUtils;

public final class MarketApiProvider {
  public static final String FINNHUB = "finnhub";
  public static final String TWELVE_DATA = "twelvedata";

  public static final List<String> DEFAULT_ENABLED = List.of(
      FINNHUB,
      TWELVE_DATA
  );

  private MarketApiProvider() {
  }

  public static String normalize(String provider) {
    if (!StringUtils.hasText(provider)) {
      return "";
    }

    String normalized = provider.trim().toLowerCase(Locale.ROOT).replace("_", "").replace("-", "");
    return switch (normalized) {
      case "finnhub" -> FINNHUB;
      case "twelvedata" -> TWELVE_DATA;
      default -> "";
    };
  }
}
