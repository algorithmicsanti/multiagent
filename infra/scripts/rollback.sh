#!/usr/bin/env bash
set -euo pipefail

echo "==> Rollback — REQUIRES CONFIRMATION"
echo "======================================"
echo "WARNING: This will roll back to the previous deployment."
read -p "Confirm rollback? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

PREV_COMMIT="${1:-HEAD~1}"
echo "Rolling back to: $PREV_COMMIT"

git checkout "$PREV_COMMIT"
pnpm install --frozen-lockfile
pnpm build
docker compose -f infra/compose/docker-compose.dev.yml up -d --build

echo ""
echo "--- Health check after rollback ---"
sleep 5
./infra/scripts/check-services.sh

echo "==> Rollback complete. Validate services manually."
