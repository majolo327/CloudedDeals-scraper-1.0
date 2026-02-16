-- =========================================================================
-- 027_upsert_deal_observation.sql — Atomic deal history upsert via RPC
-- =========================================================================
--
-- Replaces the PostgREST upsert (which overwrites times_seen to 1) with
-- a Postgres function that atomically increments times_seen on conflict.
--
-- Called from main.py via:  db.rpc('upsert_deal_observations', { observations: [...] })
--
-- Safe to run multiple times: uses CREATE OR REPLACE.
-- =========================================================================

CREATE OR REPLACE FUNCTION upsert_deal_observations(observations JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    obs JSONB;
BEGIN
    FOR obs IN SELECT * FROM jsonb_array_elements(observations)
    LOOP
        INSERT INTO deal_history (
            product_id,
            dispensary_id,
            deal_score,
            sale_price,
            original_price,
            discount_percent,
            name,
            brand,
            category,
            last_seen_at,
            last_seen_date,
            is_active,
            times_seen
        ) VALUES (
            (obs->>'product_id')::UUID,
            obs->>'dispensary_id',
            COALESCE((obs->>'deal_score')::INTEGER, 0),
            (obs->>'sale_price')::NUMERIC,
            (obs->>'original_price')::NUMERIC,
            (obs->>'discount_percent')::NUMERIC,
            obs->>'name',
            obs->>'brand',
            obs->>'category',
            COALESCE((obs->>'last_seen_at')::TIMESTAMPTZ, NOW()),
            COALESCE((obs->>'last_seen_date')::DATE, CURRENT_DATE),
            TRUE,
            1
        )
        ON CONFLICT (product_id, dispensary_id) DO UPDATE SET
            deal_score       = COALESCE((obs->>'deal_score')::INTEGER, 0),
            sale_price       = (obs->>'sale_price')::NUMERIC,
            original_price   = (obs->>'original_price')::NUMERIC,
            discount_percent = (obs->>'discount_percent')::NUMERIC,
            name             = obs->>'name',
            brand            = obs->>'brand',
            category         = obs->>'category',
            last_seen_at     = COALESCE((obs->>'last_seen_at')::TIMESTAMPTZ, NOW()),
            last_seen_date   = COALESCE((obs->>'last_seen_date')::DATE, CURRENT_DATE),
            is_active        = TRUE,
            times_seen       = deal_history.times_seen + 1;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION upsert_deal_observations(JSONB) IS
    'Atomically upsert deal observations — increments times_seen on re-observation instead of resetting to 1.';
