-- Add platform_group to scrape_runs so the idempotency check
-- can scope per group ("stable" run doesn't block a "new" run).
ALTER TABLE scrape_runs
  ADD COLUMN IF NOT EXISTS platform_group TEXT NOT NULL DEFAULT 'all';

-- Back-fill existing rows (best effort — we can't know what group
-- they actually were, so leave them as 'all').
CREATE INDEX IF NOT EXISTS idx_scrape_runs_group
  ON scrape_runs (platform_group, started_at DESC);
