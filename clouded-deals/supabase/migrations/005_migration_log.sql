-- ============================================================================
-- Migration Log Table
-- ============================================================================
-- Tracks which migrations have been applied and when.
-- This migration is idempotent - safe to run multiple times.
-- ============================================================================

-- Create migration_log table if it doesn't exist
create table if not exists public.migration_log (
  id            serial primary key,
  migration_id  text not null unique,
  applied_at    timestamptz not null default now(),
  checksum      text
);

-- Add comment for documentation
comment on table public.migration_log is 'Tracks applied database migrations';

-- Insert a record for this migration (idempotent)
insert into public.migration_log (migration_id, checksum)
values ('005_migration_log', 'initial')
on conflict (migration_id) do nothing;

-- Verify the table exists
do $$
begin
  raise notice 'Migration 005_migration_log applied successfully';
end $$;
