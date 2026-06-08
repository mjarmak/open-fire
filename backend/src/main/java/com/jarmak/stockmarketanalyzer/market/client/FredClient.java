package com.jarmak.stockmarketanalyzer.market.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.TimeSeriesPoint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class FredClient {
  private static final Logger LOGGER = LoggerFactory.getLogger(FredClient.class);
  private static final long HISTORY_CACHE_SECONDS = 900;

  private final AppProperties properties;
  private final RestClient restClient;
  private final Map<String, List<TimeSeriesPoint>> lastGoodObservations = new ConcurrentHashMap<>();
  private final Map<String, List<ChartPoint>> lastGoodHistory = new ConcurrentHashMap<>();
  private final Map<String, CacheEntry<List<ChartPoint>>> historyCache = new ConcurrentHashMap<>();

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
        LOGGER.debug("FRED latest observations found {} result(s) for {}.", points.size(), seriesId);
        lastGoodObservations.put(seriesId, points);
        return points;
      }
      return lastGoodObservations.getOrDefault(seriesId, List.of());
    } catch (RuntimeException exception) {
      return lastGoodObservations.getOrDefault(seriesId, List.of());
    }
  }

  public List<ChartPoint> observations(String seriesId, HistoryRange range) {
    if (!StringUtils.hasText(properties.market().fredApiKey())) {
      return List.of();
    }

    String cacheKey = seriesId + "|" + range.label();
    CacheEntry<List<ChartPoint>> cached = historyCache.get(cacheKey);
    if (cached != null && !cached.expired()) {
      return cached.value();
    }

    try {
      JsonNode response = restClient.get()
          .uri(uriBuilder -> {
            var builder = uriBuilder
                .scheme("https")
                .host("api.stlouisfed.org")
                .path("/fred/series/observations")
                .queryParam("series_id", seriesId)
                .queryParam("api_key", properties.market().fredApiKey())
                .queryParam("file_type", "json")
                .queryParam("sort_order", "asc")
                .queryParam("limit", 10000);

            if (!range.allTime()) {
              long days = Math.max(0, range.lookback().toDays());
              builder.queryParam("observation_start", LocalDate.now(ZoneOffset.UTC).minusDays(days));
            }

            return builder.build();
          })
          .retrieve()
          .body(JsonNode.class);

      List<ChartPoint> points = new ArrayList<>();
      if (response == null || !response.has("observations")) {
        return lastGoodHistory.getOrDefault(cacheKey, List.of());
      }

      for (JsonNode observation : response.get("observations")) {
        String value = observation.path("value").asText(".");
        if (!".".equals(value)) {
          LocalDate date = LocalDate.parse(observation.path("date").asText());
          points.add(new ChartPoint(
              date.atStartOfDay().toInstant(ZoneOffset.UTC),
              BigDecimal.valueOf(Double.parseDouble(value))
          ));
        }
      }

      List<ChartPoint> sampled = sample(points.stream().sorted(Comparator.comparing(ChartPoint::timestamp)).toList(), 260);
      if (!sampled.isEmpty()) {
        LOGGER.debug("FRED history found {} result(s) for {} {}.", sampled.size(), seriesId, range.label());
        lastGoodHistory.put(cacheKey, sampled);
        historyCache.put(cacheKey, new CacheEntry<>(sampled, Instant.now().plusSeconds(HISTORY_CACHE_SECONDS)));
        return sampled;
      }
      return lastGoodHistory.getOrDefault(cacheKey, List.of());
    } catch (RuntimeException exception) {
      return lastGoodHistory.getOrDefault(cacheKey, List.of());
    }
  }

  private List<ChartPoint> sample(List<ChartPoint> points, int maxPoints) {
    if (points.size() <= maxPoints) {
      return points;
    }

    List<ChartPoint> sampled = new ArrayList<>();
    int step = (int) Math.ceil(points.size() / (double) maxPoints);
    for (int index = 0; index < points.size(); index += step) {
      sampled.add(points.get(index));
    }

    ChartPoint last = points.get(points.size() - 1);
    if (sampled.isEmpty() || !sampled.get(sampled.size() - 1).timestamp().equals(last.timestamp())) {
      sampled.add(last);
    }
    return sampled;
  }

  private record CacheEntry<T>(T value, Instant expiresAt) {
    boolean expired() {
      return Instant.now().isAfter(expiresAt);
    }
  }
}
