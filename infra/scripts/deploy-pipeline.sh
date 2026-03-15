#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-full}" # full|backend|frontend
PRE_DEPLOY_COMMIT=$(git rev-parse HEAD)
AUTO_ROLLBACK_ON_FAIL="${AUTO_ROLLBACK_ON_FAIL:-1}"
COMPOSE_FILE="infra/compose/docker-compose.dev.yml"
STATE_DIR="infra/state"
LAST_SUCCESS_FILE="$STATE_DIR/last-successful-deploy.env"
DEPLOY_HISTORY_FILE="$STATE_DIR/deploy-history.log"

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

configure_target() {
  case "$TARGET" in
    full)
      DEPLOY_SERVICES=(postgres redis api orchestrator worker-research dashboard)
      SMOKE_NAME="full"
      HEALTH_URL="http://localhost:3001/api/v1/health"
      ERROR_SERVICES="api,orchestrator,worker-research,dashboard"
      ;;
    backend)
      DEPLOY_SERVICES=(postgres redis api orchestrator worker-research)
      SMOKE_NAME="backend"
      HEALTH_URL="http://localhost:3001/api/v1/health"
      ERROR_SERVICES="api,orchestrator,worker-research"
      ;;
    frontend)
      DEPLOY_SERVICES=(api dashboard)
      SMOKE_NAME="frontend"
      HEALTH_URL="http://localhost:3000"
      ERROR_SERVICES="api,dashboard"
      ;;
    *)
      echo "Uso: $0 [full|backend|frontend]"
      exit 1
      ;;
  esac
}

rollback_to_previous_commit() {
  if [ "$AUTO_ROLLBACK_ON_FAIL" != "1" ]; then
    echo "Auto-rollback disabled (AUTO_ROLLBACK_ON_FAIL=$AUTO_ROLLBACK_ON_FAIL)"
    return 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "Auto-rollback skipped: working tree not clean"
    return 1
  fi

  PREV_COMMIT=$(git rev-parse HEAD~1)
  echo "Attempting auto-rollback to $PREV_COMMIT"

  git checkout "$PREV_COMMIT"
  run_pnpm install --frozen-lockfile
  run_pnpm build
  run_compose up -d --build "${DEPLOY_SERVICES[@]}"

  SERVICES_CSV="$ERROR_SERVICES" SMOKE_NAME="$SMOKE_NAME" HEALTH_URL="$HEALTH_URL" ./infra/scripts/smoke-post-deploy.sh
  SERVICES_CSV="$ERROR_SERVICES" ./infra/scripts/check-errors-window.sh "5m"

  echo "Auto-rollback complete. Returning to original commit $PRE_DEPLOY_COMMIT"
  git checkout "$PRE_DEPLOY_COMMIT"
  return 0
}

record_success() {
  mkdir -p "$STATE_DIR"

  local ts commit branch services_csv
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  commit=$(git rev-parse HEAD)
  branch=$(git branch --show-current)
  services_csv=$(IFS=,; echo "${DEPLOY_SERVICES[*]}")

  cat >"$LAST_SUCCESS_FILE" <<EOF
TIMESTAMP=$ts
TARGET=$TARGET
BRANCH=$branch
COMMIT=$commit
SERVICES=$services_csv
HEALTH_URL=$HEALTH_URL
EOF

  echo "$ts target=$TARGET branch=$branch commit=$commit services=$services_csv" >>"$DEPLOY_HISTORY_FILE"
}

configure_target

echo "==> Deploy pipeline (target=$TARGET)"
BRANCH=$(git branch --show-current)
echo "Branch: $BRANCH"

if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: Uncommitted changes detected"
  git status --short
fi

echo "--- Installing dependencies ---"
run_pnpm install --frozen-lockfile

echo "--- Building ---"
run_pnpm build

echo "--- Typechecking ---"
run_pnpm typecheck

echo "--- Running migrations ---"
run_pnpm db:migrate

echo "--- Restarting target services ---"
run_compose up -d --build "${DEPLOY_SERVICES[@]}"

echo "--- Smoke post-deploy ---"
if ! SERVICES_CSV="$ERROR_SERVICES" SMOKE_NAME="$SMOKE_NAME" HEALTH_URL="$HEALTH_URL" ./infra/scripts/smoke-post-deploy.sh; then
  echo "Deploy smoke test failed (target=$TARGET)"
  rollback_to_previous_commit || true
  exit 1
fi

echo "--- Error budget (logs recientes) ---"
if ! SERVICES_CSV="$ERROR_SERVICES" ./infra/scripts/check-errors-window.sh "5m"; then
  echo "Deploy error-budget check failed (target=$TARGET)"
  rollback_to_previous_commit || true
  exit 1
fi

record_success

echo "==> Deploy pipeline complete (target=$TARGET)"
echo "Saved deploy state: $LAST_SUCCESS_FILE"