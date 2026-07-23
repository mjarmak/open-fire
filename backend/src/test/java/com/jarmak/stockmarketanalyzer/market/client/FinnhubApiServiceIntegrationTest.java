package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

class FinnhubApiServiceIntegrationTest extends MarketApiClientIntegrationSupport {
  @ParameterizedTest
  @EnumSource(HistoryRange.class)
  void historyRequestsAndReturnsTheSelectedDateRange(HistoryRange range) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubApiService service = new FinnhubApiService(properties("finnhub", null), builder.build());

    Instant start = fixtureStart(range);
    Instant end = fixtureEnd();
    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo("finnhub.io");
          assertThat(request.getURI().getPath()).isEqualTo("/api/v1/stock/candle");
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst("symbol")).isEqualTo("AAPL");
          assertThat(params.getFirst("resolution")).isEqualTo(range.finnhubResolution());
          assertThat(params.getFirst("token")).isEqualTo("finnhub");
          assertEpochRequestRange(params, range);
        })
        .andRespond(withSuccess(finnhubHistoryPayload(start, end), MediaType.APPLICATION_JSON));

    List<ChartPoint> points = service.historicalCandles("AAPL", range);

    assertReturnedRange(points, range);
    server.verify();
  }
}
