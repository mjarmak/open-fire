package com.jarmak.stockmarketanalyzer.web;

import com.jarmak.stockmarketanalyzer.market.MarketApiProvider;
import com.jarmak.stockmarketanalyzer.market.MarketApiRequestContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class MarketApiRequestInterceptor implements HandlerInterceptor {
  static final String FINNHUB_TOKEN_HEADER = "X-OpenFire-Api-Token-Finnhub";
  static final String TWELVE_DATA_TOKEN_HEADER = "X-OpenFire-Api-Token-TwelveData";

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    MarketApiRequestContext.set(marketApiTokens(request));
    return true;
  }

  @Override
  public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
    MarketApiRequestContext.clear();
  }

  private Map<String, String> marketApiTokens(HttpServletRequest request) {
    Map<String, String> tokens = new LinkedHashMap<>();
    addToken(tokens, MarketApiProvider.FINNHUB, request.getHeader(FINNHUB_TOKEN_HEADER));
    addToken(tokens, MarketApiProvider.TWELVE_DATA, request.getHeader(TWELVE_DATA_TOKEN_HEADER));
    return tokens;
  }

  private void addToken(Map<String, String> tokens, String provider, String value) {
    if (StringUtils.hasText(value)) {
      tokens.put(provider, value.trim());
    }
  }
}
