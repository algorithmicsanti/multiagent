#!/usr/bin/env bash
set -euo pipefail

LINES="${1:-100}"
SERVICE="${2:-}"

echo "==> Web Mentor Agent OS — Log Check (last $LINES lines)"
echo "========================================================"

if [ -n "$SERVICE" ]; then
  echo "Showing logs for: $SERVICE"
  docker compose -f infra/compose/docker-compose.dev.yml logs --tail="$LINES" "$SERVICE"
else
  echo "Showing logs for all services"
  docker compose -f infra/compose/docker-compose.dev.yml logs --tail="$LINES"
fi
