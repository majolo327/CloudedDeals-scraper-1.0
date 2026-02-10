"""
CloudedDeals scraper orchestrator.

Reads active dispensaries from Supabase, routes each to the correct
platform scraper, parses and scores products, then upserts results
into the products and deals tables.  Every run is tracked in
scrape_runs for the admin dashboard.

Usage:
    python main.py                # scrape all active dispensaries
    python main.py td-gibson      # scrape a single site by slug

Environment variables (for CI):
    DRY_RUN=true              # scrape only, skip all DB writes
    LIMIT_DISPENSARIES=true   # scrape only 3 sites (1 per platform)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

from playwright.async_api import async_playwright

from config.dispensaries import BROWSER_ARGS, DISPENSARIES, SITE_TIMEOUT_SEC
from clouded_logic import CloudedLogic
from deal_detector import detect_deals, get_last_report_data
from metrics_collector import collect_daily_metrics
from product_classifier import classify_product
from platforms import AIQScraper, CarrotScraper, CuraleafScraper, DutchieScraper, JaneScraper, RiseScraper

# Concurrency limit for parallel scraping (4 browser contexts at once)
SCRAPE_CONCURRENCY = int(os.getenv("SCRAPE_CONCURRENCY", "4"))

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("orchestrator")

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"
LIMIT_DISPENSARIES = os.getenv("LIMIT_DISPENSARIES", "false").lower() == "true"
FORCE_RUN = os.getenv("FORCE_RUN", "false").lower() == "true"

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
    "rise": RiseScraper,
    "carrot": CarrotScraper,
    "aiq": AIQScraper,
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _create_run() -> str:
    """Insert a new scrape_runs row and return its id."""
    if DRY_RUN:
        logger.info("[DRY RUN] Would create scrape_runs entry")
        return "dry-run"
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
    runtime_seconds: int,
) -> None:
    if DRY_RUN:
        logger.info(
            "[DRY RUN] Would update run — status=%s, products=%d, deals=%d",
            status, total_products, qualifying_deals,
        )
        return
    db.table("scrape_runs").update(
        {
            "status": status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "total_products": total_products,
            "qualifying_deals": qualifying_deals,
            "sites_scraped": sites_scraped,
            "sites_failed": sites_failed,
            "runtime_seconds": runtime_seconds,
        }
    ).eq("id", run_id).execute()
    logger.info("Run %s finished — status=%s", run_id, status)


def _seed_dispensaries() -> None:
    """Ensure all configured dispensaries exist in the DB."""
    if DRY_RUN:
        logger.info("[DRY RUN] Would seed %d dispensaries", len(DISPENSARIES))
        return
    rows = [
        {
            "id": d["slug"],
            "name": d["name"],
            "url": d["url"],
            "platform": d["platform"],
            "is_active": d.get("is_active", True),
            "region": d.get("region", "southern-nv"),
        }
        for d in DISPENSARIES
    ]
    db.table("dispensaries").upsert(rows, on_conflict="id").execute()
    logger.info("Seeded %d dispensaries into DB", len(rows))


def _deactivate_old_deals() -> None:
    """Deactivate previous day's deals so only fresh data is shown."""
    if DRY_RUN:
        logger.info("[DRY RUN] Would deactivate old deals")
        return
    today_start = (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    result = (
        db.table("products")
        .update({"is_active": False})
        .lt("scraped_at", today_start)
        .eq("is_active", True)
        .execute()
    )
    count = len(result.data) if result.data else 0
    if count > 0:
        logger.info("Deactivated %d old products", count)


_UPSERT_CHUNK_SIZE = 500  # max rows per Supabase upsert call

# Regex to strip junk from product names before storing / dedup
_RE_NAME_JUNK = re.compile(
    r"(Add to (cart|bag)|Remove|View details|Out of stock|"
    r"Sale!|New!|Limited|Sold out|In stock|"
    r"\bQty\b.*$|\bQuantity\b.*$)",
    re.IGNORECASE | re.MULTILINE,
)

# Strip inline bundle/promo text that bleeds into product names from Dutchie
# "Special Offers" DOM.  Matches patterns like "3 For $50 …", "2/$60 …",
# "Buy 2 Get 1 …" and removes everything from the match to end of string.
_RE_BUNDLE_PROMO = re.compile(
    r"\s*\b\d+\s+[Ff]or\s+\$\d+.*$"    # "3 For $50 …"
    r"|\s*\b\d+/\$\d+.*$"               # "2/$60 …"
    r"|\s*\bBuy\s+\d+\s+Get\s.*$"       # "Buy 2 Get 1 …"
    r"|\s*\bSpecial Offers?\b.*$",       # "Special Offers (1) …"
    re.IGNORECASE,
)
_RE_TRAILING_STRAIN = re.compile(r"\s*(Indica|Sativa|Hybrid)\s*$", re.IGNORECASE)

# Patterns that indicate promotional / sale copy rather than a real product name
_SALE_COPY_PATTERNS = [
    re.compile(r"^\d+%\s*off", re.IGNORECASE),
    re.compile(r"^buy\s+\d+\s+get", re.IGNORECASE),
    re.compile(r"^bogo", re.IGNORECASE),
    re.compile(r"^sale\b", re.IGNORECASE),
    re.compile(r"^special\b", re.IGNORECASE),
    re.compile(r"^deal\s+of", re.IGNORECASE),
    re.compile(r"^daily\s+deal", re.IGNORECASE),
    re.compile(r"^clearance\b", re.IGNORECASE),
    re.compile(r"^mix\s*(and|&|n)\s*match", re.IGNORECASE),
    re.compile(r"^bundle\b", re.IGNORECASE),
    re.compile(r"^promo\b", re.IGNORECASE),
    re.compile(r"\|\s*\d+%\s*off", re.IGNORECASE),
    re.compile(r"off\s+(all|select|any)\s", re.IGNORECASE),
]


# Names that are strain types / classifications, NOT real product names.
_STRAIN_ONLY_NAMES = {"indica", "sativa", "hybrid", "cbd", "thc", "unknown"}

# Leading strain-type prefix (e.g. "Indica OG Kush" → "OG Kush")
_RE_LEADING_STRAIN = re.compile(
    r"^(Indica|Sativa|Hybrid)\s*[-:|]?\s*", re.IGNORECASE,
)


def _is_junk_deal(name: str, price: float | None) -> bool:
    """Return True if this scraped entry is promotional junk rather than a real product."""
    if not price or price <= 0:
        return True
    if not name or len(name.strip()) < 5:
        return True
    # Strain type / classification masquerading as a product name
    if name.strip().lower() in _STRAIN_ONLY_NAMES:
        return True
    if any(pat.search(name) for pat in _SALE_COPY_PATTERNS):
        return True
    if name.count("%") >= 2:
        return True
    if len(name) > 100 and re.search(r"\d+%\s*off", name, re.IGNORECASE):
        return True
    return False


def _deduplicate_name(name: str) -> str:
    """Remove repeated word sequences in a product name.

    Example: "Big Dogs Casino Kush Preroll Big Dogs Casino Kush"
           → "Big Dogs Casino Kush Preroll"
    """
    words = name.split()
    if len(words) < 4:
        return name

    # Try chunk sizes from half the word count downward
    for chunk_size in range(len(words) // 2, 1, -1):
        first_chunk = " ".join(words[:chunk_size])
        remaining = " ".join(words[chunk_size:])
        if remaining.startswith(first_chunk):
            unique_trailing = remaining[len(first_chunk):].strip()
            return f"{first_chunk} {unique_trailing}".strip() if unique_trailing else first_chunk
        if first_chunk.endswith(remaining) and len(remaining) > 8:
            return first_chunk

    return name


def _clean_product_name(name: str) -> str:
    """Strip junk text, deduplicate, and normalize whitespace in a product name."""
    if not name:
        return "Unknown"
    cleaned = _RE_NAME_JUNK.sub("", name)
    # Strip bundle/promo text ("3 For $50 …", "2/$60 …") before further cleaning
    cleaned = _RE_BUNDLE_PROMO.sub("", cleaned)
    cleaned = _RE_TRAILING_STRAIN.sub("", cleaned)
    # Strip leading strain-type prefix ("Indica OG Kush" → "OG Kush")
    cleaned = _RE_LEADING_STRAIN.sub("", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    cleaned = cleaned.strip(".,;:-|")

    # Remove common scraped artifacts
    cleaned = re.sub(r"\s*\(each\)\s*", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*\(tax included\)\s*", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^["\']+(.*?)["\']+$', r"\1", cleaned)  # surrounding quotes

    # Strip bracketed weight artifacts: "[1g]", "[3.5g]", "[100mg]"
    cleaned = re.sub(r"\s*\[\s*\d+\.?\d*\s*(?:mg|g|oz)\s*\]", "", cleaned, flags=re.IGNORECASE)

    # Deduplicate repeated word sequences
    cleaned = _deduplicate_name(cleaned)

    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    return cleaned if len(cleaned) >= 3 else name.strip()


def _normalize_for_dedup(name: str) -> str:
    """Normalize a product name into a dedup key (lowercase, no punctuation)."""
    n = name.lower().strip()
    n = re.sub(r"[^a-z0-9\s]", "", n)   # strip punctuation
    n = re.sub(r"\s+", " ", n).strip()    # collapse whitespace
    return n


def _upsert_products(
    dispensary_id: str, products: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Upsert parsed products into the products table.
    Deduplicates the batch before sending to Supabase so that no two
    rows share the same conflict key (dispensary_id, name, weight_value,
    sale_price).  PostgreSQL rejects a single INSERT … ON CONFLICT when
    the same conflict key appears twice in the VALUES list.
    Large batches are split into chunks of ``_UPSERT_CHUNK_SIZE`` rows.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    rows = []
    junk_count = 0
    for p in products:
        name = _clean_product_name(p.get("name", "Unknown"))

        # Filter out junk/promo entries before they reach the database
        if _is_junk_deal(name, p.get("sale_price")):
            logger.debug("[FILTERED] Junk deal skipped: \"%s\" at $%s", name, p.get("sale_price"))
            junk_count += 1
            continue

        # Classify product for infused/pack status
        brand = p.get("brand")
        category = p.get("category")
        classification = classify_product(name, brand, category)
        if classification["corrected_category"]:
            category = classification["corrected_category"]

        rows.append(
            {
                "dispensary_id": dispensary_id,
                "name": name,
                "brand": brand,
                "category": category,
                "original_price": p.get("original_price"),
                "sale_price": p.get("sale_price"),
                "discount_percent": p.get("discount_percent"),
                "weight_value": p.get("weight_value"),
                "weight_unit": p.get("weight_unit"),
                "thc_percent": p.get("thc_percent"),
                "cbd_percent": p.get("cbd_percent"),
                "raw_text": (p.get("raw_text") or "")[:4000],
                "deal_score": p.get("deal_score", 0),
                "product_url": p.get("product_url"),
                "is_active": True,
                "strain_type": p.get("strain_type"),
                "is_infused": classification["is_infused"],
                "product_subtype": classification["product_subtype"],
                "scraped_at": now_iso,
            }
        )

    if junk_count > 0:
        logger.info("[%s] Filtered %d junk/promo entries", dispensary_id, junk_count)

    if not rows:
        return []

    # --- Deduplicate on normalized name + weight + price ----------------
    # Normalization strips case, punctuation, and extra whitespace so
    # "Cookies Gary Payton 3.5g" == "cookies gary payton 35g" etc.
    # Later entries overwrite earlier ones (more complete data from later pages).
    original_count = len(rows)
    deduped: dict[tuple, dict[str, Any]] = {}
    for row in rows:
        key = (
            row["dispensary_id"],
            _normalize_for_dedup(row["name"]),
            row.get("weight_value"),
            row.get("sale_price"),
        )
        deduped[key] = row
    rows = list(deduped.values())

    if len(rows) < original_count:
        logger.info(
            "[%s] Deduped %d → %d products",
            dispensary_id, original_count, len(rows),
        )

    if DRY_RUN:
        logger.info("[DRY RUN] Would insert %d products for %s", len(rows), dispensary_id)
        # Return fake rows with ids so deal matching still works in logs
        return [{"id": f"dry-{i}", **r} for i, r in enumerate(rows)]

    # --- Upsert in chunks -----------------------------------------------
    # Supabase / PostgREST can choke on very large payloads; chunking
    # keeps each request well under the payload limit.
    all_results: list[dict[str, Any]] = []
    for i in range(0, len(rows), _UPSERT_CHUNK_SIZE):
        chunk = rows[i : i + _UPSERT_CHUNK_SIZE]
        try:
            result = (
                db.table("products")
                .upsert(chunk, on_conflict="dispensary_id,name,weight_value,sale_price")
                .execute()
            )
        except Exception as exc:
            # Handle PGRST204 "column not found in schema cache" — strip
            # the offending column and retry so a missing migration doesn't
            # crash the entire scrape run.
            err_msg = str(exc)
            if "PGRST204" in err_msg and "column" in err_msg:
                import re as _re
                col_match = _re.search(r"'(\w+)' column", err_msg)
                bad_col = col_match.group(1) if col_match else None
                if bad_col:
                    logger.warning(
                        "[%s] Column '%s' missing from DB — stripping and retrying",
                        dispensary_id, bad_col,
                    )
                    chunk = [{k: v for k, v in row.items() if k != bad_col} for row in chunk]
                    result = (
                        db.table("products")
                        .upsert(chunk, on_conflict="dispensary_id,name,weight_value,sale_price")
                        .execute()
                    )
                else:
                    raise
            else:
                raise
        all_results.extend(result.data)
        if len(rows) > _UPSERT_CHUNK_SIZE:
            logger.info(
                "[%s] Upserted chunk %d–%d of %d",
                dispensary_id, i + 1, i + len(chunk), len(rows),
            )

    return all_results


def _insert_deals(
    dispensary_id: str,
    deals: list[dict[str, Any]],
    product_rows: list[dict[str, Any]],
) -> int:
    """Insert qualifying deals into the deals table."""
    # Build lookup: (name, sale_price) -> product_id
    product_lookup: dict[tuple[str, float | None], str] = {}
    for pr in product_rows:
        key = (pr["name"], pr.get("sale_price"))
        product_lookup[key] = pr["id"]

    deal_rows = []
    skipped = 0
    for d in deals:
        key = (d.get("name", ""), d.get("sale_price"))
        product_id = product_lookup.get(key)
        if not product_id:
            logger.warning("No product match for deal: %s @ $%s", d.get("name"), d.get("sale_price"))
            skipped += 1
            continue
        deal_rows.append(
            {
                "product_id": product_id,
                "dispensary_id": dispensary_id,
                "deal_score": int(round(d["deal_score"])),
            }
        )

    if skipped > 0:
        logger.warning("[%s] %d deals skipped (no product match)", dispensary_id, skipped)

    if not deal_rows:
        return 0

    if DRY_RUN:
        logger.info("[DRY RUN] Would insert %d deals for %s", len(deal_rows), dispensary_id)
        return len(deal_rows)

    db.table("deals").insert(deal_rows).execute()
    return len(deal_rows)


# ---------------------------------------------------------------------------
# Per-site scrape with retry
# ---------------------------------------------------------------------------


_SITE_TIMEOUT_SEC = SITE_TIMEOUT_SEC  # 600 s (from config)
_MAX_RETRIES = 2
_RETRY_DELAY_SEC = 5


def _split_weight(weight_str: str | None) -> tuple[float | None, str | None]:
    """Split CloudedLogic weight string into (value, unit) for DB schema.

    '3.5g' → (3.5, 'g'),  '100mg' → (100.0, 'mg'),  None → (None, None)
    """
    if not weight_str:
        return None, None
    for unit in ("mg", "g"):
        if weight_str.lower().endswith(unit):
            try:
                return float(weight_str[: -len(unit)]), unit
            except ValueError:
                pass
    return None, None


async def _scrape_site_inner(
    dispensary: dict[str, Any],
    *,
    browser: Any = None,
) -> dict[str, Any]:
    """Core scrape logic for a single site (no timeout wrapper).

    If *browser* is provided, passes it to the scraper so it reuses the
    shared Chromium instance instead of launching a new one.
    """
    slug = dispensary["slug"]
    platform = dispensary["platform"]
    scraper_cls = SCRAPER_MAP.get(platform)

    if scraper_cls is None:
        return {"slug": slug, "error": f"Unknown platform: {platform}"}

    async with scraper_cls(dispensary, browser=browser) as scraper:
        raw_products = await scraper.scrape()

    # Parse all raw products using CloudedLogic (single source of truth)
    logic = CloudedLogic()
    parsed: list[dict[str, Any]] = []

    for rp in raw_products:
        # Clean raw inputs before CloudedLogic parsing
        raw_name = _clean_product_name(rp.get("name", ""))
        raw_text = rp.get("raw_text", "")
        price_text = rp.get("price", "")
        text = f"{raw_name} {raw_text} {price_text}"
        product = logic.parse_product(text, dispensary["name"])
        if product is None:
            continue

        weight_value, weight_unit = _split_weight(product.get("weight"))

        # --- Build a clean display name from the scraper's raw_name ------
        # CloudedLogic's product_name is derived from the full combined text
        # blob (name + raw_text + price), which is often messy and causes
        # brand name duplication.  Instead, use raw_name as the base and
        # strip the brand prefix from it.
        brand = product.get("brand")
        display_name = raw_name
        if brand and display_name:
            display_name = re.sub(
                rf'^{re.escape(brand)}\s*[-:|]?\s*',
                '', display_name, flags=re.IGNORECASE,
            ).strip()
            if len(display_name) < 3:
                display_name = raw_name
        display_name = display_name or raw_name or "Unknown"

        # Map CloudedLogic output to the DB schema expected by _upsert_products
        enriched: dict[str, Any] = {
            **rp,
            "name": display_name,
            "brand": brand,
            "category": product.get("category"),
            "original_price": product.get("original_price"),
            "sale_price": product.get("deal_price"),
            "discount_percent": product.get("discount_percent"),
            "weight_value": weight_value,
            "weight_unit": weight_unit,
            "thc_percent": product.get("thc_percent"),
            "cbd_percent": None,
            "raw_text": rp.get("raw_text", ""),
            "dispensary_id": slug,
        }
        parsed.append(enriched)

    # --- Deal detection pipeline (hard filter → score → top-100 select) ---
    # detect_deals returns only the curated top deals with deal_score set.
    # All other products default to deal_score = 0.
    deals = detect_deals(parsed)
    report_data = get_last_report_data()

    # Write deal_score back onto parsed products so it's upserted into the
    # products table (the frontend reads deal_score from products directly).
    deal_score_lookup: dict[tuple[str, float | None], int] = {
        (d.get("name", ""), d.get("sale_price")): d["deal_score"]
        for d in deals
    }
    for p in parsed:
        key = (p.get("name", ""), p.get("sale_price"))
        p["deal_score"] = deal_score_lookup.get(key, 0)

    # Insert to DB
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
        "_report_data": report_data,
    }


async def scrape_site(
    dispensary: dict[str, Any],
    *,
    browser: Any = None,
) -> dict[str, Any]:
    """Scrape a single dispensary with timeout and retry."""
    slug = dispensary["slug"]

    for attempt in range(1, _MAX_RETRIES + 1):
        logger.info(
            "[%s] Starting scrape (%s) — attempt %d/%d",
            slug, dispensary["platform"], attempt, _MAX_RETRIES,
        )
        try:
            result = await asyncio.wait_for(
                _scrape_site_inner(dispensary, browser=browser),
                timeout=_SITE_TIMEOUT_SEC,
            )
            # Success — return immediately
            return result
        except asyncio.TimeoutError:
            logger.error("[%s] Timed out after %ds (attempt %d)", slug, _SITE_TIMEOUT_SEC, attempt)
            if attempt < _MAX_RETRIES:
                logger.info("[%s] Retrying in %ds...", slug, _RETRY_DELAY_SEC)
                await asyncio.sleep(_RETRY_DELAY_SEC)
        except Exception as exc:
            logger.error("[%s] Failed (attempt %d): %s", slug, attempt, exc, exc_info=True)
            if attempt < _MAX_RETRIES:
                logger.info("[%s] Retrying in %ds...", slug, _RETRY_DELAY_SEC)
                await asyncio.sleep(_RETRY_DELAY_SEC)

    # All attempts exhausted
    return {"slug": slug, "error": f"Failed after {_MAX_RETRIES} attempts"}


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


def _get_active_dispensaries(slug_filter: str | None = None) -> list[dict]:
    """Return dispensary configs to scrape."""
    if slug_filter:
        return [d for d in DISPENSARIES if d["slug"] == slug_filter]

    # Filter by is_active from config first
    active = [d for d in DISPENSARIES if d.get("is_active", True)]

    if LIMIT_DISPENSARIES:
        # Pick 1 per platform for quick testing
        picked: list[dict] = []
        seen_platforms: set[str] = set()
        for d in active:
            if d["platform"] not in seen_platforms:
                picked.append(d)
                seen_platforms.add(d["platform"])
            if len(picked) >= 3:
                break
        logger.info(
            "TEST MODE: Limited to %d dispensaries (%s)",
            len(picked),
            ", ".join(d["slug"] for d in picked),
        )
        return picked

    if DRY_RUN:
        # In dry run, just use the config list — don't query DB
        return active

    # Fetch active slugs from Supabase so the admin can disable sites.
    result = (
        db.table("dispensaries")
        .select("id")
        .eq("is_active", True)
        .execute()
    )
    active_slugs = {row["id"] for row in result.data}

    # If the DB has no dispensary rows yet, fall back to the config list.
    if not active_slugs:
        logger.warning("No dispensaries in DB — using config list")
        return active

    return [d for d in active if d["slug"] in active_slugs]


def _already_scraped_today() -> bool:
    """Check if a completed scrape run already exists for today (UTC)."""
    if DRY_RUN:
        return False
    today_start = (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    result = (
        db.table("scrape_runs")
        .select("id")
        .eq("status", "completed")
        .gte("started_at", today_start)
        .limit(1)
        .execute()
    )
    return bool(result.data)


async def run(slug_filter: str | None = None) -> None:
    """Run the full scrape pipeline."""
    start = time.time()

    # Idempotency: skip if already scraped today (unless FORCE_RUN is set).
    if not FORCE_RUN and _already_scraped_today():
        logger.info("Already scraped today, skipping")
        return

    logger.info("=" * 60)
    logger.info("CloudedDeals Scraper Starting")
    logger.info("  DRY_RUN:    %s", DRY_RUN)
    logger.info("  LIMITED:    %s", LIMIT_DISPENSARIES)
    logger.info("  FORCE_RUN:  %s", FORCE_RUN)
    logger.info("  SINGLE:     %s", slug_filter or "(all)")
    logger.info("=" * 60)

    _seed_dispensaries()

    # Deactivate previous day's deals before scraping fresh ones
    _deactivate_old_deals()

    dispensaries = _get_active_dispensaries(slug_filter)
    if not dispensaries:
        logger.error("No dispensaries to scrape")
        return

    concurrency = SCRAPE_CONCURRENCY
    logger.info(
        "Scraping %d dispensaries (concurrency=%d)",
        len(dispensaries), concurrency,
    )
    run_id = _create_run()

    sites_scraped: list[str] = []
    sites_failed: list[dict[str, str]] = []
    total_products = 0
    total_deals = 0

    # Launch ONE shared browser for all concurrent scrapers
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=BROWSER_ARGS + [
            "--disable-gpu",
            "--disable-extensions",
            "--disable-background-timer-throttling",
        ],
    )
    logger.info("Shared browser launched — dispatching %d sites", len(dispensaries))

    semaphore = asyncio.Semaphore(concurrency)

    async def _bounded_scrape(dispensary: dict[str, Any]) -> dict[str, Any]:
        """Scrape a single site, bounded by the semaphore."""
        async with semaphore:
            site_start = time.time()
            logger.info("[START] %s (%s)", dispensary["name"], dispensary["platform"])
            result = await scrape_site(dispensary, browser=browser)
            elapsed_s = time.time() - site_start
            label = "DONE" if not result.get("error") else "FAIL"
            logger.info(
                "[%s]  %s — %.1fs — %d products",
                label, dispensary["name"], elapsed_s,
                result.get("products", 0),
            )
            return result

    # Run all sites concurrently (bounded by semaphore)
    results = await asyncio.gather(
        *[_bounded_scrape(d) for d in dispensaries],
        return_exceptions=True,
    )

    # Close shared browser
    await browser.close()
    await pw.stop()

    # Process results
    all_top_deals: list[dict[str, Any]] = []
    all_cut_deals: list[dict[str, Any]] = []

    for result in results:
        if isinstance(result, Exception):
            logger.error("Unhandled exception: %s", result)
            sites_failed.append({"slug": "unknown", "error": str(result)})
            continue
        if result.get("error"):
            sites_failed.append(
                {"slug": result["slug"], "error": result["error"]}
            )
        else:
            sites_scraped.append(result["slug"])
            total_products += result.get("products", 0)
            total_deals += result.get("deals", 0)
            # Collect report data
            rd = result.get("_report_data", {})
            all_top_deals.extend(rd.get("top_deals", []))
            all_cut_deals.extend(rd.get("cut_deals", []))

    # Determine final status
    if not sites_failed:
        status = "completed"
    elif sites_scraped:
        status = "completed_with_errors"
    else:
        status = "failed"

    elapsed = time.time() - start

    _complete_run(
        run_id,
        status=status,
        total_products=total_products,
        qualifying_deals=total_deals,
        sites_scraped=sites_scraped,
        sites_failed=sites_failed,
        runtime_seconds=int(elapsed),
    )

    logger.info("=" * 60)
    logger.info("SCRAPE COMPLETE")
    logger.info("  Status:     %s", status)
    logger.info("  Products:   %d", total_products)
    logger.info("  Deals:      %d", total_deals)
    logger.info("  Sites OK:   %d/%d", len(sites_scraped), len(dispensaries))
    logger.info("  Duration:   %.1f min", elapsed / 60)
    if sites_failed:
        logger.info("  Failed:")
        for f in sites_failed:
            logger.info("    - %s: %s", f["slug"], f["error"])
    logger.info("=" * 60)

    # ─── Daily Metrics (pipeline quality tracking) ───────────────
    collect_daily_metrics(
        db,
        all_top_deals,
        run_id=run_id,
        total_products=total_products,
        sites_scraped=len(sites_scraped),
        sites_failed=len(sites_failed),
        runtime_seconds=int(elapsed),
        dry_run=DRY_RUN,
    )

    # ─── Detailed Deal Report ─────────────────────────────────────
    _log_deal_report(all_top_deals, all_cut_deals)


def _log_deal_report(
    top_deals: list[dict[str, Any]],
    cut_deals: list[dict[str, Any]],
) -> None:
    """Log a detailed deal report: top 3 per category + 10 cut deals."""
    if not top_deals and not cut_deals:
        return

    logger.info("")
    logger.info("=" * 60)
    logger.info("DEAL REPORT — Human Review Summary")
    logger.info("=" * 60)

    # --- Top 3 included deals per category ---
    from collections import defaultdict

    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for d in top_deals:
        cat = d.get("category", "other")
        by_cat[cat].append(d)

    cat_order = ["flower", "vape", "edible", "concentrate", "preroll", "other"]
    for cat in cat_order:
        deals = by_cat.get(cat, [])
        if not deals:
            continue
        deals.sort(key=lambda x: x.get("deal_score", 0), reverse=True)
        logger.info("")
        logger.info("  [%s] %d deals included — Top 3:", cat.upper(), len(deals))
        for i, d in enumerate(deals[:3], 1):
            name = d.get("name", "?")[:50]
            brand = d.get("brand") or "?"
            price = d.get("sale_price") or 0
            orig = d.get("original_price") or 0
            score = d.get("deal_score", 0)
            disp = d.get("dispensary_id") or d.get("dispensary") or "?"
            pct = d.get("discount_percent") or 0
            logger.info(
                "    %d. [%d pts] %s — %s | $%.0f (was $%.0f, %d%% off) @ %s",
                i, score, brand, name, price, orig, pct, disp,
            )

    # --- 10 highest-scored cut deals (qualified but not selected) ---
    if cut_deals:
        cut_deals.sort(key=lambda x: x.get("deal_score", 0), reverse=True)
        logger.info("")
        logger.info("  CUT DEALS (scored but not shown) — Top 10 of %d:", len(cut_deals))
        for i, d in enumerate(cut_deals[:10], 1):
            name = d.get("name", "?")[:50]
            brand = d.get("brand") or "?"
            price = d.get("sale_price") or 0
            score = d.get("deal_score", 0)
            cat = d.get("category", "?")
            disp = d.get("dispensary_id") or d.get("dispensary") or "?"
            pct = d.get("discount_percent") or 0
            logger.info(
                "    %d. [%d pts] %s — %s | $%.0f (%d%% off) [%s] @ %s",
                i, score, brand, name, price, pct, cat, disp,
            )
    else:
        logger.info("")
        logger.info("  No cut deals (all scored deals were selected)")

    logger.info("")
    logger.info("=" * 60)


if __name__ == "__main__":
    slug_arg = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(run(slug_arg))
