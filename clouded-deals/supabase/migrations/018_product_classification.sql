-- Add product classification columns for infused pre-rolls and pre-roll packs.
-- These products are searchable everywhere but excluded from the Top 100 feed.

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_infused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_subtype TEXT;

-- Index for efficient Top 100 filtering
CREATE INDEX IF NOT EXISTS idx_products_subtype ON products (product_subtype) WHERE product_subtype IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_infused ON products (is_infused) WHERE is_infused = TRUE;

COMMENT ON COLUMN products.is_infused IS 'True for infused pre-rolls (Rove Ice, Jeeter Infused, caviar joints, etc.)';
COMMENT ON COLUMN products.product_subtype IS 'Product subtype: infused_preroll, preroll_pack, or NULL for regular products';
