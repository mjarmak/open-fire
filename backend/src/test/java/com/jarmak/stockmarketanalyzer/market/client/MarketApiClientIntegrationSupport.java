package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.util.MultiValueMap;
import org.springframework.web.util.UriComponentsBuilder;

abstract class MarketApiClientIntegrationSupport {
  protected void assertEpochRequestRange(MultiValueMap<String, String> params, HistoryRange range) {
    long from = Long.parseLong(params.getFirst("from"));
    long to = Long.parseLong(params.getFirst("to"));
    assertThat(to).isPositive();

    if (range.allTime()) {
      assertThat(from).isZero();
      return;
    }

    long requestedSeconds = to - from;
    assertThat(Math.abs(requestedSeconds - range.lookback().toSeconds())).isLessThanOrEqualTo(2);
  }

  protected void assertDateRequestRange(MultiValueMap<String, String> params, HistoryRange range) {
    LocalDate startDate = LocalDate.parse(params.getFirst("start_date"));
    LocalDate endDate = LocalDate.parse(params.getFirst("end_date"));

    if (range.allTime()) {
      assertThat(startDate).isEqualTo(LocalDate.of(1970, 1, 1));
      assertThat(Math.abs(ChronoUnit.DAYS.between(endDate, LocalDate.now(ZoneOffset.UTC)))).isLessThanOrEqualTo(1);
      return;
    }

    long requestedDays = ChronoUnit.DAYS.between(startDate, endDate);
    assertThat(Math.abs(requestedDays - range.lookback().toDays())).isLessThanOrEqualTo(1);
  }

  protected void assertReturnedRange(List<ChartPoint> points, HistoryRange range) {
    assertThat(points).hasSize(2);
    assertThat(points).extracting(ChartPoint::value)
        .usingComparatorForType(BigDecimal::compareTo, BigDecimal.class)
        .containsExactly(BigDecimal.valueOf(100), BigDecimal.valueOf(110));

    Instant oldest = points.get(0).timestamp();
    Instant newest = points.get(points.size() - 1).timestamp();
    assertThat(newest).isAfter(oldest);

    if (range.allTime()) {
      assertThat(oldest).isBefore(Instant.now().minus(Duration.ofDays(365L * 10)));
      return;
    }

    Duration returnedSpan = Duration.between(oldest, newest);
    assertThat(returnedSpan).isGreaterThanOrEqualTo(minimumReturnedSpan(range));
  }

  protected Duration minimumReturnedSpan(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> Duration.ofMinutes(45);
      case ONE_DAY -> Duration.ofHours(20);
      case FIVE_DAYS -> Duration.ofDays(4);
      case ONE_MONTH -> Duration.ofDays(28);
      case ONE_YEAR -> Duration.ofDays(360);
      case FIVE_YEARS -> Duration.ofDays(365L * 5 - 7);
      case TEN_YEARS -> Duration.ofDays(365L * 10 - 14);
      case ALL -> Duration.ZERO;
    };
  }

  protected Instant fixtureStart(HistoryRange range) {
    Instant now = fixtureEnd();
    return switch (range) {
      case ONE_HOUR -> now.minus(Duration.ofMinutes(50));
      case ONE_DAY -> now.minus(Duration.ofHours(22));
      case FIVE_DAYS -> now.minus(Duration.ofDays(4));
      case ONE_MONTH -> now.minus(Duration.ofDays(29));
      case ONE_YEAR -> now.minus(Duration.ofDays(362));
      case FIVE_YEARS -> now.minus(Duration.ofDays(365L * 5 - 3));
      case TEN_YEARS -> now.minus(Duration.ofDays(365L * 10 - 3));
      case ALL -> Instant.parse("2010-01-04T00:00:00Z");
    };
  }

  protected Instant fixtureEnd() {
    return Instant.now().truncatedTo(ChronoUnit.MINUTES);
  }

  protected String finnhubHistoryPayload(Instant start, Instant end) {
    return """
        {"s":"ok","c":[100,110],"t":[%d,%d]}
        """.formatted(start.getEpochSecond(), end.getEpochSecond());
  }

  protected String twelveDataHistoryPayload(Instant start, Instant end) {
    return """
        {
          "values": [
            {"datetime":"%s","close":"110"},
            {"datetime":"%s","close":"100"}
          ]
        }
        """.formatted(providerDateTime(end), providerDateTime(start));
  }

  protected String providerDateTime(Instant instant) {
    return LocalDateTime.ofInstant(instant, ZoneOffset.UTC)
        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
  }

  protected String twelveDataInterval(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "5min";
      case ONE_DAY -> "15min";
      case FIVE_DAYS -> "30min";
      case ONE_MONTH, ONE_YEAR, FIVE_YEARS, TEN_YEARS, ALL -> "1day";
    };
  }

  protected String twelveDataOutputSize(HistoryRange range) {
    return switch (range) {
      case ONE_HOUR -> "120";
      case ONE_DAY -> "120";
      case FIVE_DAYS -> "300";
      case ONE_MONTH -> "60";
      case ONE_YEAR -> "400";
      case FIVE_YEARS -> "2000";
      case TEN_YEARS, ALL -> "5000";
    };
  }

  protected MultiValueMap<String, String> queryParams(String uri) {
    return UriComponentsBuilder.fromUriString(uri).build().getQueryParams();
  }

  protected void clearTwelveDataRateLimitBackoff(TwelveDataApiService service) throws Exception {
    java.lang.reflect.Field field = TwelveDataApiService.class.getDeclaredField("rateLimitBackoff");
    field.setAccessible(true);
    ((Map<?, ?>) field.get(service)).clear();
  }

  protected AppProperties properties(String finnhubApiKey, String twelveDataApiKey) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            finnhubApiKey,
            twelveDataApiKey,
            List.of(),
            List.of(),
            BigDecimal.valueOf(2_000_000_000L),
            BigDecimal.valueOf(35),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(1.5),
            BigDecimal.valueOf(40),
            BigDecimal.valueOf(20),
            BigDecimal.valueOf(65)
        ),
        null,
        null,
        null
    );
  }
}
