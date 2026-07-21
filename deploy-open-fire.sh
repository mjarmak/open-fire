#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Deploy Open Fire once, or watch GitHub and redeploy when main changes.

Usage:
  sudo bash deploy-open-fire.sh --once
  sudo bash deploy-open-fire.sh --watch

Optional environment variables:
  REPO_URL               Defaults to https://github.com/mjarmak/open-fire.git
  IMAGE_NAMESPACE        Defaults to jeniustech/open-fire
  BRANCH                 Defaults to main
  APP_DIR                Defaults to /opt/open-fire
  DEPLOY_DIR             Defaults to /home/docker_files/open-fire
  ENV_FILE               Defaults to $DEPLOY_DIR/openfire.env.production
  WATCH_INTERVAL_SECONDS Defaults to 60; minimum 15
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

MODE="${1:---once}"
case "$MODE" in
  --once|--watch) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

REPO_URL="${REPO_URL:-https://github.com/mjarmak/open-fire.git}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-jeniustech/open-fire}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/open-fire}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/docker_files/open-fire}"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/openfire.env.production}"
WATCH_INTERVAL_SECONDS="${WATCH_INTERVAL_SECONDS:-60}"

require_command git
require_command docker
require_command flock

if [[ ! "$WATCH_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || (( WATCH_INTERVAL_SECONDS < 15 )); then
  echo "WATCH_INTERVAL_SECONDS must be an integer of at least 15." >&2
  exit 2
fi

mkdir -p "$DEPLOY_DIR"
exec 9>"$DEPLOY_DIR/.deploy-open-fire.lock"
if ! flock -n 9; then
  echo "Another Open Fire deployment is already running." >&2
  exit 1
fi

sync_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    if ! git -C "$APP_DIR" diff --quiet || ! git -C "$APP_DIR" diff --cached --quiet; then
      echo "$APP_DIR has uncommitted changes. Commit, stash, or remove them before deploying." >&2
      return 1
    fi

    log "Updating $APP_DIR from $REPO_URL ($BRANCH)"
    git -C "$APP_DIR" remote set-url origin "$REPO_URL"
    git -C "$APP_DIR" fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"

    if git -C "$APP_DIR" merge-base --is-ancestor HEAD "origin/$BRANCH"; then
      git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
    else
      log "Force-syncing the dedicated deploy clone to origin/$BRANCH"
      git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    fi
  else
    log "Cloning $REPO_URL into $APP_DIR"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

current_remote_sha() {
  local remote_line
  remote_line="$(git ls-remote --exit-code "$REPO_URL" "refs/heads/$BRANCH")" || return 1
  printf '%s\n' "${remote_line%%[[:space:]]*}"
}

deploy_once() {
  local version

  sync_repo

  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing deployment environment file: $ENV_FILE" >&2
    return 2
  fi

  version="$(git -C "$APP_DIR" rev-parse --short HEAD)"
  log "Deploying Open Fire commit $version"
  REPO_URL="$REPO_URL" \
    IMAGE_NAMESPACE="$IMAGE_NAMESPACE" \
    BRANCH="$BRANCH" \
    APP_DIR="$APP_DIR" \
    DEPLOY_DIR="$DEPLOY_DIR" \
    ENV_FILE="$ENV_FILE" \
    VERSION="$version" \
    bash "$APP_DIR/scripts/deploy-linux.sh"
}

if [[ "$MODE" == "--once" ]]; then
  deploy_once
  exit 0
fi

log "Watching $REPO_URL branch $BRANCH every ${WATCH_INTERVAL_SECONDS}s"
deployed_sha=""

while true; do
  remote_sha=""
  if remote_sha="$(current_remote_sha)"; then
    if [[ "$remote_sha" != "$deployed_sha" ]]; then
      log "GitHub update detected: ${deployed_sha:-not deployed} -> $remote_sha"
      if deploy_once; then
        deployed_sha="$(git -C "$APP_DIR" rev-parse HEAD)"
        log "Redeployed commit $deployed_sha"
      else
        log "Deployment failed; it will be retried after ${WATCH_INTERVAL_SECONDS}s"
      fi
    fi
  else
    log "Could not read GitHub branch state; retrying after ${WATCH_INTERVAL_SECONDS}s"
  fi

  sleep "$WATCH_INTERVAL_SECONDS"
done
