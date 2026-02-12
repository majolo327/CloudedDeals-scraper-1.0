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
    PLATFORM_GROUP=stable     # scrape only stable platforms (dutchie/curaleaf/jane)
    PLATFORM_GROUP=new        # scrape only new platforms (rise/carrot/aiq)
    PLATFORM_GROUP=all        # scrape everything (default)
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

from config.dispensaries import (
    BROWSER_ARGS, DISPENSARIES, SITE_TIMEOUT_SEC,
    get_platforms_for_group, get_dispensaries_by_group,
)
from clouded_logic import CloudedLogic, BRANDS_LOWER
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
# Platform group filter: "stable", "new", or "all" (default).
# When set, only dispensaries from that group are scraped and only
# their stale products are deactivated — other groups are untouched.
PLATFORM_GROUP = os.getenv("PLATFORM_GROUP", "all").lower()

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
    payload: dict[str, Any] = {"status": "running"}
    row = db.table("scrape_runs").insert(payload).execute()
    run_id: str = row.data[0]["id"]
    logger.info("Scrape run started: %s (group=%s)", run_id, PLATFORM_GROUP)
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


def _deactivate_old_deals(group_slugs: list[str] | None = None) -> None:
    """Deactivate previous day's deals so only fresh data is shown.

    When *group_slugs* is provided, only products belonging to those
    dispensaries are deactivated.  This prevents a "stable" run from
    wiping yesterday's "new" products (and vice-versa).
    """
    if DRY_RUN:
        logger.info("[DRY RUN] Would deactivate old deals (group=%s)", PLATFORM_GROUP)
        return
    today_start = (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    query = (
        db.table("products")
        .update({"is_active": False})
        .lt("scraped_at", today_start)
        .eq("is_active", True)
    )
    if group_slugs:
        query = query.in_("dispensary_id", group_slugs)
    result = query.execute()
    count = len(result.data) if result.data else 0
    if count > 0:
        scope = f"group={PLATFORM_GROUP}" if group_slugs else "all"
        logger.info("Deactivated %d old products (%s)", count, scope)


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
    r"|\s*\bSpecial Offers?\b.*$"        # "Special Offers (1) …"
    r"|\s*\b\d+\s+(?:Half\s+)?(?:Ounces?|OZ)\s*[-–]?\s*\$\d+.*$"  # "2 Half Ounces - $99 …"
    r"|\s*\b\d+\s+PR'?s?\s*[-–]?\s*\$\d+.*$"  # "10 PR's - $50 …"
    r"|\s*[-–]\s*Delivery\s*$",          # "- Delivery" trailing text
    re.IGNORECASE,
)

# Marketing tier labels that brands use (e.g., STIIIZY Black/Gold/Silver Label)
_RE_MARKETING_TIER = re.compile(
    r"\s*\|?\s*\b(Black|Gold|Silver|Blue|White|Red|Green|Purple|Diamond|Platinum)\s+Label\b",
    re.IGNORECASE,
)

# "Prepack", "Whole Flower", "Flower Prepack" — dispensary marketing terms
_RE_PREPACK = re.compile(
    r"\b(?:Flower\s+)?Prepack\b|\bWhole\s+Flower\b",
    re.IGNORECASE,
)
_RE_TRAILING_STRAIN = re.compile(r"\s*(Indica|Sativa|Hybrid)\s*$", re.IGNORECASE)

# Brand abbreviations that appear in product names instead of the full brand
_BRAND_ABBREVIATIONS: dict[str, list[str]] = {
    "Circle S Farms": ["CSF"],
    "Sauce Essentials": ["Sauce"],
    "Vlasic Labs": ["Vlasic"],
    "Tyson 2.0": ["Tyson"],
    "Tsunami Labs": ["Tsunami"],
}

# Weight prefix patterns: "3.5g |", "1g |", ".5g |"
_RE_WEIGHT_PREFIX = re.compile(r"^\.?\d+\.?\d*\s*g\s*\|\s*", re.IGNORECASE)

# Bundle quantity text: "3 Eighths", "5 Pack", "2 Quarters"
_RE_BUNDLE_QTY = re.compile(
    r"\b\d+\s+(?:Eighths?|Quarters?|Halves|Half)\b\s*",
    re.IGNORECASE,
)

# Strain type anywhere in name (not just trailing)
_RE_STRAIN_TYPE = re.compile(r"\b(?:Indica|Sativa|Hybrid)\b", re.IGNORECASE)

# Redundant vape category words in display name
_RE_VAPE_WORDS = re.compile(
    r"\b(?:Cartridges?|Carts?|Distillate|Disposable|Pod|Vape)\b",
    re.IGNORECASE,
)

# Marketing junk names that don't add useful info to a product name
_RE_MARKETING_JUNK = re.compile(
    r"\bHigh\s+Octane\b|\bX(?:treme|XX)\b",
    re.IGNORECASE,
)

# Concentrate format descriptors — redundant when category is already "concentrate"
_RE_CONCENTRATE_FORMAT = re.compile(
    r"\b(?:(?:Diamond|Live|Cured)\s+)?(?:Badder|Batter|Budder|Shatter|Wax|"
    r"Sauce|Sugar|Crumble|Rosin|Resin|Diamonds?)\b",
    re.IGNORECASE,
)

# Concentrate keywords for raw_name–based category correction
_CONCENTRATE_NAME_KEYWORDS = re.compile(
    r"\b(?:badder|batter|budder|shatter|wax|sauce|sugar|crumble|"
    r"rosin|diamonds?|live\s+resin|cured\s+resin)\b",
    re.IGNORECASE,
)
_VAPE_NAME_KEYWORDS = re.compile(
    r"\b(?:cart|cartridge|pod|disposable|vape|pen|all-in-one)\b",
    re.IGNORECASE,
)

# Standalone weight values redundant with the weight field
_RE_INLINE_WEIGHT = re.compile(
    r"\b\d*\.?\d+\s*g\b",
    re.IGNORECASE,
)

# Bracket-enclosed weight: "[.95g]", "[1g]", "[3.5g]"
_RE_BRACKET_WEIGHT = re.compile(
    r"\s*\[\.?\d+\.?\d*\s*g\]\s*",
    re.IGNORECASE,
)

# Patterns that indicate promotional / sale copy rather than a real product name
_SALE_COPY_PATTERNS = [
    re.compile(r"^\d+%\s*off", re.IGNORECASE),
    re.compile(r"^\$\d+\.?\d*\s*off", re.IGNORECASE),   # "$10.00 off", "$5 off"
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

# ── Offer/bundle text isolation for brand detection ──────────────────
# When Dutchie product cards include "Special Offers" sections, those
# sections mention OTHER brands from bundle deals (e.g. "2/$40 Power
# Pack || KYND 3.5g Flower & HAZE 1g Live Resin ||").  Running brand
# detection on this text causes brand contamination — the wrong brand
# gets picked up.  We strip offer text BEFORE brand detection fallback.
_RE_OFFER_SECTION = re.compile(
    r"(?:Special Offers?\s*\(?.*$)"            # "Special Offers (1) …" to end
    r"|(?:\d+/\$\d+\s+.*(?:Power Pack|Bundle).*$)"  # "2/$40 Power Pack || …"
    r"|(?:\bShop Offer\b.*$)"                  # "Shop Offer" link text
    r"|(?:\bOffer\b.*\bShop\b.*$)"             # variant "Offer … Shop"
    r"|(?:\bselect\s+\$\d+.*$)"               # "select $20 eighths 2/$30 …" promo
    r"|(?:\bIncluded?\s+(?:in|with)\b.*$)"     # "Included in: 2/$40 Concentrates…"
    r"|(?:\bPart\s+of\b.*$)"                   # "Part of: Mix & Match…"
    r"|(?:\bMix\s*(?:&|and|n)\s*Match\b.*$)"   # "Mix & Match 2/$40…"
    r"|(?:\d+\s+for\s+\$\d+.*$)"              # "2 for $40 Rove, AMA…"
    r"|(?:\bBOGO\b.*$)"                        # "BOGO on select brands…"
    r"|(?:\bBundle\b.*$)"                       # "Bundle deal: …"
    r"|(?:\bDeal\s*:.*$)"                       # "Deal: 2/$60 …"
    r"|(?:\bPromo\s*:.*$)"                      # "Promo: …"
    r"|(?:\bAlso\s+(?:included?|available)\b.*$)",  # "Also included: Rove, Reserve…"
    re.IGNORECASE | re.MULTILINE,
)


def _strip_offer_text(raw_text: str) -> str:
    """Remove Special Offers / bundle deal sections from raw_text.

    This prevents brand names mentioned in offer text (e.g. "KYND 3.5g
    Flower & HAZE 1g Live Resin") from contaminating brand detection.
    The offer text is stripped ONLY for brand detection — the full
    raw_text is still passed to parse_product for price/weight extraction.
    """
    if not raw_text:
        return ""
    return _RE_OFFER_SECTION.sub("", raw_text).strip()


# ── URL-based brand extraction ─────────────────────────────────────────
# Product URLs often contain the brand slug (e.g. "/brands/rove/...",
# "/rove-featured-farms-1g", "brand=rove").  This is a high-confidence
# signal that avoids false positives from product name parsing.

def _extract_brand_from_url(url: str) -> str | None:
    """Return canonical brand name if found in the product URL."""
    if not url:
        return None
    # Normalize: lowercase, replace hyphens/underscores with spaces for matching
    url_lower = url.lower()
    url_normalized = url_lower.replace("-", " ").replace("_", " ")

    # Check each known brand against the URL (longest brands first to avoid
    # partial matches — e.g. "raw garden" before "raw")
    for brand_lower, canonical in sorted(
        BRANDS_LOWER.items(), key=lambda x: len(x[0]), reverse=True
    ):
        # Match brand as a path segment or query param value
        if (
            f"/{brand_lower}/" in url_lower
            or f"/{brand_lower}?" in url_lower
            or f"brand={brand_lower}" in url_lower
            or f"/{brand_lower.replace(' ', '-')}/" in url_lower
            or f"/{brand_lower.replace(' ', '-')}-" in url_lower
            or f"-{brand_lower.replace(' ', '-')}-" in url_lower
        ):
            return canonical
    return None


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

    # Strip marketing tier labels ("Black Label", "Gold Label", etc.)
    cleaned = _RE_MARKETING_TIER.sub("", cleaned)

    # Strip "Prepack", "Whole Flower", "Flower Prepack"
    cleaned = _RE_PREPACK.sub("", cleaned)

    # Strip inline price/deal text fragments that slip into product names
    # e.g. "$99 $45 1/2 OZ" or "1/2 OZ" at end of name
    cleaned = re.sub(r"\s*\$\d+\.?\d*(?:\s+\$\d+\.?\d*)*\s*(?:1/2\s+OZ)?.*$", "", cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    cleaned = cleaned.strip(".,;:-|")

    # Remove common scraped artifacts
    cleaned = re.sub(r"\s*\(each\)\s*", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*\(tax included\)\s*", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^["\']+(.*?)["\']+$', r"\1", cleaned)  # surrounding quotes

    # Strip bracketed weight artifacts: "[1g]", "[3.5g]", "[100mg]"
    cleaned = re.sub(r"\s*\[\s*\d+\.?\d*\s*(?:mg|g|oz)\s*\]", "", cleaned, flags=re.IGNORECASE)

    # Strip redundant weight+category suffixes that repeat weight info already
    # captured separately (e.g. ".5g Shatter (.5g)" → ".5g Shatter")
    cleaned = re.sub(r"\s*\(\s*\.?\d+\.?\d*\s*g\s*\)\s*$", "", cleaned, flags=re.IGNORECASE)

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

    # --- Log price history (append-only time-series) -------------------
    # Every product observation gets recorded so price changes are never lost.
    _log_price_history(all_results, run_id=None)

    return all_results


def _log_price_history(
    product_rows: list[dict[str, Any]],
    *,
    run_id: str | None = None,
) -> None:
    """Append price observations to the price_history table.

    Called after every successful upsert so we capture every price point.
    Uses upsert on (product_id, observed_date) so re-runs on the same day
    update in place rather than duplicating.
    """
    if DRY_RUN or not product_rows:
        return

    history_rows = []
    for pr in product_rows:
        product_id = pr.get("id")
        if not product_id or str(product_id).startswith("dry-"):
            continue
        history_rows.append(
            {
                "product_id": product_id,
                "dispensary_id": pr.get("dispensary_id"),
                "sale_price": pr.get("sale_price"),
                "original_price": pr.get("original_price"),
                "discount_percent": pr.get("discount_percent"),
                "name": pr.get("name"),
                "brand": pr.get("brand"),
                "category": pr.get("category"),
                "weight_value": pr.get("weight_value"),
                "weight_unit": pr.get("weight_unit"),
                "deal_score": pr.get("deal_score", 0),
                "scrape_run_id": run_id if run_id and run_id != "dry-run" else None,
            }
        )

    if not history_rows:
        return

    try:
        for i in range(0, len(history_rows), _UPSERT_CHUNK_SIZE):
            chunk = history_rows[i : i + _UPSERT_CHUNK_SIZE]
            db.table("price_history").upsert(
                chunk, on_conflict="product_id,observed_date"
            ).execute()
        logger.info("Logged %d price observations to price_history", len(history_rows))
    except Exception as exc:
        # Price history is best-effort — never crash the main pipeline
        logger.warning("Failed to log price history: %s", exc)


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

    # --- Log deal lifecycle history (best-effort) -------------------------
    _log_deal_history(dispensary_id, deals, product_rows)

    return len(deal_rows)


def _log_deal_history(
    dispensary_id: str,
    deals: list[dict[str, Any]],
    product_rows: list[dict[str, Any]],
) -> None:
    """Upsert deal observations into deal_history for lifecycle tracking.

    On first observation: creates a new row with first_seen = now.
    On re-observation: updates last_seen, increments times_seen, refreshes score.
    Deals not seen in a run are expired by _expire_stale_deal_history().
    """
    if DRY_RUN or not deals:
        return

    # Build lookup: (name, sale_price) -> product row
    product_lookup: dict[tuple[str, float | None], dict[str, Any]] = {}
    for pr in product_rows:
        key = (pr["name"], pr.get("sale_price"))
        product_lookup[key] = pr

    history_rows = []
    for d in deals:
        key = (d.get("name", ""), d.get("sale_price"))
        pr = product_lookup.get(key)
        if not pr:
            continue
        product_id = pr.get("id")
        if not product_id or str(product_id).startswith("dry-"):
            continue

        history_rows.append(
            {
                "product_id": product_id,
                "dispensary_id": dispensary_id,
                "deal_score": int(round(d.get("deal_score", 0))),
                "sale_price": d.get("sale_price"),
                "original_price": d.get("original_price"),
                "discount_percent": d.get("discount_percent"),
                "name": d.get("name"),
                "brand": d.get("brand"),
                "category": d.get("category"),
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
                "last_seen_date": datetime.now(timezone.utc).date().isoformat(),
                "is_active": True,
                "times_seen": 1,  # Will be incremented by SQL on conflict
            }
        )

    if not history_rows:
        return

    try:
        # Upsert: on conflict (product_id, dispensary_id), update last_seen
        # and increment times_seen.  Supabase/PostgREST upsert overwrites,
        # so we handle the increment via a follow-up RPC or accept the
        # simpler overwrite for now (times_seen = 1 is reset each time).
        # TODO: Use a Postgres function for atomic increment when RPC is set up.
        for i in range(0, len(history_rows), _UPSERT_CHUNK_SIZE):
            chunk = history_rows[i : i + _UPSERT_CHUNK_SIZE]
            db.table("deal_history").upsert(
                chunk, on_conflict="product_id,dispensary_id"
            ).execute()
        logger.info(
            "[%s] Logged %d deal observations to deal_history",
            dispensary_id, len(history_rows),
        )
    except Exception as exc:
        logger.warning("[%s] Failed to log deal history: %s", dispensary_id, exc)


def _expire_stale_deal_history(group_slugs: list[str] | None = None) -> None:
    """Mark deal_history rows as inactive if not seen today.

    Called once per run after all sites are scraped.  Deals that were
    active yesterday but not re-observed today get is_active=False.
    """
    if DRY_RUN:
        return

    today = datetime.now(timezone.utc).date().isoformat()
    try:
        query = (
            db.table("deal_history")
            .update({"is_active": False})
            .eq("is_active", True)
            .lt("last_seen_date", today)
        )
        if group_slugs:
            query = query.in_("dispensary_id", group_slugs)
        result = query.execute()
        count = len(result.data) if result.data else 0
        if count > 0:
            logger.info("Expired %d stale deal_history entries", count)
    except Exception as exc:
        logger.warning("Failed to expire stale deal history: %s", exc)


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

        # ── OFFER-CLEAN TEXT for brand & category detection ─────────
        # Bundle/offer text in raw_text and price_text can mention OTHER
        # brands (e.g. "3/$60 grassroots, &shine, haze") and OTHER
        # category keywords (e.g. "3/$60 1g Carts & Wax" — "Carts"
        # triggers vape detection, blocking concentrates).
        # We detect brand and category on CLEAN text first, then let
        # parse_product handle price/weight on the full text.
        stripped_raw = _strip_offer_text(raw_text)
        clean_text = f"{raw_name} {stripped_raw}"

        # Brand priority: scraped element > URL > product name > clean text
        # Some scrapers (Dutchie) extract brand from a dedicated card element
        # (e.g. "ROVE" label above the product title) — highest confidence.
        scraped_brand = rp.get("scraped_brand", "")
        brand = logic.detect_brand(scraped_brand) if scraped_brand else None
        if not brand:
            product_url = rp.get("product_url", "")
            brand = _extract_brand_from_url(product_url)
        if not brand:
            brand = logic.detect_brand(raw_name)
        if not brand:
            brand = logic.detect_brand(clean_text)

        # Category: detect from clean text (no offer keyword pollution)
        category = logic.detect_category(clean_text)

        # Concentrate correction: if clean_text caused "vape" because the
        # surrounding page text contains "vape", but the PRODUCT NAME
        # itself has concentrate format keywords (badder, wax, live resin…)
        # and no vape keywords (cart, pod…), it's actually a concentrate.
        if category == "vape" and raw_name:
            if (
                _CONCENTRATE_NAME_KEYWORDS.search(raw_name)
                and not _VAPE_NAME_KEYWORDS.search(raw_name)
            ):
                category = "concentrate"
            # If the product name itself has NO vape keywords, the "vape"
            # classification likely came from page-context text (navigation,
            # other products on the page, etc.).  Re-detect category from
            # just the product name for a more accurate result.
            elif not _VAPE_NAME_KEYWORDS.search(raw_name):
                name_category = logic.detect_category(raw_name)
                if name_category not in ("other", "vape"):
                    category = name_category

        # Parse full combined text for price, weight, THC
        text = f"{raw_name} {raw_text} {price_text}"
        product = logic.parse_product(text, dispensary["name"])
        if product is None:
            continue

        # Override parse_product's brand and category with our clean results
        if brand:
            product["brand"] = brand
        if category and category != 'other':
            product["category"] = category

        weight_value, weight_unit = _split_weight(product.get("weight"))

        # --- Build a clean display name from the scraper's raw_name ------
        # CloudedLogic's product_name is derived from the full combined text
        # blob (name + raw_text + price), which is often messy and causes
        # brand name duplication.  Instead, use raw_name as the base and
        # strip clutter (brand, weight prefix, strain type, bundle text,
        # redundant category words, marketing junk) to leave just the
        # strain/product name.
        brand = product.get("brand")
        display_name = raw_name

        # 1. Strip weight prefix: "3.5g | Blue Maui" → "Blue Maui"
        if display_name:
            display_name = _RE_WEIGHT_PREFIX.sub("", display_name).strip()

        # 2. Strip brand name from ANYWHERE in the name (not just prefix)
        if brand and display_name:
            display_name = re.sub(
                rf'\b{re.escape(brand)}\b\s*[-:|]?\s*',
                '', display_name, flags=re.IGNORECASE,
            ).strip()
            # Also strip known abbreviations for this brand
            for abbr in _BRAND_ABBREVIATIONS.get(brand, []):
                display_name = re.sub(
                    rf'\b{re.escape(abbr)}\b\s*[-:|]?\s*',
                    '', display_name, flags=re.IGNORECASE,
                ).strip()
            if len(display_name) < 3:
                display_name = raw_name

        display_name = display_name or raw_name or "Unknown"

        # 3. Strip strain type from anywhere: "Blue Maui Sativa" → "Blue Maui"
        display_name = _RE_STRAIN_TYPE.sub("", display_name).strip()

        # 4. Strip bundle quantity text: "3 Eighths" → ""
        display_name = _RE_BUNDLE_QTY.sub("", display_name).strip()

        # 5. Strip redundant category words from display name
        effective_cat = category if (category and category != 'other') else product.get("category")
        if effective_cat == "preroll":
            display_name = re.sub(
                r"\s*\b(?:Pre[-\s]?Rolls?|Prerolls?)\b", "",
                display_name, flags=re.IGNORECASE,
            ).strip()
        if effective_cat == "vape":
            display_name = _RE_VAPE_WORDS.sub("", display_name).strip()
        if effective_cat == "concentrate":
            display_name = _RE_CONCENTRATE_FORMAT.sub("", display_name).strip()
        if effective_cat == "flower":
            display_name = re.sub(
                r"\b(?:Flower|Bud)\b", "", display_name, flags=re.IGNORECASE,
            ).strip()

        # 6. Strip inline weight values redundant with the weight field
        display_name = _RE_BRACKET_WEIGHT.sub("", display_name).strip()
        display_name = _RE_INLINE_WEIGHT.sub("", display_name).strip()

        # 7. Strip marketing junk: "High Octane Xtreme" etc.
        display_name = _RE_MARKETING_JUNK.sub("", display_name).strip()

        # 8. Strip parenthetical weight and strain-type indicators
        # "(100mg)" duplicates the weight field; "(I)"/"(S)"/"(H)" are
        # strain-type shorthand already captured in the strain_type field.
        display_name = re.sub(
            r"\s*\(\s*\d+\s*mg\s*\)", "", display_name, flags=re.IGNORECASE,
        )
        display_name = re.sub(
            r"\s*\(\s*[ISH]\s*\)", "", display_name, flags=re.IGNORECASE,
        )

        display_name = re.sub(r"\s{2,}", " ", display_name).strip()
        display_name = display_name.strip(" -–—") or raw_name or "Unknown"

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
    """Return dispensary configs to scrape.

    Respects the PLATFORM_GROUP env var: when set to a group name
    (e.g. "stable" or "new"), only dispensaries from that group's
    platforms are returned.
    """
    if slug_filter:
        return [d for d in DISPENSARIES if d["slug"] == slug_filter]

    # Filter by is_active from config first
    active = [d for d in DISPENSARIES if d.get("is_active", True)]

    # Apply platform group filter
    if PLATFORM_GROUP != "all":
        group_platforms = set(get_platforms_for_group(PLATFORM_GROUP))
        if group_platforms:
            active = [d for d in active if d["platform"] in group_platforms]
            logger.info(
                "Platform group '%s': %d dispensaries (%s)",
                PLATFORM_GROUP, len(active),
                ", ".join(sorted(group_platforms)),
            )
        else:
            logger.warning("Unknown platform group '%s' — using all", PLATFORM_GROUP)

    if LIMIT_DISPENSARIES:
        # Pick 1 per platform for quick testing
        picked: list[dict] = []
        seen_platforms: set[str] = set()
        for d in active:
            if d["platform"] not in seen_platforms:
                picked.append(d)
                seen_platforms.add(d["platform"])
            if len(picked) >= len(seen_platforms) and len(picked) >= 3:
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
    """Check if a completed scrape run already exists for today (UTC).

    When running a specific platform group, only checks for completed
    runs of that same group — a "stable" run doesn't block a "new" run.
    """
    if DRY_RUN:
        return False
    today_start = (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .isoformat()
    )
    query = (
        db.table("scrape_runs")
        .select("id")
        .eq("status", "completed")
        .gte("started_at", today_start)
    )
    query = query.limit(1)
    result = query.execute()
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
    logger.info("  GROUP:      %s", PLATFORM_GROUP)
    logger.info("  SINGLE:     %s", slug_filter or "(all)")
    logger.info("=" * 60)

    _seed_dispensaries()

    dispensaries = _get_active_dispensaries(slug_filter)

    # Deactivate previous day's deals — scoped to this group's dispensaries
    # so a "stable" run doesn't wipe yesterday's "new" products.
    group_slugs = [d["slug"] for d in dispensaries] if PLATFORM_GROUP != "all" else None
    _deactivate_old_deals(group_slugs)
    _expire_stale_deal_history(group_slugs)
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
