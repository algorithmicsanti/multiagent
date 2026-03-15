#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploy to Staging"
echo "====================="

PRE_DEPLOY_COMMIT=$(git rev-parse HEAD)
AUTO_ROLLBACK_ON_FAIL="${AUTO_ROLLBACK_ON_FAIL:-1}"
COMPOSE_FILE="infra/compose/docker-compose.dev.yml"

run_compose() {
  if docker compose -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    sg docker -c "docker compose -f $COMPOSE_FILE $*"
  fi
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
  pnpm install --frozen-lockfile
  pnpm build
  run_compose up -d --build
  ./infra/scripts/smoke-post-deploy.sh

  echo "Auto-rollback complete. Returning to original commit $PRE_DEPLOY_COMMIT"
  git checkout "$PRE_DEPLOY_COMMIT"
  return 0
}

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
run_compose up -d --build

# 8. Smoke post-deploy
echo ""
echo "--- Smoke post-deploy ---"
if ! ./infra/scripts/smoke-post-deploy.sh; then
  echo "Deploy smoke test failed"
  rollback_to_previous_commit || true
  exit 1
fi

echo ""
echo "==> Staging deploy complete"
