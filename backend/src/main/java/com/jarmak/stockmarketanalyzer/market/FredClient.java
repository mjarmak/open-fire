package com.jarmak.stockmarketanalyzer.market;

import com.fasterxml.jackson.databind.JsonNode;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class FredClient {
  private final AppProperties properties;
  private final RestClient restClient;
  private final Map<String, List<TimeSeriesPoint>> lastGoodObservations = new ConcurrentHashMap<>();

  public FredClient(AppProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  public List<TimeSeriesPoint> latestObservations(String seriesId) {
    if (!StringUtils.hasText(properties.market().fredApiKey())) {
      return List.of();
    }

    try {
      JsonNode response = restClient.get()
          .uri(uriBuilder -> uriBuilder
              .scheme("https")
              .host("api.stlouisfed.org")
              .path("/fred/series/observations")
              .queryParam("series_id", seriesId)
              .queryParam("api_key", properties.market().fredApiKey())
              .queryParam("file_type", "json")
              .queryParam("sort_order", "desc")
              .queryParam("limit", 10)
              .build())
          .retrieve()
          .body(JsonNode.class);

      List<TimeSeriesPoint> points = new ArrayList<>();
      if (response == null || !response.has("observations")) {
        return points;
      }

      for (JsonNode observation : response.get("observations")) {
        String value = observation.path("value").asText(".");
        if (!".".equals(value)) {
          points.add(new TimeSeriesPoint(LocalDate.parse(observation.path("date").asText()), Double.parseDouble(value)));
        }
      }
      if (!points.isEmpty()) {
        lastGoodObservations.put(seriesId, points);
        return points;
      }
      return lastGoodObservations.getOrDefault(seriesId, List.of());
    } catch (RuntimeException exception) {
      return lastGoodObservations.getOrDefault(seriesId, List.of());
    }
  }
}
