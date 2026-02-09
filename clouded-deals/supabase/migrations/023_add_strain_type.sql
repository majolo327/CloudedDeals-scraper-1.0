-- =========================================================================
-- 022_add_strain_type.sql — Add strain_type to products
-- =========================================================================
--
-- The scraper already detects strain type (Indica / Sativa / Hybrid) from
-- product names but had no column to persist it.  This adds the column so
-- the frontend can display it on deal cards.
--
-- Safe to run multiple times: uses IF NOT EXISTS.
-- =========================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'strain_type'
    ) THEN
        ALTER TABLE products ADD COLUMN strain_type TEXT;
    END IF;
END $$;

COMMENT ON COLUMN products.strain_type IS 'Indica, Sativa, or Hybrid — extracted from product name by the scraper.';
