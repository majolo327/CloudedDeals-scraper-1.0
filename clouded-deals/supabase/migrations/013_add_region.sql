-- Add geographic region to dispensaries for multi-market support.
-- All existing rows default to 'southern-nv' (Las Vegas metro).

ALTER TABLE dispensaries
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'southern-nv';

-- Index for fast region-scoped queries on active dispensaries.
CREATE INDEX IF NOT EXISTS idx_dispensaries_region
  ON dispensaries (region) WHERE is_active = TRUE;
