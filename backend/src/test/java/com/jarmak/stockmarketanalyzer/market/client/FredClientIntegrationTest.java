package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.HistoryRange;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class FredClientIntegrationTest {
  @Test
  void cachesHistoryForRepeatedRangeRequests() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FredClient client = new FredClient(properties(), builder.build());

    server.expect(requestTo(containsString("/fred/series/observations")))
        .andRespond(withSuccess("""
            {"observations":[
              {"date":"2026-06-01","value":"15.2"},
              {"date":"2026-06-02","value":"15.8"}
            ]}
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> first = client.observations("VIXCLS", HistoryRange.ONE_MONTH);
    List<ChartPoint> second = client.observations("VIXCLS", HistoryRange.ONE_MONTH);

    assertThat(first).hasSize(2);
    assertThat(second).isEqualTo(first);
    server.verify();
  }

  private AppProperties properties() {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            "finnhub",
            null,
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
