package com.jarmak.stockmarketanalyzer.market;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
public class MarketApiTokenTestService {
  private static final Logger LOGGER = LoggerFactory.getLogger(MarketApiTokenTestService.class);
  private static final String TEST_SYMBOL = "AAPL";

  private final RestClient restClient;

  public MarketApiTokenTestService(RestClient restClient) {
    this.restClient = restClient;
  }

  public MarketApiTokenTestResult test(String provider, String tokenOverride) {
    String normalizedProvider = MarketApiProvider.normalize(provider);
    if (!StringUtils.hasText(normalizedProvider)) {
      return new MarketApiTokenTestResult(provider, false, "Unknown market data API.");
    }

    String providerName = providerName(normalizedProvider);
    if (!StringUtils.hasText(tokenOverride)) {
      return new MarketApiTokenTestResult(normalizedProvider, false, "Enter a %s token before testing.".formatted(providerName));
    }

    try {
      JsonNode response = testQuery(normalizedProvider, tokenOverride.trim());
      String providerMessage = providerMessage(normalizedProvider, response);
      if (StringUtils.hasText(providerMessage)) {
        return new MarketApiTokenTestResult(normalizedProvider, false, providerMessage);
      }

      if (hasSymbolResult(normalizedProvider, response)) {
        return new MarketApiTokenTestResult(normalizedProvider, true, "%s token works.".formatted(providerName));
      }

      return new MarketApiTokenTestResult(normalizedProvider, false, "%s did not return a valid test result.".formatted(providerName));
    } catch (RestClientResponseException exception) {
      LOGGER.debug("{} token test failed with status {}: {}", providerName, exception.getStatusCode(), exception.getMessage());
      if (exception.getStatusCode().value() == 429) {
        return new MarketApiTokenTestResult(normalizedProvider, false, "%s is rate limited right now. Try again later.".formatted(providerName));
      }
      return new MarketApiTokenTestResult(normalizedProvider, false, "%s rejected the token or could not authorize the request.".formatted(providerName));
    } catch (RuntimeException exception) {
      LOGGER.debug("{} token test failed: {}", providerName, exception.getMessage());
      return new MarketApiTokenTestResult(normalizedProvider, false, "Could not reach %s right now.".formatted(providerName));
    }
  }

  private JsonNode testQuery(String provider, String apiKey) {
    return switch (provider) {
      case MarketApiProvider.FINNHUB -> restClient.get()
          .uri(uriBuilder -> uriBuilder
              .scheme("https")
              .host("finnhub.io")
              .path("/api/v1/search")
              .queryParam("q", TEST_SYMBOL)
              .queryParam("token", apiKey)
              .build())
          .retrieve()
          .body(JsonNode.class);
      case MarketApiProvider.TWELVE_DATA -> restClient.get()
          .uri(uriBuilder -> uriBuilder
              .scheme("https")
              .host("api.twelvedata.com")
              .path("/symbol_search")
              .queryParam("symbol", TEST_SYMBOL)
              .queryParam("apikey", apiKey)
              .build())
          .retrieve()
          .body(JsonNode.class);
      default -> null;
    };
  }

  private boolean hasSymbolResult(String provider, JsonNode response) {
    if (response == null || response.isMissingNode() || response.isNull()) {
      return false;
    }

    return switch (provider) {
      case MarketApiProvider.FINNHUB -> response.path("result").isArray() && !response.path("result").isEmpty();
      case MarketApiProvider.TWELVE_DATA -> arrayWithValues(response.path("data")) || arrayWithValues(response.path("symbols"));
      default -> false;
    };
  }

  private boolean arrayWithValues(JsonNode node) {
    return node.isArray() && !node.isEmpty();
  }

  private String providerMessage(String provider, JsonNode response) {
    if (response == null || response.isMissingNode() || response.isNull()) {
      return "";
    }

    String message = firstText(response, "message", "error", "Error Message", "Note", "Information");
    if (StringUtils.hasText(message)) {
      return "%s returned: %s".formatted(providerName(provider), message);
    }

    if (MarketApiProvider.TWELVE_DATA.equals(provider) && "error".equalsIgnoreCase(response.path("status").asText())) {
      return "%s returned an error.".formatted(providerName(provider));
    }
    return "";
  }

  private String firstText(JsonNode node, String... fields) {
    for (String field : fields) {
      String value = node.path(field).asText("");
      if (StringUtils.hasText(value)) {
        return value;
      }
    }
    return "";
  }

  private String providerName(String provider) {
    return switch (provider) {
      case MarketApiProvider.FINNHUB -> "Finnhub";
      case MarketApiProvider.TWELVE_DATA -> "Twelve Data";
      default -> "Market data API";
    };
  }

  public record MarketApiTokenTestResult(String provider, boolean success, String message) {
  }
}
