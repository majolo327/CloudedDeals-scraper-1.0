-- =========================================================================
-- 015_dispensary_coords_and_top100_view.sql
-- =========================================================================
--
-- 1. Add latitude/longitude to dispensaries for distance calculations
-- 2. Create a top_100_curated view with diversity constraints
--
-- Safe to run multiple times.
-- =========================================================================

-- -----------------------------------------------------------------
-- 1. Dispensary coordinates
-- -----------------------------------------------------------------
ALTER TABLE dispensaries ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10, 7);
ALTER TABLE dispensaries ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

COMMENT ON COLUMN dispensaries.latitude  IS 'GPS latitude for distance calculations';
COMMENT ON COLUMN dispensaries.longitude IS 'GPS longitude for distance calculations';

-- Populate Las Vegas dispensary coordinates.
-- These are static locations that don't change.
UPDATE dispensaries SET latitude = 36.0984, longitude = -115.0428 WHERE id = 'td-gibson';
UPDATE dispensaries SET latitude = 36.1117, longitude = -115.1190 WHERE id = 'td-eastern';
UPDATE dispensaries SET latitude = 36.1705, longitude = -115.2095 WHERE id = 'td-decatur';
UPDATE dispensaries SET latitude = 36.1189, longitude = -115.1687 WHERE id = 'planet13';
UPDATE dispensaries SET latitude = 36.0966, longitude = -115.1728 WHERE id = 'medizin';
UPDATE dispensaries SET latitude = 36.1690, longitude = -115.1440 WHERE id = 'greenlight-downtown';
UPDATE dispensaries SET latitude = 36.1157, longitude = -115.1382 WHERE id = 'greenlight-paradise';
UPDATE dispensaries SET latitude = 36.1155, longitude = -115.1540 WHERE id = 'the-grove';
UPDATE dispensaries SET latitude = 36.1125, longitude = -115.1365 WHERE id = 'mint-paradise';
UPDATE dispensaries SET latitude = 36.1160, longitude = -115.2145 WHERE id = 'mint-rainbow';
UPDATE dispensaries SET latitude = 36.1460, longitude = -115.2140 WHERE id = 'curaleaf-western';
UPDATE dispensaries SET latitude = 36.2280, longitude = -115.1270 WHERE id = 'curaleaf-north-lv';
UPDATE dispensaries SET latitude = 36.1200, longitude = -115.1690 WHERE id = 'curaleaf-strip';
UPDATE dispensaries SET latitude = 36.1150, longitude = -115.1250 WHERE id = 'curaleaf-the-reef';
UPDATE dispensaries SET latitude = 36.1480, longitude = -115.1290 WHERE id = 'oasis';
UPDATE dispensaries SET latitude = 36.2165, longitude = -115.1460 WHERE id = 'deep-roots-cheyenne';
UPDATE dispensaries SET latitude = 36.2380, longitude = -115.1275 WHERE id = 'deep-roots-craig';
UPDATE dispensaries SET latitude = 36.0735, longitude = -115.2465 WHERE id = 'deep-roots-blue-diamond';
UPDATE dispensaries SET latitude = 36.1350, longitude = -115.1630 WHERE id = 'deep-roots-parkson';
UPDATE dispensaries SET latitude = 36.1265, longitude = -115.1755 WHERE id = 'cultivate-spring';
UPDATE dispensaries SET latitude = 36.1465, longitude = -115.2795 WHERE id = 'cultivate-durango';
UPDATE dispensaries SET latitude = 36.1445, longitude = -115.1650 WHERE id = 'thrive-sahara';
UPDATE dispensaries SET latitude = 36.2165, longitude = -115.1530 WHERE id = 'thrive-cheyenne';
UPDATE dispensaries SET latitude = 36.1195, longitude = -115.1690 WHERE id = 'thrive-strip';
UPDATE dispensaries SET latitude = 36.1695, longitude = -115.1435 WHERE id = 'thrive-main';
UPDATE dispensaries SET latitude = 36.1445, longitude = -115.1560 WHERE id = 'beyond-hello-sahara';
UPDATE dispensaries SET latitude = 36.1220, longitude = -115.1500 WHERE id = 'beyond-hello-twain';

-- -----------------------------------------------------------------
-- 2. Top 100 curated deals view
--
-- Uses window functions to enforce diversity caps:
--   - Max 30 deals per category
--   - Max 5 deals per brand
--   - Max 10 deals per dispensary
--
-- The scraper already enforces these constraints in Python via
-- deal_detector.py, so this view is mostly useful for direct
-- DB queries and potential future server-side rendering.
-- The frontend currently fetches from `products` with deal_score > 0
-- which gives the same result since the scraper only sets deal_score
-- on products that pass the curation pipeline.
-- -----------------------------------------------------------------
CREATE OR REPLACE VIEW top_100_curated AS
WITH ranked AS (
  SELECT
    p.*,
    d.name   AS dispensary_name,
    d.region AS dispensary_region,
    ROW_NUMBER() OVER (PARTITION BY p.category       ORDER BY p.deal_score DESC) AS cat_rank,
    ROW_NUMBER() OVER (PARTITION BY p.brand          ORDER BY p.deal_score DESC) AS brand_rank,
    ROW_NUMBER() OVER (PARTITION BY p.dispensary_id   ORDER BY p.deal_score DESC) AS disp_rank
  FROM products p
  JOIN dispensaries d ON d.id = p.dispensary_id
  WHERE p.is_active = TRUE
    AND p.deal_score > 0
    AND d.region = 'southern-nv'
)
SELECT *
FROM ranked
WHERE cat_rank   <= 30
  AND brand_rank <= 5
  AND disp_rank  <= 10
ORDER BY deal_score DESC
LIMIT 100;

COMMENT ON VIEW top_100_curated IS 'Daily top 100 curated deals with category/brand/dispensary diversity caps.';
