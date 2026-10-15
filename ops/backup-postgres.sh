#!/bin/sh
set -eu

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump \
  -U september_fit \
  -d september_fit \
  -Fc \
  > "$BACKUP_DIR/september_fit_${TIMESTAMP}.dump"

echo "Backup created: $BACKUP_DIR/september_fit_${TIMESTAMP}.dump"
