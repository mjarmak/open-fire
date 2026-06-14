package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

class MarketApiTokenTestServiceTest {
  @ParameterizedTest
  @MethodSource("providerFixtures")
  void testsProviderTokenWithDirectProviderRequest(ProviderFixture fixture) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    MarketApiTokenTestService service = new MarketApiTokenTestService(builder.build());

    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo(fixture.host());
          assertThat(request.getURI().getPath()).isEqualTo(fixture.path());
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst(fixture.tokenParam())).isEqualTo("draft-token");
        })
        .andRespond(withSuccess(fixture.responseBody(), MediaType.APPLICATION_JSON));

    MarketApiTokenTestService.MarketApiTokenTestResult result = service.test(fixture.provider(), "draft-token");

    assertThat(result.success()).isTrue();
    assertThat(result.message()).contains("token works");
    server.verify();
  }

  @Test
  void doesNotTestWithDeveloperTokenWhenDraftTokenIsBlank() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    MarketApiTokenTestService service = new MarketApiTokenTestService(builder.build());

    MarketApiTokenTestService.MarketApiTokenTestResult result = service.test(MarketApiProvider.FINNHUB, "   ");

    assertThat(result.success()).isFalse();
    assertThat(result.message()).isEqualTo("Enter a Finnhub token before testing.");
    server.verify();
  }

  static Stream<ProviderFixture> providerFixtures() {
    return Stream.of(
        new ProviderFixture(
            MarketApiProvider.FINNHUB,
            "finnhub.io",
            "/api/v1/search",
            "token",
            """
                {"result":[{"symbol":"AAPL"}]}
                """
        ),
        new ProviderFixture(
            MarketApiProvider.TWELVE_DATA,
            "api.twelvedata.com",
            "/symbol_search",
            "apikey",
            """
                {"data":[{"symbol":"AAPL"}]}
                """
        ),
        new ProviderFixture(
            MarketApiProvider.FINANCIAL_MODELING_PREP,
            "financialmodelingprep.com",
            "/stable/search-symbol",
            "apikey",
            """
                [{"symbol":"AAPL"}]
                """
        ),
        new ProviderFixture(
            MarketApiProvider.ALPHA_VANTAGE,
            "www.alphavantage.co",
            "/query",
            "apikey",
            """
                {"bestMatches":[{"1. symbol":"AAPL"}]}
                """
        ),
        new ProviderFixture(
            MarketApiProvider.EODHD,
            "eodhd.com",
            "/api/search/AAPL",
            "api_token",
            """
                [{"Code":"AAPL"}]
                """
        )
    );
  }

  private static MultiValueMap<String, String> queryParams(String uri) {
    return UriComponentsBuilder.fromUriString(uri).build().getQueryParams();
  }

  private record ProviderFixture(
      String provider,
      String host,
      String path,
      String tokenParam,
      String responseBody
  ) {
  }
}
