"""Probe Rise Cannabis (GTI) for API endpoints that bypass Cloudflare.

Rise's website is a Next.js SPA served from risecannabis.com.  In Feb 2026
they deployed Cloudflare Turnstile, blocking all headless browser scraping.

This script investigates whether the underlying data API is accessible
server-to-server (no browser needed).  Next.js apps typically fetch JSON
from /_next/data/{buildId}/... paths — if that endpoint isn't behind
Cloudflare, we can scrape menus directly via HTTP.

Usage:
    python scripts/probe_rise_api.py
    python scripts/probe_rise_api.py --store-url <RISE_MENU_URL>

Probes:
  1. Direct HTML fetch (expect Cloudflare block — baseline)
  2. /_next/data paths (Next.js server-side data routes)
  3. Common API patterns (/api/dispensaries, /api/stores, etc.)
  4. cdn-bong.risecannabis.com static asset paths
  5. __NEXT_DATA__ extraction if HTML is accessible
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from urllib.parse import urlparse

# Use stdlib only — no external deps required
import urllib.request
import urllib.error

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Default test URL — Rise Tropicana West (NV, store 886)
_DEFAULT_URL = "https://risecannabis.com/dispensaries/nevada/west-tropicana/886/pickup-menu/"

# Headers that mimic a real browser — helps with basic UA checks
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def _fetch(url: str, timeout: int = 15) -> tuple[int, str, dict]:
    """Fetch a URL and return (status_code, body, headers)."""
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            headers = dict(resp.headers)
            return resp.status, body, headers
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")[:2000]
        except Exception:
            pass
        return e.code, body, dict(e.headers) if e.headers else {}
    except Exception as e:
        logger.error("  Connection error: %s", e)
        return 0, str(e), {}


def _extract_build_id(html: str) -> str | None:
    """Extract Next.js buildId from __NEXT_DATA__ script tag."""
    match = re.search(r'"buildId"\s*:\s*"([^"]+)"', html)
    return match.group(1) if match else None


def _extract_next_data(html: str) -> dict | None:
    """Extract the full __NEXT_DATA__ JSON from the page."""
    match = re.search(
        r'<script\s+id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


def probe(store_url: str) -> None:
    """Run all probes against the given Rise store URL."""
    parsed = urlparse(store_url)
    base = f"{parsed.scheme}://{parsed.hostname}"
    path = parsed.path.rstrip("/")

    # Extract slug and store ID from URL pattern:
    # /dispensaries/nevada/{slug}/{store-id}/pickup-menu/
    parts = path.strip("/").split("/")
    store_id = None
    state_slug = None
    if len(parts) >= 4:
        state_slug = parts[1]  # e.g., "nevada"
        store_id = parts[3]    # e.g., "886"

    print("=" * 70)
    print(f"  RISE API PROBE — {store_url}")
    print(f"  Store ID: {store_id or '?'} | State: {state_slug or '?'}")
    print("=" * 70)

    # ------------------------------------------------------------------
    # Probe 1: Direct page fetch
    # ------------------------------------------------------------------
    print("\n[1/5] Direct page fetch (expect Cloudflare block)...")
    status, body, headers = _fetch(store_url)
    cf_blocked = "cloudflare" in body.lower() or "just a moment" in body.lower()
    print(f"  Status: {status}")
    print(f"  Cloudflare detected: {cf_blocked}")
    if status == 200 and not cf_blocked:
        print("  *** PAGE IS ACCESSIBLE! Cloudflare may have been removed. ***")
        next_data = _extract_next_data(body)
        if next_data:
            print(f"  __NEXT_DATA__ found — buildId: {next_data.get('buildId', '?')}")
            props = next_data.get("props", {}).get("pageProps", {})
            product_keys = [k for k in props if "product" in k.lower() or "menu" in k.lower()]
            if product_keys:
                print(f"  Interesting pageProps keys: {product_keys}")
                for key in product_keys[:2]:
                    val = props[key]
                    if isinstance(val, list):
                        print(f"    {key}: {len(val)} items")
                    elif isinstance(val, dict):
                        print(f"    {key}: dict with keys {list(val.keys())[:5]}")

    build_id = _extract_build_id(body) if status == 200 else None

    # ------------------------------------------------------------------
    # Probe 2: /_next/data paths
    # ------------------------------------------------------------------
    print("\n[2/5] Next.js _next/data paths...")
    if build_id:
        print(f"  Found buildId: {build_id}")
        data_paths = [
            f"/_next/data/{build_id}{path}.json",
            f"/_next/data/{build_id}/dispensaries/{state_slug}.json",
        ]
    else:
        print("  No buildId found — trying common patterns...")
        # Try fetching the homepage to get buildId
        home_status, home_body, _ = _fetch(base + "/")
        build_id = _extract_build_id(home_body) if home_status == 200 else None
        if build_id:
            print(f"  Got buildId from homepage: {build_id}")
            data_paths = [
                f"/_next/data/{build_id}{path}.json",
                f"/_next/data/{build_id}/dispensaries/{state_slug}.json",
            ]
        else:
            print("  Cannot determine buildId — skipping _next/data probes")
            data_paths = []

    for dp in data_paths:
        url = base + dp
        status, body, _ = _fetch(url)
        print(f"  {dp}")
        print(f"    Status: {status}")
        if status == 200:
            try:
                data = json.loads(body)
                page_props = data.get("pageProps", {})
                keys = list(page_props.keys())[:10]
                print(f"    *** JSON RESPONSE! pageProps keys: {keys}")
                # Look for product data
                for k, v in page_props.items():
                    if isinstance(v, list) and len(v) > 0:
                        print(f"    {k}: {len(v)} items")
                        if len(v) > 0 and isinstance(v[0], dict):
                            print(f"      Sample keys: {list(v[0].keys())[:8]}")
            except json.JSONDecodeError:
                print(f"    Not JSON (body[:100]: {body[:100]})")

    # ------------------------------------------------------------------
    # Probe 3: Common API patterns
    # ------------------------------------------------------------------
    print("\n[3/5] Common API endpoint patterns...")
    api_paths = [
        f"/api/dispensaries/{store_id}/menu" if store_id else None,
        f"/api/v1/stores/{store_id}/products" if store_id else None,
        f"/api/dispensaries/{store_id}" if store_id else None,
        f"/api/menu/{store_id}" if store_id else None,
        "/api/dispensaries",
        "/api/stores",
        "/api/graphql",
        "/graphql",
    ]
    for ap in api_paths:
        if ap is None:
            continue
        url = base + ap
        status, body, hdrs = _fetch(url)
        content_type = hdrs.get("content-type", hdrs.get("Content-Type", ""))
        is_json = "json" in content_type or (body.startswith("{") or body.startswith("["))
        marker = " ***" if status == 200 and is_json else ""
        print(f"  {ap}")
        print(f"    Status: {status} | JSON: {is_json}{marker}")
        if status == 200 and is_json:
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    print(f"    Keys: {list(data.keys())[:10]}")
                elif isinstance(data, list):
                    print(f"    Array of {len(data)} items")
            except json.JSONDecodeError:
                print(f"    Body[:200]: {body[:200]}")

    # ------------------------------------------------------------------
    # Probe 4: CDN paths
    # ------------------------------------------------------------------
    print("\n[4/5] CDN (cdn-bong.risecannabis.com) asset paths...")
    cdn_base = "https://cdn-bong.risecannabis.com"
    cdn_paths = [
        f"/dispensaries/{state_slug}/{store_id}/menu.json" if store_id else None,
        f"/api/menu/{store_id}" if store_id else None,
        "/manifest.json",
    ]
    for cp in cdn_paths:
        if cp is None:
            continue
        url = cdn_base + cp
        status, body, _ = _fetch(url)
        print(f"  {cp}")
        print(f"    Status: {status}")
        if status == 200:
            print(f"    Body[:200]: {body[:200]}")

    # ------------------------------------------------------------------
    # Probe 5: Network intercept suggestion
    # ------------------------------------------------------------------
    print("\n[5/5] Network intercept (requires Playwright)...")
    print("  To capture the actual API calls Rise's SPA makes:")
    print("  1. Open a browser to the Rise menu page")
    print("  2. Open DevTools > Network tab > Filter by XHR/Fetch")
    print("  3. Look for JSON responses containing product data")
    print("  4. The URL pattern will reveal the real API endpoint")
    print()
    print("  Alternatively, run with Playwright network listener:")
    print("    python scripts/probe_rise_api.py --intercept")

    print("\n" + "=" * 70)
    print("  PROBE COMPLETE")
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Probe Rise Cannabis for API endpoints bypassing Cloudflare"
    )
    parser.add_argument(
        "--store-url",
        default=_DEFAULT_URL,
        help="Rise dispensary menu URL to probe (default: Rise Tropicana West NV)",
    )
    args = parser.parse_args()
    probe(args.store_url)


if __name__ == "__main__":
    main()
