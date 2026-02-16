-- Add region tracking to scrape_runs so the expansion dashboard can
-- filter runs by state and show per-region success/failure.

ALTER TABLE scrape_runs
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'southern-nv';

-- Index for fast region-scoped queries (expansion dashboard).
CREATE INDEX IF NOT EXISTS idx_scrape_runs_region
  ON scrape_runs (region, started_at DESC);
