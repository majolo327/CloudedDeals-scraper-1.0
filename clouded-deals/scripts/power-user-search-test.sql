-- =============================================================================
-- POWER USER SEARCH STRESS TEST — Corrected SQL for Actual Schema
-- =============================================================================
-- Generated: 2026-02-09
-- Purpose: Test 12 real-world searches against the CloudedDeals database
--
-- SCHEMA NOTES: The original test queries referenced a flat "deals" table
-- with columns like "price", "dispensary_name", "strain", "quantity".
-- The actual schema uses:
--   - `products` table for product data (name, brand, category, sale_price, etc.)
--   - `dispensaries` table for store data (name, address, latitude, longitude)
--   - `deals` table only for posting/scoring metadata (product_id, deal_score)
--   - Products link to dispensaries via `dispensary_id` (FK → dispensaries.id)
--   - No `strain` field exists
--   - No `quantity` field — use `weight_value` + `weight_unit`
--   - No `discount_label` — use `discount_percent`
--   - `is_active = true` filters to today's scrape (replaces scraped_at::date)
-- =============================================================================


-- =============================
-- PRE-FLIGHT: Verify Data
-- =============================

-- Total active products (equivalent to "today's scrape")
SELECT COUNT(*) AS total_active_products
FROM products
WHERE is_active = true;

-- Products with deals (deal_score > 0 = curated)
SELECT COUNT(*) AS curated_deal_count
FROM products
WHERE is_active = true AND deal_score > 0;

-- Dispensary count
SELECT COUNT(*) AS active_dispensaries
FROM dispensaries
WHERE is_active = true;


-- =============================
-- TEST 1: Brand Search — "Matrix Rippers"
-- =============================
-- User types: "matrix rippers" or "matrix"
-- Expected: Matrix brand vape/concentrate carts — no false positives

SELECT
  p.name AS product_name,
  p.brand,
  p.category,
  p.sale_price,
  p.original_price,
  p.discount_percent,
  d.name AS dispensary_name
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND (
    p.name ~* '\mmatrix\M'
    OR p.brand ~* '\mmatrix\M'
  )
  AND p.category IN ('vape', 'concentrate')
ORDER BY p.sale_price ASC
LIMIT 20;


-- =============================
-- TEST 2: Brand Search — "Airo Pods" / "AiroPods"
-- =============================
-- User types: "airo" or "airopod"
-- Expected: AiroPro/Airo brand vape pods

SELECT
  p.name AS product_name,
  p.brand,
  p.category,
  p.sale_price,
  d.name AS dispensary_name
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND (
    p.name ~* '\mairo'
    OR p.brand ~* '\mairo'
  )
  AND p.category = 'vape'
ORDER BY p.sale_price ASC
LIMIT 20;


-- =============================
-- TEST 3: Premium Brand — "Stiiizy"
-- =============================

-- A) Raw search (handles misspellings: stiizy, stiiizy, stiiiizy)
SELECT
  p.name AS product_name,
  p.brand,
  p.category,
  p.sale_price,
  p.original_price,
  p.discount_percent,
  p.deal_score,
  d.name AS dispensary_name
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND (
    p.name ~* 'stii+zy'
    OR p.brand ~* 'stii+zy'
  )
ORDER BY p.sale_price ASC
LIMIT 30;

-- B) How many Stiiizy in top 200 curated deals?
SELECT COUNT(*) AS stiiizy_in_top_200
FROM (
  SELECT * FROM products
  WHERE is_active = true
  ORDER BY deal_score DESC
  LIMIT 200
) top_deals
WHERE brand ~* 'stii+zy';


-- =============================
-- TEST 4: Local Brand — "Local's Only" Wax
-- =============================
-- Note: This brand is NOT in the BRANDS list in clouded_logic.py.
-- It would need to be added for brand detection to work.

SELECT
  p.name AS product_name,
  p.brand,
  p.category,
  p.sale_price,
  d.name AS dispensary_name
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND (
    p.name ~* 'local''?s?\s+only'
    OR p.brand ~* 'local''?s?\s+only'
  )
  AND p.category = 'concentrate'
ORDER BY p.sale_price ASC
LIMIT 20;


-- =============================
-- TEST 5: Quantity Filter — "7g flower" or "14g deals"
-- =============================
-- Uses weight_value (NUMERIC) + weight_unit (TEXT) instead of quantity

SELECT
  p.name AS product_name,
  p.category,
  p.sale_price,
  p.weight_value,
  p.weight_unit,
  d.name AS dispensary_name,
  CASE
    WHEN p.weight_value > 0 THEN
      ROUND(p.sale_price / p.weight_value, 2)
    ELSE NULL
  END AS price_per_gram
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND p.category = 'flower'
  AND p.weight_unit = 'g'
  AND (
    p.weight_value = 7
    OR p.weight_value = 14
    OR p.name ~* '(7|quarter|1/4)\s*g'
    OR p.name ~* '(14|half|1/2)\s*(g|oz)'
  )
ORDER BY price_per_gram ASC NULLS LAST
LIMIT 20;


-- =============================
-- TEST 6: Distance Filter — Vapes within 5 miles of 89102
-- =============================

-- A) Check dispensary geo data coverage
SELECT
  d.name AS dispensary_name,
  d.address,
  d.latitude,
  d.longitude,
  COUNT(p.id) AS deal_count
FROM dispensaries d
LEFT JOIN products p ON p.dispensary_id = d.id AND p.is_active = true
WHERE d.is_active = true
GROUP BY d.name, d.address, d.latitude, d.longitude
ORDER BY deal_count DESC
LIMIT 15;

-- B) Vapes within 5 miles (if lat/long exists in dispensaries table)
WITH user_location AS (
  SELECT 36.1716 AS lat, -115.1391 AS lng  -- 89102 center
),
dispensary_distances AS (
  SELECT
    d.id,
    d.name,
    d.address,
    (
      3959 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(ul.lat)) *
          cos(radians(d.latitude)) *
          cos(radians(d.longitude) - radians(ul.lng)) +
          sin(radians(ul.lat)) *
          sin(radians(d.latitude))
        ))
      )
    ) AS distance_miles
  FROM dispensaries d
  CROSS JOIN user_location ul
  WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
)
SELECT
  p.name AS product_name,
  p.brand,
  p.sale_price,
  dd.name AS dispensary_name,
  ROUND(dd.distance_miles::numeric, 1) AS miles_away
FROM products p
JOIN dispensary_distances dd ON p.dispensary_id = dd.id
WHERE p.is_active = true
  AND p.category = 'vape'
  AND dd.distance_miles <= 5
ORDER BY p.sale_price ASC
LIMIT 20;


-- =============================
-- TEST 7: Specific Product — "City Trees Disposable"
-- =============================

SELECT
  p.name AS product_name,
  p.brand,
  p.sale_price,
  p.discount_percent,
  d.name AS dispensary_name
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND p.brand ~* '\mcity\s+trees\M'
  AND (
    p.category = 'vape'
    OR p.name ~* 'disposable'
  )
ORDER BY p.sale_price ASC
LIMIT 15;


-- =============================
-- TEST 8: Multi-Brand Search — "Sip AND Wyld edibles"
-- =============================
-- Note: "Sip" is NOT in the BRANDS list. Only "Wyld" would be detected.

SELECT
  p.name AS product_name,
  p.brand,
  p.category,
  p.sale_price,
  d.name AS dispensary_name,
  CASE
    WHEN p.brand ~* '\msip\M' THEN 'Sip'
    WHEN p.brand ~* '\mwyld\M' THEN 'Wyld'
    ELSE 'Other'
  END AS matched_brand
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND p.category = 'edible'
  AND (
    p.brand ~* '\msip\M'
    OR p.brand ~* '\mwyld\M'
    OR p.name ~* '\msip\M'
    OR p.name ~* '\mwyld\M'
  )
ORDER BY matched_brand, p.sale_price ASC
LIMIT 30;


-- =============================
-- TEST 9: Strain Search — "Tangie"
-- =============================
-- NOTE: No `strain` column exists in the schema.
-- Can only search in product name.

SELECT
  p.name AS product_name,
  p.brand,
  p.category,
  p.sale_price,
  d.name AS dispensary_name
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND p.name ~* '\mtangie\M'
  AND p.name !~* 'tangerine'
ORDER BY p.category, p.sale_price ASC
LIMIT 20;


-- =============================
-- TEST 10: Dispensary Search — "Rise Nellis"
-- =============================
-- NOTE: All Rise locations are listed-only (scraped: false).
-- They exist in frontend dispensaries.ts but are NOT in the scraper config.
-- This search will return 0 results.

SELECT
  d.name AS dispensary_name,
  d.address,
  p.category,
  COUNT(*) AS deal_count,
  MIN(p.sale_price) AS cheapest_deal,
  MAX(p.sale_price) AS most_expensive
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND d.name ~* '\mrise\M'
  AND d.address ~* 'nellis'
GROUP BY d.name, d.address, p.category
ORDER BY p.category;


-- =============================
-- TEST 11: Tourist Search — "The Strip" dispensary
-- =============================
-- Note: Using frontend zone='strip' data. In DB, check address for Las Vegas Blvd.

SELECT
  d.name AS dispensary_name,
  d.address,
  COUNT(*) AS deal_count,
  ROUND(AVG(p.sale_price)::numeric, 2) AS avg_price,
  MIN(p.sale_price) AS cheapest
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = true
  AND (
    d.address ~* 'las vegas blvd'
    OR d.address ~* '\mstrip\M'
    OR d.name ~* 'planet\s*13'
    -- These are known strip-area dispensaries from frontend data:
    OR d.id IN (
      'planet13', 'curaleaf-strip', 'oasis',
      'the-grove', 'thrive-strip', 'beyond-hello-twain',
      'cultivate-spring'
    )
  )
GROUP BY d.name, d.address
ORDER BY deal_count DESC;


-- =============================
-- TEST 12: Overall Data Quality
-- =============================

-- A) Category Distribution
SELECT
  category,
  COUNT(*) AS total_products,
  ROUND(AVG(sale_price)::numeric, 2) AS avg_price,
  MIN(sale_price) AS min_price,
  MAX(sale_price) AS max_price
FROM products
WHERE is_active = true
GROUP BY category
ORDER BY total_products DESC;

-- B) Brand Coverage (top 30 brands)
SELECT
  brand,
  COUNT(*) AS product_count
FROM products
WHERE is_active = true
  AND brand IS NOT NULL
  AND brand != ''
GROUP BY brand
ORDER BY product_count DESC
LIMIT 30;

-- C) Price Quality (deals under $20)
SELECT
  category,
  COUNT(*) AS deals_under_20,
  ROUND(AVG(sale_price)::numeric, 2) AS avg_price_under_20
FROM products
WHERE is_active = true
  AND sale_price < 20
GROUP BY category
ORDER BY deals_under_20 DESC;

-- D) Deals with brand detected (data quality metric)
SELECT
  COUNT(*) AS total_active,
  COUNT(CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 END) AS has_brand,
  ROUND(
    100.0 * COUNT(CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 END) / NULLIF(COUNT(*), 0),
    1
  ) AS brand_pct
FROM products
WHERE is_active = true;

-- E) Dispensary geo data coverage
SELECT
  COUNT(*) AS total_dispensaries,
  COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) AS has_coordinates,
  ROUND(
    100.0 * COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0),
    1
  ) AS geo_pct
FROM dispensaries
WHERE is_active = true;

-- F) Average deals per dispensary
SELECT
  ROUND(AVG(deal_count)::numeric, 1) AS avg_deals_per_dispensary
FROM (
  SELECT dispensary_id, COUNT(*) AS deal_count
  FROM products
  WHERE is_active = true
  GROUP BY dispensary_id
) sub;

-- G) Curated deal score distribution
SELECT
  CASE
    WHEN deal_score >= 85 THEN 'steal (85+)'
    WHEN deal_score >= 70 THEN 'fire (70-84)'
    WHEN deal_score >= 50 THEN 'solid (50-69)'
    WHEN deal_score > 0 THEN 'qualifying (1-49)'
    ELSE 'not_curated (0)'
  END AS tier,
  COUNT(*) AS count
FROM products
WHERE is_active = true
GROUP BY tier
ORDER BY tier;
