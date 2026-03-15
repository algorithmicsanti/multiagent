#!/usr/bin/env bash
set -euo pipefail

WINDOW="${1:-5m}"
COMPOSE_FILE="infra/compose/docker-compose.dev.yml"
RULES_FILE="${RULES_FILE:-infra/config/log-error-budget.rules.sh}"

# Defaults (se sobreescriben desde RULES_FILE si existe)
SERVICES=(api orchestrator worker-research)
BASE_ERROR_REGEX='(\b(ERROR|FATAL)\b|UnhandledPromiseRejection|TypeError:|ReferenceError:|PrismaClientKnownRequestError|ERR_[A-Z_]+)'
GLOBAL_IGNORE_REGEX='(DeprecationWarning|ExperimentalWarning|the attribute `version` is obsolete)'
declare -A SERVICE_IGNORE_REGEX
declare -A SERVICE_HARD_FAIL_REGEX

if [ -f "$RULES_FILE" ]; then
  # shellcheck disable=SC1090
  source "$RULES_FILE"
fi

run_compose() {
  if docker compose -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    sg docker -c "docker compose -f $COMPOSE_FILE $*"
  fi
}

echo "==> Error scan window: $WINDOW"

tmp_log=$(mktemp)
trap 'rm -f "$tmp_log"' EXIT

run_compose logs --since "$WINDOW" "${SERVICES[@]}" >"$tmp_log" 2>&1 || true

failed=0
for service in "${SERVICES[@]}"; do
  service_lines=$(grep -E "^${service}-[0-9]+\s+\|" "$tmp_log" || true)
  [ -z "$service_lines" ] && continue

  hard_fail_regex="${SERVICE_HARD_FAIL_REGEX[$service]:-}"
  if [ -n "$hard_fail_regex" ]; then
    hard_hits=$(printf "%s\n" "$service_lines" | grep -E "$hard_fail_regex" || true)
    if [ -n "$hard_hits" ]; then
      echo "ERROR: hard-fail pattern detectado en $service"
      printf "%s\n" "$hard_hits"
      failed=1
      continue
    fi
  fi

  hits=$(printf "%s\n" "$service_lines" | grep -E "$BASE_ERROR_REGEX" | grep -Ev "$GLOBAL_IGNORE_REGEX" || true)
  [ -z "$hits" ] && continue

  ignore_regex="${SERVICE_IGNORE_REGEX[$service]:-}"
  if [ -n "$ignore_regex" ]; then
    hits=$(printf "%s\n" "$hits" | grep -Ev "$ignore_regex" || true)
  fi

  if [ -n "$hits" ]; then
    echo "ERROR: errores recientes detectados en $service"
    printf "%s\n" "$hits"
    failed=1
  fi
done

if [ "$failed" -eq 1 ]; then
  exit 1
fi

echo "OK: no se detectaron errores recientes en logs críticos"