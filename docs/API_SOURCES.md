# API Sources

The Angular frontend does not call market-data providers directly. It calls the Spring Boot backend at `http://localhost:8080/api`, and the backend owns all provider API keys, data fetching, caching, and fallback behavior.

## Current Implementation

| Data | Backend client | External provider/API | Endpoints / series |
| --- | --- | --- | --- |
| Stock quotes and daily OHLC closes | `FinnhubClient` | Finnhub | `/quote`, `/stock/candle` |
| Stock fundamentals and risk inputs | `FinnhubClient` | Finnhub | `/stock/metric?metric=all` |
| Symbol search/autocomplete | `FinnhubClient` | Finnhub | `/search` |
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
| Breadth | Finnhub ETF basket | No high-quality free full-market breadth feed is consistently available, so the app starts with configurable ETF participation. |
| Cross-asset correlation | Finnhub daily closes | Configurable SPY/TLT/GLD/UUP close data supports rolling correlation. |
| Symbol autofill | Finnhub `search` | Lets manually entered holdings link to real market symbols before enrichment. |
| Telegram alerts | Telegram Bot API `sendMessage` | Uses backend-owned bot credentials to send alert digests without exposing tokens to Angular. |

Useful docs:

- FRED API series observations: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- FRED VIX series: https://fred.stlouisfed.org/series/VIXCLS
- Finnhub API docs: https://finnhub.io/docs/api
- Telegram Bot API sendMessage: https://core.telegram.org/bots/api#sendmessage

Notes:

- The Fear & Greed indicator is implemented as an explainable internal proxy rather than scraping CNN's visual index endpoint.
- The breadth implementation is intentionally pluggable. If you later choose a paid market breadth feed, add a new provider behind `MarketIndicatorService`.
- Finnhub is still rate-limited, so the app caches provider calls and debounces symbol search before increasing symbol counts.
- API keys are configured through environment variables such as `FRED_API_KEY`, `FINNHUB_API_KEY`, and `TELEGRAM_BOT_TOKEN`; do not put production tokens in committed files.
