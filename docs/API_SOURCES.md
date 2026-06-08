# API Sources

The Angular frontend does not call market-data providers directly. It calls the Spring Boot backend at `http://localhost:8080/api`, and the backend owns all provider API keys, data fetching, caching, and fallback behavior.

## Current Implementation

| Data | Backend client | External provider/API | Endpoints / series |
| --- | --- | --- | --- |
| Stock quotes and daily OHLC closes | `FinnhubClient` | Finnhub, Twelve Data, Financial Modeling Prep, EODHD, Alpha Vantage | Finnhub `/quote`, `/stock/candle`; Twelve Data `/quote`, `/time_series`; FMP `/stable/quote`, `/stable/historical-price-eod/full`, `/stable/historical-chart/*`; EODHD `/api/real-time`, `/api/eod`, `/api/intraday`; Alpha Vantage `GLOBAL_QUOTE`, `TIME_SERIES_DAILY`, `TIME_SERIES_INTRADAY` |
| Stock fundamentals and risk inputs | `FinnhubClient` | Finnhub, Twelve Data, Financial Modeling Prep, EODHD, Alpha Vantage | Finnhub `/stock/metric?metric=all`; Twelve Data `/quote`; FMP `/stable/profile`; EODHD `/api/fundamentals`; Alpha Vantage `OVERVIEW` |
| Symbol search/autocomplete | `FinnhubClient` | Finnhub, Twelve Data, Financial Modeling Prep, EODHD, Alpha Vantage | Finnhub `/search`; Twelve Data `/symbol_search`; FMP `/stable/search-symbol`; EODHD `/api/search`; Alpha Vantage `SYMBOL_SEARCH` |
| VIX / Fear Index | `FredClient` | FRED / St. Louis Fed | `/fred/series/observations`, series `VIXCLS` |
| Credit Market | `FredClient` | FRED / St. Louis Fed | `/fred/series/observations`, series `BAMLC0A0CM` |
| Market Breadth | `MarketIndicatorService` | Finnhub ETF basket | daily closes for configured `BREADTH_SYMBOLS` |
| Cross-Asset Correlation | `MarketIndicatorService` | Finnhub ETF basket | daily closes for configured `CROSS_ASSET_SYMBOLS` |
| Fear & Greed | `MarketIndicatorService` | Internal composite | VIX, credit, breadth, and cross-asset correlation |
| Telegram alerts/reminders | `TelegramNotificationService` | Telegram Bot API | `sendMessage` |

Local PostgreSQL stores users, Basic Auth password hashes, portfolio holdings, Telegram chat IDs, and retirement planner settings. Those values are not fetched from external market APIs.

Best free/public starting point:

| Need | Provider | Why |
| --- | --- | --- |
| Fear Index / VIX | FRED `VIXCLS` | Free official St. Louis Fed API access to CBOE VIX observations. |
| Credit Market | FRED `BAMLC0A0CM` | Free credit-spread proxy from ICE BofA corporate option-adjusted spread. |
| Company market cap + daily prices | Finnhub `quote`, `stock/profile2`, and `stock/candle` | Higher free request allowance than Alpha Vantage and enough data for first-pass low-cap momentum alerts. |
| Additional stock fallback quota | Twelve Data, Financial Modeling Prep, EODHD, Alpha Vantage | The backend tries the next configured provider when an earlier provider returns no usable data or is temporarily rate-limited. |
| Breadth | Finnhub ETF basket | No high-quality free full-market breadth feed is consistently available, so the app starts with configurable ETF participation. |
| Cross-asset correlation | Finnhub daily closes | Configurable SPY/TLT/GLD/UUP close data supports rolling correlation. |
| Symbol autofill | Finnhub `search` | Lets manually entered holdings link to real market symbols before enrichment. |
| Telegram alerts | Telegram Bot API `sendMessage` | Uses backend-owned bot credentials to send alert digests without exposing tokens to Angular. |

Useful docs:

- FRED API series observations: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- FRED VIX series: https://fred.stlouisfed.org/series/VIXCLS
- Finnhub API docs: https://finnhub.io/docs/api
- Twelve Data API docs: https://twelvedata.com/docs/introduction
- Financial Modeling Prep quickstart: https://site.financialmodelingprep.com/developer/docs/quickstart
- Financial Modeling Prep stable API docs: https://site.financialmodelingprep.com/developer/docs/stable
- EODHD quickstart: https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis
- EODHD historical data API: https://eodhd.com/financial-apis/api-for-historical-data-and-volumes/
- Alpha Vantage API docs: https://www.alphavantage.co/documentation/
- Telegram Bot API sendMessage: https://core.telegram.org/bots/api#sendmessage

## Access Tokens

All market-data tokens belong on the Spring Boot backend. Put them in environment variables before starting the backend, or in your deployment secret store. Do not put production tokens in committed files.

| Provider | Environment variable | Where to find the token | How requests authenticate |
| --- | --- | --- | --- |
| FRED | `FRED_API_KEY` | Sign in to the FRED account site, then request or view API keys from the FRED API key page: https://fred.stlouisfed.org/docs/api/fred/v2/api_key.html | Query parameter or bearer token, depending on API version. The app uses the existing `FredClient` request format. |
| Finnhub | `FINNHUB_API_KEY` | Finnhub dashboard. The authentication docs note that the key is under Dashboard: https://finnhub.io/docs/api/authentication | `token=...` query parameter. |
| Twelve Data | `TWELVEDATA_API_KEY` | Twelve Data dashboard after signing in: https://twelvedata.com/docs/advanced/api-usage | `apikey=...` query parameter. |
| Financial Modeling Prep | `FINANCIAL_MODELING_PREP_API_KEY` | FMP Dashboard under API Keys: https://site.financialmodelingprep.com/developer/docs/quickstart | `apikey=...` query parameter. |
| EODHD | `EODHD_API_KEY` | EODHD dashboard or welcome email after signup: https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis | `api_token=...` query parameter. |
| Alpha Vantage | `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key signup/support page linked from the docs: https://www.alphavantage.co/documentation/ | `apikey=...` query parameter. |
| Telegram | `TELEGRAM_BOT_TOKEN` | BotFather in Telegram after creating or selecting a bot: https://core.telegram.org/bots/features#creating-a-new-bot | Bot API token used by `TelegramNotificationService`. |

Notes:

- The Fear & Greed indicator is implemented as an explainable internal proxy rather than scraping CNN's visual index endpoint.
- The breadth implementation is intentionally pluggable. If you later choose a paid market breadth feed, add a new provider behind `MarketIndicatorService`.
- Stock provider fallback order is Finnhub, Twelve Data, Financial Modeling Prep, EODHD, then Alpha Vantage.
- Provider calls are still rate-limited, so the app caches provider calls and debounces symbol search before increasing symbol counts.
