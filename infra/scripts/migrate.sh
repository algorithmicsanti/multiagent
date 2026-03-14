#!/usr/bin/env bash
set -euo pipefail
echo "==> Running Prisma migrations..."
pnpm --filter @wm/db db:migrate
echo "==> Done."
