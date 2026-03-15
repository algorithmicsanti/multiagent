#!/usr/bin/env bash
set -euo pipefail

WINDOW="${1:-5m}"
COMPOSE_FILE="infra/compose/docker-compose.dev.yml"
SERVICES=(api orchestrator worker-research)

# Regex de error “real” (ajustable)
ERROR_REGEX='\b(ERROR|Error|error|FATAL|Unhandled|UnhandledPromiseRejection|ERR_)\b'
IGNORE_REGEX='(DeprecationWarning|experimental warning)'

run_compose() {
  if docker compose -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    sg docker -c "docker compose -f $COMPOSE_FILE $*"
  fi
}

echo "==> Error scan window: $WINDOW"
LOGS=$(run_compose logs --since "$WINDOW" "${SERVICES[@]}" 2>&1 || true)

MATCHES=$(printf "%s\n" "$LOGS" | grep -E "$ERROR_REGEX" | grep -Ev "$IGNORE_REGEX" || true)

if [ -n "$MATCHES" ]; then
  echo "ERROR: se detectaron errores recientes en logs"
  printf "%s\n" "$MATCHES"
  exit 1
fi

echo "OK: no se detectaron errores recientes en logs críticos"