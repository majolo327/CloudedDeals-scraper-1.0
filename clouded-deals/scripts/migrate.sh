#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# CloudedDeals Migration Runner
# ---------------------------------------------------------------------------
# Runs all SQL migration files in order against your Supabase project.
#
# Usage:
#   ./scripts/migrate.sh                        # Uses SUPABASE_DB_URL env var
#   ./scripts/migrate.sh "postgresql://..."      # Pass connection string directly
#
# Prerequisites:
#   - psql (PostgreSQL client) must be installed
#   - OR set SUPABASE_PROJECT_REF + SUPABASE_SERVICE_KEY to use the REST API
#
# The script tracks applied migrations in the `migration_log` table to avoid
# re-running files that have already been applied.
# ---------------------------------------------------------------------------

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"
DB_URL="${1:-${SUPABASE_DB_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: No database URL provided."
  echo ""
  echo "Set SUPABASE_DB_URL or pass it as an argument:"
  echo "  export SUPABASE_DB_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'"
  echo "  ./scripts/migrate.sh"
  echo ""
  echo "Find your connection string at:"
  echo "  https://supabase.com/dashboard → Project → Settings → Database → Connection string (URI)"
  exit 1
fi

echo "=== CloudedDeals Migration Runner ==="
echo "Migrations dir: $MIGRATIONS_DIR"
echo ""

# Ensure migration_log table exists
psql "$DB_URL" -q -c "
CREATE TABLE IF NOT EXISTS public.migration_log (
  id            serial primary key,
  migration_id  text not null unique,
  applied_at    timestamptz not null default now(),
  checksum      text
);
" 2>/dev/null || true

# Get list of already-applied migrations
APPLIED=$(psql "$DB_URL" -t -A -c "SELECT migration_id FROM public.migration_log ORDER BY id;" 2>/dev/null || echo "")

# Run each migration in order
for file in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$file" .sql)

  if echo "$APPLIED" | grep -qx "$filename"; then
    echo "  [skip] $filename (already applied)"
    continue
  fi

  echo "  [run]  $filename ..."
  if psql "$DB_URL" -q -f "$file" 2>&1; then
    # Record successful migration
    psql "$DB_URL" -q -c "
      INSERT INTO public.migration_log (migration_id, checksum)
      VALUES ('$filename', md5(pg_read_file('/dev/null')))
      ON CONFLICT (migration_id) DO NOTHING;
    " 2>/dev/null || true
    echo "         ✓ applied"
  else
    echo "         ✗ FAILED — stopping"
    exit 1
  fi
done

echo ""
echo "=== All migrations up to date ==="
