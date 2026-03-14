#!/usr/bin/env bash
set -euo pipefail

echo "==> Restarting API service..."
docker compose -f infra/compose/docker-compose.dev.yml restart api

echo "--- Waiting for API to be healthy ---"
sleep 3
curl -sf http://localhost:3001/api/v1/health | jq '.' 2>/dev/null || echo "API health check failed"

echo "==> API restart complete"
