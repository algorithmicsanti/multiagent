#!/usr/bin/env bash
set -euo pipefail

echo "==> Restarting worker services..."
docker compose -f infra/compose/docker-compose.dev.yml restart worker-research

echo "==> Worker restart complete"
docker compose -f infra/compose/docker-compose.dev.yml ps worker-research
