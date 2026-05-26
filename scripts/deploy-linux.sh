#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Build, push, and deploy Stock Market Analyzer from a Linux server.

Required:
  REPO_URL          Git URL to clone on first run.
  IMAGE_NAMESPACE  Docker image namespace, for example ghcr.io/acme/open-fire.

Common options:
  VERSION          Image tag to build and deploy. Defaults to the current git short SHA.
  BRANCH           Git branch to deploy. Defaults to main.
  APP_DIR          Local clone path. Defaults to /opt/open-fire.
  DEPLOY_DIR       Compose/env directory. Defaults to /home/docker_files/open-fire.
  ENV_FILE         Deploy env file. Defaults to $DEPLOY_DIR/.env.

Optional registry login:
  DOCKER_REGISTRY  Registry host, for example ghcr.io.
  DOCKER_USERNAME  Registry username.
  DOCKER_TOKEN     Registry token or password.

Example:
  REPO_URL=git@github.com:you/open-fire.git \
  IMAGE_NAMESPACE=ghcr.io/you/open-fire \
  VERSION=2026.06.03-1 \
  bash scripts/deploy-linux.sh
USAGE
}

log() {
  printf '\n[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "Missing Docker Compose. Install docker compose or docker-compose." >&2
    exit 1
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

: "${REPO_URL:?Set REPO_URL to your Git repository URL}"
: "${IMAGE_NAMESPACE:?Set IMAGE_NAMESPACE, for example ghcr.io/you/open-fire}"

BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/open-fire}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/docker_files/open-fire}"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env}"

require_command git
require_command docker

if [[ -n "${DOCKER_USERNAME:-}" && -n "${DOCKER_TOKEN:-}" ]]; then
  registry="${DOCKER_REGISTRY:-docker.io}"
  log "Logging in to $registry"
  printf '%s' "$DOCKER_TOKEN" | docker login "$registry" -u "$DOCKER_USERNAME" --password-stdin
fi

if [[ -d "$APP_DIR/.git" ]]; then
  log "Updating existing clone at $APP_DIR"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  log "Cloning $REPO_URL into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

VERSION="${VERSION:-$(git -C "$APP_DIR" rev-parse --short HEAD)}"
BACKEND_IMAGE="${IMAGE_NAMESPACE}/backend:${VERSION}"
FRONTEND_IMAGE="${IMAGE_NAMESPACE}/frontend:${VERSION}"

log "Preparing deploy directory $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp "$APP_DIR/docker/openfire-docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$APP_DIR/docker/openfire.env.production" "$ENV_FILE"
  cat >&2 <<EOF
Created $ENV_FILE from docker/openfire.env.production.
Edit it with real database, API, auth, and Telegram values, then rerun this script.
EOF
  exit 2
fi

if grep -Eq '^(POSTGRES_PASSWORD=change-me|FRED_API_KEY=your-fred-key|FINNHUB_API_KEY=your-finnhub-key|APP_PASSWORD_HASH=generated-salted-sha256-hash)$' "$ENV_FILE"; then
  cat >&2 <<EOF
$ENV_FILE still contains template placeholders.
Fill in the required deploy values, then rerun this script.
EOF
  exit 2
fi

log "Building backend image $BACKEND_IMAGE"
docker build --pull -f "$APP_DIR/backend/Dockerfile" -t "$BACKEND_IMAGE" "$APP_DIR"

log "Building frontend image $FRONTEND_IMAGE"
docker build --pull -f "$APP_DIR/frontend/Dockerfile" -t "$FRONTEND_IMAGE" "$APP_DIR"

log "Pushing images"
docker push "$BACKEND_IMAGE"
docker push "$FRONTEND_IMAGE"

log "Deploying version $VERSION"
(
  cd "$DEPLOY_DIR"
  BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" APP_ENV_FILE="$ENV_FILE" compose_cmd --env-file "$ENV_FILE" -f docker-compose.yml pull
  BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" APP_ENV_FILE="$ENV_FILE" compose_cmd --env-file "$ENV_FILE" -f docker-compose.yml up -d --remove-orphans
)

log "Deployment complete"
echo "Backend image:  $BACKEND_IMAGE"
echo "Frontend image: $FRONTEND_IMAGE"
