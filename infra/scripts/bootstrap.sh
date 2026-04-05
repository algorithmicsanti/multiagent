#!/usr/bin/env bash
set -euo pipefail

echo "==> Bootstrapping Web Mentor Agent OS"

# Copy .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example — please fill in secrets"
fi

# Start postgres and redis only
docker compose -f infra/compose/docker-compose.dev.yml up -d postgres redis

echo "==> Waiting for postgres..."
until docker compose -f infra/compose/docker-compose.dev.yml exec postgres pg_isready -U wm_user -d webmentor_agent_os &>/dev/null; do
  sleep 1
done

echo "==> Running migrations (deploy mode)..."
pnpm db:deploy

echo "==> Done! Run 'pnpm infra:up' to start all services."
