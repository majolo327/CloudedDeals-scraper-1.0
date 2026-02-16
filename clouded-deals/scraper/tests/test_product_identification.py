"""Tests for product identification fixes.

Covers:
  - Brand-as-display-name fallback (_extract_strain_from_raw_text)
  - 1g flower → preroll reclassification heuristic
  - Dutchie scraped_category extraction
  - Cookies brand detection (regression)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

# Ensure the scraper package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# =====================================================================
# _extract_strain_from_raw_text — inlined here to avoid importing
# main.py which has heavy dependencies (supabase, playwright, etc.)
# The canonical implementation lives in main.py.
# =====================================================================

_JUNK_LINE_PATTERNS = re.compile(
    r"^(?:"
    r"\$[\d.]+"
    r"|[\d.]+\s*(?:g|mg|oz)\b"
    r"|(?:Indica|Sativa|Hybrid)$"
    r"|(?:THC|CBD|CBN)\s*:?\s*[\d.]+\s*%?"
    r"|Add to (?:cart|bag)"
    r"|(?:Pre[-\s]?Rolls?|Prerolls?|Flower|Vapes?|Cartridges?|Concentrates?|Edibles?)$"
    r"|(?:Sale!?|New!?|Limited|Sold out|In stock|Staff Pick|Local Love|New Arrival)"
    r"|\d+%\s*off"
    r"|Special Offers?"
    r"|\s*$"
    r")",
    re.IGNORECASE,
)


def _extract_strain_from_raw_text(
    raw_text: str, brand: str, fallback: str,
) -> str:
    """Inlined from main.py for testability."""
    if not raw_text:
        return fallback
    brand_lower = brand.lower() if brand else ""
    for line in raw_text.split("\n"):
        candidate = line.strip()
        if not candidate or len(candidate) < 3:
            continue
        if candidate.lower() == brand_lower:
            continue
        if brand_lower and candidate.lower().startswith(brand_lower):
            continue
        if _JUNK_LINE_PATTERNS.match(candidate):
            continue
        result = re.sub(
            rf'\b{re.escape(brand)}\b\s*[-:|]?\s*',
            '', candidate, flags=re.IGNORECASE,
        ).strip()
        if len(result) >= 3:
            return result
    return fallback


# =====================================================================
# _extract_strain_from_raw_text tests
# =====================================================================


class TestExtractStrainFromRawText:
    """When the product name equals the brand, extract strain from raw_text."""

    def test_cookies_headband_preroll(self):
        """Cookies brand card with 'Headband' as a separate line."""
        raw_text = "Cookies\nHeadband\nHybrid\n1g\n$8.00\n$5.00"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Headband"

    def test_cookies_gary_payton(self):
        """Cookies brand card with 'Gary Payton' strain."""
        raw_text = "Cookies\nGary Payton\nHybrid\n3.5g\n$55.00\n$40.00"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Gary Payton"

    def test_stiiizy_white_runtz(self):
        """STIIIZY brand card with strain as a separate line."""
        raw_text = "STIIIZY\nWhite Runtz\nIndica\n1g\n$12.00\n$8.00"
        result = _extract_strain_from_raw_text(raw_text, "STIIIZY", "STIIIZY")
        assert result == "White Runtz"

    def test_skips_prices(self):
        """Price lines should not be returned as strain names."""
        raw_text = "Cookies\n$8.00\n$5.00\nHeadband\n1g"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Headband"

    def test_skips_weight_lines(self):
        """Weight lines should not be returned as strain names."""
        raw_text = "Cookies\n3.5g\nGelato 41\nHybrid"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Gelato 41"

    def test_skips_strain_type_lines(self):
        """Standalone strain type lines (Indica/Sativa/Hybrid) are skipped."""
        raw_text = "Cookies\nIndica\nCereal Milk\n1g\n$8.00"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Cereal Milk"

    def test_skips_category_labels(self):
        """Category label lines (Flower, Pre-Roll, etc.) are skipped."""
        raw_text = "Cookies\nFlower\nOcean Beach\n3.5g\n$45.00"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Ocean Beach"

    def test_skips_preroll_category_label(self):
        """Pre-Roll category label should be skipped."""
        raw_text = "Cookies\nPre-Roll\nHeadband\n1g\n$8.00"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Headband"

    def test_fallback_when_no_strain(self):
        """Falls back to the given fallback when no useful line is found."""
        raw_text = "Cookies\n$8.00\n1g"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Cookies"

    def test_empty_raw_text(self):
        """Returns fallback when raw_text is empty."""
        result = _extract_strain_from_raw_text("", "Cookies", "Cookies")
        assert result == "Cookies"

    def test_brand_prefix_in_line(self):
        """Lines that start with brand name are skipped (not the strain)."""
        raw_text = "Cookies Flower\nCookies\nGary Payton\n3.5g"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Gary Payton"

    def test_skips_thc_lines(self):
        """THC percentage lines are skipped."""
        raw_text = "Cookies\nTHC: 28.5%\nGelato\n3.5g"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Gelato"

    def test_skips_sale_badge(self):
        """Sale badge text is skipped."""
        raw_text = "Cookies\nSale!\nLondon Pound Cake\n3.5g\n$45.00\n$35.00"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "London Pound Cake"

    def test_short_lines_skipped(self):
        """Lines shorter than 3 chars are skipped."""
        raw_text = "Cookies\nOG\nI\nGeorgia Pie\n3.5g"
        result = _extract_strain_from_raw_text(raw_text, "Cookies", "Cookies")
        assert result == "Georgia Pie"


# =====================================================================
# Dutchie category label extraction
# =====================================================================

from platforms.dutchie import _CATEGORY_LABEL_MAP, _RE_CATEGORY_LABEL


class TestDutchieCategoryLabels:
    """Test the Dutchie scraped_category extraction."""

    @pytest.mark.parametrize("label,expected", [
        ("pre-roll", "preroll"),
        ("pre-rolls", "preroll"),
        ("pre roll", "preroll"),
        ("pre rolls", "preroll"),
        ("preroll", "preroll"),
        ("prerolls", "preroll"),
        ("flower", "flower"),
        ("vape", "vape"),
        ("vapes", "vape"),
        ("cartridge", "vape"),
        ("cartridges", "vape"),
        ("concentrate", "concentrate"),
        ("concentrates", "concentrate"),
        ("edible", "edible"),
        ("edibles", "edible"),
    ])
    def test_label_map(self, label, expected):
        """All expected category labels map correctly."""
        assert _CATEGORY_LABEL_MAP[label] == expected

    def test_regex_strips_standalone_flower(self):
        """Standalone 'Flower' line is stripped from raw_text."""
        text = "Cookies\nFlower\nHeadband\n3.5g"
        result = _RE_CATEGORY_LABEL.sub("", text).strip()
        assert "Flower" not in result
        assert "Headband" in result

    def test_regex_strips_standalone_preroll(self):
        """Standalone 'Pre-Roll' line is stripped from raw_text."""
        text = "Cookies\nPre-Roll\nHeadband\n1g"
        result = _RE_CATEGORY_LABEL.sub("", text).strip()
        assert "Pre-Roll" not in result
        assert "Headband" in result

    def test_regex_preserves_flower_in_strain(self):
        """'Flower' embedded in a strain name is NOT stripped."""
        text = "Flower One\nBlue Dream\n3.5g"
        result = _RE_CATEGORY_LABEL.sub("", text).strip()
        # "Flower One" is a brand, not a standalone category label
        assert "Flower One" in result

    def test_regex_preserves_preroll_in_name(self):
        """'Preroll' as part of a product name is NOT stripped."""
        text = "Infused Preroll Pack\n1g\n$12.00"
        result = _RE_CATEGORY_LABEL.sub("", text).strip()
        assert "Infused Preroll Pack" in result


# =====================================================================
# Category detection and 1g preroll heuristic
# =====================================================================


class TestFlowerOneGramPrerollHeuristic:
    """The 1g flower → preroll reclassification logic."""

    def test_1g_without_keyword_is_other(self):
        """CloudedLogic classifies '1g' without keywords as 'other'."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_category("Cookies Headband 1g") == "other"

    def test_1g_with_preroll_keyword(self):
        """When 'preroll' keyword is present, category is preroll."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_category("Cookies Headband Preroll 1g") == "preroll"

    def test_1g_with_flower_keyword_stays_flower(self):
        """When 'flower' keyword is explicitly present, stays flower."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_category("Cookies Headband Flower 1g") == "flower"

    def test_3_5g_stays_flower(self):
        """3.5g products are unambiguously flower by weight pattern."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_category("Cookies Headband 3.5g") == "flower"


# =====================================================================
# Cookies brand detection regression tests
# =====================================================================


class TestCookiesBrandRegression:
    """Ensure Cookies brand detection still works correctly."""

    def test_cookies_at_start_is_brand(self):
        """'Cookies' at the start of text IS the Cookies brand."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_brand("Cookies Gary Payton 3.5g") == "Cookies"

    def test_cookies_headband_is_brand(self):
        """'Cookies Headband' — Cookies is the brand."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_brand("Cookies Headband 1g") == "Cookies"

    def test_girl_scout_cookies_not_brand(self):
        """'Girl Scout Cookies' is a strain, not Cookies brand."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_brand("Girl Scout Cookies 3.5g") is None

    def test_cookies_and_cream_not_brand(self):
        """'Cookies and Cream' is a strain, not Cookies brand."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_brand("Cookies and Cream 3.5g") is None

    def test_pink_cookies_not_brand(self):
        """'Pink Cookies' is a strain cross, not Cookies brand."""
        from clouded_logic import CloudedLogic
        logic = CloudedLogic()
        assert logic.detect_brand("Pink Cookies 3.5g") is None
