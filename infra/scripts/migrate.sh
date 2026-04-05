#!/usr/bin/env bash
set -euo pipefail
echo "==> Running Prisma migrations (deploy mode)..."
pnpm db:deploy
echo "==> Done."
