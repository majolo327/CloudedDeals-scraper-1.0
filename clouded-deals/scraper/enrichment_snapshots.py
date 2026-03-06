"""
Weekly data enrichment snapshots — price distributions + cross-state brand pricing.

Queries the existing products table to compute:
  1. Price distribution by (region, category, weight_tier) — percentiles 25/50/75
  2. Cross-state brand pricing by (brand, category, weight_tier) — per-region median

These snapshots build the foundation for:
  - State-aware deal scoring (price caps calibrated per market)
  - B2B brand insights ("STIIIZY pods cost $25 in MI vs $55 in NJ")
  - ML feature engineering (state-relative price percentiles)

Usage:
    # As standalone script (weekly cron)
    python enrichment_snapshots.py

    # From another module
    from enrichment_snapshots import compute_price_distributions, compute_brand_pricing
    dists = compute_price_distributions(db)
    brand_prices = compute_brand_pricing(db)

Environment:
    SUPABASE_URL, SUPABASE_SERVICE_KEY — required
    DRY_RUN=true — compute and log but don't write to DB
"""

from __future__ import annotations

import logging
import os
import statistics
from collections import defaultdict
from datetime import date
from typing import Any

from dotenv import load_dotenv

logger = logging.getLogger("enrichment")

# Weight tiers for grouping — maps raw weight_value (g) to standard tier
_WEIGHT_TIERS = {
    "flower": {
        (0.5, 2.0): "1g",
        (2.5, 4.5): "3.5g",
        (5.0, 10.0): "7g",
        (10.5, 16.0): "14g",
        (16.5, 32.0): "28g",
    },
    "vape": {
        (0.1, 0.4): "0.3g",
        (0.4, 0.6): "0.5g",
        (0.8, 1.2): "1g",
    },
    "concentrate": {
        (0.4, 0.6): "0.5g",
        (0.8, 1.2): "1g",
        (1.5, 2.5): "2g",
    },
    "edible": {
        (50, 120): "100mg",
        (150, 250): "200mg",
    },
    "preroll": {
        (0.5, 1.5): "1g",
    },
}


def _weight_tier(category: str, weight_value: float | None, weight_unit: str | None) -> str | None:
    """Map a raw weight value to its canonical tier for grouping."""
    if weight_value is None:
        return None

    # Edibles are in mg — convert if unit says so, or use raw value
    # (the scraper normalizes most edible weights to mg already)
    val = float(weight_value)
    tiers = _WEIGHT_TIERS.get(category)
    if not tiers:
        return None

    for (lo, hi), tier_name in tiers.items():
        if lo <= val <= hi:
            return tier_name
    return None


def compute_price_distributions(
    db: Any,
    *,
    regions: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Compute price percentiles by (region, category, weight_tier).

    Queries active products from the last 7 days, groups by region+category+weight,
    and returns p25/p50/p75 distributions.
    """
    # Fetch recent active products with prices
    query = (
        db.table("products")
        .select("dispensary_id, category, weight_value, weight_unit, sale_price, original_price")
        .eq("is_active", True)
        .gt("sale_price", 0)
    )
    result = query.execute()
    rows = result.data or []

    if not rows:
        logger.warning("No active products found for price distribution snapshot")
        return []

    # We need dispensary → region mapping
    disp_result = db.table("dispensaries").select("id, region").execute()
    disp_region = {d["id"]: d["region"] for d in (disp_result.data or [])}

    # Group prices by (region, category, weight_tier)
    buckets: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for row in rows:
        region = disp_region.get(row["dispensary_id"], "unknown")
        if regions and region not in regions:
            continue
        category = row.get("category") or "other"
        wt = _weight_tier(category, row.get("weight_value"), row.get("weight_unit"))
        if not wt:
            continue
        price = float(row["sale_price"])
        buckets[(region, category, wt)].append(price)

    # Compute percentiles
    snapshots = []
    for (region, category, weight_tier), prices in sorted(buckets.items()):
        if len(prices) < 5:
            continue  # not enough data for meaningful percentiles
        prices.sort()
        n = len(prices)
        snapshots.append({
            "snapshot_date": date.today().isoformat(),
            "snapshot_type": "price_distribution",
            "region": region,
            "category": category,
            "weight_tier": weight_tier,
            "brand": None,
            "sample_size": n,
            "p25": round(prices[n // 4], 2),
            "p50": round(statistics.median(prices), 2),
            "p75": round(prices[3 * n // 4], 2),
            "p_min": round(prices[0], 2),
            "p_max": round(prices[-1], 2),
        })

    logger.info(
        "Price distributions: %d buckets across %d regions",
        len(snapshots),
        len({s["region"] for s in snapshots}),
    )
    return snapshots


def compute_brand_pricing(
    db: Any,
    *,
    min_brand_products: int = 3,
) -> list[dict[str, Any]]:
    """Compute per-region median prices for recognized brands.

    Only includes brands with >= min_brand_products active products in a
    given region+category+weight_tier bucket. This filters out noise from
    brands with sparse data.
    """
    query = (
        db.table("products")
        .select("dispensary_id, brand, category, weight_value, weight_unit, sale_price")
        .eq("is_active", True)
        .gt("sale_price", 0)
        .not_.is_("brand", "null")
    )
    result = query.execute()
    rows = result.data or []

    if not rows:
        logger.warning("No branded products found for brand pricing snapshot")
        return []

    disp_result = db.table("dispensaries").select("id, region").execute()
    disp_region = {d["id"]: d["region"] for d in (disp_result.data or [])}

    # Group by (brand, region, category, weight_tier)
    buckets: dict[tuple[str, str, str, str], list[float]] = defaultdict(list)
    for row in rows:
        brand = row.get("brand")
        if not brand:
            continue
        region = disp_region.get(row["dispensary_id"], "unknown")
        category = row.get("category") or "other"
        wt = _weight_tier(category, row.get("weight_value"), row.get("weight_unit"))
        if not wt:
            continue
        buckets[(brand, region, category, wt)].append(float(row["sale_price"]))

    snapshots = []
    for (brand, region, category, weight_tier), prices in sorted(buckets.items()):
        if len(prices) < min_brand_products:
            continue
        prices.sort()
        snapshots.append({
            "snapshot_date": date.today().isoformat(),
            "snapshot_type": "brand_pricing",
            "region": region,
            "category": category,
            "weight_tier": weight_tier,
            "brand": brand,
            "sample_size": len(prices),
            "p25": round(prices[len(prices) // 4], 2),
            "p50": round(statistics.median(prices), 2),
            "p75": round(prices[3 * len(prices) // 4], 2),
            "p_min": round(prices[0], 2),
            "p_max": round(prices[-1], 2),
        })

    # Log cross-state brands (brands appearing in 2+ regions)
    brand_regions: dict[str, set[str]] = defaultdict(set)
    for s in snapshots:
        brand_regions[s["brand"]].add(s["region"])
    cross_state = {b: regions for b, regions in brand_regions.items() if len(regions) >= 2}
    if cross_state:
        logger.info(
            "Cross-state brands: %d brands in 2+ regions (e.g. %s in %s)",
            len(cross_state),
            next(iter(cross_state)),
            ", ".join(sorted(next(iter(cross_state.values())))),
        )

    logger.info(
        "Brand pricing: %d buckets, %d unique brands, %d cross-state brands",
        len(snapshots),
        len({s["brand"] for s in snapshots}),
        len(cross_state),
    )
    return snapshots


def compute_price_cap_recommendations(
    db: Any,
    *,
    min_sample_size: int = 20,
    cap_multiplier: float = 1.1,
) -> list[dict[str, Any]]:
    """Compute data-driven price caps from current price distributions.

    For each (region, category, weight_tier) bucket with enough data,
    sets recommended_cap = p30 * cap_multiplier.

    Logic: a "deal" should be cheaper than ~70% of products in that market.
    The p30 (30th percentile) represents that threshold; the multiplier
    adds a small buffer to avoid being too aggressive on edge cases.

    Buckets with < min_sample_size products fall back to hardcoded caps
    (this function records the hardcoded cap for comparison but marks
    the recommendation as based on actual data only when sample is large
    enough).
    """
    # Import hardcoded caps for comparison/fallback
    from deal_detector import CATEGORY_PRICE_CAPS, STATE_PRICE_CAP_OVERRIDES, _get_state_region

    # Fetch active products with prices
    query = (
        db.table("products")
        .select("dispensary_id, category, weight_value, weight_unit, sale_price")
        .eq("is_active", True)
        .gt("sale_price", 0)
    )
    result = query.execute()
    rows = result.data or []

    if not rows:
        logger.warning("No active products found for price cap recommendations")
        return []

    disp_result = db.table("dispensaries").select("id, region").execute()
    disp_region = {d["id"]: d["region"] for d in (disp_result.data or [])}

    # Group prices by (region, category, weight_tier)
    buckets: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for row in rows:
        region = disp_region.get(row["dispensary_id"], "unknown")
        category = row.get("category") or "other"
        wt = _weight_tier(category, row.get("weight_value"), row.get("weight_unit"))
        if not wt:
            continue
        buckets[(region, category, wt)].append(float(row["sale_price"]))

    recommendations = []
    for (region, category, weight_tier), prices in sorted(buckets.items()):
        prices.sort()
        n = len(prices)

        # Compute p30 (30th percentile)
        p30_idx = int(n * 0.30)
        p30 = round(prices[p30_idx], 2)
        recommended = round(p30 * cap_multiplier, 2)

        # Look up the hardcoded cap for comparison
        hardcoded_cap = _lookup_hardcoded_cap(category, weight_tier, region)

        cap_delta = None
        if hardcoded_cap and hardcoded_cap > 0:
            cap_delta = round((recommended - hardcoded_cap) / hardcoded_cap * 100, 1)

        recommendations.append({
            "region": region,
            "category": category,
            "weight_tier": weight_tier,
            "recommended_cap": recommended,
            "p25": round(prices[n // 4], 2),
            "p30": p30,
            "p50": round(prices[n // 2], 2) if n > 1 else p30,
            "p75": round(prices[3 * n // 4], 2),
            "sample_size": n,
            "hardcoded_cap": hardcoded_cap,
            "cap_delta_pct": cap_delta,
            "is_active": n >= min_sample_size,
        })

    active = sum(1 for r in recommendations if r["is_active"])
    logger.info(
        "Price cap recommendations: %d buckets (%d active with n>=%d, %d fallback)",
        len(recommendations), active, min_sample_size, len(recommendations) - active,
    )

    return recommendations


def _lookup_hardcoded_cap(
    category: str, weight_tier: str, region: str
) -> float | None:
    """Look up the hardcoded cap for a (category, weight_tier, region) combo."""
    from deal_detector import CATEGORY_PRICE_CAPS, STATE_PRICE_CAP_OVERRIDES, _get_state_region

    state = _get_state_region(region)

    # Check state overrides first
    caps = None
    if state and state in STATE_PRICE_CAP_OVERRIDES:
        overrides = STATE_PRICE_CAP_OVERRIDES[state]
        if category in overrides:
            caps = overrides[category]

    if caps is None:
        caps = CATEGORY_PRICE_CAPS.get(category)

    if caps is None:
        return None

    if isinstance(caps, dict):
        # weight_tier is like "3.5g" — strip the unit for lookup
        weight_key = weight_tier.rstrip("gm")
        return caps.get(weight_key)
    else:
        return float(caps)


def write_price_cap_recommendations(
    db: Any,
    recommendations: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> int:
    """Write price cap recommendations to the ml_price_caps table."""
    if not recommendations:
        return 0

    if dry_run:
        logger.info("[DRY RUN] Would write %d price cap recommendations:", len(recommendations))
        for r in recommendations[:10]:
            active = "ACTIVE" if r["is_active"] else "fallback"
            delta = f" (delta={r['cap_delta_pct']:+.1f}%)" if r["cap_delta_pct"] is not None else ""
            logger.info(
                "  %-15s %-12s %-5s  rec=$%.2f  hardcoded=$%s  n=%d  [%s]%s",
                r["region"], r["category"], r["weight_tier"],
                r["recommended_cap"], r.get("hardcoded_cap", "?"),
                r["sample_size"], active, delta,
            )
        return len(recommendations)

    try:
        db.table("ml_price_caps").upsert(
            recommendations,
            on_conflict="region,category,weight_tier",
        ).execute()
        logger.info("Wrote %d price cap recommendations", len(recommendations))
        return len(recommendations)
    except Exception as exc:
        logger.warning("Failed to write price cap recommendations: %s", exc)
        return 0


def write_snapshots(
    db: Any,
    snapshots: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> int:
    """Write enrichment snapshots to the enrichment_snapshots table.

    Returns the number of rows written.
    """
    if not snapshots:
        return 0

    if dry_run:
        logger.info("[DRY RUN] Would write %d enrichment snapshots", len(snapshots))
        return len(snapshots)

    try:
        db.table("enrichment_snapshots").upsert(
            snapshots,
            on_conflict="snapshot_date,snapshot_type,region,category,weight_tier,brand",
        ).execute()
        logger.info("Wrote %d enrichment snapshots", len(snapshots))
        return len(snapshots)
    except Exception as exc:
        logger.warning("Failed to write enrichment snapshots: %s", exc)
        return 0


def run_enrichment_snapshots(db: Any, *, dry_run: bool = False) -> dict[str, int]:
    """Run all enrichment snapshot computations and write to DB.

    Returns counts of snapshots computed.
    """
    price_dists = compute_price_distributions(db)
    brand_prices = compute_brand_pricing(db)

    all_snapshots = price_dists + brand_prices
    written = write_snapshots(db, all_snapshots, dry_run=dry_run)

    # Compute and write data-driven price cap recommendations
    cap_recs = compute_price_cap_recommendations(db)
    caps_written = write_price_cap_recommendations(db, cap_recs, dry_run=dry_run)

    return {
        "price_distributions": len(price_dists),
        "brand_pricing": len(brand_prices),
        "price_cap_recommendations": len(cap_recs),
        "total_written": written,
        "caps_written": caps_written,
    }


if __name__ == "__main__":
    load_dotenv()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    db = create_client(url, key)

    dry = os.getenv("DRY_RUN", "").lower() in ("true", "1", "yes")
    result = run_enrichment_snapshots(db, dry_run=dry)
    logger.info("Enrichment complete: %s", result)
