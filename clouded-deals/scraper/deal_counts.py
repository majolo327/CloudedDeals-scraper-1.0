"""
Deal counts by dispensary for yesterday and today.

Usage:
    python deal_counts.py                # all platforms
    python deal_counts.py jane carrot aiq  # specific platforms only
"""

import os
import sys
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL", "")
key = os.getenv("SUPABASE_SERVICE_KEY", "")

if not url or not key:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

from supabase import create_client

db = create_client(url, key)

# --- Date boundaries (UTC) ---
now = datetime.now(timezone.utc)
today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
yesterday_start = today_start - timedelta(days=1)

today_iso = today_start.isoformat()
yesterday_iso = yesterday_start.isoformat()

# --- Optional platform filter from CLI args ---
platform_filter = set(sys.argv[1:]) if len(sys.argv) > 1 else None

# --- Get dispensary metadata ---
disps_resp = db.table("dispensaries").select("id, name, platform, is_active").execute()
disp_map = {d["id"]: d for d in disps_resp.data}

if platform_filter:
    disp_map = {k: v for k, v in disp_map.items() if v["platform"] in platform_filter}

slug_list = list(disp_map.keys())

# --- Query deals for yesterday and today ---
def fetch_deals(gte: str, lt: str):
    """Fetch deals created in [gte, lt) for our dispensaries."""
    all_deals = []
    # Supabase .in_() has a limit, batch if needed
    batch_size = 50
    for i in range(0, len(slug_list), batch_size):
        batch = slug_list[i : i + batch_size]
        resp = (
            db.table("deals")
            .select("dispensary_id, deal_score")
            .in_("dispensary_id", batch)
            .gte("created_at", gte)
            .lt("created_at", lt)
            .execute()
        )
        all_deals.extend(resp.data)
    return all_deals

yesterday_deals = fetch_deals(yesterday_iso, today_iso)
today_deals = fetch_deals(today_iso, (today_start + timedelta(days=1)).isoformat())

# --- Aggregate by dispensary ---
def aggregate(deals):
    counts = {}
    for d in deals:
        slug = d["dispensary_id"]
        if slug not in counts:
            counts[slug] = {"count": 0, "avg_score": 0, "scores": []}
        counts[slug]["count"] += 1
        if d.get("deal_score"):
            counts[slug]["scores"].append(float(d["deal_score"]))
    for slug, info in counts.items():
        if info["scores"]:
            info["avg_score"] = sum(info["scores"]) / len(info["scores"])
    return counts

yesterday_agg = aggregate(yesterday_deals)
today_agg = aggregate(today_deals)

# --- Also get product counts ---
def fetch_product_counts(gte: str, lt: str):
    counts = {}
    batch_size = 50
    for i in range(0, len(slug_list), batch_size):
        batch = slug_list[i : i + batch_size]
        resp = (
            db.table("products")
            .select("dispensary_id")
            .in_("dispensary_id", batch)
            .gte("scraped_at", gte)
            .lt("scraped_at", lt)
            .eq("is_active", True)
            .execute()
        )
        for p in resp.data:
            slug = p["dispensary_id"]
            counts[slug] = counts.get(slug, 0) + 1
    return counts

yesterday_products = fetch_product_counts(yesterday_iso, today_iso)
today_products = fetch_product_counts(today_iso, (today_start + timedelta(days=1)).isoformat())

# --- Latest scrape runs ---
print("=" * 72)
print("CloudedDeals — Deal Counts by Dispensary (Yesterday vs Today)")
print("=" * 72)
print(f"  Yesterday: {yesterday_start.strftime('%Y-%m-%d')} UTC")
print(f"  Today:     {today_start.strftime('%Y-%m-%d')} UTC")

runs = (
    db.table("scrape_runs")
    .select("id, started_at, status, total_products, qualifying_deals, platform_group, sites_failed")
    .order("started_at", desc=True)
    .limit(3)
    .execute()
)
if runs.data:
    print(f"\n--- Last {len(runs.data)} Scrape Runs ---")
    for r in runs.data:
        failed = r.get("sites_failed") or []
        failed_slugs = [f["slug"] for f in failed] if failed else []
        print(
            f"  {r['started_at'][:16]}  "
            f"group={r.get('platform_group', '?'):6s}  "
            f"status={r['status']:24s}  "
            f"products={r.get('total_products', 0):4d}  "
            f"deals={r.get('qualifying_deals', 0):3d}"
            + (f"  FAILED: {', '.join(failed_slugs)}" if failed_slugs else "")
        )

# --- Print per-platform breakdown ---
platforms_to_show = sorted(set(d["platform"] for d in disp_map.values()))

for platform in platforms_to_show:
    slugs = sorted(
        [s for s, d in disp_map.items() if d["platform"] == platform],
        key=lambda s: disp_map[s]["name"],
    )
    print(f"\n{'─' * 72}")
    print(f"  {platform.upper()} ({len(slugs)} dispensaries)")
    print(f"{'─' * 72}")
    print(
        f"  {'Dispensary':<35s}  "
        f"{'Yesterday':>14s}  "
        f"{'Today':>14s}  "
        f"{'Active'}"
    )
    print(
        f"  {'':35s}  "
        f"{'prod / deals':>14s}  "
        f"{'prod / deals':>14s}"
    )
    print(f"  {'─' * 35}  {'─' * 14}  {'─' * 14}  {'─' * 6}")

    plat_ytotal_p, plat_ytotal_d = 0, 0
    plat_ttotal_p, plat_ttotal_d = 0, 0

    for slug in slugs:
        info = disp_map[slug]
        name = info["name"][:35]
        active = "Yes" if info.get("is_active") else "No"

        yp = yesterday_products.get(slug, 0)
        yd = yesterday_agg.get(slug, {}).get("count", 0)
        tp = today_products.get(slug, 0)
        td = today_agg.get(slug, {}).get("count", 0)

        plat_ytotal_p += yp
        plat_ytotal_d += yd
        plat_ttotal_p += tp
        plat_ttotal_d += td

        print(
            f"  {name:<35s}  "
            f"{yp:>6d} / {yd:<5d}  "
            f"{tp:>6d} / {td:<5d}  "
            f"{active}"
        )

    print(
        f"  {'TOTAL':<35s}  "
        f"{plat_ytotal_p:>6d} / {plat_ytotal_d:<5d}  "
        f"{plat_ttotal_p:>6d} / {plat_ttotal_d:<5d}"
    )

# --- Grand totals ---
grand_yp = sum(yesterday_products.values())
grand_yd = sum(y.get("count", 0) for y in yesterday_agg.values())
grand_tp = sum(today_products.values())
grand_td = sum(y.get("count", 0) for y in today_agg.values())

print(f"\n{'=' * 72}")
print(
    f"  {'GRAND TOTAL':<35s}  "
    f"{grand_yp:>6d} / {grand_yd:<5d}  "
    f"{grand_tp:>6d} / {grand_td:<5d}"
)
print(f"{'=' * 72}")
