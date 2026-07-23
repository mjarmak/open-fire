package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.MarketModels.ChartPoint;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import com.jarmak.stockmarketanalyzer.market.MarketSnapshotCandidate;
import com.jarmak.stockmarketanalyzer.market.TimeSeriesPoint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

class LiveMarketApiClientSmokeTest {
  private static final String STOCK_SYMBOL = "AAPL";
  private static final String FRED_SERIES = "VIXCLS";

  @Test
  void finnhubLivePriceSnapshotReturnsAStockPriceAndSearchFields() {
    String apiKey = liveApiKey("FINNHUB_API_KEY");
    FinnhubApiService service = new FinnhubApiService(properties(null, apiKey, null), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  @Test
  void twelveDataLivePriceSnapshotReturnsAStockPriceAndSearchFields() {
    String apiKey = liveApiKey("TWELVEDATA_API_KEY");
    TwelveDataApiService service = new TwelveDataApiService(properties(null, null, apiKey), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  @Test
  void fredLiveLatestObservationsReturnsMacroData() {
    String apiKey = liveApiKey("FRED_API_KEY");
    FredClient client = new FredClient(properties(apiKey, null, null), RestClient.create());

    List<TimeSeriesPoint> observations = client.latestObservations(FRED_SERIES);

    assertThat(observations).isNotEmpty();
    assertThat(observations.get(0).value()).isPositive();
  }

  @Test
  void binanceLiveSearchAndHistoricalDailyCandlesReturnKnownCryptoPrices() {
    liveMarketApiTestsEnabled();
    BinanceApiService service = new BinanceApiService(RestClient.create());
    LocalDate priceDate = LocalDate.of(2024, 1, 1);

    SymbolSearchResult btc = service.searchSymbols("btc").stream()
        .filter(result -> "BINANCE:BTCUSDT".equals(result.symbol()))
        .findFirst()
        .orElseThrow();
    List<ChartPoint> btcCandles = service.dailyCandles(btc.symbol(), priceDate, priceDate);

    assertThat(btc.name()).isEqualTo("Bitcoin / USDT");
    assertThat(btcCandles).singleElement()
        .satisfies(point -> assertThat(point.value()).isEqualByComparingTo("44179.55000000"));

    SymbolSearchResult eth = service.searchSymbols("eth").stream()
        .filter(result -> "BINANCE:ETHUSDT".equals(result.symbol()))
        .findFirst()
        .orElseThrow();
    List<ChartPoint> ethCandles = service.dailyCandles(eth.symbol(), priceDate, priceDate);

    assertThat(eth.name()).isEqualTo("Ethereum / USDT");
    assertThat(ethCandles).singleElement()
        .satisfies(point -> assertThat(point.value()).isEqualByComparingTo("2352.04000000"));
  }

  private String liveApiKey(String envVar) {
    liveMarketApiTestsEnabled();
    String apiKey = System.getenv(envVar);
    assumeTrue(StringUtils.hasText(apiKey), "Set " + envVar + " to run this live provider smoke test.");
    return apiKey;
  }

  private void liveMarketApiTestsEnabled() {
    assumeTrue(
        "true".equalsIgnoreCase(System.getenv("LIVE_MARKET_API_TESTS")),
        "Set LIVE_MARKET_API_TESTS=true to run live market API smoke tests."
    );
  }

  private void assertStockPriceSnapshot(Optional<MarketSnapshotCandidate> snapshot) {
    assertThat(snapshot).isPresent();
    MarketSnapshotCandidate value = snapshot.orElseThrow();
    assertThat(value.latestPrice()).isNotNull().isPositive();
    assertThat(value.marketCap()).isNotNull().isPositive();
  }

  private void assertSearchMinimumFields(List<SymbolSearchResult> results) {
    assertThat(results).isNotEmpty();
    SymbolSearchResult result = results.stream()
        .filter(item -> item.symbol() != null && item.symbol().toUpperCase().contains(STOCK_SYMBOL))
        .findFirst()
        .orElse(results.get(0));
    assertThat(result.symbol()).isNotBlank();
    assertThat(result.name()).isNotBlank();
    assertThat(result.region()).isNotBlank();
    assertThat(result.currency()).isNotBlank();
  }

  private AppProperties properties(
      String fredApiKey,
      String finnhubApiKey,
      String twelveDataApiKey
  ) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            fredApiKey,
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
