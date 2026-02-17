-- =========================================================================
-- 032_trigram_search_index.sql — pg_trgm index for fuzzy product search
-- =========================================================================
--
-- Enables fast ILIKE / similarity() searches on product names and brands
-- without requiring exact matches.  Powers the frontend SearchPage.
--
-- pg_trgm is a built-in Postgres extension available on Supabase.
-- =========================================================================

-- Enable the extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on product name — covers ILIKE '%term%' queries
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

-- GIN trigram index on brand — covers brand search/autocomplete
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
    ON products USING gin (brand gin_trgm_ops);

COMMENT ON INDEX idx_products_name_trgm IS
    'Trigram index for fuzzy product name search (ILIKE, similarity)';
COMMENT ON INDEX idx_products_brand_trgm IS
    'Trigram index for fuzzy brand search (ILIKE, similarity)';
