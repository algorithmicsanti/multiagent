#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="infra/state/last-successful-deploy.env"
COMPOSE_FILE="infra/compose/docker-compose.dev.yml"

run_compose() {
  if docker compose -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    sg docker -c "docker compose -f $COMPOSE_FILE $*"
  fi
}

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  else
    echo "pnpm/corepack not found in PATH"
    return 127
  fi
}

if [ ! -f "$STATE_FILE" ]; then
  echo "No state file found at $STATE_FILE"
  exit 1
fi

# shellcheck disable=SC1091
source "$STATE_FILE"

if [ -z "${COMMIT:-}" ] || [ -z "${TARGET:-}" ]; then
  echo "Invalid state file: missing COMMIT or TARGET"
  exit 1
fi

echo "==> Rollback to last successful deploy"
echo "Target: $TARGET"
echo "Commit: $COMMIT"
echo "Timestamp: ${TIMESTAMP:-unknown}"

read -r -p "Confirm rollback to this release? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree dirty. Commit/stash changes before rollback."
  exit 1
fi

git checkout "$COMMIT"
run_pnpm install --frozen-lockfile
run_pnpm build
run_pnpm typecheck

case "$TARGET" in
  full)
    DEPLOY_SERVICES=(postgres redis api orchestrator worker-research dashboard)
    ERROR_SERVICES="api,orchestrator,worker-research,dashboard"
    HEALTH_URL="http://localhost:3001/api/v1/health"
    SMOKE_NAME="full"
    echo "Running migrations for rollback target=$TARGET"
    run_pnpm db:deploy
    ;;
  backend)
    DEPLOY_SERVICES=(postgres redis api orchestrator worker-research)
    ERROR_SERVICES="api,orchestrator,worker-research"
    HEALTH_URL="http://localhost:3001/api/v1/health"
    SMOKE_NAME="backend"
    echo "Running migrations for rollback target=$TARGET"
    run_pnpm db:deploy
    ;;
  frontend)
    DEPLOY_SERVICES=(api dashboard)
    ERROR_SERVICES="api,dashboard"
    HEALTH_URL="http://localhost:3000"
    SMOKE_NAME="frontend"
    echo "Skipping DB migrations for rollback target=$TARGET"
    ;;
  *)
    echo "Unknown TARGET in state file: $TARGET"
    exit 1
    ;;
esac

run_compose up -d --build "${DEPLOY_SERVICES[@]}"
SERVICES_CSV="$ERROR_SERVICES" SMOKE_NAME="$SMOKE_NAME" HEALTH_URL="$HEALTH_URL" ./infra/scripts/smoke-post-deploy.sh
SERVICES_CSV="$ERROR_SERVICES" ./infra/scripts/check-errors-window.sh 5m

echo "Rollback complete. You are now on commit $COMMIT"
