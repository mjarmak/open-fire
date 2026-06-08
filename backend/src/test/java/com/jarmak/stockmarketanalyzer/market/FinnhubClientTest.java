package com.jarmak.stockmarketanalyzer.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.test.web.client.MockRestServiceServer;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

class FinnhubClientTest {
  @Test
  void springCanCreateFinnhubClientWithProductionConstructor() {
    try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
      context.registerBean(AppProperties.class, this::properties);
      context.registerBean(RestClient.class, () -> RestClient.create());
      context.registerBean(FinnhubClient.class);

      context.refresh();

      assertThat(context.getBean(FinnhubClient.class)).isNotNull();
    }
  }

  @Test
  void historyCacheKeepsShortRangesFreshAndCachesLongerRangesForOneDay() {
    assertThat(FinnhubClient.historyCacheSeconds(HistoryRange.ONE_HOUR)).isEqualTo(900);
    assertThat(FinnhubClient.historyCacheSeconds(HistoryRange.ONE_DAY)).isEqualTo(900);
    assertThat(FinnhubClient.historyCacheSeconds(HistoryRange.FIVE_DAYS)).isEqualTo(86_400);
    assertThat(FinnhubClient.historyCacheSeconds(HistoryRange.ONE_MONTH)).isEqualTo(86_400);
    assertThat(FinnhubClient.historyCacheSeconds(HistoryRange.ONE_YEAR)).isEqualTo(86_400);
    assertThat(FinnhubClient.historyCacheSeconds(HistoryRange.ALL)).isEqualTo(86_400);
  }

  @Test
  void searchIncludesForeignDottedStockSymbols() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/search")))
        .andRespond(withSuccess("""
            {"result":[{"symbol":"1810.HK","description":"XIAOMI CORPORATION","type":"EQS","currency":"HKD"}]}
            """, MediaType.APPLICATION_JSON));
    expectEmptyAssetSymbolLists(server);

    List<SymbolSearchResult> results = client.searchSymbols("xiaomi");

    assertThat(results).extracting(SymbolSearchResult::symbol).contains("1810.HK");
    server.verify();
  }

  @Test
  void searchIncludesCryptoAndCurrencySymbols() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/search")))
        .andRespond(withSuccess("{\"result\":[]}", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/crypto/symbol")))
        .andRespond(withSuccess("""
            [{"symbol":"BINANCE:BTCUSDT","displaySymbol":"BTC/USDT","description":"Bitcoin / Tether"}]
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/crypto/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/symbol")))
        .andRespond(withSuccess("""
            [{"symbol":"OANDA:EUR_USD","displaySymbol":"EUR/USD","description":"Euro / US Dollar"}]
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/search")))
        .andRespond(withSuccess("{\"result\":[]}", MediaType.APPLICATION_JSON));

    List<SymbolSearchResult> cryptoResults = client.searchSymbols("btc");
    List<SymbolSearchResult> currencyResults = client.searchSymbols("eur usd");

    assertThat(cryptoResults).extracting(SymbolSearchResult::symbol).contains("BINANCE:BTCUSDT");
    assertThat(currencyResults).extracting(SymbolSearchResult::symbol).contains("OANDA:EUR_USD");
    server.verify();
  }

  @Test
  void searchFallsBackToTwelveDataWhenFinnhubIsUnavailable() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(null, "twelve", null), builder.build());

    server.expect(requestTo(containsString("/symbol_search")))
        .andRespond(withSuccess("""
            {
              "data": [
                {"symbol":"1810.HK","instrument_name":"Xiaomi","type":"Common Stock","currency":"HKD"}
              ]
            }
            """, MediaType.APPLICATION_JSON));

    List<SymbolSearchResult> results = client.searchSymbols("xiaomi");

    assertThat(results).extracting(SymbolSearchResult::symbol).contains("1810.HK");
    assertThat(results).extracting(SymbolSearchResult::name).contains("Xiaomi");
    server.verify();
  }

  @Test
  void searchFindsCryptosByCommonNamesWhenExchangeDescriptionsOnlyContainPairs() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/search")))
        .andRespond(withSuccess("{\"result\":[]}", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/crypto/symbol")))
        .andRespond(withSuccess("""
            [
              {"symbol":"BINANCE:ETHUSDT","displaySymbol":"ETH/USDT","description":"ETH/USDT"},
              {"symbol":"BINANCE:ADAUSDT","displaySymbol":"ADA/USDT","description":"ADA/USDT"}
            ]
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/crypto/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/search")))
        .andRespond(withSuccess("{\"result\":[]}", MediaType.APPLICATION_JSON));

    List<SymbolSearchResult> ethereumResults = client.searchSymbols("ethereum");
    List<SymbolSearchResult> cardanoResults = client.searchSymbols("cardano");

    assertThat(ethereumResults).extracting(SymbolSearchResult::symbol).contains("BINANCE:ETHUSDT");
    assertThat(ethereumResults).extracting(SymbolSearchResult::name).contains("Ethereum / USDT");
    assertThat(cardanoResults).extracting(SymbolSearchResult::symbol).contains("BINANCE:ADAUSDT");
    assertThat(cardanoResults).extracting(SymbolSearchResult::name).contains("Cardano / USDT");
    server.verify();
  }

  @Test
  void cryptoAndCurrencyCandlesUseAssetSpecificEndpoints() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/crypto/candle")))
        .andRespond(withSuccess("""
            {"s":"ok","c":[100,110],"t":[1717200000,1717286400]}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/candle")))
        .andRespond(withSuccess("""
            {"s":"ok","c":[1.08,1.09],"t":[1717200000,1717286400]}
            """, MediaType.APPLICATION_JSON));

    assertThat(client.dailyCloses("BINANCE:BTCUSDT")).hasSize(2);
    assertThat(client.dailyCloses("OANDA:EUR_USD")).hasSize(2);
    server.verify();
  }

  @Test
  void historicalCandlesReturnFinnhubCandlePointsAndCacheThem() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"ok","c":[100,110],"t":[1717200000,1717286400]}
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> first = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);
    List<ChartPoint> second = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);

    assertThat(first).hasSize(2);
    assertThat(first).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(100.0), BigDecimal.valueOf(110.0));
    assertThat(second).isSameAs(first);
    server.verify();
  }

  @Test
  void historicalCandlesLogsCacheHitForSubsequentCalls() {
    Logger logger = (Logger) LoggerFactory.getLogger(FinnhubClient.class);
    ListAppender<ILoggingEvent> listAppender = new ListAppender<>();
    Level originalLevel = logger.getLevel();
    listAppender.start();
    logger.setLevel(Level.DEBUG);
    logger.addAppender(listAppender);

    try {
      RestClient.Builder builder = RestClient.builder();
      MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
      FinnhubClient client = new FinnhubClient(properties(), builder.build());

      server.expect(requestTo(containsString("/api/v1/stock/candle")))
          .andRespond(withSuccess("""
              {"s":"ok","c":[100,110],"t":[1717200000,1717286400]}
              """, MediaType.APPLICATION_JSON));

      List<ChartPoint> first = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);
      assertThat(first).hasSize(2);
      assertThat(historyCacheHitMessages(listAppender, "AAPL", HistoryRange.ONE_MONTH.label()))
          .isFalse();

      List<ChartPoint> second = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);
      assertThat(second).isSameAs(first);
      assertThat(historyCacheHitMessages(listAppender, "AAPL", HistoryRange.ONE_MONTH.label()))
          .isTrue();

      server.verify();
    } finally {
      logger.detachAppender(listAppender);
      logger.setLevel(originalLevel);
      listAppender.stop();
    }
  }

  @Test
  void historicalCandlesUsesTwelveDataBeforeAlphaVantageWhenConfigured() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties("finnhub", "twelve", "alpha"), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/time_series")))
        .andRespond(withSuccess("""
            {
              "values": [
                {"datetime":"2024-06-03","close":"101"},
                {"datetime":"2024-06-04","close":"104"}
              ]
            }
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> points = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);

    assertThat(points).hasSize(2);
    assertThat(points).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(101), BigDecimal.valueOf(104));
    server.verify();
  }

  @Test
  void historicalCandlesUsesAlphaVantageWhenTwelveDataUnavailable() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties("finnhub", "twelve", "alpha"), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/time_series")))
        .andRespond(withSuccess("""
            {"status":"error","message":"No data for symbol."}
            """, MediaType.APPLICATION_JSON));
    LocalDate latest = LocalDate.now(ZoneOffset.UTC).minusDays(1);
    String priorCloseDate = latest.minusDays(1).format(DateTimeFormatter.ISO_DATE);
    String latestDate = latest.format(DateTimeFormatter.ISO_DATE);
    server.expect(requestTo(containsString("/query")))
        .andRespond(withSuccess("""
            {"Time Series (Daily)": {
                "%s": {"4. close":"201"},
                "%s": {"4. close":"205"}
            }
            }""".formatted(priorCloseDate, latestDate), MediaType.APPLICATION_JSON));

    List<ChartPoint> points = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);

    assertThat(points).hasSize(2);
    assertThat(points).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(201), BigDecimal.valueOf(205));
    server.verify();
  }

  @Test
  void historicalCandlesPreservesDottedSymbolWhenCallingTwelveData() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties("finnhub", "twelve", null), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("symbol=1810.HK")))
        .andRespond(withSuccess("""
            {
              "values": [
                {"datetime":"2024-06-03","close":"120"}
              ]
            }
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> points = client.historicalCandles("1810.HK", HistoryRange.ONE_MONTH);

    assertThat(points).hasSize(1);
    assertThat(points).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(120));
    server.verify();
  }

  @Test
  void historicalCandlesFallBackToDailyClosesWhenRangeCandlesAreUnavailable() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"ok","c":[101,104,108],"t":[1779235200,1779840000,1780444800]}
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> points = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);

    assertThat(points).hasSize(3);
    assertThat(points).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(101.0), BigDecimal.valueOf(104.0), BigDecimal.valueOf(108.0));
    server.verify();
  }

  @Test
  void historicalCandlesReturnsNoPointsInsteadOfQuoteFallbackWhenCandlesAreUnavailable() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> points = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);

    assertThat(points).isEmpty();
    server.verify();
  }

  @Test
  void historicalCandlesReturnsNoPointsWhenAllProvidersAndFallbacksFail() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));

    List<ChartPoint> points = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);
    List<ChartPoint> retryPoints = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);

    assertThat(points).isEmpty();
    assertThat(retryPoints).isEmpty();
    server.verify();
  }

  @Test
  void historicalCandlesBackOffTwelveDataFallbackAfterRateLimit() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties("finnhub", "twelve", "alpha"), builder.build());

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/time_series")))
        .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body("""
            {"code":429,"message":"Rate limited","status":"error"}
            """));
    LocalDate latest = LocalDate.now(ZoneOffset.UTC).minusDays(1);
    String priorCloseDate = latest.minusDays(1).format(DateTimeFormatter.ISO_DATE);
    String latestDate = latest.format(DateTimeFormatter.ISO_DATE);
    server.expect(requestTo(containsString("/query")))
        .andRespond(withSuccess("""
            {"Time Series (Daily)": {
                "%s": {"4. close":"201"},
                "%s": {"4. close":"205"}
            }
            }""".formatted(priorCloseDate, latestDate), MediaType.APPLICATION_JSON));

    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"no_data"}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/query")))
        .andRespond(withSuccess("""
            {"Time Series (Daily)": {
                "%s": {"4. close":"301"},
                "%s": {"4. close":"305"}
            }
            }""".formatted(priorCloseDate, latestDate), MediaType.APPLICATION_JSON));

    List<ChartPoint> first = client.historicalCandles("AAPL", HistoryRange.ONE_MONTH);
    List<ChartPoint> second = client.historicalCandles("MSFT", HistoryRange.ONE_MONTH);

    assertThat(first).hasSize(2);
    assertThat(first).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(201), BigDecimal.valueOf(205));
    assertThat(second).hasSize(2);
    assertThat(second).extracting(ChartPoint::value)
        .containsExactly(BigDecimal.valueOf(301), BigDecimal.valueOf(305));
    server.verify();
  }

  @Test
  void cryptoSnapshotUsesCandlesWithoutStockQuoteOrProfileCalls() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());

    server.expect(requestTo(containsString("/api/v1/crypto/candle")))
        .andRespond(withSuccess("""
            {"s":"ok","c":[100,110],"t":[1717200000,1717286400]}
            """, MediaType.APPLICATION_JSON));

    CompanySnapshot snapshot = client.companySnapshot("BINANCE:BTCUSDT").orElseThrow();

    assertThat(snapshot.latestPrice()).isEqualByComparingTo("110");
    assertThat(snapshot.previousClose()).isEqualByComparingTo("100");
    assertThat(snapshot.industry()).isEqualTo("Crypto");
    assertThat(snapshot.marketCap()).isNull();
    server.verify();
  }

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
    assertThat(snapshot.thirtyDayChangePercent().setScale(2, RoundingMode.HALF_UP))
        .isEqualByComparingTo("2.56");
    server.verify();
  }

  @Test
  void companySnapshotUsesFirstCloseInsideThirtyDayWindowForPositiveThirtyDayChange() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    FinnhubClient client = new FinnhubClient(properties(), builder.build());
    LocalDate cutoff = LocalDate.now(ZoneOffset.UTC).minusDays(30);
    long priorCloseTimestamp = cutoff.minusDays(2).atStartOfDay().toEpochSecond(ZoneOffset.UTC);
    long futureCloseTimestamp = cutoff.plusDays(1).atStartOfDay().toEpochSecond(ZoneOffset.UTC);
    long latestCloseTimestamp = LocalDate.now(ZoneOffset.UTC).minusDays(1).atStartOfDay().toEpochSecond(ZoneOffset.UTC);

    server.expect(requestTo(containsString("/api/v1/quote")))
        .andRespond(withSuccess("""
            {"c":110,"pc":108,"h":111,"l":107}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/profile2")))
        .andRespond(withSuccess("""
            {"name":"Test Corp","marketCapitalization":1000}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/metric")))
        .andRespond(withSuccess("""
            {"metric":{"peBasicExclExtraTTM":12,"beta":1.1,"52WeekHigh":130}}
            """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/stock/candle")))
        .andRespond(withSuccess("""
            {"s":"ok","c":[130,100,110],"t":[%d,%d,%d]}
            """.formatted(priorCloseTimestamp, futureCloseTimestamp, latestCloseTimestamp), MediaType.APPLICATION_JSON));

    CompanySnapshot snapshot = client.companySnapshot("TEST").orElseThrow();

    assertThat(snapshot.thirtyDayChangePercent().setScale(2, RoundingMode.HALF_UP))
        .isEqualByComparingTo("10.00");
    server.verify();
  }

  private void expectEmptyAssetSymbolLists(MockRestServiceServer server) {
    server.expect(requestTo(containsString("/api/v1/crypto/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/crypto/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
    server.expect(requestTo(containsString("/api/v1/forex/symbol")))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
  }

  private AppProperties properties() {
    return properties("finnhub", null, null);
  }

  private AppProperties properties(String finnhubApiKey, String twelveDataApiKey, String alphaVantageApiKey) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            "fred",
            finnhubApiKey,
            twelveDataApiKey,
            alphaVantageApiKey,
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

  private boolean historyCacheHitMessages(ListAppender<ILoggingEvent> listAppender, String symbol, String rangeLabel) {
    return listAppender.list.stream()
        .map(ILoggingEvent::getFormattedMessage)
        .anyMatch(message -> message.contains("Stock history cache hit for %s %s".formatted(symbol, rangeLabel)));
  }
}
