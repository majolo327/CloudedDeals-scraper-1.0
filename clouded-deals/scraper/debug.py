"""
Debug tool — inspect what's in the database after a scrape run.

Run manually or via the "Debug Database" GitHub Actions workflow.
"""

import os
import sys
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL", "")
key = os.getenv("SUPABASE_SERVICE_KEY", "")

if not url or not key:
    print("X  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

from supabase import create_client

db = create_client(url, key)

print("=" * 60)
print("CloudedDeals Database Debug Report")
print("=" * 60)

# --- Latest scrape run ---
print("\n--- Latest Scrape Run ---")
run = db.table("scrape_runs").select("*").order("started_at", desc=True).limit(1).execute()
if run.data:
    r = run.data[0]
    print(f"  ID:         {r['id'][:12]}...")
    print(f"  Status:     {r['status']}")
    print(f"  Started:    {r['started_at']}")
    print(f"  Completed:  {r.get('completed_at', 'N/A')}")
    print(f"  Products:   {r.get('total_products', 0)}")
    print(f"  Deals:      {r.get('qualifying_deals', 0)}")

    scraped = r.get("sites_scraped") or []
    failed = r.get("sites_failed") or []
    print(f"  Sites OK:   {len(scraped)}")
    print(f"  Sites fail: {len(failed)}")
    if failed:
        for f in failed[:5]:
            print(f"    - {f['slug']}: {f['error'][:80]}")
else:
    print("  No scrape runs found.")

# --- Dispensaries ---
print("\n--- Dispensaries ---")
disps = db.table("dispensaries").select("id, name, platform, is_active", count="exact").execute()
print(f"  Total:    {disps.count or 0}")
if disps.data:
    active = sum(1 for d in disps.data if d.get("is_active"))
    platforms = {}
    for d in disps.data:
        p = d.get("platform", "unknown")
        platforms[p] = platforms.get(p, 0) + 1
    print(f"  Active:   {active}")
    print(f"  Platforms: {platforms}")

# --- Products (today) ---
print("\n--- Products ---")
today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
today = today_start.isoformat()
all_products = db.table("products").select("id", count="exact").limit(1).execute()
today_products = db.table("products").select("id", count="exact").gte("scraped_at", today).limit(1).execute()
print(f"  Total:    {all_products.count or 0}")
print(f"  Today:    {today_products.count or 0}")

# Sample recent products
sample = (
    db.table("products")
    .select("name, brand, category, sale_price, dispensary_id")
    .order("created_at", desc=True)
    .limit(5)
    .execute()
)
if sample.data:
    print("  Recent:")
    for p in sample.data:
        price = f"${p['sale_price']}" if p.get("sale_price") else "N/A"
        print(f"    - [{p.get('category', '?')}] {p['name'][:40]} — {price} @ {p['dispensary_id']}")

# --- Deals ---
print("\n--- Deals ---")
all_deals = db.table("deals").select("id", count="exact").limit(1).execute()
today_deals = db.table("deals").select("id", count="exact").gte("created_at", today).limit(1).execute()
print(f"  Total:    {all_deals.count or 0}")
print(f"  Today:    {today_deals.count or 0}")

# Top deals by score
top = (
    db.table("deals")
    .select("deal_score, dispensary_id, product_id")
    .order("deal_score", desc=True)
    .limit(5)
    .execute()
)
if top.data:
    print("  Top deals by score:")
    for d in top.data:
        print(f"    - score={d['deal_score']} @ {d['dispensary_id']}")

# --- Deal counts by dispensary (yesterday vs today) ---
print("\n--- Deals by Dispensary (Yesterday vs Today) ---")
yesterday = (today_start - timedelta(days=1)).isoformat()
tomorrow = (today_start + timedelta(days=1)).isoformat()

disp_resp = db.table("dispensaries").select("id, name, platform, is_active").execute()
disp_map = {d["id"]: d for d in (disp_resp.data or [])}
slugs = list(disp_map.keys())

def _count_by_disp(table, ts_col, gte, lt):
    """Return {slug: count} for rows in [gte, lt)."""
    counts = {}
    for i in range(0, len(slugs), 50):
        batch = slugs[i : i + 50]
        rows = (
            db.table(table)
            .select("dispensary_id")
            .in_("dispensary_id", batch)
            .gte(ts_col, gte)
            .lt(ts_col, lt)
            .execute()
        ).data or []
        for r in rows:
            s = r["dispensary_id"]
            counts[s] = counts.get(s, 0) + 1
    return counts

y_products = _count_by_disp("products", "scraped_at", yesterday, today)
t_products = _count_by_disp("products", "scraped_at", today, tomorrow)
y_deals = _count_by_disp("deals", "created_at", yesterday, today)
t_deals = _count_by_disp("deals", "created_at", today, tomorrow)

for platform in sorted(set(d["platform"] for d in disp_map.values())):
    p_slugs = sorted(
        [s for s, d in disp_map.items() if d["platform"] == platform],
        key=lambda s: disp_map[s]["name"],
    )
    print(f"\n  {platform.upper()}")
    print(f"  {'Name':<34s} {'Yest prod':>9s} {'deals':>5s}  {'Today prod':>10s} {'deals':>5s}")
    yp_tot = yd_tot = tp_tot = td_tot = 0
    for s in p_slugs:
        info = disp_map[s]
        tag = "" if info.get("is_active") else " [OFF]"
        yp = y_products.get(s, 0); yd = y_deals.get(s, 0)
        tp = t_products.get(s, 0); td = t_deals.get(s, 0)
        yp_tot += yp; yd_tot += yd; tp_tot += tp; td_tot += td
        print(f"  {(info['name'][:32] + tag):<34s} {yp:>9d} {yd:>5d}  {tp:>10d} {td:>5d}")
    print(f"  {'TOTAL':<34s} {yp_tot:>9d} {yd_tot:>5d}  {tp_tot:>10d} {td_tot:>5d}")

# --- Analytics events ---
print("\n--- Analytics ---")
events = db.table("analytics_events").select("id", count="exact").limit(1).execute()
print(f"  Total events: {events.count or 0}")

# --- User saves ---
saves = db.table("user_saved_deals").select("id", count="exact").limit(1).execute()
print(f"  Total saves:  {saves.count or 0}")

print("\n" + "=" * 60)
print("Debug report complete.")
print("=" * 60)
