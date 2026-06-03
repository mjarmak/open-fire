# Stock Market Analyzer

Angular + Spring Boot trading assistant for a daily macro-market digest, low-cap momentum alerts, and Telegram alert delivery.

## What It Tracks

- Fear Index / VIX from FRED series `VIXCLS`
- Fear & Greed as an internal composite of VIX, credit, breadth, and cross-asset correlation
- Market Breadth from a configurable Finnhub ETF basket
- Credit Market from FRED series `BAMLC0A0CM`
- Cross-Asset Correlation from configurable Finnhub symbols, defaulting to `SPY,TLT,GLD,UUP`
- Stock alerts when a watched stock is below the market-cap threshold and rose too quickly over roughly 30 calendar days

The backend only returns fetched provider data. If a provider key is missing, the dashboard shows an empty/loading state instead of sample market values.

## Run The App

Frontend:

```powershell
cd frontend
npm start
```

Backend:

```powershell
mvn -f backend/pom.xml spring-boot:run
```

Open the Angular app at `http://localhost:4200`.

Default basic auth:

- Username: `admin`
- Password: `admin123`

## Deploy With Docker Compose

The repo includes Dockerfiles for the Spring Boot backend and Angular frontend, plus a production compose file for frontend, backend, and PostgreSQL.

Create a deploy env file from the template and fill in real values:

```bash
mkdir -p /home/docker_files/open-fire
cp docker/openfire.env.production /home/docker_files/open-fire/.env
nano /home/docker_files/open-fire/.env
```

Build, push, and deploy a version from your Linux server:

```bash
export REPO_URL=https://github.com/mjarmak/open-fire.git
export IMAGE_NAMESPACE=jeniustech/open-fire
export VERSION=1.1.100
export DOCKER_USERNAME=jeniustech
export DOCKER_TOKEN=your-registry-token

sed -i 's/\r$//' deploy-linux.sh
bash scripts/deploy-linux.sh
```

On the first run the script clones the repo into `/opt/open-fire`. On later runs it updates the clone, builds both images, pushes:

```text
jeniustech/open-fire-backend:$VERSION
jeniustech/open-fire-frontend:$VERSION
```

Then it deploys `/home/docker_files/open-fire/docker-compose.yml` with the new image tags.

For Docker Hub, leave `DOCKER_REGISTRY` unset or set it to `docker.io`. Only set `DOCKER_REGISTRY` to a registry hostname such as `ghcr.io` when your `IMAGE_NAMESPACE` uses that registry.
Docker Hub image names are flattened to `jeniustech/open-fire-backend:$VERSION` and `jeniustech/open-fire-frontend:$VERSION`.

If the repository is private and you use an SSH URL such as `git@github.com:mjarmak/open-fire.git`, the Linux user running the script must have a GitHub SSH key with repository access. When running as root, that means configuring `/root/.ssh`.

Useful overrides:

```bash
BRANCH=main
APP_DIR=/opt/open-fire
DEPLOY_DIR=/home/docker_files/open-fire
ENV_FILE=/home/docker_files/open-fire/.env
BACKEND_IMAGE=jeniustech/open-fire-backend:$VERSION
FRONTEND_IMAGE=jeniustech/open-fire-frontend:$VERSION
APP_CORS_ALLOWED_ORIGIN_PATTERNS=*
FRONTEND_PORT=80
BACKEND_PORT=8080
BACKEND_CONTAINER_PORT=8080
```

`FRONTEND_PORT` and `BACKEND_PORT` are host ports. `BACKEND_CONTAINER_PORT` is the port Spring Boot listens on inside the Docker network, and nginx uses the same value when proxying `/api` to the backend container. In most deployments, change only the host ports:

```bash
FRONTEND_PORT=8081
BACKEND_PORT=8280
BACKEND_CONTAINER_PORT=8080
```

The frontend container serves Angular through nginx and proxies `/api` to the backend container, so users open only the frontend URL.

If the browser calls the backend through a different origin than the frontend, set `APP_CORS_ALLOWED_ORIGIN_PATTERNS` to the frontend origin, for example:

```bash
APP_CORS_ALLOWED_ORIGIN_PATTERNS=https://your-domain.com,http://45.133.178.241:8081
```

## PostgreSQL Only Compose

Start the stack with:

```bash
docker compose -f /home/docker_files/sma-docker-compose-postgres.yml up -d
```

If the backend also runs in Docker, make sure its service provides these backend environment variables:

```bash
POSTGRES_URL=jdbc:postgresql://postgres_sma:5432/stock_analyzer
POSTGRES_USER=admin
POSTGRES_PASSWORD=G@#$g4G#dwsfgfs
FRED_API_KEY=your-fred-key
FINNHUB_API_KEY=your-finnhub-key
APP_BASIC_USER=admin
APP_PASSWORD_SALT=open-fire-fixed-salt
APP_PASSWORD_HASH=generated-hash
```

Optional Telegram variables:

```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_USERNAME=sma3141_bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

Useful deployment commands:

```bash
docker compose -f /home/docker_files/sma-docker-compose-postgres.yml up -d
sudo ufw allow '5432'

docker exec -it postgres_sma psql -U admin -d stock_analyzer
ALTER USER admin WITH PASSWORD 'G@#$g4G#dwsfgfs';
```

The included `docker/sma-docker-compose-postgres.yml` starts only PostgreSQL. If you run Spring Boot from your host machine after starting that compose file, set the local backend variables shown in the PostgreSQL section below.

## Live Data Configuration

Set these environment variables before running the backend:

```powershell
$env:FRED_API_KEY="your-fred-key"
$env:FINNHUB_API_KEY="your-finnhub-key"
$env:LOW_MARKET_CAP_THRESHOLD="2000000000"
$env:FAST_RISE_PERCENT_THRESHOLD="35"
```

See [docs/API_SOURCES.md](docs/API_SOURCES.md) for the exact external APIs, backend clients, and provider endpoints used by the app.

## Manual Portfolio

Use the dashboard form to add portfolio holdings manually:

- Stock symbol or company name
- Position quantity
- Average cost per share

The stock field uses Finnhub symbol search for autofill. Saved holdings are kept by the Spring Boot backend while it is running.

## PostgreSQL Portfolio Storage

Portfolio positions require PostgreSQL storage. Set:

```powershell
$env:POSTGRES_URL="jdbc:postgresql://localhost:5439/stock_analyzer"
$env:POSTGRES_USER="admin"
$env:POSTGRES_PASSWORD='G@#$g4G#dwsfgfs'
```

When the backend runs in Docker on the same compose network as the database, use `jdbc:postgresql://postgres_sma:5432/stock_analyzer`.
When the backend runs from your host machine and only Postgres is in Docker, use `jdbc:postgresql://localhost:5439/stock_analyzer`.
The backend will not start unless `POSTGRES_URL` or `SPRING_DATASOURCE_URL` points to a reachable database.

Flyway runs on backend startup when PostgreSQL is enabled and applies migrations from `backend/src/main/resources/db/migration`.
The initial migration creates or upgrades the `users` and `portfolio_holdings` tables.
Basic Auth users are stored in the `users` table and portfolio rows are stored per user in `portfolio_holdings`.
Each portfolio row uses `(username, symbol)` as its primary key and `portfolio_holdings.username` has a foreign key to `users.username`.

On first startup, Flyway seeds one user from `APP_BASIC_USER` and `APP_PASSWORD_HASH` if that username does not already exist. To add another user, use the Create User dialog or insert a salted SHA-256 password hash:

```sql
insert into users (username, password_hash, enabled)
values ('second-user', 'salted-sha256-hash', true);
```

## Telegram Configuration

The backend sends Telegram messages through the Telegram Bot API. Keep the bot token in an environment variable, not in source files:

```powershell
$env:TELEGRAM_ENABLED="true"
$env:TELEGRAM_BOT_USERNAME="sma3141_bot"
$env:TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
```

Chat IDs are stored per app user in PostgreSQL. Use the Telegram button in the dashboard to save or test your own chat ID. For a private chat, start the bot in Telegram, call `getUpdates` with the bot token, and copy the returned `message.chat.id` into the dashboard. For a channel or supergroup, Telegram can accept a target username such as `@channel_name` when the bot has permission to post there.

## Basic Auth Password Hash

The app uses a fixed salt from `APP_PASSWORD_SALT` and stores only `APP_PASSWORD_HASH`.
Hash format is:

```text
sha256(fixedSalt + rawPassword)
```

Generate a new hash in PowerShell:

```powershell
$salt="open-fire-fixed-salt"
$password="new-password"
$bytes=[System.Text.Encoding]::UTF8.GetBytes($salt + $password)
$sha=[System.Security.Cryptography.SHA256]::Create()
([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-","").ToLowerInvariant()
```

Then set:

```powershell
$env:APP_BASIC_USER="admin"
$env:APP_PASSWORD_SALT="open-fire-fixed-salt"
$env:APP_PASSWORD_HASH="generated-hash"
```
