#!/usr/bin/env bash
set -euo pipefail

echo "==> Web Mentor Agent OS — Service Health Check"
echo "================================================"

# Docker compose services
echo ""
echo "--- Docker Compose Services ---"
docker compose -f infra/compose/docker-compose.dev.yml ps 2>/dev/null || echo "Docker Compose not running"

# API health
echo ""
echo "--- API Health ---"
curl -sf http://localhost:3001/api/v1/health | jq '.' 2>/dev/null || echo "API not reachable at :3001"

# Dashboard
echo ""
echo "--- Dashboard ---"
curl -sf -o /dev/null -w "HTTP %{http_code}" http://localhost:3000 && echo "" || echo "Dashboard not reachable at :3000"

# Redis
echo ""
echo "--- Redis ---"
redis-cli -u "${REDIS_URL:-redis://localhost:6379}" ping 2>/dev/null || echo "Redis not reachable"

# PostgreSQL
echo ""
echo "--- PostgreSQL ---"
if command -v pg_isready &>/dev/null; then
  pg_isready -h localhost -p 5432 -U wm_user 2>/dev/null || echo "PostgreSQL not reachable"
else
  echo "pg_isready not available — check via Docker"
  docker compose -f infra/compose/docker-compose.dev.yml exec postgres pg_isready -U wm_user -d webmentor_agent_os 2>/dev/null || echo "PostgreSQL not reachable"
fi

echo ""
echo "==> Health check complete"
