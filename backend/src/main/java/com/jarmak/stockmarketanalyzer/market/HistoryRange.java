package com.jarmak.stockmarketanalyzer.market;

import java.time.Duration;
import java.util.Arrays;

public enum HistoryRange {
  ONE_HOUR("1h", "5", Duration.ofHours(1)),
  ONE_DAY("1d", "30", Duration.ofDays(1)),
  FIVE_DAYS("5d", "60", Duration.ofDays(5)),
  ONE_MONTH("1m", "D", Duration.ofDays(30)),
  ONE_YEAR("1y", "W", Duration.ofDays(365)),
  FIVE_YEARS("5y", "M", Duration.ofDays(365L * 5)),
  ALL("all", "M", null);

  private final String label;
  private final String finnhubResolution;
  private final Duration lookback;

  HistoryRange(String label, String finnhubResolution, Duration lookback) {
    this.label = label;
    this.finnhubResolution = finnhubResolution;
    this.lookback = lookback;
  }

  public String label() {
    return label;
  }

  public String finnhubResolution() {
    return finnhubResolution;
  }

  public Duration lookback() {
    return lookback;
  }

  public boolean allTime() {
    return lookback == null;
  }

  public static HistoryRange fromLabel(String label) {
    return Arrays.stream(values())
        .filter(range -> range.label.equalsIgnoreCase(label == null ? "" : label.trim()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unsupported history range: " + label));
  }
}
