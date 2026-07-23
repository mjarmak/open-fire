# Market Data Sources

This document maps the external market-data endpoints currently used by OpenFIRE and the fields we read from each response.

## Internal Usage

| App flow | Internal method | Provider order | Notes |
| --- | --- | --- | --- |
| Symbol search | `FinnhubClient.searchSymbols` | Finnhub, then Twelve Data | Returns ticker metadata only: symbol, name, region/type, currency. |
| Search price details | `FinnhubClient.companyPriceSnapshot` | Finnhub, then Twelve Data | Lightweight path for `/symbols/search` enrichment. Returns price and market cap only. It must not call daily closes or history. |
| Alerts / portfolio rows / stock preview | `FinnhubClient.companySnapshot` | Finnhub, then Twelve Data | Full snapshot path. Can call daily closes to calculate 30D change, realized volatility, and drawdown. |
| Position chart history | `FinnhubClient.historicalCandles` | Finnhub, then Twelve Data | Returns chart points for the selected range. |
| Macro indicators | `FredClient` plus selected market history | FRED for macro series; FinnhubClient history/closes for breadth/correlation assets | Used for macro gauges and histories. |

## Market Indicator Contract

When all source data is available, `MarketIndicatorService.indicators` returns these five indicators in order:

| ID | Display name | Source |
| --- | --- | --- |
| `vix` | Fear Index / VIX | FRED `VIXCLS` |
| `fear-greed` | Fear & Greed Index | Internal composite of VIX, credit, breadth, and correlation |
| `breadth` | Market Breadth | Live quote direction for the configured ETF basket, with daily closes as fallback |
| `credit` | Credit Market | FRED `BAMLC0A0CM` |
| `correlation` | Cross-Asset Correlation | Daily closes for the configured cross-asset basket |

## Finnhub

Base URL: `https://finnhub.io/api/v1`

| App operation | Endpoint | Parameters | Fields read | Output fields populated |
| --- | --- | --- | --- | --- |
| Symbol search | `/search` | `q`, `token` | `result[].symbol`, `result[].description`, `result[].type`, `result[].currency` | `SymbolSearchResult.symbol`, `name`, `region`, `currency` |
| Crypto symbol list | `/crypto/symbol` | `exchange`, `token` | `symbol`, `displaySymbol`, `description` | Search fallback symbols for crypto |
| Forex symbol list | `/forex/symbol` | `exchange`, `token` | `symbol`, `displaySymbol`, `description` | Search fallback symbols for currencies |
| Lightweight price snapshot | `/quote` | `symbol`, `token` | `c`, `pc`, `h`, `l` | `latestPrice`, `previousClose`, `dailyHigh`, `dailyLow` |
| Lightweight stock metadata | `/stock/profile2` | `symbol`, `token` | `name`, `finnhubIndustry`, `marketCapitalization` | `name`, `industry`, `marketCap` |
| Full stock quote | `/quote` | `symbol`, `token` | `c`, `pc`, `h`, `l` | `latestPrice`, `previousClose`, `dailyHigh`, `dailyLow` |
| Full stock metadata | `/stock/profile2` | `symbol`, `token` | `name`, `finnhubIndustry`, `marketCapitalization` | `name`, `industry`, `marketCap` |
| Full stock metrics | `/stock/metric` | `symbol`, `metric=all`, `token` | `metric.peBasicExclExtraTTM`, `metric.beta`, `metric.52WeekHigh` | `peRatio`, `beta`, `fiftyTwoWeekHigh` |
| Daily closes | `/stock/candle`, `/crypto/candle`, or `/forex/candle` | `symbol`, `resolution=D`, `from`, `to`, `token` | `s`, `c[]`, `t[]` | `TimeSeriesPoint.date`, `value` |
| Chart history | `/stock/candle`, `/crypto/candle`, or `/forex/candle` | `symbol`, `resolution`, `from`, `to`, `token` | `s`, `c[]`, `t[]` | `ChartPoint.timestamp`, `value` |

Notes:
- Finnhub `marketCapitalization` is returned in millions, so the app multiplies it by `1,000,000`.
- Search price details use only `/quote` and, for stocks, `/stock/profile2`.
- Full alerts can use `/stock/metric` and daily candle data.

## Twelve Data

Base URL: `https://api.twelvedata.com`

| App operation | Endpoint | Parameters | Fields read | Output fields populated |
| --- | --- | --- | --- | --- |
| Symbol search | `/symbol_search` | `symbol`, `apikey` | `data[]` or `symbols[]`: `symbol`, `instrument_name`, `name`, `type`, `currency` | `SymbolSearchResult.symbol`, `name`, `region`, `currency` |
| Lightweight price snapshot | `/quote` | `symbol`, `apikey` | `values[0].close`, `values[0].previous_close`, `values[0].high`, `values[0].low`; fallback `price` | `latestPrice`, `previousClose`, `dailyHigh`, `dailyLow` |
| Lightweight metadata | `/quote` | `symbol`, `outputsize=1`, `apikey` | `name`, `market_cap` | `name`, `marketCap` |
| Full snapshot quote | `/quote` | `symbol`, `apikey` | `values[0].close`, `values[0].previous_close`, `values[0].high`, `values[0].low`, `fifty_two_week_high`, `exchange`, `name` | Price fields, `fiftyTwoWeekHigh`, `industry` label |
| Full snapshot metadata | `/quote` | `symbol`, `outputsize=1`, `apikey` | `name`, `market_cap`, `pe_ratio`, `beta` | `name`, `marketCap`, `peRatio`, `beta` |
| Daily closes | `/time_series` | `symbol`, `interval=1day`, `outputsize=90`, `apikey` | `values[].datetime`, `values[].close` | `TimeSeriesPoint.date`, `value` |
| Chart history | `/time_series` | `symbol`, `interval`, `start_date`, `end_date`, `outputsize`, `apikey` | `values[].datetime`, `values[].close` | `ChartPoint.timestamp`, `value` |

Notes:
- Symbols are normalized for Twelve Data by removing provider prefixes and converting separators like `_` or `-` to `/`.
- Twelve Data has a short rate-limit backoff. While backed off, the client skips requests and returns no data.

## Binance

Base URL: `https://api.binance.com`

Binance is used without an API token for supported crypto symbol search and historical candles. Stock requests do not fall back to Binance.

## FRED

Base URL: `https://api.stlouisfed.org`

| App operation | Endpoint | Parameters | Fields read | Output fields populated |
| --- | --- | --- | --- | --- |
| Latest macro observations | `/fred/series/observations` | `series_id`, `api_key`, `file_type=json`, `sort_order=desc`, `limit=10` | `observations[].date`, `observations[].value` | `TimeSeriesPoint.date`, `value` |
| Macro history | `/fred/series/observations` | `series_id`, `api_key`, `file_type=json`, `sort_order=asc`, `limit=10000`, optional `observation_start` | `observations[].date`, `observations[].value` | `ChartPoint.timestamp`, `value` |

Notes:
- FRED values of `.` are skipped.
- The client keeps last-good observations/history in memory and can return them if the provider response fails.

## Fields By Output Model

### `SymbolSearchResult`

| Field | Finnhub | Twelve Data |
| --- | --- | --- |
| `symbol` | `result[].symbol` | `data[].symbol` or `symbols[].symbol` |
| `name` | `result[].description` | `instrument_name` or `name` |
| `region` | `result[].type` | `type` |
| `currency` | `result[].currency` | `currency` |
| `indicators` | Added only by internal enrichment | Added only by internal enrichment |

### `StockAlert` / `CompanySnapshot`

| Field | Lightweight search enrichment | Full alerts / portfolio evaluation |
| --- | --- | --- |
| `latestPrice` | Yes | Yes |
| `marketCap` | Yes, when provider has it | Yes, when provider has it |
| `dayGainLoss` | No | Yes |
| `dayGainLossPercent` | No | Yes |
| `peRatio` | No | Yes, when provider has it |
| `beta` | No | Yes, when provider has it |
| `realizedVolatilityPercent` | No | Yes, calculated from daily closes or quote range fallback |
| `drawdownPercent` | No | Yes, calculated from daily closes or high fallback |
| `fearScore` | No | Yes |
| `thirtyDayChangePercent` | No | Yes, calculated from daily closes |
