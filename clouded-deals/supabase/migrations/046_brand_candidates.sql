-- Migration 046: Brand Candidates — Auto-discovered brands from scraper data
--
-- Every scrape run tracks "top_unmatched_brands" — product name prefixes that
-- didn't match any brand in the hardcoded BRANDS list. This table promotes
-- those observations into a learning pipeline:
--
-- 1. brand_learner.py reads daily_metrics.top_unmatched_brands
-- 2. Clusters similar names (fuzzy matching)
-- 3. Inserts high-confidence candidates with observation counts
-- 4. Admin reviews and approves/rejects via dashboard
-- 5. Approved brands get added to BRANDS list in clouded_logic.py
--
-- Status flow: pending → approved | rejected | merged (into existing brand as alias)

CREATE TABLE IF NOT EXISTS brand_candidates (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            TEXT NOT NULL,               -- candidate brand name as observed
    canonical_name  TEXT,                         -- cleaned/normalized form (NULL until reviewed)
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),

    -- Observation metrics (updated by brand_learner.py)
    observation_count   INTEGER NOT NULL DEFAULT 1,  -- total times seen across all runs
    dispensary_count    INTEGER NOT NULL DEFAULT 1,  -- unique dispensaries carrying it
    state_count         INTEGER NOT NULL DEFAULT 1,  -- unique states it appears in
    first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at        TIMESTAMPTZ DEFAULT NOW(),

    -- Context for review
    sample_products     JSONB,                   -- up to 5 example product names containing this brand
    regions_seen        TEXT[],                   -- e.g. ['michigan', 'illinois']
    categories_seen     TEXT[],                   -- e.g. ['flower', 'vape']

    -- Fuzzy match info
    closest_existing_brand  TEXT,                 -- nearest match in current BRANDS list
    similarity_score        NUMERIC(4,3),         -- 0.000-1.000 from SequenceMatcher

    -- Merge target (when status = 'merged')
    merged_into         TEXT,                     -- existing brand this was merged into as alias

    -- Review metadata
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT brand_candidates_name_unique UNIQUE (name)
);

-- Index for the brand_learner query: find pending candidates sorted by confidence
CREATE INDEX IF NOT EXISTS idx_brand_candidates_pending
    ON brand_candidates (status, observation_count DESC)
    WHERE status = 'pending';

-- Index for dispensary/state count (high-spread brands are more likely real)
CREATE INDEX IF NOT EXISTS idx_brand_candidates_spread
    ON brand_candidates (dispensary_count DESC, state_count DESC)
    WHERE status = 'pending';

-- RLS: public read (admin dashboard), service-role write
ALTER TABLE brand_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "brand_candidates_public_read"
    ON brand_candidates FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY IF NOT EXISTS "brand_candidates_service_write"
    ON brand_candidates FOR ALL TO service_role
    USING (true) WITH CHECK (true);

COMMENT ON TABLE brand_candidates IS
    'Auto-discovered brand names from scraper unmatched-brand logs. '
    'Pipeline: daily_metrics.top_unmatched_brands → brand_learner.py → '
    'brand_candidates → admin review → BRANDS list in clouded_logic.py';
