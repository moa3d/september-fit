#!/bin/sh
set -eu

if [ -f /run/secrets/postgres_password ]; then
  DB_PASSWORD="$(cat /run/secrets/postgres_password)"
  ENCODED_PASSWORD="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DB_PASSWORD")"
  export DATABASE_URL="postgresql://${DATABASE_USER:-september_fit}:${ENCODED_PASSWORD}@${DATABASE_HOST:-postgres}:${DATABASE_PORT:-5432}/${DATABASE_NAME:-september_fit}?schema=public"
fi

exec "$@"
