-- =========================================================================
-- 012_fix_unique_constraint.sql
-- =========================================================================
--
-- Fixes the products table unique constraint.
--
-- PROBLEM: The original constraint (dispensary_id, name, sale_price, scraped_at)
-- includes scraped_at which defaults to NOW(). Since every insert gets a unique
-- timestamp, the upsert can never match an existing row — causing duplicate
-- product rows on every scraper run.
--
-- FIX: Replace with (dispensary_id, name, weight_value, sale_price) so the
-- same product at the same weight and price from the same dispensary is
-- correctly deduplicated across runs.
--
-- Safe to run multiple times.
-- =========================================================================

-- 1. Drop the old constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS uq_product_per_day;

-- 2. Create the corrected constraint
-- NULLs are treated as distinct by default in PostgreSQL unique constraints,
-- so we use COALESCE to normalize NULLs for weight_value and sale_price.
-- However, a simpler approach: just create the unique index with NULLS NOT DISTINCT
-- (requires PostgreSQL 15+). If on older PG, use a unique index instead.
DO $$
BEGIN
    -- Try PG15+ NULLS NOT DISTINCT syntax first
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_product_dedup'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT uq_product_dedup
            UNIQUE NULLS NOT DISTINCT (dispensary_id, name, weight_value, sale_price);
    END IF;
EXCEPTION
    WHEN syntax_error THEN
        -- Fallback for PG < 15: use a unique index with COALESCE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_product_dedup
            ON products (dispensary_id, name, COALESCE(weight_value, -1), COALESCE(sale_price, -1));
END $$;
