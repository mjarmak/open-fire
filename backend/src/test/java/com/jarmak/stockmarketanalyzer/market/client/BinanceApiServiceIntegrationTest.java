package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

class BinanceApiServiceIntegrationTest {
  private static final LocalDate PRICE_DATE = LocalDate.of(2024, 1, 1);
  private static final long PRICE_DATE_START_MS = 1_704_067_200_000L;
  private static final long PRICE_DATE_END_MS = 1_704_153_600_000L;

  @Test
  void searchFindsBtcAndEthAndFetchesKnownDailyClosesForSpecificDate() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    BinanceApiService service = new BinanceApiService(builder.build());

    expectExchangeInfo(server);
    expectDailyKline(server, "BTCUSDT", "44179.55000000");
    expectExchangeInfo(server);
    expectDailyKline(server, "ETHUSDT", "2352.04000000");

    SymbolSearchResult btc = service.searchSymbols("btc").get(0);
    assertThat(btc.symbol()).isEqualTo("BINANCE:BTCUSDT");
    assertThat(btc.name()).isEqualTo("Bitcoin / USDT");

    List<ChartPoint> btcCandles = service.dailyCandles(btc.symbol(), PRICE_DATE, PRICE_DATE);
    assertThat(btcCandles).singleElement()
        .satisfies(point -> {
          assertThat(point.timestamp()).isEqualTo(Instant.parse("2024-01-01T00:00:00Z"));
          assertThat(point.value()).isEqualByComparingTo("44179.55000000");
        });

    SymbolSearchResult eth = service.searchSymbols("eth").get(0);
    assertThat(eth.symbol()).isEqualTo("BINANCE:ETHUSDT");
    assertThat(eth.name()).isEqualTo("Ethereum / USDT");

    List<ChartPoint> ethCandles = service.dailyCandles(eth.symbol(), PRICE_DATE, PRICE_DATE);
    assertThat(ethCandles).singleElement()
        .satisfies(point -> {
          assertThat(point.timestamp()).isEqualTo(Instant.parse("2024-01-01T00:00:00Z"));
          assertThat(point.value()).isEqualByComparingTo("2352.04000000");
        });

    server.verify();
  }

  private void expectExchangeInfo(MockRestServiceServer server) {
    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo("api.binance.com");
          assertThat(request.getURI().getPath()).isEqualTo("/api/v3/exchangeInfo");
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst("symbolStatus")).isEqualTo("TRADING");
          assertThat(params.getFirst("showPermissionSets")).isEqualTo("false");
        })
        .andRespond(withSuccess("""
            {
              "symbols": [
                {"symbol":"BTCUSDT","status":"TRADING","baseAsset":"BTC","quoteAsset":"USDT","isSpotTradingAllowed":true},
                {"symbol":"ETHUSDT","status":"TRADING","baseAsset":"ETH","quoteAsset":"USDT","isSpotTradingAllowed":true}
              ]
            }
            """, MediaType.APPLICATION_JSON));
  }

  private void expectDailyKline(MockRestServiceServer server, String symbol, String close) {
    server.expect(request -> {
          assertThat(request.getURI().getHost()).isEqualTo("api.binance.com");
          assertThat(request.getURI().getPath()).isEqualTo("/api/v3/klines");
          MultiValueMap<String, String> params = queryParams(request.getURI().toString());
          assertThat(params.getFirst("symbol")).isEqualTo(symbol);
          assertThat(params.getFirst("interval")).isEqualTo("1d");
          assertThat(params.getFirst("startTime")).isEqualTo(String.valueOf(PRICE_DATE_START_MS));
          assertThat(params.getFirst("endTime")).isEqualTo(String.valueOf(PRICE_DATE_END_MS));
          assertThat(params.getFirst("limit")).isEqualTo("1");
        })
        .andRespond(withSuccess("""
            [[%d,"0","0","0","%s","0",%d,"0",0,"0","0","0"]]
            """.formatted(
                PRICE_DATE.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
                close,
                PRICE_DATE.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() - 1
            ), MediaType.APPLICATION_JSON));
  }

  private MultiValueMap<String, String> queryParams(String uri) {
    return UriComponentsBuilder.fromUriString(uri).build().getQueryParams();
  }
}
