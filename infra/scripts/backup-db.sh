#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/db"
BACKUP_FILE="$BACKUP_DIR/webmentor_agent_os_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "==> Backing up database to $BACKUP_FILE"

docker compose -f infra/compose/docker-compose.dev.yml exec -T postgres \
  pg_dump -U wm_user -d webmentor_agent_os > "$BACKUP_FILE"

echo "==> Backup complete: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
