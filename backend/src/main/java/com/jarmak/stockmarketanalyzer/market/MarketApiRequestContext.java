package com.jarmak.stockmarketanalyzer.market;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.util.StringUtils;

public final class MarketApiRequestContext {
  private static final ThreadLocal<Settings> CURRENT = new ThreadLocal<>();

  private MarketApiRequestContext() {
  }

  public static void set(Map<String, String> apiTokens) {
    CURRENT.set(new Settings(apiTokens == null ? Map.of() : Map.copyOf(apiTokens)));
  }

  public static void clear() {
    CURRENT.remove();
  }

  public static String apiKey(String provider, String fallback) {
    Settings settings = CURRENT.get();
    if (settings == null) {
      return fallback;
    }

    String token = settings.apiTokens().get(MarketApiProvider.normalize(provider));
    return StringUtils.hasText(token) ? token : fallback;
  }

  public static String providerCacheSuffix(String provider) {
    Settings settings = CURRENT.get();
    if (settings == null) {
      return "default";
    }

    String normalized = MarketApiProvider.normalize(provider);
    return normalized + ":" + tokenHash(settings.apiTokens().get(normalized));
  }

  public static String requestCacheSuffix() {
    Settings settings = CURRENT.get();
    if (settings == null) {
      return "default";
    }

    Map<String, String> stableTokens = new TreeMap<>();
    for (String provider : MarketApiProvider.DEFAULT_ENABLED) {
      stableTokens.put(provider, tokenHash(settings.apiTokens().get(provider)));
    }
    return stableTokens.toString();
  }

  private static String tokenHash(String token) {
    if (!StringUtils.hasText(token)) {
      return "app";
    }
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder();
      for (int i = 0; i < 6 && i < digest.length; i++) {
        builder.append(String.format("%02x", digest[i]));
      }
      return builder.toString();
    } catch (NoSuchAlgorithmException exception) {
      return Integer.toHexString(token.hashCode());
    }
  }

  private record Settings(Map<String, String> apiTokens) {
  }
}
