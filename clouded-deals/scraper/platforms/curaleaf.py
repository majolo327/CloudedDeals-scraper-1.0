"""
Scraper for Curaleaf dispensary pages.

Flow:
  1. Navigate directly to the ``/shop/nevada/`` store URL.
  2. Handle the age gate — Curaleaf now **redirects** to
     ``/age-gate?returnurl=...`` instead of showing an overlay.  We must
     detect the redirect, select Nevada, and submit.
  3. Wait for the React SPA to render product cards.
  4. Extract product cards from the direct page.
  5. Paginate via numbered / "Next" buttons.

CRITICAL: Always check ``is_enabled()`` before clicking any pagination
button.  A disabled button means pagination is COMPLETE — not an error.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from playwright.async_api import TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, navigate_curaleaf_page
from handlers.pagination import _JS_DISMISS_OVERLAYS
from .base import BaseScraper

logger = logging.getLogger(__name__)

_CURALEAF_CFG = PLATFORM_DEFAULTS["curaleaf"]
_POST_AGE_GATE_WAIT = _CURALEAF_CFG["wait_after_age_gate_sec"]  # 30 s

# Cap pagination to avoid 240 s site timeout.  Curaleaf sites have 500–700+
# products across 12-14 pages.  10 pages × 51 products ≈ 510, which captures
# the vast majority of specials and finishes in ~155 s.
_MAX_PAGES = 10

# Curaleaf product card selectors (tried in order).
_PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    '[data-testid*="Product"]',
    '[data-testid*="Card"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    'a[href*="/product/"]',
    "article[class*='product']",
    ".product-tile",
    # Curaleaf uses Next.js — try common React component patterns
    'div[class*="ProductItem"]',
    'div[class*="Item_"]',
    'li[class*="product"]',
    # Broad fallback: any card-like container with a "$" price inside
    '[class*="card"]',
    'article',
]


class CuraleafScraper(BaseScraper):
    """Scraper for Curaleaf direct-page dispensary menus."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()
        logger.info("[%s] After navigation, URL is: %s", self.slug, self.page.url)

        # --- Handle Curaleaf's redirect-based age gate -------------------
        await self._handle_curaleaf_age_gate()

        logger.info("[%s] After age gate, URL is: %s", self.slug, self.page.url)

        # Wait for React SPA to render products
        logger.info("[%s] Waiting %ds for product cards to render…", self.slug, _POST_AGE_GATE_WAIT)
        await asyncio.sleep(_POST_AGE_GATE_WAIT)

        # --- Dismiss overlays that block interaction --------------------
        try:
            removed = await self.page.evaluate(_JS_DISMISS_OVERLAYS)
            if removed:
                logger.info("[%s] Dismissed %d overlay(s) after age gate", self.slug, removed)
        except Exception:
            pass

        # --- Paginate and collect products ------------------------------
        all_products: list[dict[str, Any]] = []
        page_num = 1

        while page_num <= _MAX_PAGES:
            products = await self._extract_products()
            all_products.extend(products)
            logger.info(
                "[%s] Page %d → %d products (total %d)",
                self.slug, page_num, len(products), len(all_products),
            )

            page_num += 1
            # CRITICAL: navigate_curaleaf_page checks is_enabled() internally.
            try:
                if not await navigate_curaleaf_page(self.page, page_num):
                    break
            except Exception as exc:
                # Gracefully stop pagination — keep products we already have.
                logger.warning(
                    "[%s] Pagination to page %d failed (%s) — keeping %d products from earlier pages",
                    self.slug, page_num, exc, len(all_products),
                )
                break

        if page_num > _MAX_PAGES:
            logger.info("[%s] Reached max pages (%d) — stopping pagination", self.slug, _MAX_PAGES)

        # --- Fallback: if /specials returned 0 products, try the base menu ---
        if not all_products and "/specials" in self.url:
            base_url = self.url.replace("/specials", "")
            logger.warning(
                "[%s] /specials returned 0 products — retrying base menu: %s",
                self.slug, base_url,
            )
            await self.save_debug_info("zero_products_specials")
            await self.goto(base_url)
            await self._handle_curaleaf_age_gate()
            logger.info("[%s] Waiting %ds for product cards on base menu…", self.slug, _POST_AGE_GATE_WAIT)
            await asyncio.sleep(_POST_AGE_GATE_WAIT)
            page_num = 1
            while page_num <= _MAX_PAGES:
                products = await self._extract_products()
                all_products.extend(products)
                logger.info(
                    "[%s] Base menu page %d → %d products (total %d)",
                    self.slug, page_num, len(products), len(all_products),
                )
                page_num += 1
                if not await navigate_curaleaf_page(self.page, page_num):
                    break

        if not all_products:
            await self.save_debug_info("zero_products")
        logger.info("[%s] Scrape complete — %d products", self.slug, len(all_products))
        return all_products

    # ------------------------------------------------------------------
    # Age gate — redirect-based
    # ------------------------------------------------------------------

    async def _handle_curaleaf_age_gate(self) -> None:
        """Handle Curaleaf's redirect-based age gate.

        Curaleaf redirects ``/shop/...`` to ``/age-gate?returnurl=...``.
        We need to select Nevada and submit to get back to the shop page.
        If we're NOT on the age-gate page, fall back to the generic handler.
        """
        current_url = self.page.url

        if "/age-gate" not in current_url:
            logger.info("[%s] No age-gate redirect detected — trying generic handler", self.slug)
            await self.handle_age_gate(post_wait_sec=0)
            return

        logger.info("[%s] Detected Curaleaf age-gate redirect: %s", self.slug, current_url)

        # Step 1: Select state from dropdown
        state_selectors = [
            'select',                           # standard <select>
            '[data-testid*="state"]',
            '[class*="state"]',
            '[class*="select"]',
            '[aria-label*="state"]',
            '[role="combobox"]',
        ]

        for selector in state_selectors:
            try:
                locator = self.page.locator(selector).first
                await locator.wait_for(state="visible", timeout=5_000)
                tag = await locator.evaluate("el => el.tagName.toLowerCase()")
                if tag == "select":
                    await locator.select_option(label="Nevada")
                    logger.info("[%s] Selected 'Nevada' from <select> dropdown", self.slug)
                else:
                    await locator.click()
                    await asyncio.sleep(1)
                    nv_option = self.page.locator('text="Nevada"').first
                    try:
                        await nv_option.wait_for(state="visible", timeout=3_000)
                        await nv_option.click()
                        logger.info("[%s] Clicked 'Nevada' option in dropdown", self.slug)
                    except PlaywrightTimeout:
                        nv_option = self.page.locator('text="NV"').first
                        try:
                            await nv_option.wait_for(state="visible", timeout=2_000)
                            await nv_option.click()
                            logger.info("[%s] Clicked 'NV' option in dropdown", self.slug)
                        except PlaywrightTimeout:
                            logger.debug("[%s] Could not find Nevada/NV in dropdown via %r", self.slug, selector)
                            continue
                break
            except PlaywrightTimeout:
                continue
            except Exception:
                logger.debug("[%s] State selector %r failed", self.slug, selector, exc_info=True)
                continue

        # Step 2: Wait for page to update after state selection
        # The page transitions from state picker to age confirmation
        logger.info("[%s] Waiting 3s for page to update after state selection…", self.slug)
        await asyncio.sleep(3)

        # Step 3: Click the "I'm over 21" button (or similar)
        submit_selectors = [
            "button:has-text(\"I'm over 21\")",
            'button:has-text("over 21")',
            'button:has-text("21 or older")',
            'button:has-text("I am 21")',
            'button:has-text("Enter")',
            'button:has-text("Submit")',
            'button:has-text("Confirm")',
            'button:has-text("Yes")',
            'button[type="submit"]',
            'a:has-text("over 21")',
            'a:has-text("Enter")',
        ]

        for selector in submit_selectors:
            try:
                locator = self.page.locator(selector).first
                await locator.wait_for(state="visible", timeout=5_000)
                await locator.click()
                logger.info("[%s] Clicked age gate submit via %r", self.slug, selector)
                break
            except PlaywrightTimeout:
                continue

        # Wait for redirect back to store page
        try:
            await self.page.wait_for_url("**/stores/**", timeout=15_000)
            logger.info("[%s] Redirected back to store: %s", self.slug, self.page.url)
        except PlaywrightTimeout:
            logger.warning(
                "[%s] Did not redirect back to store after age gate — current URL: %s",
                self.slug, self.page.url,
            )
            await self.save_debug_info("age_gate_stuck")

        # Dismiss cookie consent banner (OneTrust) immediately so it
        # doesn't block product extraction or pagination clicks.
        try:
            removed = await self.page.evaluate(_JS_DISMISS_OVERLAYS)
            if removed:
                logger.info("[%s] Dismissed %d overlay(s) after age gate redirect", self.slug, removed)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self) -> list[dict[str, Any]]:
        """Extract product cards from the current Curaleaf page."""
        products: list[dict[str, Any]] = []

        for selector in _PRODUCT_SELECTORS:
            try:
                await self.page.locator(selector).first.wait_for(
                    state="attached", timeout=8_000,
                )
            except PlaywrightTimeout:
                continue

            elements = await self.page.locator(selector).all()
            if not elements:
                continue

            for el in elements:
                try:
                    text_block = await el.inner_text()

                    # Skip elements that don't contain a price — not a product card
                    if "$" not in text_block:
                        continue

                    lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                    product: dict[str, Any] = {
                        "name": lines[0] if lines else "Unknown",
                        "raw_text": text_block.strip(),
                        "product_url": self.url,  # fallback: dispensary menu URL
                    }

                    # Extract product link from element or ancestor <a>
                    try:
                        href = await el.evaluate(
                            """el => {
                                if (el.tagName === 'A') return el.href;
                                const a = el.closest('a') || el.querySelector('a');
                                return a ? a.href : null;
                            }"""
                        )
                        if href:
                            product["product_url"] = href
                    except Exception:
                        pass

                    for line in lines:
                        if "$" in line:
                            product["price"] = line
                            break

                    products.append(product)
                except Exception:
                    logger.debug("Failed to extract a Curaleaf product", exc_info=True)

            if products:
                logger.info(
                    "[%s] Products matched via selector %r (%d found)",
                    self.slug, selector, len(products),
                )
                break

        return products
