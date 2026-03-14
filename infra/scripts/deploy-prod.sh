#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploy to Production — REQUIRES CONFIRMATION"
echo "=================================================="
echo "WARNING: This will deploy to production."
read -p "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Production deploy not yet configured."
echo "Configure infra/compose/docker-compose.prod.yml and update this script."
echo ""
echo "Minimum steps:"
echo "  1. Pull latest main"
echo "  2. Run pnpm install --frozen-lockfile"
echo "  3. Run pnpm build"
echo "  4. Run pnpm db:migrate"
echo "  5. Restart production services"
echo "  6. Validate health checks"
echo "  7. Generate deploy report"
