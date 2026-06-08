package com.jarmak.stockmarketanalyzer.market.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.market.MarketModels.SymbolSearchResult;
import com.jarmak.stockmarketanalyzer.market.MarketSnapshotCandidate;
import com.jarmak.stockmarketanalyzer.market.TimeSeriesPoint;
import java.math.BigDecimal;
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
    FinnhubApiService service = new FinnhubApiService(properties(null, apiKey, null, null, null, null), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  @Test
  void twelveDataLivePriceSnapshotReturnsAStockPriceAndSearchFields() {
    String apiKey = liveApiKey("TWELVEDATA_API_KEY");
    TwelveDataApiService service = new TwelveDataApiService(properties(null, null, apiKey, null, null, null), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  @Test
  void alphaVantageLivePriceSnapshotReturnsAStockPriceAndSearchFields() {
    String apiKey = liveApiKey("ALPHA_VANTAGE_API_KEY");
    AlphaVantageApiService service = new AlphaVantageApiService(properties(null, null, null, apiKey, null, null), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  @Test
  void fredLiveLatestObservationsReturnsMacroData() {
    String apiKey = liveApiKey("FRED_API_KEY");
    FredClient client = new FredClient(properties(apiKey, null, null, null, null, null), RestClient.create());

    List<TimeSeriesPoint> observations = client.latestObservations(FRED_SERIES);

    assertThat(observations).isNotEmpty();
    assertThat(observations.get(0).value()).isPositive();
  }

  @Test
  void financialModelingPrepLivePriceSnapshotReturnsAStockPriceAndSearchFields() {
    String apiKey = liveApiKey("FINANCIAL_MODELING_PREP_API_KEY");
    FinancialModelingPrepApiService service =
        new FinancialModelingPrepApiService(properties(null, null, null, null, apiKey, null), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  @Test
  void eodHistoricalDataLivePriceSnapshotReturnsAStockPriceAndSearchFields() {
    String apiKey = liveApiKey("EODHD_API_KEY");
    EodHistoricalDataApiService service =
        new EodHistoricalDataApiService(properties(null, null, null, null, null, apiKey), RestClient.create());

    Optional<MarketSnapshotCandidate> snapshot = service.companyPriceSnapshot(STOCK_SYMBOL);
    List<SymbolSearchResult> results = service.searchSymbols(STOCK_SYMBOL);

    assertStockPriceSnapshot(snapshot);
    assertSearchMinimumFields(results);
  }

  private String liveApiKey(String envVar) {
    assumeTrue(
        "true".equalsIgnoreCase(System.getenv("LIVE_MARKET_API_TESTS")),
        "Set LIVE_MARKET_API_TESTS=true to run live market API smoke tests."
    );
    String apiKey = System.getenv(envVar);
    assumeTrue(StringUtils.hasText(apiKey), "Set " + envVar + " to run this live provider smoke test.");
    return apiKey;
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
      String twelveDataApiKey,
      String alphaVantageApiKey,
      String financialModelingPrepApiKey,
      String eodHistoricalDataApiKey
  ) {
    return new AppProperties(
        null,
        new AppProperties.Market(
            fredApiKey,
            finnhubApiKey,
            twelveDataApiKey,
            alphaVantageApiKey,
            financialModelingPrepApiKey,
            eodHistoricalDataApiKey,
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
