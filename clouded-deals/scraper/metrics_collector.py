"""
Post-scrape metrics collector — writes one row per day to daily_metrics.

Called at the end of each scrape run to persist pipeline quality stats.
These metrics power the /api/health endpoint and detect regressions
(e.g. edible count dropping to 0, dispensary diversity tanking).

Usage from main.py:
    from metrics_collector import collect_daily_metrics
    collect_daily_metrics(db, top_deals, run_id=run_id, ...)
"""

from __future__ import annotations

import logging
import statistics
from collections import Counter
from datetime import date
from typing import Any

logger = logging.getLogger("metrics")


def collect_daily_metrics(
    db: Any,
    top_deals: list[dict[str, Any]],
    *,
    run_id: str | None = None,
    total_products: int = 0,
    sites_scraped: int = 0,
    sites_failed: int = 0,
    runtime_seconds: int = 0,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Compute and upsert daily metrics from the curated deal set.

    Returns the metrics dict (useful for logging / tests) regardless
    of whether DB write succeeds.
    """
    scores = [d.get("deal_score", 0) for d in top_deals]
    categories = Counter(d.get("category", "other") for d in top_deals)
    brands = {d.get("brand") for d in top_deals if d.get("brand")}
    dispensaries = {d.get("dispensary_id") for d in top_deals if d.get("dispensary_id")}

    metrics = {
        "run_date": date.today().isoformat(),
        "total_products": total_products,
        "qualifying_deals": len(top_deals),

        # Category breakdown
        "flower_count": categories.get("flower", 0),
        "vape_count": categories.get("vape", 0),
        "edible_count": categories.get("edible", 0),
        "concentrate_count": categories.get("concentrate", 0),
        "preroll_count": categories.get("preroll", 0),

        # Diversity
        "unique_brands": len(brands),
        "unique_dispensaries": len(dispensaries),

        # Score distribution
        "avg_deal_score": round(statistics.mean(scores), 2) if scores else 0,
        "median_deal_score": int(statistics.median(scores)) if scores else 0,
        "min_deal_score": min(scores) if scores else 0,
        "max_deal_score": max(scores) if scores else 0,

        # Badge counts (thresholds from deal_detector)
        "steal_count": sum(1 for s in scores if s >= 85),
        "fire_count": sum(1 for s in scores if 70 <= s < 85),
        "solid_count": sum(1 for s in scores if 50 <= s < 70),

        # Scrape health
        "sites_scraped": sites_scraped,
        "sites_failed": sites_failed,
        "runtime_seconds": runtime_seconds,
    }

    if run_id and run_id != "dry-run":
        metrics["scrape_run_id"] = run_id

    logger.info(
        "Daily metrics: %d deals | flower=%d vape=%d edible=%d conc=%d pre=%d | "
        "%d brands, %d dispos | avg_score=%.1f",
        metrics["qualifying_deals"],
        metrics["flower_count"], metrics["vape_count"],
        metrics["edible_count"], metrics["concentrate_count"],
        metrics["preroll_count"],
        metrics["unique_brands"], metrics["unique_dispensaries"],
        metrics["avg_deal_score"],
    )

    if dry_run:
        logger.info("[DRY RUN] Would upsert daily_metrics row for %s", metrics["run_date"])
        return metrics

    try:
        db.table("daily_metrics").upsert(
            metrics,
            on_conflict="run_date",
        ).execute()
        logger.info("Daily metrics saved for %s", metrics["run_date"])
    except Exception as e:
        # Non-fatal — don't crash the scrape if metrics table doesn't exist yet
        logger.warning("Failed to save daily metrics: %s", e)

    return metrics
