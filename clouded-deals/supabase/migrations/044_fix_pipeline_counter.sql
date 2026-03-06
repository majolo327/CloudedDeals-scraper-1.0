-- Migration 044: Fix pipeline counter to use unique products instead of deal-scored only
--
-- The "Path to 1,000,000" pipeline counter was using:
--   COUNT(*) FROM products WHERE deal_score > 0  (~12k)
-- This only counted products that passed hard deal filters (15%+ discount, price caps, etc.)
--
-- Fix: Use total unique products count (~295k) which represents all unique products
-- cataloged across all states. The products table is already deduplicated by the
-- scraper's upsert logic (keyed on dispensary + product name), so this count
-- represents genuinely unique product observations.
--
-- The pipeline tracks "how many unique products have we cataloged" on the path to 1M.

CREATE OR REPLACE FUNCTION get_dashboard_pipeline()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_total_deals_active BIGINT;
  v_total_products BIGINT;
  v_states_live BIGINT;
  v_scraper_success NUMERIC;
  v_last_run_at TIMESTAMPTZ;
  v_coverage JSON;
  v_total_shares BIGINT;
BEGIN
  -- Active deals
  SELECT COALESCE(COUNT(*), 0) INTO v_total_deals_active
  FROM products WHERE is_active = true AND deal_score > 0;

  -- Total unique products (this IS the pipeline counter now)
  SELECT COALESCE(COUNT(*), 0) INTO v_total_products FROM products;

  -- States live
  SELECT COALESCE(COUNT(DISTINCT
    CASE WHEN region ~ '^(.+)-\d+$' THEN regexp_replace(region, '-\d+$', '')
         ELSE region END
  ), 0) INTO v_states_live
  FROM scrape_runs WHERE started_at >= NOW() - INTERVAL '7 days';

  -- Last run
  SELECT MAX(started_at) INTO v_last_run_at FROM scrape_runs;

  -- Scraper success rate (last 15 runs)
  WITH recent AS (
    SELECT sites_scraped, sites_failed
    FROM scrape_runs
    WHERE status IN ('completed', 'completed_with_errors')
    ORDER BY started_at DESC LIMIT 15
  )
  SELECT ROUND(AVG(
    CASE WHEN (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) > 0
    THEN COALESCE(jsonb_array_length(sites_scraped), 0)::numeric
      / (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) * 100
    ELSE 100 END
  ), 0) INTO v_scraper_success FROM recent;

  -- Coverage by state
  WITH region_runs AS (
    SELECT
      CASE WHEN region ~ '^(.+)-\d+$' THEN regexp_replace(region, '-\d+$', '')
           ELSE region END AS base_region,
      sites_scraped, sites_failed, total_products, started_at
    FROM scrape_runs WHERE started_at >= NOW() - INTERVAL '7 days'
  ),
  by_region AS (
    SELECT
      base_region,
      SUM(COALESCE(jsonb_array_length(sites_scraped), 0)) AS sites_ok,
      SUM(total_products) AS products,
      ROUND(AVG(
        CASE WHEN (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) > 0
        THEN COALESCE(jsonb_array_length(sites_scraped), 0)::numeric
          / (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) * 100
        ELSE 100 END
      ), 0) AS success_rate_7d,
      MAX(started_at) AS last_run
    FROM region_runs GROUP BY base_region
  )
  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.base_region), '[]'::json)
  INTO v_coverage FROM by_region r;

  -- Total shares
  SELECT COALESCE(COUNT(*), 0) INTO v_total_shares
  FROM analytics_events
  WHERE event_name IN ('deal_shared', 'share_saves');

  RETURN json_build_object(
    'pipeline', json_build_object(
      'total_deals_active', v_total_deals_active,
      'total_products', v_total_products,
      'deals_pipeline_total', v_total_products,
      'states_live', v_states_live,
      'scraper_success', COALESCE(v_scraper_success, 0),
      'last_run_at', v_last_run_at
    ),
    'viral', json_build_object('total_shares', v_total_shares),
    'coverage', v_coverage,
    'calculated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_pipeline TO anon, authenticated;
