#!/bin/sh
set -eu

COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

$COMPOSE run --rm api \
  ./node_modules/.bin/prisma db push \
  --schema apps/api/prisma/schema.prisma

$COMPOSE run --rm api \
  ./node_modules/.bin/tsx apps/api/prisma/seed.ts

echo "Database schema synchronized and seed completed."
echo "SEED_DEMO_DATA controls whether demo/pilot merchant data is created."
echo "Create and commit Prisma migrations before subsequent production releases."
