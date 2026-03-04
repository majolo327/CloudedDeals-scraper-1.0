"""
Diagnostic tool — analyze vape product classification to debug disposable detection.

Two modes:
  1. Database mode (default): Query Supabase for real vape products from the
     latest scrape, re-classify them, and report what would change.
  2. Offline mode (--offline): Run the classifier on built-in sample product
     names from known NV dispensary menus.  No database required.

Run locally:
    python diagnose_disposables.py           # database mode
    python diagnose_disposables.py --offline # offline mode

Via GitHub Actions:
    See .github/workflows/diagnose-disposables.yml
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict

from product_classifier import classify_product

# =====================================================================
# Offline sample data — real product names from NV dispensary menus
# =====================================================================

_OFFLINE_SAMPLES: list[dict] = [
    # STIIIZY products (should all be disposable except 510/cartridge)
    {"name": "Blue Dream 0.5g", "brand": "STIIIZY", "category": "vape"},
    {"name": "OG Kush 1g", "brand": "STIIIZY", "category": "vape"},
    {"name": "Strawnana Live Resin 0.5g", "brand": "STIIIZY", "category": "vape"},
    {"name": "LIIIL Indica 0.5g", "brand": "STIIIZY", "category": "vape"},
    {"name": "Birthday Cake Pod", "brand": "STIIIZY", "category": "vape"},
    {"name": "Blue Dream 510 Cartridge", "brand": "STIIIZY", "category": "vape"},
    {"name": "Strawberry Milkshake All In One Live Resin", "brand": "STIIIZY", "category": "vape"},
    {"name": "CDT Pod SFV OG 1g", "brand": "STIIIZY", "category": "vape"},
    {"name": "Biscotti 0.5g", "brand": "STIIIZY", "category": "vape"},
    {"name": "Skywalker OG Live Resin", "brand": "STIIIZY", "category": "vape"},
    # Select products
    {"name": "Bite Blueberry 0.5g", "brand": "Select", "category": "vape"},
    {"name": "Cliq Blue Dream", "brand": "Select", "category": "vape"},
    {"name": "Elite Live Resin 0.5g", "brand": "Select", "category": "vape"},
    {"name": "Essentials Cartridge 1g", "brand": "Select", "category": "vape"},
    # Rove products
    {"name": "Ready Live Resin 0.5g", "brand": "Rove", "category": "vape"},
    {"name": "Featured Farms 0.5g", "brand": "Rove", "category": "vape"},
    {"name": "Pro Pack 3pk", "brand": "Rove", "category": "vape"},
    # AiroPro products
    {"name": "Blue Dream 0.5g", "brand": "AiroPro", "category": "vape"},
    {"name": "Midnight Moon Live Flower", "brand": "AiroPro", "category": "vape"},
    # Provisions products
    {"name": "AIO Strawberry Lemonade 0.5g", "brand": "Provisions", "category": "vape"},
    {"name": "Disposable Pen Blue Dream 0.3g", "brand": "Provisions", "category": "vape"},
    # Generic disposable indicators
    {"name": "All In One Live Resin Pen 0.5g", "brand": None, "category": "vape"},
    {"name": "RTU Vape 0.5g", "brand": None, "category": "vape"},
    {"name": "Disposable Vape 0.3g", "brand": None, "category": "vape"},
    {"name": "Draw Activated Pen 0.5g", "brand": None, "category": "vape"},
    # Standard carts/pods — should NOT be disposable
    {"name": "Blue Dream Cartridge 0.5g", "brand": None, "category": "vape"},
    {"name": "OG Kush 510 0.5g", "brand": None, "category": "vape"},
    {"name": "Blue Dream Pod 0.5g", "brand": None, "category": "vape"},
    {"name": "Replacement Pod 0.5g", "brand": None, "category": "vape"},
    {"name": "Pen Battery Starter Kit", "brand": None, "category": "vape"},
    # PAX / Kingpen brand fallback
    {"name": "Blue Dream 0.5g", "brand": "PAX", "category": "vape"},
    {"name": "Gelato 0.5g", "brand": "Kingpen", "category": "vape"},
    # Wrong category — should correct to vape
    {"name": "All In One Live Resin 0.5g", "brand": None, "category": "flower"},
    {"name": "AIO Pen 0.5g", "brand": None, "category": "concentrate"},
    {"name": "Disposable Pen 0.3g", "brand": None, "category": "edible"},
]


def _run_offline():
    """Classify sample products and report results."""
    print("=" * 72)
    print("DISPOSABLE DIAGNOSTIC — OFFLINE MODE (sample product names)")
    print("=" * 72)
    print()

    results = []
    for sample in _OFFLINE_SAMPLES:
        r = classify_product(
            sample["name"],
            brand=sample.get("brand"),
            category=sample["category"],
        )
        results.append({**sample, **r})

    _print_results(results)


def _run_database():
    """Query Supabase for real vape products and re-classify them."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass  # dotenv not required if env vars are already set

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")

    if not url or not key:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        print("Use --offline mode to run without database access.")
        sys.exit(1)

    from supabase import create_client

    db = create_client(url, key)

    print("=" * 72)
    print("DISPOSABLE DIAGNOSTIC — DATABASE MODE (real scraped products)")
    print("=" * 72)
    print()

    # Query all active vape products from the most recent scrape
    print("Fetching vape products from database...")

    # Get active vapes
    resp = (
        db.table("products")
        .select("name, brand, category, product_subtype, dispensary_id, sale_price, raw_text")
        .eq("category", "vape")
        .eq("is_active", True)
        .limit(2000)
        .execute()
    )
    vape_products = resp.data or []

    # Also get products that SHOULD be vape but might be miscategorized
    resp2 = (
        db.table("products")
        .select("name, brand, category, product_subtype, dispensary_id, sale_price, raw_text")
        .eq("is_active", True)
        .neq("category", "vape")
        .limit(5000)
        .execute()
    )
    # Filter to ones with vape indicators in name
    import re
    vape_kw = re.compile(
        r"\b(?:disposable|all[- ]?in[- ]?one|aio|cart|cartridge|pod|vape|pen)\b",
        re.IGNORECASE,
    )
    miscat_vapes = [
        p for p in (resp2.data or [])
        if vape_kw.search(p.get("name", "") or "")
    ]

    print(f"  Active vapes in DB: {len(vape_products)}")
    print(f"  Potentially miscategorized vapes: {len(miscat_vapes)}")
    print()

    # Re-classify each vape product
    results = []
    for p in vape_products:
        r = classify_product(
            p.get("name"),
            brand=p.get("brand"),
            category=p.get("category") or "vape",
        )
        results.append({
            "name": p.get("name", "???"),
            "brand": p.get("brand"),
            "category": p.get("category", "vape"),
            "dispensary": p.get("dispensary_id"),
            "sale_price": p.get("sale_price"),
            "raw_text": (p.get("raw_text") or "")[:80],
            "db_subtype": p.get("product_subtype"),
            **r,
        })

    # Also classify the miscategorized ones
    miscat_results = []
    for p in miscat_vapes:
        r = classify_product(
            p.get("name"),
            brand=p.get("brand"),
            category=p.get("category"),
        )
        miscat_results.append({
            "name": p.get("name", "???"),
            "brand": p.get("brand"),
            "category": p.get("category"),
            "dispensary": p.get("dispensary_id"),
            "db_subtype": p.get("product_subtype"),
            **r,
        })

    _print_results(results, miscat_results)


def _print_results(
    results: list[dict],
    miscat_results: list[dict] | None = None,
):
    """Print classification analysis."""

    # --- Summary ---
    total = len(results)
    subtype_counts: Counter = Counter()
    brand_subtype: dict[str, Counter] = defaultdict(Counter)
    unclassified: list[dict] = []

    for r in results:
        sub = r.get("product_subtype") or "NONE"
        subtype_counts[sub] += 1
        brand = r.get("brand") or "Unknown"
        brand_subtype[brand][sub] += 1
        if sub == "NONE":
            unclassified.append(r)

    print(f"--- Vape Subtype Distribution ({total} total) ---")
    print()
    for sub, count in subtype_counts.most_common():
        pct = count / total * 100 if total else 0
        marker = ""
        if sub == "disposable" and count < 30:
            marker = "  !! UNDER TARGET (30)"
        elif sub == "NONE":
            marker = "  !! UNCLASSIFIED"
        print(f"  {sub:20s} {count:4d}  ({pct:5.1f}%){marker}")

    disp_count = subtype_counts.get("disposable", 0)
    print()
    print(f"  DISPOSABLE TOTAL: {disp_count}/{total} vapes")
    if disp_count < 6:
        print("  !! CRITICAL: Below CATEGORY_MINIMUMS (6)")
    elif disp_count < 30:
        print(f"  !! WARNING: Below CATEGORY_TARGETS (30), need {30 - disp_count} more")
    else:
        print("  OK: Meets target")

    # --- Brand breakdown ---
    print()
    print("--- Brand Breakdown ---")
    print()
    # Sort by total products descending
    for brand in sorted(brand_subtype, key=lambda b: sum(brand_subtype[b].values()), reverse=True):
        counts = brand_subtype[brand]
        total_brand = sum(counts.values())
        parts = ", ".join(f"{k}={v}" for k, v in counts.most_common())
        print(f"  {brand:25s} ({total_brand:3d}): {parts}")

    # --- Unclassified products ---
    if unclassified:
        print()
        print(f"--- Unclassified Vapes ({len(unclassified)} products) ---")
        print("    These vapes have NO subtype — they compete as generic 'vape'")
        print("    instead of being bucketed as disposable/cartridge/pod.")
        print()
        for r in unclassified[:50]:
            brand = r.get("brand") or "?"
            name = r.get("name") or "?"
            disp = r.get("dispensary") or ""
            raw = r.get("raw_text") or ""
            print(f"  [{brand:20s}] {name[:50]:50s} ({disp})")
            if raw:
                print(f"  {'':22s} raw: {raw[:60]}")
        if len(unclassified) > 50:
            print(f"  ... and {len(unclassified) - 50} more")

    # --- DB vs reclassification comparison (database mode only) ---
    changes = [r for r in results if r.get("db_subtype") != r.get("product_subtype")]
    if changes:
        print()
        print(f"--- Classification Changes ({len(changes)} products would change) ---")
        print("    DB subtype → new subtype")
        print()
        change_counts: Counter = Counter()
        for r in changes:
            old = r.get("db_subtype") or "NONE"
            new = r.get("product_subtype") or "NONE"
            change_counts[(old, new)] += 1

        for (old, new), count in change_counts.most_common():
            print(f"  {old:20s} → {new:20s}  ({count} products)")

        print()
        print("  Sample changes:")
        for r in changes[:20]:
            old = r.get("db_subtype") or "NONE"
            new = r.get("product_subtype") or "NONE"
            brand = r.get("brand") or "?"
            name = r.get("name") or "?"
            print(f"  [{brand:15s}] {name[:45]:45s}  {old} → {new}")

    # --- Miscategorized products ---
    if miscat_results:
        corrections = [r for r in miscat_results if r.get("corrected_category") == "vape"]
        if corrections:
            print()
            print(f"--- Miscategorized Vapes ({len(corrections)} products) ---")
            print("    Products NOT in 'vape' category that have vape indicators:")
            print()
            for r in corrections[:20]:
                brand = r.get("brand") or "?"
                name = r.get("name") or "?"
                cat = r.get("category") or "?"
                sub = r.get("product_subtype") or "NONE"
                print(f"  [{brand:15s}] {name[:40]:40s} cat={cat} → vape ({sub})")

    # --- Actionable recommendations ---
    print()
    print("=" * 72)
    print("RECOMMENDATIONS")
    print("=" * 72)

    if unclassified:
        # Analyze common brands in unclassified
        unc_brands = Counter(r.get("brand") or "Unknown" for r in unclassified)
        top_unc = unc_brands.most_common(5)
        print()
        print(f"1. {len(unclassified)} unclassified vapes — top brands:")
        for brand, count in top_unc:
            print(f"   - {brand}: {count} products (add to _DISPOSABLE_BRAND_LINES or _CART_BRANDS?)")

    if disp_count < 30:
        print()
        print(f"2. Only {disp_count} disposables detected — need {30 - disp_count} more for target")
        print("   Actions:")
        print("   - Check if any unclassified vape brands are actually disposable lines")
        print("   - Check Dutchie category tabs for 'Disposable' labels (raw_text fallback)")
        print("   - Review NOT-disposable exclusions for false positives")

    if not unclassified and disp_count >= 30:
        print()
        print("All vapes classified and disposable target met!")


def main():
    parser = argparse.ArgumentParser(
        description="Diagnose disposable vape classification issues",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Run with built-in sample data (no database required)",
    )
    args = parser.parse_args()

    if args.offline:
        _run_offline()
    else:
        _run_database()


if __name__ == "__main__":
    main()
