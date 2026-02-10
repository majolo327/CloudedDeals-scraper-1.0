"""Tests for the DailyMetricsCollector."""

from __future__ import annotations

from unittest.mock import MagicMock

from metrics_collector import collect_daily_metrics


def test_collect_basic_metrics(make_product):
    """Metrics are computed correctly from a deal set."""
    deals = [
        make_product(brand="STIIIZY", category="vape", deal_score=90,
                     dispensary_id="planet13"),
        make_product(brand="Cookies", category="flower", deal_score=80,
                     dispensary_id="medizin"),
        make_product(brand="Wyld", category="edible", deal_score=60,
                     dispensary_id="reef"),
        make_product(brand="MPX", category="concentrate", deal_score=55,
                     dispensary_id="td-gibson"),
        make_product(brand="Jeeter", category="preroll", deal_score=70,
                     dispensary_id="oasis"),
    ]

    metrics = collect_daily_metrics(
        MagicMock(),  # db not called in dry_run
        deals,
        total_products=100,
        sites_scraped=15,
        sites_failed=2,
        runtime_seconds=300,
        dry_run=True,
    )

    assert metrics["qualifying_deals"] == 5
    assert metrics["flower_count"] == 1
    assert metrics["vape_count"] == 1
    assert metrics["edible_count"] == 1
    assert metrics["concentrate_count"] == 1
    assert metrics["preroll_count"] == 1
    assert metrics["unique_brands"] == 5
    assert metrics["unique_dispensaries"] == 5
    assert metrics["steal_count"] == 1   # 90 >= 85
    assert metrics["fire_count"] == 2    # 70, 80
    assert metrics["solid_count"] == 2   # 55, 60
    assert metrics["avg_deal_score"] == 71.0
    assert metrics["total_products"] == 100
    assert metrics["sites_scraped"] == 15
    assert metrics["sites_failed"] == 2


def test_collect_empty_deals():
    """Empty deal set produces zero metrics without crashing."""
    metrics = collect_daily_metrics(
        MagicMock(),
        [],
        dry_run=True,
    )
    assert metrics["qualifying_deals"] == 0
    assert metrics["avg_deal_score"] == 0
    assert metrics["unique_brands"] == 0


def test_collect_upserts_to_db(make_product):
    """When not dry_run, upsert is called on the daily_metrics table."""
    db = MagicMock()
    deals = [make_product(brand="Rove", category="vape", deal_score=70)]

    collect_daily_metrics(db, deals, dry_run=False)

    db.table.assert_called_with("daily_metrics")
    db.table().upsert.assert_called_once()
    call_args = db.table().upsert.call_args
    row = call_args[0][0]
    assert row["qualifying_deals"] == 1
    assert call_args[1]["on_conflict"] == "run_date"
