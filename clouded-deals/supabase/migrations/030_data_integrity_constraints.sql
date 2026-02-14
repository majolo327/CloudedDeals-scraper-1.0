-- Migration 030: Add data integrity constraints for beta launch
--
-- Adds CHECK constraints on enum-like text fields and numeric ranges
-- to prevent garbage data from entering the database.
--
-- All constraints use DROP IF EXISTS + ADD for idempotent re-runs.

-- =====================================================================
-- 1. products table — category, scoring, pricing, percentages
-- =====================================================================

-- Category must be one of the 6 valid values (or NULL for unclassified)
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_category;
ALTER TABLE products
  ADD CONSTRAINT chk_products_category
  CHECK (category IS NULL OR category IN ('flower', 'preroll', 'vape', 'edible', 'concentrate', 'other'));

-- deal_score must be 0–100
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_deal_score;
ALTER TABLE products
  ADD CONSTRAINT chk_products_deal_score
  CHECK (deal_score >= 0 AND deal_score <= 100);

-- sale_price must be positive when present
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_sale_price;
ALTER TABLE products
  ADD CONSTRAINT chk_products_sale_price
  CHECK (sale_price IS NULL OR sale_price > 0);

-- original_price must be positive when present
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_original_price;
ALTER TABLE products
  ADD CONSTRAINT chk_products_original_price
  CHECK (original_price IS NULL OR original_price > 0);

-- discount_percent must be 0–100 when present
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_discount_percent;
ALTER TABLE products
  ADD CONSTRAINT chk_products_discount_percent
  CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

-- THC/CBD percentages must be 0–100 when present
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_thc_percent;
ALTER TABLE products
  ADD CONSTRAINT chk_products_thc_percent
  CHECK (thc_percent IS NULL OR (thc_percent >= 0 AND thc_percent <= 100));

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_cbd_percent;
ALTER TABLE products
  ADD CONSTRAINT chk_products_cbd_percent
  CHECK (cbd_percent IS NULL OR (cbd_percent >= 0 AND cbd_percent <= 100));

-- weight_unit must be a valid unit when present
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_weight_unit;
ALTER TABLE products
  ADD CONSTRAINT chk_products_weight_unit
  CHECK (weight_unit IS NULL OR weight_unit IN ('g', 'mg', 'oz'));

-- product_subtype enum
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_subtype;
ALTER TABLE products
  ADD CONSTRAINT chk_products_subtype
  CHECK (product_subtype IS NULL OR product_subtype IN (
    'infused_preroll', 'preroll_pack', 'disposable', 'cartridge', 'pod'
  ));

-- strain_type enum
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_strain_type;
ALTER TABLE products
  ADD CONSTRAINT chk_products_strain_type
  CHECK (strain_type IS NULL OR strain_type IN ('Indica', 'Sativa', 'Hybrid'));

-- Product name must be at least 3 characters
-- NOT VALID: skip validation of existing rows — enforced on future inserts/updates only
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_name_length;
ALTER TABLE products
  ADD CONSTRAINT chk_products_name_length
  CHECK (LENGTH(TRIM(name)) >= 3) NOT VALID;

-- =====================================================================
-- 2. dispensaries table — platform and region enums
-- =====================================================================

ALTER TABLE dispensaries DROP CONSTRAINT IF EXISTS chk_dispensaries_platform;
ALTER TABLE dispensaries
  ADD CONSTRAINT chk_dispensaries_platform
  CHECK (platform IN ('dutchie', 'curaleaf', 'jane', 'carrot', 'aiq', 'rise', 'pending'));

ALTER TABLE dispensaries DROP CONSTRAINT IF EXISTS chk_dispensaries_region;
ALTER TABLE dispensaries
  ADD CONSTRAINT chk_dispensaries_region
  CHECK (region IN ('southern-nv', 'northern-nv'));

-- =====================================================================
-- 3. scrape_runs table — status and platform_group enums
-- =====================================================================

ALTER TABLE scrape_runs DROP CONSTRAINT IF EXISTS chk_scrape_runs_status;
ALTER TABLE scrape_runs
  ADD CONSTRAINT chk_scrape_runs_status
  CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed'));

ALTER TABLE scrape_runs DROP CONSTRAINT IF EXISTS chk_scrape_runs_platform_group;
ALTER TABLE scrape_runs
  ADD CONSTRAINT chk_scrape_runs_platform_group
  CHECK (platform_group IN ('all', 'stable', 'new', 'test'));

-- =====================================================================
-- 4. deal_reports table — report_type enum
-- =====================================================================

ALTER TABLE deal_reports DROP CONSTRAINT IF EXISTS chk_deal_reports_type;
ALTER TABLE deal_reports
  ADD CONSTRAINT chk_deal_reports_type
  CHECK (report_type IN ('wrong_price', 'deal_gone', 'wrong_product', 'other'));
