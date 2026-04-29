#!/bin/bash
# ──────────────────────────────────────────────────────────
# Apply app migrations and seed data.
#
# When run as one-shot container: connects to db:5432
# When run in DB initdb: connects via local socket
# ──────────────────────────────────────────────────────────
set -euo pipefail

MIGRATIONS_DIR="/app-migrations"
SEED_FILE="/app-seed/seed.sql"

# Determine connection method
if [ -n "${PGPASSWORD:-}" ]; then
  # Running as one-shot migration container
  PSQL_CMD="psql -h db -p 5432 -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-postgres}"
else
  # Running inside DB initdb
  PSQL_CMD="psql -v ON_ERROR_STOP=1 --username ${POSTGRES_USER:-postgres} --dbname ${POSTGRES_DB:-postgres}"
fi

echo "=== Applying app migrations ==="

for f in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$f" ]; then
    name=$(basename "$f" .sql)
    version=$(echo "$name" | grep -oE '^[0-9]+')
    migration_name=$(echo "$name" | sed 's/^[0-9]*_//')

    # Skip if already applied
    ALREADY=$($PSQL_CMD -tAc "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='$version'" 2>/dev/null || echo "")
    if [ "$ALREADY" = "1" ]; then
      echo "  Skip (already applied): $name"
      continue
    fi

    echo "  Applying: $name"
    $PSQL_CMD -v ON_ERROR_STOP=1 -f "$f"

    $PSQL_CMD -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$migration_name') ON CONFLICT (version) DO NOTHING;"
  fi
done

echo "=== Migrations complete ==="

# Apply seed data if present
if [ -f "$SEED_FILE" ]; then
  echo "=== Applying seed data ==="
  $PSQL_CMD -v ON_ERROR_STOP=1 -f "$SEED_FILE"
  echo "=== Seed data applied ==="
fi

echo "=== DB init finished ==="
