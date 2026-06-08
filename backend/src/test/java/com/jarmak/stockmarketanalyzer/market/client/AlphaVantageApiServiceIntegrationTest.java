package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

class AlphaVantageApiServiceIntegrationTest extends MarketApiClientIntegrationSupport {
  @ParameterizedTest
  @EnumSource(HistoryRange.class)
  void historyRequestsAndReturnsTheSelectedDateRange(HistoryRange range) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    AlphaVantageApiService service = new AlphaVantageApiService(properties(null, null, "alpha"), builder.build());

    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();
    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo("www.alphavantage.co");
          assertThat(request.getURI().getPath()).isEqualTo("/query");
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst("symbol")).isEqualTo("AAPL");
          assertThat(params.getFirst("function")).isEqualTo(alphaVantageFunction(range));
          assertThat(params.getFirst("outputsize")).isEqualTo(alphaVantageOutputSize(range));
          assertThat(params.getFirst("apikey")).isEqualTo("alpha");
          if (range == HistoryRange.ONE_HOUR || range == HistoryRange.ONE_DAY) {
            assertThat(params.getFirst("interval")).isEqualTo(alphaVantageInterval(range));
          } else {
            assertThat(params).doesNotContainKey("interval");
          }
        })
        .andRespond(withSuccess(alphaVantageHistoryPayload(range, start, end), MediaType.APPLICATION_JSON));

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }

  @Test
  void providerMessageDoesNotCacheEmptyHistory() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    AlphaVantageApiService service = new AlphaVantageApiService(properties(null, null, "alpha"), builder.build());
    HistoryRange range = HistoryRange.ONE_YEAR;
    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();

    server.expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/query"))
        .andRespond(withSuccess("""
            {"Information":"Thank you for using Alpha Vantage. Our standard API rate limit is 25 requests per day."}
            """, MediaType.APPLICATION_JSON));
    server.expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/query"))
        .andRespond(withSuccess(alphaVantageHistoryPayload(range, start, end), MediaType.APPLICATION_JSON));

    assertThat(service.historicalCandles("AAPL", range)).isEmpty();

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }
}
