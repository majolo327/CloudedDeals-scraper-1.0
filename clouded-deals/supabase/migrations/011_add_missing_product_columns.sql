-- =========================================================================
-- 011_add_missing_product_columns.sql
-- =========================================================================
--
-- Adds columns and fixes constraints that the scraper code expects but
-- that were not present in the original 001_initial_schema.sql migration.
--
-- Missing from products:
--   is_active    — used by _deactivate_old_deals() to mark stale products
--   deal_score   — PRD schema; allows frontend to sort without joining deals
--   product_url  — PRD schema; direct link to product on dispensary site
--
-- Missing from scrape_runs:
--   runtime_seconds — written by _complete_run()
--   status check    — needs 'completed_with_errors' as a valid value
--
-- Safe to run multiple times: uses IF NOT EXISTS / OR REPLACE where possible
-- and checks for column existence before ALTER.
-- =========================================================================

-- -----------------------------------------------------------------
-- 1. products.is_active
-- -----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;

-- Partial index: the frontend and deactivation query both filter on
-- is_active = true, so a partial index keeps it lean.
CREATE INDEX IF NOT EXISTS idx_products_active
    ON products (is_active)
    WHERE is_active = TRUE;

-- -----------------------------------------------------------------
-- 2. products.deal_score
-- -----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'deal_score'
    ) THEN
        ALTER TABLE products ADD COLUMN deal_score INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_score
    ON products (deal_score DESC);

-- -----------------------------------------------------------------
-- 3. products.product_url
-- -----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'product_url'
    ) THEN
        ALTER TABLE products ADD COLUMN product_url TEXT;
    END IF;
END $$;

-- -----------------------------------------------------------------
-- 4. scrape_runs.runtime_seconds
-- -----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scrape_runs' AND column_name = 'runtime_seconds'
    ) THEN
        ALTER TABLE scrape_runs ADD COLUMN runtime_seconds INTEGER;
    END IF;
END $$;

-- -----------------------------------------------------------------
-- 5. Update scrape_runs.status CHECK constraint
--    Original only allowed: running | completed | failed
--    Scraper now also writes: completed_with_errors
-- -----------------------------------------------------------------
-- Drop the old check if it exists (constraint name may vary; use a
-- safe DO block that catches the "does not exist" error).
DO $$
BEGIN
    -- The initial schema used an inline CHECK, which Postgres names
    -- automatically as "scrape_runs_status_check".  Drop it so we can
    -- recreate with the expanded value list.
    ALTER TABLE scrape_runs DROP CONSTRAINT IF EXISTS scrape_runs_status_check;
EXCEPTION
    WHEN undefined_object THEN NULL;  -- constraint doesn't exist, that's fine
END $$;

ALTER TABLE scrape_runs
    ADD CONSTRAINT scrape_runs_status_check
    CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed'));

-- -----------------------------------------------------------------
-- 6. Comments
-- -----------------------------------------------------------------
COMMENT ON COLUMN products.is_active    IS 'FALSE after daily deactivation; only today''s scrape results are TRUE.';
COMMENT ON COLUMN products.deal_score   IS 'Composite deal score 0–100 from deal_detector (denormalized for fast sorts).';
COMMENT ON COLUMN products.product_url  IS 'Direct link to the product page on the dispensary website.';
COMMENT ON COLUMN scrape_runs.runtime_seconds IS 'Wall-clock seconds the scrape run took.';
