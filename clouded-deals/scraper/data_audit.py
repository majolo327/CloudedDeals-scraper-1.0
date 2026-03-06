"""
Data audit — systematic review of ~300K scraped product records.

Connects to Supabase and prints a human-readable report covering:
  1. Product volume by region, category, platform
  2. Brand detection rates by region
  3. Price cap rejection rates (from daily_metrics)
  4. Top unmatched brand names (candidates for auto-discovery)
  5. Suspicious data (sale > original, zero weight, extreme discounts)
  6. Category distribution gaps per region

Usage:
    python data_audit.py              # full audit
    python data_audit.py --region michigan  # single region
    python data_audit.py --summary    # summary only (no per-region breakdowns)

Environment:
    SUPABASE_URL, SUPABASE_SERVICE_KEY — required
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

from dotenv import load_dotenv

logger = logging.getLogger("data_audit")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pct(num: int, denom: int) -> str:
    """Format a percentage string, handling zero denominator."""
    if denom == 0:
        return "N/A"
    return f"{num / denom * 100:.1f}%"


def _bar(pct_val: float, width: int = 30) -> str:
    """Simple ASCII bar chart."""
    filled = int(pct_val / 100 * width)
    return "█" * filled + "░" * (width - filled)


# ---------------------------------------------------------------------------
# Audit queries
# ---------------------------------------------------------------------------

def audit_product_volumes(db: Any, region_filter: str | None = None) -> dict:
    """Count products by region, category, and platform."""
    query = (
        db.table("products")
        .select("dispensary_id, category, is_active", count="exact")
        .eq("is_active", True)
    )
    result = query.execute()
    rows = result.data or []

    # Get dispensary metadata
    disp_result = db.table("dispensaries").select("id, region, platform").execute()
    disp_meta = {d["id"]: d for d in (disp_result.data or [])}

    by_region: Counter = Counter()
    by_category: Counter = Counter()
    by_platform: Counter = Counter()
    by_region_category: dict[str, Counter] = defaultdict(Counter)

    for row in rows:
        meta = disp_meta.get(row["dispensary_id"], {})
        region = meta.get("region", "unknown")
        platform = meta.get("platform", "unknown")
        category = row.get("category") or "uncategorized"

        if region_filter and region_filter not in region:
            continue

        by_region[region] += 1
        by_category[category] += 1
        by_platform[platform] += 1
        by_region_category[region][category] += 1

    return {
        "total_active": len(rows),
        "by_region": by_region,
        "by_category": by_category,
        "by_platform": by_platform,
        "by_region_category": by_region_category,
    }


def audit_brand_detection(db: Any, region_filter: str | None = None) -> dict:
    """Measure brand detection rate by region."""
    query = (
        db.table("products")
        .select("dispensary_id, brand, category")
        .eq("is_active", True)
    )
    result = query.execute()
    rows = result.data or []

    disp_result = db.table("dispensaries").select("id, region").execute()
    disp_region = {d["id"]: d["region"] for d in (disp_result.data or [])}

    region_total: Counter = Counter()
    region_branded: Counter = Counter()
    region_null: Counter = Counter()
    category_branded: Counter = Counter()
    category_total: Counter = Counter()

    for row in rows:
        region = disp_region.get(row["dispensary_id"], "unknown")
        if region_filter and region_filter not in region:
            continue
        category = row.get("category") or "uncategorized"
        has_brand = bool(row.get("brand"))

        region_total[region] += 1
        category_total[category] += 1
        if has_brand:
            region_branded[region] += 1
            category_branded[category] += 1
        else:
            region_null[region] += 1

    rates = {}
    for region in sorted(region_total.keys()):
        rates[region] = {
            "total": region_total[region],
            "branded": region_branded[region],
            "null": region_null[region],
            "rate": region_branded[region] / max(1, region_total[region]),
        }

    category_rates = {}
    for cat in sorted(category_total.keys()):
        category_rates[cat] = {
            "total": category_total[cat],
            "branded": category_branded[cat],
            "rate": category_branded[cat] / max(1, category_total[cat]),
        }

    return {"by_region": rates, "by_category": category_rates}


def audit_unmatched_brands(db: Any, days: int = 30) -> list[tuple[str, int]]:
    """Get top unmatched brand names from daily_metrics."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    result = (
        db.table("daily_metrics")
        .select("top_unmatched_brands")
        .gte("run_date", cutoff)
        .not_.is_("top_unmatched_brands", "null")
        .execute()
    )
    rows = result.data or []

    freq: Counter = Counter()
    for row in rows:
        brands = row.get("top_unmatched_brands", [])
        if isinstance(brands, str):
            try:
                brands = json.loads(brands)
            except (json.JSONDecodeError, TypeError):
                continue
        for name in brands:
            if name and len(name) >= 3:
                freq[name] += 1

    return freq.most_common(50)


def audit_suspicious_data(db: Any, region_filter: str | None = None) -> dict:
    """Find products with suspicious pricing or missing data."""
    query = (
        db.table("products")
        .select("dispensary_id, name, brand, category, sale_price, original_price, "
                "discount_percent, weight_value")
        .eq("is_active", True)
    )
    result = query.execute()
    rows = result.data or []

    disp_result = db.table("dispensaries").select("id, region").execute()
    disp_region = {d["id"]: d["region"] for d in (disp_result.data or [])}

    issues = {
        "sale_gt_original": 0,
        "zero_weight": 0,
        "extreme_discount_high": 0,  # > 80%
        "extreme_discount_low": 0,   # < 5% with original_price set
        "missing_category": 0,
        "missing_name": 0,
        "very_low_price": 0,         # < $1
        "very_high_price": 0,        # > $200
    }
    examples: dict[str, list[str]] = defaultdict(list)

    for row in rows:
        region = disp_region.get(row["dispensary_id"], "unknown")
        if region_filter and region_filter not in region:
            continue

        sale = row.get("sale_price") or 0
        orig = row.get("original_price") or 0
        disc = row.get("discount_percent") or 0
        name = row.get("name") or ""

        if sale > 0 and orig > 0 and sale > orig:
            issues["sale_gt_original"] += 1
            if len(examples["sale_gt_original"]) < 3:
                examples["sale_gt_original"].append(
                    f"  {name[:40]} — sale=${sale} > orig=${orig}"
                )

        if row.get("weight_value") == 0:
            issues["zero_weight"] += 1

        if disc > 80:
            issues["extreme_discount_high"] += 1
            if len(examples["extreme_discount_high"]) < 3:
                examples["extreme_discount_high"].append(
                    f"  {name[:40]} — {disc}% off (${orig}→${sale})"
                )

        if orig > 0 and 0 < disc < 5:
            issues["extreme_discount_low"] += 1

        if not row.get("category"):
            issues["missing_category"] += 1

        if not name or len(name) < 3:
            issues["missing_name"] += 1

        if 0 < sale < 1:
            issues["very_low_price"] += 1

        if sale > 200:
            issues["very_high_price"] += 1

    return {"counts": issues, "examples": examples, "total_checked": len(rows)}


def audit_price_cap_metrics(db: Any, days: int = 14) -> list[dict]:
    """Get recent price cap rejection rates from daily_metrics."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    result = (
        db.table("daily_metrics")
        .select("run_date, region, price_cap_reject_count, price_cap_reject_rate, "
                "brand_detection_rate, total_products")
        .gte("run_date", cutoff)
        .order("run_date", desc=True)
        .execute()
    )
    return result.data or []


def audit_enrichment_status(db: Any) -> dict:
    """Check if enrichment snapshots and ML tables have data."""
    checks = {}

    # Enrichment snapshots
    try:
        result = db.table("enrichment_snapshots").select("snapshot_date", count="exact").limit(1).execute()
        checks["enrichment_snapshots"] = {"has_data": bool(result.data), "count": result.count}
    except Exception:
        checks["enrichment_snapshots"] = {"has_data": False, "error": "table may not exist"}

    # ML price caps
    try:
        result = db.table("ml_price_caps").select("id", count="exact").limit(1).execute()
        checks["ml_price_caps"] = {"has_data": bool(result.data), "count": result.count}
    except Exception:
        checks["ml_price_caps"] = {"has_data": False, "error": "table may not exist"}

    # Brand candidates
    try:
        result = db.table("brand_candidates").select("id", count="exact").limit(1).execute()
        checks["brand_candidates"] = {"has_data": bool(result.data), "count": result.count}
    except Exception:
        checks["brand_candidates"] = {"has_data": False, "error": "table may not exist"}

    return checks


# ---------------------------------------------------------------------------
# Report printer
# ---------------------------------------------------------------------------

def print_report(
    volumes: dict,
    brand_detection: dict,
    unmatched: list[tuple[str, int]],
    suspicious: dict,
    cap_metrics: list[dict],
    enrichment: dict,
    summary_only: bool = False,
) -> None:
    """Print a human-readable audit report."""
    print("\n" + "=" * 70)
    print("  CLOUDED DEALS DATA AUDIT REPORT")
    print(f"  Date: {date.today().isoformat()}")
    print("=" * 70)

    # --- 1. Volume summary ---
    print(f"\n{'─' * 50}")
    print("1. PRODUCT VOLUME")
    print(f"{'─' * 50}")
    print(f"  Total active products: {volumes['total_active']:,}")
    print(f"\n  By Region:")
    for region, count in sorted(volumes["by_region"].items(), key=lambda x: -x[1]):
        print(f"    {region:<25} {count:>7,}")
    print(f"\n  By Category:")
    for cat, count in sorted(volumes["by_category"].items(), key=lambda x: -x[1]):
        pct = count / max(1, volumes["total_active"]) * 100
        print(f"    {cat:<20} {count:>7,}  ({pct:5.1f}%)")
    print(f"\n  By Platform:")
    for plat, count in sorted(volumes["by_platform"].items(), key=lambda x: -x[1]):
        print(f"    {plat:<20} {count:>7,}")

    # --- 2. Brand detection ---
    print(f"\n{'─' * 50}")
    print("2. BRAND DETECTION RATES")
    print(f"{'─' * 50}")
    overall_branded = sum(r["branded"] for r in brand_detection["by_region"].values())
    overall_total = sum(r["total"] for r in brand_detection["by_region"].values())
    print(f"  Overall: {_pct(overall_branded, overall_total)} "
          f"({overall_branded:,}/{overall_total:,})")
    print(f"\n  By Region:")
    for region, stats in sorted(brand_detection["by_region"].items(),
                                 key=lambda x: x[1]["rate"]):
        rate_pct = stats["rate"] * 100
        bar = _bar(rate_pct, 25)
        print(f"    {region:<25} {rate_pct:5.1f}% {bar} ({stats['null']:,} null)")

    if not summary_only:
        print(f"\n  By Category:")
        for cat, stats in sorted(brand_detection["by_category"].items(),
                                  key=lambda x: x[1]["rate"]):
            rate_pct = stats["rate"] * 100
            print(f"    {cat:<20} {rate_pct:5.1f}% ({stats['branded']:,}/{stats['total']:,})")

    # --- 3. Top unmatched brands ---
    print(f"\n{'─' * 50}")
    print("3. TOP UNMATCHED BRANDS (last 30 days)")
    print(f"{'─' * 50}")
    if unmatched:
        print("  These appear frequently but aren't in the 264-brand database.")
        print("  High-count names are candidates for brand_candidates table.\n")
        for name, count in unmatched[:30]:
            print(f"    {name:<35} appeared {count}x")
    else:
        print("  No unmatched brand data found in daily_metrics.")

    # --- 4. Suspicious data ---
    print(f"\n{'─' * 50}")
    print("4. DATA QUALITY ISSUES")
    print(f"{'─' * 50}")
    total = suspicious["total_checked"]
    print(f"  Products checked: {total:,}\n")
    for issue, count in sorted(suspicious["counts"].items(), key=lambda x: -x[1]):
        label = issue.replace("_", " ").title()
        pct = count / max(1, total) * 100
        flag = " ⚠" if pct > 1 else ""
        print(f"    {label:<30} {count:>6,}  ({pct:5.2f}%){flag}")
        for ex in suspicious["examples"].get(issue, []):
            print(f"      {ex}")

    # --- 5. Price cap metrics ---
    print(f"\n{'─' * 50}")
    print("5. PRICE CAP REJECTION RATES (last 14 days)")
    print(f"{'─' * 50}")
    if cap_metrics:
        # Group by region, show latest
        by_region: dict[str, dict] = {}
        for row in cap_metrics:
            region = row.get("region", "unknown")
            if region not in by_region:
                by_region[region] = row
        for region, row in sorted(by_region.items()):
            reject_rate = row.get("price_cap_reject_rate") or 0
            reject_count = row.get("price_cap_reject_count") or 0
            brand_rate = row.get("brand_detection_rate") or 0
            print(f"    {region:<25} cap_rejects={reject_count:>4}  "
                  f"({reject_rate:5.1f}%)  brand_det={brand_rate:5.1f}%")
    else:
        print("  No recent daily_metrics data found.")

    # --- 6. ML infrastructure status ---
    print(f"\n{'─' * 50}")
    print("6. ML INFRASTRUCTURE STATUS")
    print(f"{'─' * 50}")
    for table_name, status in enrichment.items():
        has_data = "HAS DATA" if status.get("has_data") else "EMPTY"
        count = status.get("count", "?")
        error = status.get("error", "")
        symbol = "✓" if status.get("has_data") else "✗"
        extra = f" ({error})" if error else f" ({count} rows)"
        print(f"    {symbol} {table_name:<30} {has_data}{extra}")

    print(f"\n{'=' * 70}")
    print("  END OF AUDIT REPORT")
    print(f"{'=' * 70}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    load_dotenv()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(description="CloudedDeals data audit")
    parser.add_argument("--region", help="Filter to a specific region (e.g. michigan)")
    parser.add_argument("--summary", action="store_true", help="Summary only, skip details")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        sys.exit(1)

    from supabase import create_client
    db = create_client(url, key)

    print("Running data audit... (this may take 30-60 seconds)")

    volumes = audit_product_volumes(db, region_filter=args.region)
    brand_detection = audit_brand_detection(db, region_filter=args.region)
    unmatched = audit_unmatched_brands(db)
    suspicious = audit_suspicious_data(db, region_filter=args.region)
    cap_metrics = audit_price_cap_metrics(db)
    enrichment = audit_enrichment_status(db)

    print_report(
        volumes, brand_detection, unmatched, suspicious,
        cap_metrics, enrichment, summary_only=args.summary,
    )


if __name__ == "__main__":
    main()
