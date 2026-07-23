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

class TwelveDataApiServiceIntegrationTest extends MarketApiClientIntegrationSupport {
  @ParameterizedTest
  @EnumSource(HistoryRange.class)
  void historyRequestsAndReturnsTheSelectedDateRange(HistoryRange range) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    TwelveDataApiService service = new TwelveDataApiService(properties(null, "twelve"), builder.build());

    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();
    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo("api.twelvedata.com");
          assertThat(request.getURI().getPath()).isEqualTo("/time_series");
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst("symbol")).isEqualTo("AAPL");
          assertThat(params.getFirst("interval")).isEqualTo(twelveDataInterval(range));
          assertThat(params.getFirst("outputsize")).isEqualTo(twelveDataOutputSize(range));
          assertThat(params.getFirst("apikey")).isEqualTo("twelve");
          assertDateRequestRange(params, range);
        })
        .andRespond(withSuccess(twelveDataHistoryPayload(start, end), MediaType.APPLICATION_JSON));

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }

  @Test
  void rateLimitSkipDoesNotCacheEmptyHistory() throws Exception {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    TwelveDataApiService service = new TwelveDataApiService(properties(null, "twelve"), builder.build());
    HistoryRange range = HistoryRange.ONE_YEAR;
    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();

    server.expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/time_series"))
        .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body("""
            {"code":429,"message":"Rate limited","status":"error"}
            """));
    server.expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/time_series"))
        .andRespond(withSuccess(twelveDataHistoryPayload(start, end), MediaType.APPLICATION_JSON));

    assertThat(service.historicalCandles("AAPL", range)).isEmpty();
    clearTwelveDataRateLimitBackoff(service);

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }
}
