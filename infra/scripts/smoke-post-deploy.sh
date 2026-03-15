#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/v1/health}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-90}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-3}"
LOG_LINES="${LOG_LINES:-120}"
COMPOSE_FILE="infra/compose/docker-compose.dev.yml"

run_compose() {
  if docker compose -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    sg docker -c "docker compose -f $COMPOSE_FILE $*"
  fi
}

start_ts=$(date +%s)

echo "==> Smoke test post-deploy"
echo "Health URL: $HEALTH_URL"
echo "Timeout: ${TIMEOUT_SECONDS}s"

healthy="0"
while true; do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    healthy="1"
    break
  fi

  now_ts=$(date +%s)
  elapsed=$((now_ts - start_ts))
  if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
    break
  fi
  sleep "$INTERVAL_SECONDS"
done

if [ "$healthy" != "1" ]; then
  echo "ERROR: Healthcheck failed after ${TIMEOUT_SECONDS}s"
  run_compose logs --tail="$LOG_LINES" api orchestrator worker-research || true
  exit 1
fi

echo "OK: API health responded"

echo "==> Service status"
run_compose ps

echo "==> Recent logs"
run_compose logs --tail="$LOG_LINES" api orchestrator worker-research

echo "==> Smoke test complete"