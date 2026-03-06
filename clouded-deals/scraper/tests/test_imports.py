"""Import smoke tests — catch SyntaxError / ImportError before merge.

Prevents b0b40b8-style crashes where a bad merge introduced duplicate code
blocks with unclosed literals, crashing all 12 region cron jobs.  These tests
are picked up automatically by the existing CI pytest run.

Platform scrapers and handlers depend on ``playwright`` which is only installed
in CI.  We use ``importlib`` to distinguish between a missing optional
dependency (skip) and a genuine SyntaxError/ImportError in our code (fail).
"""

import importlib
import sys

import pytest


def _import_or_skip(module_name: str):
    """Import *module_name*, skipping if playwright is unavailable.

    Raises AssertionError on SyntaxError or ImportError that is NOT caused by
    a missing playwright install.
    """
    try:
        return importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        if "playwright" in str(exc):
            pytest.skip("playwright not installed in this environment")
        raise
    except SyntaxError:
        raise  # always a real bug — never skip


class TestCriticalImports:
    """Every critical scraper module must be importable without errors."""

    def test_config_dispensaries(self):
        from config.dispensaries import DISPENSARIES, _USER_AGENT_POOL

        assert len(DISPENSARIES) > 0, "DISPENSARIES list must not be empty"
        assert len(_USER_AGENT_POOL) > 0, "UA pool must not be empty"

    def test_platforms_package(self):
        _import_or_skip("platforms")

    def test_platform_base(self):
        _import_or_skip("platforms.base")

    def test_platform_dutchie(self):
        _import_or_skip("platforms.dutchie")

    def test_platform_jane(self):
        _import_or_skip("platforms.jane")

    def test_platform_curaleaf(self):
        _import_or_skip("platforms.curaleaf")

    def test_platform_carrot(self):
        _import_or_skip("platforms.carrot")

    def test_platform_aiq(self):
        _import_or_skip("platforms.aiq")

    def test_platform_rise(self):
        _import_or_skip("platforms.rise")

    def test_handlers_age_verification(self):
        _import_or_skip("handlers.age_verification")

    def test_handlers_iframe(self):
        _import_or_skip("handlers.iframe")

    def test_handlers_pagination(self):
        _import_or_skip("handlers.pagination")

    def test_deal_detector(self):
        from deal_detector import detect_deals, select_top_deals  # noqa: F401

    def test_clouded_logic(self):
        from clouded_logic import CloudedLogic  # noqa: F401

    def test_parser(self):
        from parser import parse_product  # noqa: F401

    def test_product_classifier(self):
        from product_classifier import classify_product  # noqa: F401

    def test_metrics_collector(self):
        from metrics_collector import collect_daily_metrics  # noqa: F401
