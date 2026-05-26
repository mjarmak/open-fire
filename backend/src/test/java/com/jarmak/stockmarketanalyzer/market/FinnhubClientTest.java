package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class FinnhubClientTest {
  @Test
  void fallsBackToQuoteAndMetricDataWhenCandlesAreUnavailable() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/quote")))
        .andRespond(withSuccess("""
            {"c":80,"pc":78,"h":84,"l":76}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/profile2")))
        .andRespond(withSuccess("""
            {"name":"Test Corp","marketCapitalization":1000}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/metric")))
        .andRespond(withSuccess("""
            {"metric":{"peBasicExclExtraTTM":12,"beta":1.1,"52WeekHigh":100}}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));

    CompanySnapshot snapshot = client.companySnapshot("TEST").orElseThrow();

    assertThat(snapshot.realizedVolatilityPercent()).isNotNull();
    assertThat(snapshot.realizedVolatilityPercent()).isGreaterThan(BigDecimal.ZERO);
    assertThat(snapshot.drawdownPercent()).isEqualByComparingTo("20.0");
    server.verify();
  }

  private AppProperties properties() {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            "finnhub",
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
        null
    );
  }
}
