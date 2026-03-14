#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploy to Staging"
echo "====================="

# 1. Validate branch
BRANCH=$(git branch --show-current)
echo "Branch: $BRANCH"

# 2. Git status
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: Uncommitted changes detected"
  git status --short
fi

# 3. Install dependencies
echo ""
echo "--- Installing dependencies ---"
pnpm install --frozen-lockfile

# 4. Build
echo ""
echo "--- Building ---"
pnpm build

# 5. Typecheck
echo ""
echo "--- Typechecking ---"
pnpm typecheck

# 6. Run migrations
echo ""
echo "--- Running migrations ---"
pnpm db:migrate

# 7. Restart services
echo ""
echo "--- Restarting services ---"
docker compose -f infra/compose/docker-compose.dev.yml up -d --build

# 8. Health check
echo ""
echo "--- Health check ---"
sleep 5
./infra/scripts/check-services.sh

echo ""
echo "==> Staging deploy complete"
