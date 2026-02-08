-- 016_cleanup_junk_deals.sql
-- Remove junk/promotional entries from the products table.
-- These are scraped artifacts: $0 deals, promotional banners captured as products,
-- category headers, and names shorter than 5 characters.

-- 1. Delete products with $0 or null price
DELETE FROM products WHERE sale_price IS NULL OR sale_price <= 0;

-- 2. Delete products where name looks like promotional copy (not a real product)
DELETE FROM products WHERE
  name ~* '^\d+%\s*off'
  OR name ~* '^buy\s+\d+\s+get'
  OR name ~* '^bogo'
  OR name ~* '^\s*sale\b'
  OR name ~* '\|\s*\d+%\s*off';

-- 3. Delete products with names shorter than 5 characters (category labels, artifacts)
DELETE FROM products WHERE LENGTH(TRIM(name)) < 5;

-- 4. Delete products where name contains 2+ percentage signs (promo descriptions)
DELETE FROM products WHERE (LENGTH(name) - LENGTH(REPLACE(name, '%', ''))) >= 2;
