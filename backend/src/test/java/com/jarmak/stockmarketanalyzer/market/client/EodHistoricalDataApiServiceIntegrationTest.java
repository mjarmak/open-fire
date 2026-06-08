package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

class EodHistoricalDataApiServiceIntegrationTest extends MarketApiClientIntegrationSupport {
  @ParameterizedTest
  @EnumSource(HistoryRange.class)
  void historyRequestsAndReturnsTheSelectedDateRange(HistoryRange range) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    EodHistoricalDataApiService service =
        new EodHistoricalDataApiService(properties(null, null, null, null, "eodhd"), builder.build());

    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();
    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo("eodhd.com");
          assertThat(request.getURI().getPath()).isEqualTo(eodHistoricalDataPath(range));
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst("api_token")).isEqualTo("eodhd");
          assertThat(params.getFirst("fmt")).isEqualTo("json");
          if (range == HistoryRange.ONE_HOUR || range == HistoryRange.ONE_DAY) {
            assertThat(params.getFirst("interval")).isEqualTo(range == HistoryRange.ONE_HOUR ? "5m" : "1h");
            assertEpochRequestRange(params, range);
          } else {
            assertThat(params.getFirst("period")).isEqualTo("d");
            assertThat(params.getFirst("order")).isEqualTo("a");
            assertFromToDateRequestRange(params, range);
          }
        })
        .andRespond(withSuccess(eodHistoricalDataHistoryPayload(range, start, end), MediaType.APPLICATION_JSON));

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }

  @Test
  void rateLimitDoesNotCacheEmptyHistory() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    EodHistoricalDataApiService service =
        new EodHistoricalDataApiService(properties(null, null, null, null, "eodhd"), builder.build());
    HistoryRange range = HistoryRange.ONE_YEAR;
    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();

    server.expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/api/eod/AAPL.US"))
        .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body("""
            {"message":"Rate limited"}
            """));
    server.expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/api/eod/AAPL.US"))
        .andRespond(withSuccess(eodHistoricalDataHistoryPayload(range, start, end), MediaType.APPLICATION_JSON));

    assertThat(service.historicalCandles("AAPL", range)).isEmpty();

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }

  private String eodHistoricalDataPath(HistoryRange range) {
    return range == HistoryRange.ONE_HOUR || range == HistoryRange.ONE_DAY
        ? "/api/intraday/AAPL.US"
        : "/api/eod/AAPL.US";
  }
}
