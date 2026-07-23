package com.jarmak.stockmarketanalyzer.market;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.springframework.util.StringUtils;

public final class MarketApiUtils {
  private static final Map<String, String> CRYPTO_NAMES = Map.ofEntries(
      Map.entry("BTC", "Bitcoin"),
      Map.entry("ETH", "Ethereum"),
      Map.entry("ADA", "Cardano"),
      Map.entry("SOL", "Solana"),
      Map.entry("XRP", "XRP"),
      Map.entry("DOGE", "Dogecoin"),
      Map.entry("BNB", "BNB"),
      Map.entry("LTC", "Litecoin"),
      Map.entry("DOT", "Polkadot"),
      Map.entry("AVAX", "Avalanche"),
      Map.entry("MATIC", "Polygon"),
      Map.entry("LINK", "Chainlink"),
      Map.entry("UNI", "Uniswap"),
      Map.entry("TRX", "TRON"),
      Map.entry("SHIB", "Shiba Inu"),
      Map.entry("TON", "Toncoin"),
      Map.entry("BCH", "Bitcoin Cash"),
      Map.entry("XLM", "Stellar"),
      Map.entry("ATOM", "Cosmos"),
      Map.entry("ETC", "Ethereum Classic"),
      Map.entry("FIL", "Filecoin"),
      Map.entry("NEAR", "NEAR Protocol"),
      Map.entry("ICP", "Internet Computer"),
      Map.entry("APT", "Aptos"),
      Map.entry("ARB", "Arbitrum"),
      Map.entry("OP", "Optimism")
  );

  public static final List<String> CRYPTO_EXCHANGES = List.of("binance", "coinbase");
  public static final List<String> FOREX_EXCHANGES = List.of("oanda", "fxcm");
  private static final List<String> CRYPTO_PAIR_QUOTES = List.of("USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "EUR", "GBP");
  private static final List<String> USD_COMPATIBLE_CRYPTO_QUOTES = List.of("USDT", "USDC", "BUSD");

  private MarketApiUtils() {
  }

  public enum AssetClass {
    STOCK,
    CRYPTO,
    FOREX
  }

  public record CryptoPair(String base, String quote) {
  }

  public static AssetClass assetClass(String symbol) {
    String normalized = symbol == null ? "" : symbol.toUpperCase();
    if (normalized.contains(":")) {
      String prefix = normalized.substring(0, normalized.indexOf(':'));
      if (List.of("BINANCE", "COINBASE", "KRAKEN", "BITFINEX", "KUCOIN", "HUOBI").contains(prefix)) {
        return AssetClass.CRYPTO;
      }
      return AssetClass.FOREX;
    }
    if (normalized.contains("_")) {
      return AssetClass.FOREX;
    }
    if (cryptoPair(normalized).isPresent()) {
      return AssetClass.CRYPTO;
    }
    return AssetClass.STOCK;
  }

  public static String assetClassLabel(AssetClass assetClass, String stockIndustry) {
    return switch (assetClass) {
      case CRYPTO -> "Crypto";
      case FOREX -> "Currency";
      case STOCK -> stockIndustry == null ? "" : stockIndustry;
    };
  }

  public static String candlePath(String symbol) {
    return switch (assetClass(symbol)) {
      case CRYPTO -> "/crypto/candle";
      case FOREX -> "/forex/candle";
      case STOCK -> "/stock/candle";
    };
  }

  public static String toTwelveDataSymbol(String symbol) {
    String normalized = symbol == null ? "" : symbol.trim().toUpperCase();
    if (!StringUtils.hasText(normalized)) {
      return "";
    }

    if (normalized.contains(":")) {
      normalized = normalized.substring(normalized.indexOf(':') + 1);
    }

    return normalized
        .replace("_", "/")
        .replace("-", "/");
  }

  public static String normalizeSearchText(String value) {
    return (value == null ? "" : value)
        .toLowerCase()
        .replaceAll("[^a-z0-9]+", "");
  }

  public static boolean isKnownCryptoSearchTerm(String value) {
    String normalized = normalizeSearchText(value);
    if (!StringUtils.hasText(normalized)) {
      return false;
    }

    return CRYPTO_NAMES.entrySet().stream()
        .anyMatch(entry ->
            normalized.equals(normalizeSearchText(entry.getKey()))
                || normalized.equals(normalizeSearchText(entry.getValue()))
        );
  }

  public static Optional<CryptoPair> cryptoPair(String value) {
    String normalized = normalizedPairSymbol(value);
    if (!StringUtils.hasText(normalized)) {
      return Optional.empty();
    }

    for (String quote : CRYPTO_PAIR_QUOTES) {
      if (normalized.endsWith(quote) && normalized.length() > quote.length()) {
        String base = normalized.substring(0, normalized.length() - quote.length());
        if (CRYPTO_NAMES.containsKey(base)) {
          return Optional.of(new CryptoPair(base, quote));
        }
      }
    }
    return Optional.empty();
  }

  public static boolean cryptoPairMatches(String requestedSymbol, String candidateSymbol) {
    Optional<CryptoPair> requested = cryptoPair(requestedSymbol);
    Optional<CryptoPair> candidate = cryptoPair(candidateSymbol);
    if (requested.isEmpty() || candidate.isEmpty()) {
      return false;
    }

    return requested.get().base().equals(candidate.get().base())
        && cryptoQuotesCompatible(requested.get().quote(), candidate.get().quote());
  }

  public static boolean cryptoQuotesCompatible(String requestedQuote, String candidateQuote) {
    if (requestedQuote.equals(candidateQuote)) {
      return true;
    }
    if ("USD".equals(requestedQuote)) {
      return USD_COMPATIBLE_CRYPTO_QUOTES.contains(candidateQuote);
    }
    if ("USD".equals(candidateQuote)) {
      return USD_COMPATIBLE_CRYPTO_QUOTES.contains(requestedQuote);
    }
    return false;
  }

  public static BigDecimal positiveMetric(JsonNode node) {
    BigDecimal value = BigDecimal.valueOf(node.asDouble(0));
    return value.signum() > 0 ? value : null;
  }

  public static BigDecimal decimalMetric(JsonNode node) {
    double value = node.asDouble(Double.NaN);
    return Double.isFinite(value) ? BigDecimal.valueOf(value) : null;
  }

  public static BigDecimal positiveMetricFromText(JsonNode node) {
    String text = node.asText("");
    if (!StringUtils.hasText(text) || "null".equalsIgnoreCase(text)) {
      return null;
    }

    try {
      BigDecimal value = new BigDecimal(text);
      return value.signum() > 0 ? value : null;
    } catch (NumberFormatException exception) {
      return null;
    }
  }

  public static BigDecimal decimalMetricFromText(JsonNode node) {
    String text = node.asText("");
    if (!StringUtils.hasText(text) || "null".equalsIgnoreCase(text)) {
      return null;
    }
    try {
      return new BigDecimal(text);
    } catch (NumberFormatException exception) {
      return null;
    }
  }

  public static String currencyFromSymbol(String displaySymbol, String symbol) {
    String candidate = StringUtils.hasText(displaySymbol) ? displaySymbol : symbol;
    int separator = Math.max(candidate.lastIndexOf('/'), Math.max(candidate.lastIndexOf('-'), candidate.lastIndexOf('_')));
    if (separator >= 0 && separator + 1 < candidate.length()) {
      return candidate.substring(separator + 1).toUpperCase();
    }

    if (candidate.length() >= 6) {
      return candidate.substring(candidate.length() - 3).toUpperCase();
    }
    return "";
  }

  public static String cryptoDescription(String symbol, String displaySymbol, String description) {
    String base = baseCryptoSymbol(displaySymbol, symbol);
    String cryptoName = CRYPTO_NAMES.get(base);
    if (!StringUtils.hasText(cryptoName)) {
      return StringUtils.hasText(description) ? description : displaySymbol;
    }

    String currentDescription = StringUtils.hasText(description) ? description : displaySymbol;
    String normalizedDescription = normalizeSearchText(currentDescription);
    if (normalizedDescription.contains(normalizeSearchText(cryptoName))) {
      return currentDescription;
    }

    String quote = currencyFromSymbol(displaySymbol, symbol);
    if (StringUtils.hasText(quote)) {
      return cryptoName + " / " + quote;
    }
    return cryptoName;
  }

  public static String baseCryptoSymbol(String displaySymbol, String symbol) {
    String candidate = StringUtils.hasText(displaySymbol) ? displaySymbol : symbol;
    int exchangeSeparator = candidate.indexOf(':');
    if (exchangeSeparator >= 0 && exchangeSeparator + 1 < candidate.length()) {
      candidate = candidate.substring(exchangeSeparator + 1);
    }

    int pairSeparator = firstPairSeparator(candidate);
    if (pairSeparator > 0) {
      return candidate.substring(0, pairSeparator).toUpperCase();
    }

    String normalized = candidate.toUpperCase().replaceAll("[^A-Z0-9]", "");
    for (String quote : CRYPTO_PAIR_QUOTES) {
      if (normalized.endsWith(quote) && normalized.length() > quote.length()) {
        return normalized.substring(0, normalized.length() - quote.length());
      }
    }
    return normalized;
  }

  private static String normalizedPairSymbol(String value) {
    String candidate = value == null ? "" : value.trim().toUpperCase();
    int exchangeSeparator = candidate.indexOf(':');
    if (exchangeSeparator >= 0 && exchangeSeparator + 1 < candidate.length()) {
      candidate = candidate.substring(exchangeSeparator + 1);
    }
    return candidate.replaceAll("[^A-Z0-9]", "");
  }

  public static int firstPairSeparator(String value) {
    int separator = -1;
    for (char candidate : List.of('/', '-', '_')) {
      int index = value.indexOf(candidate);
      if (index >= 0) {
        separator = separator < 0 ? index : Math.min(separator, index);
      }
    }
    return separator;
  }

  public static String resolveName(String name, String symbol) {
    return StringUtils.hasText(name) ? name : symbol;
  }

  public static LocalDate parseDate(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String normalized = value.trim();

    try {
      return LocalDate.parse(normalized);
    } catch (DateTimeParseException ignored) {
      // Fall back to datetime parsing.
    }
    try {
      return LocalDateTime.parse(normalized).toLocalDate();
    } catch (DateTimeParseException ignored) {
      // Fall back to timestamp parsing.
    }
    try {
      return LocalDateTime.parse(normalized.replace(' ', 'T')).toLocalDate();
    } catch (DateTimeParseException ignored) {
      // Fall back to timestamp parsing.
    }
    try {
      return Instant.ofEpochSecond(Long.parseLong(normalized)).atOffset(ZoneOffset.UTC).toLocalDate();
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  public static Instant parseInstant(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String normalized = value.trim();
    try {
      return Instant.parse(normalized);
    } catch (DateTimeParseException ignored) {
      // Keep trying alternate formats.
    }
    try {
      return LocalDateTime.parse(normalized).toInstant(ZoneOffset.UTC);
    } catch (DateTimeParseException ignored) {
      // Continue below.
    }
    try {
      return LocalDateTime.parse(normalized.replace(' ', 'T')).toInstant(ZoneOffset.UTC);
    } catch (DateTimeParseException ignored) {
      // Continue below.
    }
    try {
      return LocalDate.parse(normalized).atStartOfDay(ZoneOffset.UTC).toInstant();
    } catch (DateTimeParseException ignored) {
      // Keep trying numeric parsing.
    }
    try {
      return Instant.ofEpochSecond(Long.parseLong(normalized));
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  public static <T> List<T> sample(List<T> points, int maxPoints, Function<T, Object> timestampAccessor) {
    if (points.size() <= maxPoints) {
      return points;
    }

    List<T> sampled = new ArrayList<>();
    int step = (int) Math.ceil(points.size() / (double) maxPoints);
    for (int index = 0; index < points.size(); index += step) {
      sampled.add(points.get(index));
    }

    T last = points.get(points.size() - 1);
    if (sampled.isEmpty() || !timestampAccessor.apply(sampled.get(sampled.size() - 1)).equals(timestampAccessor.apply(last))) {
      sampled.add(last);
    }
    return sampled;
  }
}
