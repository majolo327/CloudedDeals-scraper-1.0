"""
Brand auto-discovery — learns new brands from scraper unmatched-brand logs.

Reads daily_metrics.top_unmatched_brands across all regions, clusters similar
names via fuzzy matching, and writes high-confidence candidates to the
brand_candidates table for admin review.

Usage:
    # As standalone script (weekly cron or manual)
    python brand_learner.py

    # Dry run — compute but don't write to DB
    DRY_RUN=true python brand_learner.py

Environment:
    SUPABASE_URL, SUPABASE_SERVICE_KEY — required
    DRY_RUN=true — compute and log but don't write to DB
    MIN_OBSERVATIONS=10 — minimum times a name must appear to be a candidate (default 10)
"""

from __future__ import annotations

import json
import logging
import os
from collections import Counter, defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from typing import Any

from dotenv import load_dotenv

from clouded_logic import BRANDS, BRANDS_LOWER, BRAND_ALIASES, fuzzy_brand_match

logger = logging.getLogger("brand_learner")


def _normalize_candidate(name: str) -> str:
    """Normalize a candidate brand name for grouping."""
    import re
    # Strip common suffixes that aren't part of the brand name
    name = re.sub(r'\s*(cannabis|extracts?|labs?|farms?|edibles?|vapes?)\s*$',
                  '', name, flags=re.IGNORECASE)
    return name.strip()


def _cluster_similar_names(names: list[str], threshold: float = 0.80) -> dict[str, list[str]]:
    """Group similar candidate names together.

    Returns {canonical_form: [variant1, variant2, ...]}
    The canonical form is the most frequently observed variant.
    """
    clusters: dict[str, list[str]] = {}
    name_to_cluster: dict[str, str] = {}

    for name in sorted(names, key=len, reverse=True):
        name_lower = name.lower()
        matched_cluster = None

        for canonical in clusters:
            if SequenceMatcher(None, name_lower, canonical.lower()).ratio() >= threshold:
                matched_cluster = canonical
                break

        if matched_cluster:
            clusters[matched_cluster].append(name)
            name_to_cluster[name] = matched_cluster
        else:
            clusters[name] = [name]
            name_to_cluster[name] = name

    return clusters


def collect_unmatched_brands(db: Any, days: int = 30) -> list[dict[str, Any]]:
    """Read top_unmatched_brands from daily_metrics for the last N days.

    Returns list of {region, run_date, brands: [...]} dicts.
    """
    result = (
        db.table("daily_metrics")
        .select("region, run_date, top_unmatched_brands")
        .gte("run_date", (datetime.now().date().isoformat()))
        .not_.is_("top_unmatched_brands", "null")
        .execute()
    )
    rows = result.data or []
    if not rows:
        # Try broader date range
        from datetime import timedelta
        cutoff = (datetime.now().date() - timedelta(days=days)).isoformat()
        result = (
            db.table("daily_metrics")
            .select("region, run_date, top_unmatched_brands")
            .gte("run_date", cutoff)
            .not_.is_("top_unmatched_brands", "null")
            .execute()
        )
        rows = result.data or []

    logger.info("Found %d daily_metrics rows with unmatched brands", len(rows))
    return rows


def analyze_candidates(
    metrics_rows: list[dict[str, Any]],
    min_observations: int = 10,
) -> list[dict[str, Any]]:
    """Analyze unmatched brand names and produce candidates.

    Returns list of candidate dicts ready for brand_candidates table upsert.
    """
    # Count total observations per name across all regions/dates
    name_freq: Counter = Counter()
    name_regions: dict[str, set[str]] = defaultdict(set)
    name_dates: dict[str, set[str]] = defaultdict(set)
    name_samples: dict[str, list[str]] = defaultdict(list)

    for row in metrics_rows:
        region = row.get("region", "unknown")
        run_date = row.get("run_date", "")
        brands = row.get("top_unmatched_brands", [])
        if isinstance(brands, str):
            try:
                brands = json.loads(brands)
            except (json.JSONDecodeError, TypeError):
                brands = []

        for name in brands:
            if not name or len(name) < 3:
                continue
            normalized = _normalize_candidate(name)
            if not normalized:
                continue
            name_freq[normalized] += 1
            name_regions[normalized].add(region)
            name_dates[normalized].add(run_date)
            if len(name_samples[normalized]) < 5:
                name_samples[normalized].append(name)

    # Filter to candidates with enough observations
    frequent = {name: count for name, count in name_freq.items()
                if count >= min_observations}

    if not frequent:
        logger.info("No candidates meet minimum observation threshold (%d)", min_observations)
        return []

    # Cluster similar names
    clusters = _cluster_similar_names(list(frequent.keys()))

    candidates = []
    for canonical, variants in clusters.items():
        # Aggregate stats across cluster
        total_obs = sum(name_freq.get(v, 0) for v in variants)
        all_regions = set()
        for v in variants:
            all_regions.update(name_regions.get(v, set()))
        samples = []
        for v in variants:
            samples.extend(name_samples.get(v, []))

        # Check fuzzy match against existing brand DB
        closest_brand, similarity = fuzzy_brand_match(canonical, threshold=0.70)

        # Skip if this IS an existing brand (similarity >= 0.95)
        if similarity >= 0.95:
            logger.debug("Skipping '%s' — matches existing brand '%s' (%.0f%%)",
                         canonical, closest_brand, similarity * 100)
            continue

        # Also skip if already in brand DB (exact match)
        if canonical.lower() in BRANDS_LOWER:
            continue

        candidates.append({
            "name": canonical,
            "observation_count": total_obs,
            "dispensary_count": len(all_regions),  # approximation: regions ≈ dispensary spread
            "state_count": len(all_regions),
            "last_seen_at": datetime.now().isoformat(),
            "sample_products": json.dumps(samples[:5]),
            "regions_seen": sorted(all_regions),
            "categories_seen": [],  # would need product-level data to populate
            "closest_existing_brand": closest_brand,
            "similarity_score": round(similarity, 3) if closest_brand else None,
            "status": "pending",
        })

    # Sort by confidence: more observations + more regions = higher confidence
    candidates.sort(key=lambda c: (c["state_count"], c["observation_count"]), reverse=True)

    logger.info(
        "Brand candidates: %d candidates from %d frequent names (%d clusters)",
        len(candidates), len(frequent), len(clusters),
    )

    return candidates


def write_candidates(
    db: Any,
    candidates: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> int:
    """Write brand candidates to the brand_candidates table.

    Returns number of rows written.
    """
    if not candidates:
        return 0

    if dry_run:
        logger.info("[DRY RUN] Would write %d brand candidates:", len(candidates))
        for c in candidates[:20]:
            closest = f" (closest: {c['closest_existing_brand']} @ {c['similarity_score']})" \
                if c.get('closest_existing_brand') else ""
            logger.info(
                "  %-30s  obs=%3d  regions=%d%s",
                c["name"], c["observation_count"], c["state_count"], closest,
            )
        return len(candidates)

    try:
        db.table("brand_candidates").upsert(
            candidates,
            on_conflict="name",
        ).execute()
        logger.info("Wrote %d brand candidates", len(candidates))
        return len(candidates)
    except Exception as exc:
        logger.warning("Failed to write brand candidates: %s", exc)
        return 0


def run_brand_learner(
    db: Any,
    *,
    dry_run: bool = False,
    min_observations: int = 10,
    days: int = 30,
) -> dict[str, int]:
    """Run the full brand learning pipeline.

    Returns summary stats.
    """
    metrics_rows = collect_unmatched_brands(db, days=days)
    candidates = analyze_candidates(metrics_rows, min_observations=min_observations)
    written = write_candidates(db, candidates, dry_run=dry_run)

    return {
        "metrics_rows_analyzed": len(metrics_rows),
        "candidates_found": len(candidates),
        "candidates_written": written,
    }


if __name__ == "__main__":
    load_dotenv()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    db = create_client(url, key)

    dry = os.getenv("DRY_RUN", "").lower() in ("true", "1", "yes")
    min_obs = int(os.getenv("MIN_OBSERVATIONS", "10"))
    result = run_brand_learner(db, dry_run=dry, min_observations=min_obs)
    logger.info("Brand learner complete: %s", result)
