#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup.dump>"
  exit 1
fi

BACKUP="$1"
test -f "$BACKUP"

cat "$BACKUP" | \
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore \
  -U september_fit \
  -d september_fit \
  --clean \
  --if-exists

echo "Restore complete."
