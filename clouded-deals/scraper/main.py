"""
CloudedDeals scraper orchestrator.

Reads active dispensaries from Supabase, routes each to the correct
platform scraper, parses and scores products, then upserts results
into the products and deals tables.  Every run is tracked in
scrape_runs for the admin dashboard.

Usage:
    python main.py                # scrape all active dispensaries
    python main.py td-gibson      # scrape a single site by slug
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

from config.dispensaries import DISPENSARIES
from deal_detector import detect_deals
from parser import parse_product
from platforms import CuraleafScraper, DutchieScraper, JaneScraper

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("orchestrator")

# ---------------------------------------------------------------------------
# Supabase client (service-role key for writes)
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Platform router
# ---------------------------------------------------------------------------

SCRAPER_MAP = {
    "dutchie": DutchieScraper,
    "curaleaf": CuraleafScraper,
    "jane": JaneScraper,
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _create_run() -> str:
    """Insert a new scrape_runs row and return its id."""
    row = db.table("scrape_runs").insert({"status": "running"}).execute()
    run_id: str = row.data[0]["id"]
    logger.info("Scrape run started: %s", run_id)
    return run_id


def _complete_run(
    run_id: str,
    *,
    status: str,
    total_products: int,
    qualifying_deals: int,
    sites_scraped: list[str],
    sites_failed: list[dict[str, str]],
) -> None:
    db.table("scrape_runs").update(
        {
            "status": status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "total_products": total_products,
            "qualifying_deals": qualifying_deals,
            "sites_scraped": sites_scraped,
            "sites_failed": sites_failed,
        }
    ).eq("id", run_id).execute()
    logger.info("Run %s finished — status=%s", run_id, status)


def _upsert_products(
    dispensary_id: str, products: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Upsert parsed products into the products table.

    Returns the rows as returned by Supabase (including generated ids).
    """
    rows = []
    for p in products:
        rows.append(
            {
                "dispensary_id": dispensary_id,
                "name": p.get("name", "Unknown"),
                "brand": p.get("brand"),
                "category": p.get("category"),
                "original_price": p.get("original_price"),
                "sale_price": p.get("sale_price"),
                "discount_percent": p.get("discount_percent"),
                "weight_value": p.get("weight_value"),
                "weight_unit": p.get("weight_unit"),
                "thc_percent": p.get("thc_percent"),
                "cbd_percent": p.get("cbd_percent"),
                "raw_text": (p.get("raw_text") or "")[:4000],
            }
        )

    if not rows:
        return []

    result = (
        db.table("products")
        .upsert(rows, on_conflict="dispensary_id,name,sale_price")
        .execute()
    )
    return result.data


def _insert_deals(
    dispensary_id: str,
    deals: list[dict[str, Any]],
    product_rows: list[dict[str, Any]],
) -> int:
    """Insert qualifying deals into the deals table.

    Matches deals back to their upserted product rows by name + sale_price.
    Returns the number of deals inserted.
    """
    # Build lookup: (name, sale_price) → product_id
    product_lookup: dict[tuple[str, float | None], str] = {}
    for pr in product_rows:
        key = (pr["name"], pr.get("sale_price"))
        product_lookup[key] = pr["id"]

    deal_rows = []
    for d in deals:
        key = (d.get("name", ""), d.get("sale_price"))
        product_id = product_lookup.get(key)
        if not product_id:
            continue
        deal_rows.append(
            {
                "product_id": product_id,
                "dispensary_id": dispensary_id,
                "deal_score": round(d["deal_score"], 1),
            }
        )

    if not deal_rows:
        return 0

    db.table("deals").upsert(
        deal_rows, on_conflict="product_id,dispensary_id"
    ).execute()
    return len(deal_rows)


# ---------------------------------------------------------------------------
# Per-site scrape
# ---------------------------------------------------------------------------


async def scrape_site(dispensary: dict[str, Any]) -> dict[str, Any]:
    """Scrape a single dispensary site end-to-end.

    Returns a summary dict with product/deal counts or error info.
    """
    slug = dispensary["slug"]
    platform = dispensary["platform"]
    scraper_cls = SCRAPER_MAP.get(platform)

    if scraper_cls is None:
        return {"slug": slug, "error": f"Unknown platform: {platform}"}

    try:
        async with scraper_cls(dispensary) as scraper:
            raw_products = await scraper.scrape()

        # Parse and detect deals
        parsed = [parse_product(rp) for rp in raw_products]
        deals = detect_deals(parsed)

        # Upsert to DB
        product_rows = _upsert_products(slug, parsed)
        deal_count = _insert_deals(slug, deals, product_rows)

        logger.info(
            "[%s] %d products, %d deals", slug, len(parsed), deal_count
        )
        return {
            "slug": slug,
            "products": len(parsed),
            "deals": deal_count,
            "error": None,
        }

    except Exception as exc:
        logger.error("[%s] Failed: %s", slug, exc, exc_info=True)
        return {"slug": slug, "error": str(exc)}


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


def _get_active_dispensaries(slug_filter: str | None = None) -> list[dict]:
    """Return dispensary configs to scrape.

    If *slug_filter* is given, return only that single site.
    Otherwise return all active dispensaries from the DISPENSARIES list.
    """
    if slug_filter:
        return [d for d in DISPENSARIES if d["slug"] == slug_filter]

    # Fetch active slugs from Supabase so the admin can disable sites.
    result = (
        db.table("dispensaries")
        .select("id")
        .eq("is_active", True)
        .execute()
    )
    active_slugs = {row["id"] for row in result.data}

    # If the DB has no dispensary rows yet, fall back to the full config.
    if not active_slugs:
        logger.warning("No dispensaries in DB — using full config list")
        return list(DISPENSARIES)

    return [d for d in DISPENSARIES if d["slug"] in active_slugs]


async def run(slug_filter: str | None = None) -> None:
    """Run the full scrape pipeline."""
    dispensaries = _get_active_dispensaries(slug_filter)
    if not dispensaries:
        logger.error("No dispensaries to scrape")
        return

    logger.info("Scraping %d dispensaries", len(dispensaries))
    run_id = _create_run()

    sites_scraped: list[str] = []
    sites_failed: list[dict[str, str]] = []
    total_products = 0
    total_deals = 0

    for dispensary in dispensaries:
        result = await scrape_site(dispensary)

        if result.get("error"):
            sites_failed.append(
                {"slug": result["slug"], "error": result["error"]}
            )
        else:
            sites_scraped.append(result["slug"])
            total_products += result.get("products", 0)
            total_deals += result.get("deals", 0)

    status = "completed" if sites_scraped else "failed"
    _complete_run(
        run_id,
        status=status,
        total_products=total_products,
        qualifying_deals=total_deals,
        sites_scraped=sites_scraped,
        sites_failed=sites_failed,
    )

    logger.info(
        "Done — %d products, %d deals, %d/%d sites OK",
        total_products,
        total_deals,
        len(sites_scraped),
        len(sites_scraped) + len(sites_failed),
    )


if __name__ == "__main__":
    slug_arg = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(run(slug_arg))
