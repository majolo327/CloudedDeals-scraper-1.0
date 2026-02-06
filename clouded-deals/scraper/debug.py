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
today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
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
