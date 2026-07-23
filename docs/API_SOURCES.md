# API Sources

The Angular frontend calls the Spring Boot backend at `/api`. Deployment-level provider keys stay on the backend. Optional user-provided Finnhub and Twelve Data keys are stored only in browser local storage and sent to the backend with market-data requests.

## Current Implementation

| Data | Backend client | External provider/API | Endpoints / series |
| --- | --- | --- | --- |
| Stock quotes and daily OHLC closes | `FinnhubClient` | Finnhub, then Twelve Data | Finnhub `/quote`, `/stock/candle`; Twelve Data `/quote`, `/time_series` |
| Stock fundamentals and risk inputs | `FinnhubClient` | Finnhub, then Twelve Data | Finnhub `/stock/metric?metric=all`; Twelve Data `/quote` |
| Symbol search/autocomplete | `FinnhubClient` | Finnhub, then Twelve Data | Finnhub `/search`; Twelve Data `/symbol_search` |
| Crypto symbol search and candles | `BinanceApiService` | Binance public API | `/api/v3/exchangeInfo`, `/api/v3/klines` |
| VIX / Fear Index | `FredClient` | FRED / St. Louis Fed | `/fred/series/observations`, series `VIXCLS` |
| Credit Market | `FredClient` | FRED / St. Louis Fed | `/fred/series/observations`, series `BAMLC0A0CM` |
| Market Breadth | `MarketIndicatorService` | Configured ETF basket | live current/previous quote direction, with daily closes as fallback |
| Cross-Asset Correlation | `MarketIndicatorService` | Configured ETF basket | daily closes for configured `CROSS_ASSET_SYMBOLS` |
| Fear & Greed | `MarketIndicatorService` | Internal composite | VIX, credit, breadth, and cross-asset correlation |
| Telegram alerts/reminders | `TelegramNotificationService` | Telegram Bot API | `sendMessage` |

Local PostgreSQL stores users, Basic Auth password hashes, portfolio holdings, Telegram chat IDs, and retirement planner settings. Those values are not fetched from external market APIs.

Best free/public starting point:

| Need | Provider | Why |
| --- | --- | --- |
| Fear Index / VIX | FRED `VIXCLS` | Free official St. Louis Fed API access to CBOE VIX observations. |
| Credit Market | FRED `BAMLC0A0CM` | Free credit-spread proxy from ICE BofA corporate option-adjusted spread. |
| Company market cap + daily prices | Finnhub `quote`, `stock/profile2`, and `stock/candle` | Primary stock source for quotes, metadata, and risk inputs. |
| Additional stock fallback quota | Twelve Data | The backend tries Twelve Data when Finnhub returns no usable data or is temporarily rate-limited. |
| Breadth | Finnhub ETF basket | No high-quality free full-market breadth feed is consistently available, so the app starts with configurable ETF participation. |
| Cross-asset correlation | Finnhub daily closes | Configurable SPY/TLT/GLD/UUP close data supports rolling correlation. |
| Symbol autofill | Finnhub `search` | Lets manually entered holdings link to real market symbols before enrichment. |
| Telegram alerts | Telegram Bot API `sendMessage` | Uses backend-owned bot credentials to send alert digests without exposing tokens to Angular. |

Useful docs:

- FRED API series observations: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- FRED VIX series: https://fred.stlouisfed.org/series/VIXCLS
- Finnhub API docs: https://finnhub.io/docs/api
- Twelve Data API docs: https://twelvedata.com/docs/introduction
- Binance Spot API docs: https://developers.binance.com/docs/binance-spot-api-docs
- Telegram Bot API sendMessage: https://core.telegram.org/bots/api#sendmessage

## Access Tokens

All market-data tokens belong on the Spring Boot backend. Put them in environment variables before starting the backend, or in your deployment secret store. Do not put production tokens in committed files.

| Provider | Environment variable | Where to find the token | How requests authenticate |
| --- | --- | --- | --- |
| FRED | `FRED_API_KEY` | Sign in to the FRED account site, then request or view API keys from the FRED API key page: https://fred.stlouisfed.org/docs/api/fred/v2/api_key.html | Query parameter or bearer token, depending on API version. The app uses the existing `FredClient` request format. |
| Finnhub | `FINNHUB_API_KEY` | Finnhub dashboard. The authentication docs note that the key is under Dashboard: https://finnhub.io/docs/api/authentication | `token=...` query parameter. |
| Twelve Data | `TWELVEDATA_API_KEY` | Twelve Data dashboard after signing in: https://twelvedata.com/docs/advanced/api-usage | `apikey=...` query parameter. |
| Telegram | `TELEGRAM_BOT_TOKEN` | BotFather in Telegram after creating or selecting a bot: https://core.telegram.org/bots/features#creating-a-new-bot | Bot API token used by `TelegramNotificationService`. |

Notes:

- The Fear & Greed indicator is implemented as an explainable internal proxy rather than scraping CNN's visual index endpoint.
- The breadth implementation is intentionally pluggable. If you later choose a paid market breadth feed, add a new provider behind `MarketIndicatorService`.
- Stock provider fallback order is Finnhub, then Twelve Data.
- Provider calls are still rate-limited, so the app caches provider calls and debounces symbol search before increasing symbol counts.
