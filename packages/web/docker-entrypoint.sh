#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ] && [ "$SKIP_DB_MIGRATE" != "1" ]; then
  echo "Running database migrations…"
  SKIP_DB_PUSH="${SKIP_DB_PUSH:-1}"
  export SKIP_DB_PUSH
  node --experimental-strip-types scripts/migrate.ts
else
  echo "Skipping database migrations (DATABASE_URL unset or SKIP_DB_MIGRATE=1)."
fi

exec "$@"
