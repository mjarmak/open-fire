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
  ENV_FILE         Deploy env file. Defaults to $DEPLOY_DIR/openfire.env.production.

Optional registry login:
  DOCKER_REGISTRY  Registry host override, for example ghcr.io. Defaults from IMAGE_NAMESPACE.
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
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/openfire.env.production}"

require_command git
require_command docker

image_registry() {
  local first_segment="${IMAGE_NAMESPACE%%/*}"

  if [[ -n "${DOCKER_REGISTRY:-}" ]]; then
    if [[ "$DOCKER_REGISTRY" == "$first_segment" && "$first_segment" != *.* && "$first_segment" != *:* && "$first_segment" != "localhost" ]]; then
      echo "DOCKER_REGISTRY=$DOCKER_REGISTRY looks like a Docker Hub namespace; using docker.io for login." >&2
      printf '%s\n' "docker.io"
      return
    fi

    printf '%s\n' "$DOCKER_REGISTRY"
  elif [[ "$first_segment" == *.* || "$first_segment" == *:* || "$first_segment" == "localhost" ]]; then
    printf '%s\n' "$first_segment"
  else
    printf '%s\n' "docker.io"
  fi
}

service_image() {
  local service="$1"
  local registry
  registry="$(image_registry)"

  if [[ "$registry" == "docker.io" && "$IMAGE_NAMESPACE" == */* ]]; then
    printf '%s-%s:%s\n' "$IMAGE_NAMESPACE" "$service" "$VERSION"
  else
    printf '%s/%s:%s\n' "$IMAGE_NAMESPACE" "$service" "$VERSION"
  fi
}

if [[ -n "${DOCKER_USERNAME:-}" && -n "${DOCKER_TOKEN:-}" ]]; then
  registry="$(image_registry)"
  log "Logging in to $registry"
  printf '%s' "$DOCKER_TOKEN" | docker login "$registry" -u "$DOCKER_USERNAME" --password-stdin
fi

if [[ -d "$APP_DIR/.git" ]]; then
  log "Updating existing clone at $APP_DIR"
  git -C "$APP_DIR" fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"

  if ! git -C "$APP_DIR" diff --quiet || ! git -C "$APP_DIR" diff --cached --quiet; then
    echo "$APP_DIR has uncommitted changes. Commit, stash, or remove them before deploying." >&2
    exit 1
  fi

  REMOTE_REF="origin/$BRANCH"
  if git -C "$APP_DIR" merge-base --is-ancestor HEAD "$REMOTE_REF"; then
    git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
  else
    log "Local $BRANCH cannot fast-forward to $REMOTE_REF; force-syncing deploy clone to remote branch"
    git -C "$APP_DIR" reset --hard "$REMOTE_REF"
  fi
else
  log "Cloning $REPO_URL into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

VERSION="${VERSION:-$(git -C "$APP_DIR" rev-parse --short HEAD)}"
BACKEND_IMAGE="${BACKEND_IMAGE:-$(service_image backend)}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-$(service_image frontend)}"

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

if grep -Eq '^(POSTGRES_PASSWORD=change-me|FRED_API_KEY=your-fred-key|FINNHUB_API_KEY=your-finnhub-key|APP_PASSWORD_HASH=generated-salted-sha256-hash|KEYCLOAK_ADMIN_PASSWORD=your_existing_keycloak_admin_password)$' "$ENV_FILE"; then
  cat >&2 <<EOF
$ENV_FILE still contains template placeholders.
Fill in the required deploy values, then rerun this script.
EOF
  exit 2
fi

env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  printf '%s\n' "${line#*=}"
}

KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-$(env_value KEYCLOAK_CONTAINER)}"
JENIUS_KEYCLOAK_REALM="${JENIUS_KEYCLOAK_REALM:-$(env_value JENIUS_KEYCLOAK_REALM)}"
KEYCLOAK_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USERNAME:-$(env_value KEYCLOAK_ADMIN_USERNAME)}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-$(env_value KEYCLOAK_ADMIN_PASSWORD)}"
SHARED_SERVICES_NETWORK="${SHARED_SERVICES_NETWORK:-$(env_value SHARED_SERVICES_NETWORK)}"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-innovilyse_auth}"
JENIUS_KEYCLOAK_REALM="${JENIUS_KEYCLOAK_REALM:-jenius}"
SHARED_SERVICES_NETWORK="${SHARED_SERVICES_NETWORK:-docker_files_default}"

if ! docker network inspect "$SHARED_SERVICES_NETWORK" >/dev/null 2>&1; then
  echo "Missing shared Docker network: $SHARED_SERVICES_NETWORK" >&2
  exit 1
fi
if ! docker inspect "$KEYCLOAK_CONTAINER" >/dev/null 2>&1; then
  echo "Shared Jenius Auth container is not running: $KEYCLOAK_CONTAINER" >&2
  exit 1
fi

log "Ensuring the Open Fire public PKCE client exists in Jenius Auth"
docker exec \
  -e OPEN_FIRE_KC_ADMIN="$KEYCLOAK_ADMIN_USERNAME" \
  -e OPEN_FIRE_KC_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
  -e OPEN_FIRE_KC_REALM="$JENIUS_KEYCLOAK_REALM" \
  "$KEYCLOAK_CONTAINER" sh -eu -c '
    kc_admin="${OPEN_FIRE_KC_ADMIN:-${KEYCLOAK_USER:-${KEYCLOAK_ADMIN:-}}}"
    kc_password="${OPEN_FIRE_KC_PASSWORD:-${KEYCLOAK_PASSWORD:-${KEYCLOAK_ADMIN_PASSWORD:-}}}"
    if [ -z "$kc_admin" ] || [ -z "$kc_password" ]; then
      echo "Keycloak admin credentials are missing. Set KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD in the Open Fire env file." >&2
      exit 2
    fi
    if [ -x /opt/keycloak/bin/kcadm.sh ]; then
      kcadm=/opt/keycloak/bin/kcadm.sh
    elif [ -x /opt/jboss/keycloak/bin/kcadm.sh ]; then
      kcadm=/opt/jboss/keycloak/bin/kcadm.sh
    else
      echo "Could not find kcadm.sh in the shared Keycloak container." >&2
      exit 1
    fi
    config_file=/tmp/open-fire-kcadm.config
    "$kcadm" config credentials --config "$config_file" \
      --server http://localhost:8080/auth --realm master \
      --user "$kc_admin" --password "$kc_password" >/dev/null
    client_uuid="$("$kcadm" get clients --config "$config_file" -r "$OPEN_FIRE_KC_REALM" \
      -q clientId=open-fire --fields id --format csv --noquotes | head -n 1)"
    if [ -z "$client_uuid" ]; then
      "$kcadm" create clients --config "$config_file" -r "$OPEN_FIRE_KC_REALM" \
        -s clientId=open-fire -s protocol=openid-connect -s publicClient=true \
        -s standardFlowEnabled=true -s implicitFlowEnabled=false \
        -s directAccessGrantsEnabled=false >/dev/null
      client_uuid="$("$kcadm" get clients --config "$config_file" -r "$OPEN_FIRE_KC_REALM" \
        -q clientId=open-fire --fields id --format csv --noquotes | head -n 1)"
    fi
    "$kcadm" update "clients/$client_uuid" --config "$config_file" -r "$OPEN_FIRE_KC_REALM" \
      -s clientId=open-fire \
      -s '"'"'name=Open Fire'"'"' \
      -s enabled=true -s publicClient=true -s standardFlowEnabled=true \
      -s implicitFlowEnabled=false -s directAccessGrantsEnabled=false \
      -s '"'"'redirectUris=["https://openfire.jeniusapps.com/*","http://localhost:4200/*","http://127.0.0.1:4200/*"]'"'"' \
      -s '"'"'webOrigins=["https://openfire.jeniusapps.com","http://localhost:4200","http://127.0.0.1:4200"]'"'"' \
      -s '"'"'attributes={"pkce.code.challenge.method":"S256"}'"'"'
    rm -f "$config_file"
  '
log "Building backend image $BACKEND_IMAGE"
docker build --pull -f "$APP_DIR/backend/Dockerfile" -t "$BACKEND_IMAGE" "$APP_DIR"

log "Building frontend image $FRONTEND_IMAGE"
docker build --pull -f "$APP_DIR/frontend/Dockerfile" -t "$FRONTEND_IMAGE" "$APP_DIR"

log "Pushing images"
log "Pushing backend image:  $BACKEND_IMAGE"
docker push "$BACKEND_IMAGE"
log "Pushing frontend image: $FRONTEND_IMAGE"
docker push "$FRONTEND_IMAGE"

log "Deploying version $VERSION"
(
  cd "$DEPLOY_DIR"
  BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" APP_ENV_FILE="$ENV_FILE" compose_cmd --env-file "$ENV_FILE" -f docker-compose.yml pull
  BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" APP_ENV_FILE="$ENV_FILE" compose_cmd --env-file "$ENV_FILE" -f docker-compose.yml up -d --remove-orphans
)

log "Waiting for Open Fire containers"
for container in open_fire_backend open_fire_frontend; do
  for attempt in {1..30}; do
    container_state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
    if [[ "$container_state" == "running" ]]; then
      break
    fi

    if (( attempt == 30 )); then
      echo "$container did not reach the running state." >&2
      docker logs --tail 80 "$container" >&2 || true
      exit 1
    fi

    sleep 2
  done
done

sleep 5
for container in open_fire_backend open_fire_frontend; do
  container_state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
  if [[ "$container_state" != "running" ]]; then
    echo "$container stopped during the readiness check." >&2
    docker logs --tail 80 "$container" >&2 || true
    exit 1
  fi
done

log "Service status"
(
  cd "$DEPLOY_DIR"
  BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" APP_ENV_FILE="$ENV_FILE" compose_cmd --env-file "$ENV_FILE" -f docker-compose.yml ps
)

log "Deployment complete"
echo "Backend image:  $BACKEND_IMAGE"
echo "Frontend image: $FRONTEND_IMAGE"
