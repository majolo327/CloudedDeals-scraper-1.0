"""
Validate Supabase connection before running the scraper.

Tests:
  1. Can connect with the provided credentials
  2. Can read from dispensaries table
  3. Can write to scrape_runs table (then cleans up)

Exit code 0 = all good, 1 = something is broken.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL", "")
key = os.getenv("SUPABASE_SERVICE_KEY", "")


def log(icon: str, msg: str) -> None:
    print(f"{icon}  {msg}", flush=True)


if not url or not key:
    log("X", "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

try:
    from supabase import create_client

    supabase = create_client(url, key)
    log("OK", f"Client created for {url[:40]}...")
except Exception as e:
    log("X", f"Failed to create Supabase client: {e}")
    sys.exit(1)

# --- Test 1: Read dispensaries ---
try:
    result = supabase.table("dispensaries").select("id").limit(5).execute()
    log("OK", f"Read dispensaries — {len(result.data)} rows returned")
except Exception as e:
    log("X", f"Failed to read dispensaries: {e}")
    sys.exit(1)

# --- Test 2: Read products ---
try:
    result = supabase.table("products").select("id", count="exact").limit(1).execute()
    log("OK", f"Read products — {result.count or 0} total rows")
except Exception as e:
    log("X", f"Failed to read products: {e}")
    sys.exit(1)

# --- Test 3: Read deals ---
try:
    result = supabase.table("deals").select("id", count="exact").limit(1).execute()
    log("OK", f"Read deals — {result.count or 0} total rows")
except Exception as e:
    log("X", f"Failed to read deals: {e}")
    sys.exit(1)

# --- Test 4: Write + delete scrape_runs ---
try:
    row = supabase.table("scrape_runs").insert(
        {"status": "connection_test", "total_products": 0}
    ).execute()
    test_id = row.data[0]["id"]
    log("OK", f"Write test passed — created scrape_runs row {test_id[:8]}...")

    supabase.table("scrape_runs").delete().eq("id", test_id).execute()
    log("OK", "Cleanup passed — deleted test row")
except Exception as e:
    log("X", f"Write test failed: {e}")
    sys.exit(1)

print()
log("OK", "All connection tests passed. Scraper is ready to run.")
