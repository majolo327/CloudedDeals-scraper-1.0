"""
Dispensary configuration across 11 regions and 5 active platforms.

Regions (~1493 active / ~1542 total):
  - michigan:      300 dispensaries (Dutchie + Jane)
  - colorado:      200 dispensaries (Dutchie + Jane)
  - massachusetts: 186 dispensaries (Dutchie + Jane + Curaleaf/Zen Leaf)
  - illinois:      178 dispensaries (Dutchie + Jane + Curaleaf/Zen Leaf)
  - ohio:          133 dispensaries (Dutchie + Jane + Curaleaf/Zen Leaf)
  - arizona:       127 dispensaries (Dutchie + Curaleaf/Zen Leaf + Jane)
  - missouri:      121 dispensaries (Dutchie + Jane)
  - new-jersey:    106 dispensaries (Dutchie + Jane + Curaleaf/Zen Leaf)
  - new-york:       76 dispensaries (Dutchie + Jane + Curaleaf)
  - southern-nv:    66 dispensaries (Dutchie/Jane/Carrot/Curaleaf/Zen Leaf/AIQ)
  - pennsylvania:   49 dispensaries (Curaleaf/Zen Leaf + Dutchie)

Platforms (~1493 active / ~1542 total):
  - dutchie: ~846 — iframe-based menus (Dutchie/TD sites)
  - jane:    ~531 — hybrid iframe/direct with "View More" pagination
  - curaleaf: ~109 — direct page loads (Curaleaf + Zen Leaf)
  - rise:        0 — ALL DEACTIVATED (100% Cloudflare blocked)
  - carrot:      5 — JS widget via getcarrot.io
  - aiq:         2 — Alpine IQ / Dispense React SPA

Rise sites (37) are kept in config with is_active=False for DB history
but are universally skipped due to Cloudflare blocking.
Curaleaf MI sites (4) deactivated — Curaleaf exited Michigan late 2023.

Sites marked ``is_active: False`` are known-broken (redirects, rebrands,
Cloudflare blocks, etc.) and will be skipped by the orchestrator.  They
remain in the config so the DB seed keeps their rows for historical data.

Multi-state dispensaries use the ``region`` field for filtering.
The ``REGION`` env var in main.py controls which state is scraped.
"""

# ---------------------------------------------------------------------------
# Browser / Playwright defaults — stealth configuration
# ---------------------------------------------------------------------------

import random as _random

BROWSER_ARGS = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--disable-infobars",
    "--disable-features=AutomationControlled",
]

# Pool of realistic Chrome User-Agents — rotated per browser context so
# each scraper session presents a different fingerprint.
_USER_AGENT_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
]

# Default (backwards-compat import target); callers should prefer get_user_agent()
USER_AGENT = _USER_AGENT_POOL[0]


def get_user_agent() -> str:
    """Return a randomly selected realistic Chrome User-Agent."""
    return _random.choice(_USER_AGENT_POOL)


# Common desktop resolutions with small random offsets to avoid
# fingerprint-matching on exact viewport dimensions.
_VIEWPORT_BASES = [
    (1920, 1080),
    (1366, 768),
    (1440, 900),
    (1536, 864),
]

# Default (backwards-compat import target); callers should prefer get_viewport()
VIEWPORT = {"width": 1920, "height": 1080}


def get_viewport() -> dict[str, int]:
    """Return a slightly randomized viewport to avoid fingerprinting."""
    w, h = _random.choice(_VIEWPORT_BASES)
    return {
        "width": w + _random.randint(-16, 16),
        "height": h + _random.randint(-8, 8),
    }


# JavaScript injected into every browser context on creation to mask
# Playwright/Chromium automation signals.  Industry-standard technique
# used by all major scraping frameworks.
STEALTH_INIT_SCRIPT = """
// 1. Mask navigator.webdriver (primary bot signal)
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
});

// 2. Override navigator.plugins to look like a real browser
Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
});

// 3. Override navigator.languages to match User-Agent
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});

// 4. Mask chrome.runtime (present in real Chrome, absent in headless)
if (!window.chrome) { window.chrome = {}; }
if (!window.chrome.runtime) { window.chrome.runtime = {}; }

// 5. Override permissions API (Notification permission query leaks headless)
const _origQuery = window.navigator.permissions.query.bind(navigator.permissions);
window.navigator.permissions.query = (params) =>
    params.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : _origQuery(params);
"""

# Use 'domcontentloaded' — NOT 'networkidle' — to avoid hanging on
# long-polling analytics and chat widgets that never finish loading.
WAIT_UNTIL = "domcontentloaded"

# Navigation timeout in milliseconds.  Dutchie JS-heavy sites can take
# well over 60 s to fully load scripts and render the iframe / embed.
GOTO_TIMEOUT_MS = 120_000

# Per-site scrape timeout in seconds.  Must accommodate the smart-wait
# (up to 60 s) + iframe/JS-embed detection (up to 105 s) + pagination
# (5 s × N pages) + one full retry cycle.  300 s was too tight for
# slow Dutchie sites (TD, Greenlight, The Grove) — 600 s gives room.
SITE_TIMEOUT_SEC = 600

# ---------------------------------------------------------------------------
# Platform-level configuration
# ---------------------------------------------------------------------------

PLATFORM_DEFAULTS = {
    "dutchie": {
        "wait_after_age_gate_sec": 60,
        "wait_after_iframe_found_sec": 5,
        "pagination": "aria-label",       # paginate via aria-label buttons
        "between_pages_sec": 5,
        "embed_type": "iframe",
        "wait_until": "domcontentloaded",  # proven pattern: domcontentloaded is faster; 'load' waits for analytics/trackers
    },
    "curaleaf": {
        "wait_after_age_gate_sec": 30,
        "embed_type": "direct",
        "wait_until": "domcontentloaded",
    },
    "jane": {
        "wait_after_age_gate_sec": 10,
        "pagination": "view_more",        # click "View More" button
        "between_view_more_sec": 1.5,
        "embed_type": "hybrid",           # iframe or direct depending on site
        "wait_until": "domcontentloaded",
    },
    "rise": {
        "wait_after_age_gate_sec": 15,
        "embed_type": "direct",           # proprietary Next.js SPA, no iframe
        "wait_until": "load",             # SPA needs full script execution to hydrate
    },
    "carrot": {
        "wait_after_age_gate_sec": 10,
        "embed_type": "direct",           # JS widget injects into page DOM
        "wait_until": "domcontentloaded",
    },
    "aiq": {
        "wait_after_age_gate_sec": 15,
        "embed_type": "direct",           # React SPA (standalone or embedded)
        "wait_until": "domcontentloaded",
    },
}

# ---------------------------------------------------------------------------
# Expansion state regions — these get aggressive pagination and higher limits.
# Production NV sites (southern-nv) use the proven stable configuration.
# ---------------------------------------------------------------------------

PRODUCTION_REGIONS = {"southern-nv"}

EXPANSION_REGIONS = {
    "michigan", "illinois", "arizona", "colorado", "massachusetts",
    "missouri", "new-jersey", "ohio", "new-york", "pennsylvania",
    "northern-nv",
}


def is_expansion_region(region: str) -> bool:
    """Return True if *region* is an expansion state (not production NV).

    Expansion regions get aggressive pagination enhancements:
    - Category tab iteration
    - Higher page limits
    - More Load More / View More clicks
    - Increased product caps

    Production regions (southern-nv) use the existing proven patterns
    unchanged.
    """
    if not region:
        return False
    # Handle sharded regions like "michigan-2" → "michigan"
    base = region.rsplit("-", 1)[0] if region[-1:].isdigit() else region
    return base in EXPANSION_REGIONS


# ---------------------------------------------------------------------------
# Dispensary definitions
#
# Core MVP sites (is_active=True) are the ones the PRD has validated.
# Remaining sites are preserved but deactivated until their URLs/selectors
# are verified.
# ---------------------------------------------------------------------------

DISPENSARIES = [
    # ------------------------------------------------------------------
    # DUTCHIE SITES  (20 — incl. SLV + 4 Nevada Made below)
    # ------------------------------------------------------------------
    {
        "name": "The Dispensary - Gibson",
        "slug": "td-gibson",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-dispensary-henderson",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # confirmed via debug logs — dtche param injects a Dutchie iframe
    },
    {
        "name": "The Dispensary - Eastern",
        "slug": "td-eastern",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-dispensary-eastern-express",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # confirmed via debug logs — dtche param injects a Dutchie iframe
    },
    {
        "name": "The Dispensary - Decatur",
        "slug": "td-decatur",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-dispensary-las-vegas",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # confirmed via debug logs — dtche param injects a Dutchie iframe
    },
    {
        "name": "Planet 13",
        "slug": "planet13",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/planet-13-dispensary/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/planet-13-dispensary/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "direct",   # P13 renders Dutchie cards directly on page — no iframe
    },
    {
        "name": "Medizin",
        "slug": "medizin",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/medizin-dispensary/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/medizin-dispensary/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "direct",   # same as Planet 13 — direct page rendering
    },
    {
        "name": "Greenlight Downtown",
        "slug": "greenlight-downtown",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/greenlight-las-vegas/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # logs confirm iframe, not js_embed
    },
    {
        "name": "Greenlight Paradise",
        "slug": "greenlight-paradise",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/greenlight-paradise/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # logs confirm iframe, not js_embed
    },
    {
        "name": "The Grove",
        "slug": "the-grove",
        "platform": "dutchie",
        "url": "https://www.thegrovenv.com/lasvegas/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-grove-las-vegas/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
    },
    {
        "name": "Mint Paradise",
        "slug": "mint-paradise",
        "platform": "dutchie",
        "url": "https://mintdeals.com/paradise-lv/deals/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-mint-paradise/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # logs confirm iframe (about:blank initially, loads after age gate)
    },
    {
        "name": "Mint Rainbow",
        "slug": "mint-rainbow",
        "platform": "dutchie",
        "url": "https://mintdeals.com/rainbow-lv/deals/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-mint-spring-valley/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # logs confirm iframe, not js_embed
    },
    # --- Phase 1 additions (recon-confirmed Dutchie JS embeds) ---
    {
        "name": "Jade Cannabis Desert Inn",
        "slug": "jade-desert-inn",
        "platform": "dutchie",
        "url": "https://jadecannabisco.com/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/blum-desert-inn/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # logs confirm iframe (found via dutchie.com selector)
    },
    {
        "name": "Jade Cannabis Sky Pointe",
        "slug": "jade-sky-pointe",
        "platform": "dutchie",
        "url": "https://skypointe.jadecannabisco.com/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",  # logs confirm iframe (found via dutchie.com selector)
    },
    {
        "name": "The Grove Pahrump",
        "slug": "grove-pahrump",
        "platform": "dutchie",
        "url": "https://www.thegrovenv.com/pahrump/?dtche%5Bpath%5D=specials",
        "is_active": False,  # Pahrump is outside Vegas metro — excluded for now
        "region": "southern-nv",
    },
    {
        "name": "Sahara Wellness",
        "slug": "sahara-wellness",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/sahara-wellness/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "direct",
    },
    {
        "name": "The Treehouse Vegas",
        "slug": "treehouse",
        "platform": "dutchie",
        "url": "https://vegastreehouse.com/store/?dtche%5Bpath%5D=specials",
        "is_active": False,  # chronic timeouts — demoted pre-beta
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
    },

    # ------------------------------------------------------------------
    # CURALEAF SITES  (4)
    # ------------------------------------------------------------------
    {
        "name": "Curaleaf Western",
        "slug": "curaleaf-western",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-las-vegas-western-ave/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Curaleaf North LV",
        "slug": "curaleaf-north-lv",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-north-las-vegas/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Curaleaf Strip",
        "slug": "curaleaf-strip",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-nv-las-vegas/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Curaleaf The Reef",
        "slug": "curaleaf-the-reef",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/reef-dispensary-las-vegas-strip/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    # ------------------------------------------------------------------
    # JANE SITES  (19)
    # ------------------------------------------------------------------
    {
        "name": "Oasis Cannabis",
        "slug": "oasis",
        "platform": "jane",
        "url": "https://www.iheartjane.com/stores/1649/oasis-cannabis-las-vegas/menu",
        "fallback_url": "https://oasiscannabis.com/shop/menu/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Deep Roots Harvest Cheyenne",
        "slug": "deep-roots-cheyenne",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/cheyenne",
        "is_active": True,
        "region": "southern-nv",
        "hybrid_strategy": True,  # Deep Roots uses a different DOM structure
    },
    {
        "name": "Deep Roots Harvest Craig",
        "slug": "deep-roots-craig",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/craig",
        "is_active": True,
        "region": "southern-nv",
        "hybrid_strategy": True,
    },
    {
        "name": "Deep Roots Harvest Blue Diamond",
        "slug": "deep-roots-blue-diamond",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/blue-diamond",
        "is_active": True,
        "region": "southern-nv",
        "hybrid_strategy": True,
    },
    {
        "name": "Deep Roots Harvest Parkson",
        "slug": "deep-roots-parkson",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/parkson",
        "is_active": True,
        "region": "southern-nv",
        "hybrid_strategy": True,
    },
    {
        "name": "Cultivate Spring Mountain",
        "slug": "cultivate-spring",
        "platform": "jane",
        "url": "https://cultivatelv.com/online-menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Cultivate Durango",
        "slug": "cultivate-durango",
        "platform": "jane",
        "url": "https://cultivatelv.com/online-menu-durango/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Thrive Sahara",
        "slug": "thrive-sahara",
        "platform": "jane",
        "url": "https://thrivenevada.com/west-sahara-weed-dispensary-menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Thrive Cheyenne",
        "slug": "thrive-cheyenne",
        "platform": "jane",
        "url": "https://thrivenevada.com/north-las-vegas-dispensary-menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Thrive Strip",
        "slug": "thrive-strip",
        "platform": "jane",
        "url": "https://thrivenevada.com/las-vegas-strip-dispensary-menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Thrive Main",
        "slug": "thrive-main",
        "platform": "jane",
        "url": "https://thrivenevada.com/art-district/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Sahara was failing with iheartjane.com as primary — swap to
        # beyond-hello.com first (matches working Twain config).
        "name": "Beyond/Hello Sahara",
        "slug": "beyond-hello-sahara",
        "platform": "jane",
        "url": "https://beyond-hello.com/nevada-dispensaries/las-vegas-sahara/adult-use-menu/",
        "fallback_url": "https://www.iheartjane.com/stores/4361/beyond-hello-sahara-ave/menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # NuLeaf at 430 E Twain — acquired by Jushi (Beyond/Hello parent).
        # Use beyond-hello.com URL for consistency with Jane scraper.
        "name": "Beyond/Hello Twain",
        "slug": "beyond-hello-twain",
        "platform": "jane",
        "url": "https://beyond-hello.com/nevada-dispensaries/las-vegas-twain/adult-use-menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    # --- Phase 1 additions (recon-confirmed Jane sites) ---
    {
        "name": "Exhale",
        "slug": "exhale",
        "platform": "jane",
        "url": "https://exhalebrands.com/store/",
        "is_active": False,  # chronic timeouts — demoted pre-beta
        "region": "southern-nv",
    },
    {
        "name": "Thrive Southern Highlands",
        "slug": "thrive-southern-highlands",
        "platform": "jane",
        "url": "https://thrivenevada.com/southern-highlands-weed-dispensary-menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Custom domain was failing — add iheartjane.com as fallback
        # (store ID 4219 confirmed via web search).
        "name": "Tree of Life Jones",
        "slug": "tree-of-life-jones",
        "platform": "jane",
        "url": "https://lasvegas.treeoflifenv.com/store",
        "fallback_url": "https://www.iheartjane.com/stores/4219/tree-of-life-las-vegas/menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Custom domain was failing — add iheartjane.com as fallback
        # (store ID 3274 confirmed via web search).
        "name": "Tree of Life Centennial",
        "slug": "tree-of-life-centennial",
        "platform": "jane",
        "url": "https://northlasvegas.treeoflifenv.com/store",
        "fallback_url": "https://www.iheartjane.com/stores/3274/tree-of-life-north-las-vegas/menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "The Sanctuary N LV Blvd",
        "slug": "sanctuary-n-lv",
        "platform": "jane",
        "url": "https://thesanctuarynv.com/shop/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # NOTE: The Source shares one /specials/ URL for all 4 locations.
        # This entry captures the specials page; per-location menus TBD.
        "name": "The Source",
        "slug": "the-source",
        "platform": "jane",
        "url": "https://www.thesourcenv.com/specials/",
        "is_active": True,
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # RISE SITES — proprietary Next.js SPA via cdn-bong.risecannabis.com
    #
    # DISABLED Feb 2026: Rise deployed Cloudflare bot protection (Turnstile)
    # which blocks headless browser scraping.  All locations deactivated
    # until an alternative data source (API, feed, or Cloudflare bypass)
    # is found.  Re-enable by setting is_active back to True.
    #
    # URL pattern:
    #   /dispensaries/nevada/{slug}/{store-id}/pickup-menu/
    # ------------------------------------------------------------------
    {
        "name": "Rise Tropicana West",
        "slug": "rise-tropicana",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/west-tropicana/886/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        "name": "Rise South Rainbow",
        "slug": "rise-rainbow",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/south-rainbow/1718/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        "name": "Rise Nellis",
        "slug": "rise-nellis",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/nellis/5267/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        "name": "Rise South Durango",
        "slug": "rise-durango",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/south-durango/1885/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        "name": "Rise Craig",
        "slug": "rise-craig",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/craig-rd/5429/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        # Rebranded from "Boulder Highway" to "Henderson on Boulder"
        "name": "Rise Henderson (Boulder)",
        "slug": "rise-boulder",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/henderson-boulder/6211/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        # Cookies on the Strip still uses /recreational-menu/ (not pickup-menu)
        "name": "Cookies on the Strip",
        "slug": "cookies-strip-rise",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/cookies-on-the-strip/888/recreational-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },
    {
        # Cookies Flamingo merged into "Cookies on the Strip" (888) — deactivated.
        "name": "Cookies Flamingo",
        "slug": "cookies-flamingo",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/cookies-on-the-strip/888/recreational-menu/",
        "is_active": False,
        "region": "southern-nv",
    },
    {
        "name": "Rise Henderson (Sunset)",
        "slug": "rise-henderson",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/henderson/887/pickup-menu/",
        "is_active": False,  # Cloudflare blocked
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # DUTCHIE — supplemental sites added post-recon
    # ------------------------------------------------------------------
    {
        # Double age gate: first "Yes", then "I'M AT LEAST 21 YEARS OLD".
        # Uses iframe to goshango.com (confirmed from scrape logs 2026-02-12).
        "name": "SLV Dispensary",
        "slug": "slv",
        "platform": "dutchie",
        "url": "https://slvcannabis.com/specials/",
        "embed_type": "iframe",    # was "direct" — wrong; goshango.com iframe detected in logs
        "is_active": False,  # chronic timeouts (double age gate + goshango iframe) — demoted pre-beta
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # CARROT SITES (6) — JS widget via nevada-store-core.getcarrot.io
    # ------------------------------------------------------------------
    {
        "name": "Wallflower Blue Diamond",
        "slug": "wallflower-blue-diamond",
        "platform": "carrot",
        "url": "https://wallflower-house.com/store/category/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Inyo Fine Cannabis",
        "slug": "inyo",
        "platform": "carrot",
        "url": "https://inyolasvegas.com/delivery-pickup-orders/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Jenny's Dispensary",
        "slug": "jennys",
        "platform": "carrot",
        "url": "https://jennysdispensary.com/store/category/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Euphoria Wellness uses iHeartJane (store #1173) via Jane Roots
        # headless integration.  Primary URL is the Jane embed; fallback
        # is their own /menu/category/specials page (JS-rendered).
        "name": "Euphoria Wellness",
        "slug": "euphoria-wellness",
        "platform": "jane",
        "url": "https://www.iheartjane.com/embed/stores/1173/menu",
        "fallback_url": "https://euphoriawellnessnv.com/menu/category/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Silver Sage Wellness",
        "slug": "silver-sage",
        "platform": "carrot",
        "url": "https://store.sswlv.com/category/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "ShowGrow",
        "slug": "showgrow",
        "platform": "carrot",
        "url": "https://store.showgrowvegas.com/",
        "is_active": True,
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # AIQ / DISPENSE SITES (3) — Alpine IQ React SPA menus
    # + 4 former-AIQ sites now on Dutchie (Nevada Made)
    # ------------------------------------------------------------------
    {
        # Recon: 628 products, alpineiq scripts detected
        "name": "Green (Hualapai)",
        "slug": "green-hualapai",
        "platform": "aiq",
        "url": "https://greennv.com/menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Recon: 197 products, score 7
        "name": "Pisos",
        "slug": "pisos",
        "platform": "aiq",
        "url": "https://www.pisoslv.com/menu/rec",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Recon (Feb 2026): switched from AIQ to Dutchie.
        # Dutchie page: dutchie.com/dispensaries/jardin-premium-cannabis-dispensary
        # jardinlasvegas.com/store now embeds Dutchie (no longer AIQ).
        "name": "Jardin",
        "slug": "jardin",
        "platform": "dutchie",
        "url": "https://dutchie.com/embedded-menu/jardin-premium-cannabis-dispensary/specials",
        "fallback_url": "https://www.jardinlasvegas.com/store",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "direct",
    },
    {
        # Switched from AIQ to Dutchie — specials page with embedded menu.
        # Added fallback URL so we go direct to Dutchie if primary fails.
        "name": "Nevada Made Laughlin",
        "slug": "nevada-made-casino-dr",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-laughlin/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/nevada-made-marijuana-laughlin/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — specials page with embedded menu
        "name": "Nevada Made Charleston",
        "slug": "nevada-made-charleston",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-charleston/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/nevada-made-marijuana-charleston/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — was 403 on old platform, now active
        "name": "Nevada Made Henderson",
        "slug": "nevada-made-henderson",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-henderson1/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/nevada-made-marijuana-henderson1/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — was 403 on old platform, now active
        "name": "Nevada Made Warm Springs",
        "slug": "nevada-made-warm-springs",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-warm-springs/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/nevada-made-marijuana-warm-springs/specials",
        "is_active": True,
        "region": "southern-nv",
    },

    # ==================================================================
    # MICHIGAN — 198 dispensaries. Dutchie-dominant market (350-400 on
    # Dutchie alone). Organized by region: Detroit Metro → Ann Arbor →
    # Grand Rapids/West MI → Kalamazoo → Lansing → Flint/Saginaw →
    # Northern MI → Upper Peninsula → Southwest MI border.
    # ==================================================================

    # ── LUME CANNABIS (MI's largest chain, 38 locations, Dutchie) ────
    {"name": "Lume Walled Lake", "slug": "lume-walled-lake", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-walled-lake", "is_active": True, "region": "michigan"},
    {"name": "Lume Monroe", "slug": "lume-monroe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-monroe", "is_active": True, "region": "michigan"},
    {"name": "Lume Berkley", "slug": "lume-berkley", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-berkley", "is_active": True, "region": "michigan"},
    {"name": "Lume Southfield", "slug": "lume-southfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-southfield", "is_active": True, "region": "michigan"},
    {"name": "Lume Oxford", "slug": "lume-oxford", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-oxford", "is_active": True, "region": "michigan"},
    {"name": "Lume Ann Arbor", "slug": "lume-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-ann-arbor", "is_active": True, "region": "michigan"},
    {"name": "Lume Grand Rapids", "slug": "lume-grand-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-grand-rapids", "is_active": True, "region": "michigan"},
    {"name": "Lume Grand Rapids Beltline", "slug": "lume-gr-beltline", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-grand-rapids-beltline", "is_active": True, "region": "michigan"},
    {"name": "Lume Cedar Springs", "slug": "lume-cedar-springs", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-cedar-springs", "is_active": True, "region": "michigan"},
    {"name": "Lume Lowell", "slug": "lume-lowell", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-lowell", "is_active": True, "region": "michigan"},
    {"name": "Lume Kalamazoo", "slug": "lume-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Lume Portage", "slug": "lume-portage", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-portage", "is_active": True, "region": "michigan"},
    {"name": "Lume Coldwater", "slug": "lume-coldwater", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-coldwater", "is_active": True, "region": "michigan"},
    {"name": "Lume Jackson", "slug": "lume-jackson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-jackson", "is_active": True, "region": "michigan"},
    {"name": "Lume Adrian", "slug": "lume-adrian", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-adrian", "is_active": True, "region": "michigan"},
    {"name": "Lume Petersburg", "slug": "lume-petersburg", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-petersburg", "is_active": True, "region": "michigan"},
    {"name": "Lume Holly", "slug": "lume-holly", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-holly", "is_active": True, "region": "michigan"},
    {"name": "Lume Owosso", "slug": "lume-owosso", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-owosso", "is_active": True, "region": "michigan"},
    {"name": "Lume Mt Pleasant", "slug": "lume-mt-pleasant", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-mt-pleasant", "is_active": True, "region": "michigan"},
    {"name": "Lume Big Rapids", "slug": "lume-big-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-big-rapids", "is_active": True, "region": "michigan"},
    {"name": "Lume Saginaw", "slug": "lume-saginaw", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-saginaw", "is_active": True, "region": "michigan"},
    {"name": "Lume Birch Run", "slug": "lume-birch-run", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-birch-run", "is_active": True, "region": "michigan"},
    {"name": "Lume Frankenmuth", "slug": "lume-frankenmuth", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-frankenmuth", "is_active": True, "region": "michigan"},
    {"name": "Lume Cadillac", "slug": "lume-cadillac", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-cadillac", "is_active": True, "region": "michigan"},
    {"name": "Lume Evart", "slug": "lume-evart", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-evart", "is_active": True, "region": "michigan"},
    {"name": "Lume Petoskey", "slug": "lume-petoskey", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-petoskey", "is_active": True, "region": "michigan"},
    {"name": "Lume Traverse City", "slug": "lume-traverse-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-traverse-city", "is_active": True, "region": "michigan"},
    {"name": "Lume Gaylord", "slug": "lume-gaylord", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-gaylord", "is_active": True, "region": "michigan"},
    {"name": "Lume Mackinaw City", "slug": "lume-mackinaw", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-mackinaw-city", "is_active": True, "region": "michigan"},
    {"name": "Lume Honor", "slug": "lume-honor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-honor", "is_active": True, "region": "michigan"},
    {"name": "Lume Houghton", "slug": "lume-houghton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-houghton", "is_active": True, "region": "michigan"},
    {"name": "Lume Iron Mountain", "slug": "lume-iron-mountain", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-iron-mountain", "is_active": True, "region": "michigan"},
    {"name": "Lume Escanaba", "slug": "lume-escanaba", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-escanaba", "is_active": True, "region": "michigan"},
    {"name": "Lume Menominee", "slug": "lume-menominee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lumemenominee-rec", "is_active": True, "region": "michigan"},
    {"name": "Lume Manistique", "slug": "lume-manistique", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-manistique", "is_active": True, "region": "michigan"},
    {"name": "Lume Negaunee", "slug": "lume-negaunee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-negaunee", "is_active": True, "region": "michigan"},
    {"name": "Lume Sault Ste Marie", "slug": "lume-sault-ste-marie", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lume-cannabis-co-sault-ste-marie", "is_active": True, "region": "michigan"},

    # ── SKYMINT (20+ locations, Dutchie — acquired 3Fifteen) ────────
    {"name": "Skymint Ann Arbor", "slug": "skymint-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-ann-arbor", "is_active": True, "region": "michigan"},
    {"name": "Skymint Hazel Park", "slug": "skymint-hazel-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-hazel-park", "is_active": True, "region": "michigan"},
    {"name": "Skymint East Lansing", "slug": "skymint-east-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-east-lansing", "is_active": True, "region": "michigan"},
    {"name": "Skymint Grand Rapids", "slug": "skymint-grand-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-division", "is_active": True, "region": "michigan"},
    {"name": "Skymint Kalamazoo", "slug": "skymint-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Skymint Portage", "slug": "skymint-portage", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-portage", "is_active": True, "region": "michigan"},
    {"name": "Skymint Coldwater", "slug": "skymint-coldwater", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-coldwater", "is_active": True, "region": "michigan"},
    {"name": "Skymint Saginaw", "slug": "skymint-saginaw", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-saginaw", "is_active": True, "region": "michigan"},
    {"name": "Skymint Nunica", "slug": "skymint-nunica", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-nunica", "is_active": True, "region": "michigan"},
    {"name": "Skymint Muskegon", "slug": "skymint-muskegon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/skymint-muskegon", "is_active": True, "region": "michigan"},
    {"name": "Skymint 3Fifteen Morenci", "slug": "skymint-3fifteen", "platform": "dutchie", "url": "https://dutchie.com/dispensary/3fifteen", "is_active": True, "region": "michigan"},

    # ── JARS CANNABIS (20+ locations, Dutchie) ──────────────────────
    {"name": "JARS Ann Arbor", "slug": "jars-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-ann-arbor-packard", "is_active": True, "region": "michigan"},
    {"name": "JARS Grand Rapids", "slug": "jars-grand-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-grand-rapids", "is_active": True, "region": "michigan"},
    {"name": "JARS Mt Clemens", "slug": "jars-mt-clemens", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-mount-clemens", "is_active": True, "region": "michigan"},
    {"name": "JARS East Detroit", "slug": "jars-east-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/district-3-detroit", "is_active": True, "region": "michigan"},
    {"name": "JARS Hazel Park", "slug": "jars-hazel-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-hazel-park", "is_active": True, "region": "michigan"},
    {"name": "JARS Monroe", "slug": "jars-monroe-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-monroe", "is_active": True, "region": "michigan"},
    {"name": "JARS Mt Pleasant", "slug": "jars-mt-pleasant", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-mt-pleasant", "is_active": True, "region": "michigan"},
    {"name": "JARS Saginaw", "slug": "jars-saginaw", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-saginaw-rec", "is_active": True, "region": "michigan"},
    {"name": "JARS New Buffalo", "slug": "jars-new-buffalo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-new-buffalo-obrien", "is_active": True, "region": "michigan"},
    {"name": "JARS Saugatuck", "slug": "jars-saugatuck", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-saugatuck", "is_active": True, "region": "michigan"},
    {"name": "JARS Muskegon", "slug": "jars-muskegon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-muskegon1", "is_active": True, "region": "michigan"},
    {"name": "JARS Oxford", "slug": "jars-oxford", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-oxford-rec", "is_active": True, "region": "michigan"},

    # ── CLOUD CANNABIS (10+ locations, Dutchie) ─────────────────────
    {"name": "Cloud Cannabis Detroit", "slug": "cloud-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-detroit", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Utica", "slug": "cloud-utica", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-utica", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis New Baltimore", "slug": "cloud-new-baltimore", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-new-baltimore", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Grand Rapids", "slug": "cloud-grand-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/grand-rapids", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Kalamazoo", "slug": "cloud-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Muskegon", "slug": "cloud-muskegon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-muskegon", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Traverse City", "slug": "cloud-traverse-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-traverse-city", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Gaylord", "slug": "cloud-gaylord", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud-cannabis-co-gaylord-rec", "is_active": True, "region": "michigan"},

    # ── JOYOLOGY (10+ locations, Dutchie) ───────────────────────────
    {"name": "Joyology Center Line", "slug": "joyology-center-line", "platform": "dutchie", "url": "https://dutchie.com/dispensary/joyology-of-center-line", "is_active": True, "region": "michigan"},
    {"name": "Joyology Wayne", "slug": "joyology-wayne", "platform": "dutchie", "url": "https://dutchie.com/dispensary/joyology-by-holistic-health-wayne", "is_active": True, "region": "michigan"},
    {"name": "Joyology Orion", "slug": "joyology-orion", "platform": "dutchie", "url": "https://dutchie.com/dispensary/grams-club-rec", "is_active": True, "region": "michigan"},
    {"name": "Joyology Monroe", "slug": "joyology-monroe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/grams-club-monroe-rec", "is_active": True, "region": "michigan"},
    {"name": "Joyology Portage", "slug": "joyology-portage", "platform": "dutchie", "url": "https://dutchie.com/dispensary/joyology-of-portage", "is_active": True, "region": "michigan"},
    {"name": "Joyology Three Rivers", "slug": "joyology-three-rivers", "platform": "dutchie", "url": "https://dutchie.com/dispensary/joyology-three-rivers", "is_active": True, "region": "michigan"},
    {"name": "Joyology Allegan", "slug": "joyology-allegan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/joyology-allegan", "is_active": True, "region": "michigan"},
    {"name": "Joyology Memphis", "slug": "joyology-memphis", "platform": "dutchie", "url": "https://dutchie.com/dispensary/joyology-of-memphis", "is_active": True, "region": "michigan"},
    {"name": "Joyology Mt Pleasant", "slug": "joyology-mt-pleasant", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mt-pleasant-joyology", "is_active": True, "region": "michigan"},

    # ── HIGH PROFILE / C3 (7+ locations, Dutchie) ──────────────────
    {"name": "High Profile Muskegon", "slug": "hp-muskegon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-profile-muskegon", "is_active": True, "region": "michigan"},
    {"name": "High Profile Grant", "slug": "hp-grant", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-profile-grant", "is_active": True, "region": "michigan"},
    {"name": "High Profile Webberville", "slug": "hp-webberville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-profile-webberville", "is_active": True, "region": "michigan"},
    {"name": "High Profile Buchanan", "slug": "hp-buchanan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-profile-buchanan", "is_active": True, "region": "michigan"},
    {"name": "High Profile Constantine", "slug": "hp-constantine", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-tops", "is_active": True, "region": "michigan"},
    {"name": "High Profile Marquette", "slug": "hp-marquette", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabis-lupus-cafe", "is_active": True, "region": "michigan"},

    # ── PINNACLE EMPORIUM (5+ locations, Dutchie) ──────────────────
    {"name": "Pinnacle Buchanan", "slug": "pinnacle-buchanan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pinnacle-emporium-buchanan", "is_active": True, "region": "michigan"},
    {"name": "Pinnacle Morenci", "slug": "pinnacle-morenci", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pinnacle-canna-morenci", "is_active": True, "region": "michigan"},
    {"name": "Pinnacle Camden", "slug": "pinnacle-camden", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pinnacle-canna-camden", "is_active": True, "region": "michigan"},
    {"name": "Pinnacle Addison", "slug": "pinnacle-addison", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pinnacle-emporium-addison", "is_active": True, "region": "michigan"},
    {"name": "Pinnacle Edmore", "slug": "pinnacle-edmore", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pinnacle-emporium-edmore", "is_active": True, "region": "michigan"},

    # ── PLEASANTREES (5 locations, Dutchie) ─────────────────────────
    {"name": "Pleasantrees Hamtramck", "slug": "pleasantrees-hamtramck", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pleasantrees-detroit", "is_active": True, "region": "michigan"},
    {"name": "Pleasantrees Mt Clemens", "slug": "pleasantrees-mt-clemens", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pleasantrees-mt-clemens", "is_active": True, "region": "michigan"},
    {"name": "Pleasantrees Lincoln Park", "slug": "pleasantrees-lincoln-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pleasantrees-lincoln-park", "is_active": True, "region": "michigan"},
    {"name": "Pleasantrees East Lansing", "slug": "pleasantrees-east-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pleasantrees", "is_active": True, "region": "michigan"},
    {"name": "Pleasantrees Houghton Lake", "slug": "pleasantrees-houghton-lake", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pleasantrees-houghton-lake1", "is_active": True, "region": "michigan"},

    # ── HERBANA (3 locations, Dutchie) ──────────────────────────────
    {"name": "Herbana Ann Arbor", "slug": "herbana-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/herbana", "is_active": True, "region": "michigan"},
    {"name": "Herbana Lansing", "slug": "herbana-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/herbana-lansing", "is_active": True, "region": "michigan"},
    {"name": "Herbana Kalamazoo", "slug": "herbana-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/herbana-kalamazoo", "is_active": True, "region": "michigan"},

    # ── DETROIT METRO INDEPENDENTS (Dutchie) ────────────────────────
    {"name": "Supergood Detroit", "slug": "supergood-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/supergood-detroit", "is_active": True, "region": "michigan"},
    {"name": "Hyde Cannabis Detroit", "slug": "hyde-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hyde-cannabis-co", "is_active": True, "region": "michigan"},
    {"name": "LIV Cannabis Detroit", "slug": "liv-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liv-detroit-rec", "is_active": True, "region": "michigan"},
    {"name": "LIV Cannabis Ferndale", "slug": "liv-ferndale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liv-ferndale", "is_active": True, "region": "michigan"},
    {"name": "ZAZA Detroit", "slug": "zaza-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ZAZA-detroit", "is_active": True, "region": "michigan"},
    {"name": "Oz Cannabis Detroit", "slug": "oz-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/oz-cannabis-detroit", "is_active": True, "region": "michigan"},
    {"name": "High Club Detroit", "slug": "high-club-detroit", "platform": "dutchie", "url": "https://dutchie.com/dispensary/detroit-herbal-center1", "is_active": True, "region": "michigan"},
    {"name": "Dispo Hazel Park", "slug": "dispo-hazel-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dispo-hazel-park", "is_active": True, "region": "michigan"},
    {"name": "Green Pharm Hazel Park", "slug": "green-pharm-hazel-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-pharm-hazel-park-rec", "is_active": True, "region": "michigan"},
    {"name": "Clarity Hazel Park", "slug": "clarity-hazel-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/breeze", "is_active": True, "region": "michigan"},
    {"name": "King of Budz Ferndale", "slug": "king-budz-ferndale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ferndale-mi", "is_active": True, "region": "michigan"},

    # ── LANSING/FLINT/SAGINAW AREA (Dutchie) ───────────────────────
    {"name": "First Class Lansing", "slug": "first-class-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/first-class-lansing", "is_active": True, "region": "michigan"},
    {"name": "Bazonzoes South Lansing", "slug": "bazonzoes-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bazonzoes-south-lansing", "is_active": True, "region": "michigan"},
    {"name": "Bacco Farms Flint", "slug": "bacco-farms-flint", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bacco-farms-flint", "is_active": True, "region": "michigan"},
    {"name": "Smok Flint", "slug": "smok-flint", "platform": "dutchie", "url": "https://dutchie.com/dispensary/smok-flint-michigan", "is_active": True, "region": "michigan"},

    # ── GAGE / COOKIES MICHIGAN (Gage rebranded to Cookies, Dutchie) ─
    {"name": "Gage Ferndale MI", "slug": "gage-ferndale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-ferndale", "is_active": True, "region": "michigan"},
    {"name": "Gage Kalamazoo MI", "slug": "gage-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-cannabis-co-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Gage Traverse City MI", "slug": "gage-traverse-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-traverse-city", "is_active": True, "region": "michigan"},
    {"name": "Gage Adrian MI", "slug": "gage-adrian", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-adrian", "is_active": True, "region": "michigan"},
    {"name": "Gage Bay City MI", "slug": "gage-bay-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-bay-city", "is_active": True, "region": "michigan"},
    {"name": "Gage Battle Creek MI", "slug": "gage-battle-creek", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-cannabis-co-battle-creek", "is_active": True, "region": "michigan"},
    {"name": "Gage Lansing MI", "slug": "gage-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-cannabis-co-lansing", "is_active": True, "region": "michigan"},
    {"name": "Gage Burton MI", "slug": "gage-burton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gage-cannabis-co-burton", "is_active": True, "region": "michigan"},
    {"name": "Cookies Ann Arbor MI", "slug": "cookies-ann-arbor-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-ann-arbor", "is_active": True, "region": "michigan"},
    {"name": "Cookies Detroit MI", "slug": "cookies-detroit-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-detroit", "is_active": True, "region": "michigan"},
    {"name": "Cookies Kalamazoo MI", "slug": "cookies-kalamazoo-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Cookies Jackson MI", "slug": "cookies-jackson-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-jackson", "is_active": True, "region": "michigan"},
    {"name": "Cookies Grand Rapids MI", "slug": "cookies-gr-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/noxx-ann-st", "is_active": True, "region": "michigan"},

    # ── HOUSE OF DANK (Detroit metro, 15+ locations, Dutchie) ─────────
    {"name": "House of Dank Center Line MI", "slug": "hod-center-line", "platform": "dutchie", "url": "https://dutchie.com/dispensary/centerlinerec", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Ypsilanti MI", "slug": "hod-ypsilanti", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-ypsilanti", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Fort Gratiot MI", "slug": "hod-fort-gratiot", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-fort-gratiot", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Monroe MI", "slug": "hod-monroe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-monroe-laplaisance", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Inkster MI", "slug": "hod-inkster", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-inkster", "is_active": True, "region": "michigan"},
    {"name": "House of Dank 8 Mile MI", "slug": "hod-8mile-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-recreational-cannabis-8-mile", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Ann Arbor MI", "slug": "hod-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-ann-arbor-rec", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Grand Rapids MI", "slug": "hod-grand-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-grand-rapids", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Lansing MI", "slug": "hod-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-cannabis-company", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Garden City MI", "slug": "hod-garden-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-garden-city", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Kalamazoo MI", "slug": "hod-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-kalamazoo-rec", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Saginaw MI", "slug": "hod-saginaw", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-saginaw", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Traverse City MI", "slug": "hod-traverse-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-traverse-city-rec", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Lapeer MI", "slug": "hod-lapeer", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-lapeer", "is_active": True, "region": "michigan"},
    {"name": "House of Dank New Buffalo MI", "slug": "hod-new-buffalo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dank-new-buffalo", "is_active": True, "region": "michigan"},

    # ── EXCLUSIVE CANNABIS (8 locations, Dutchie) ─────────────────────
    {"name": "Exclusive Ann Arbor MI", "slug": "exclusive-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-ann-arbor", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Kalamazoo MI", "slug": "exclusive-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Coldwater MI", "slug": "exclusive-coldwater", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-cold-water", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Gaylord MI", "slug": "exclusive-gaylord", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-gaylord-rec", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Grand Rapids MI", "slug": "exclusive-grand-rapids", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-grand-rapids", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Lowell MI", "slug": "exclusive-lowell", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-lowell", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Monroe MI", "slug": "exclusive-monroe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/heads-monroe", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Muskegon MI", "slug": "exclusive-muskegon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/exclusive-muskegon", "is_active": True, "region": "michigan"},

    # ── PUFF CANNABIS (13 locations, Dutchie) ─────────────────────────
    {"name": "Puff Cannabis Traverse City MI", "slug": "puff-traverse-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-traverse-city-med", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Hamtramck MI", "slug": "puff-hamtramck", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-canna-co-hamtramck-rec", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Bay City MI", "slug": "puff-bay-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-bay-city-rec", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Kalamazoo MI", "slug": "puff-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-kalamazoo-rec", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Monroe MI", "slug": "puff-monroe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-monroe-rec", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis River Rouge MI", "slug": "puff-river-rouge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-river-rouge", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Sturgis MI", "slug": "puff-sturgis", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-canna-co-sturgis-rec", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Utica MI", "slug": "puff-utica", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-cannabis-utica", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Center Line MI", "slug": "puff-center-line", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-centerline", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis New Buffalo MI", "slug": "puff-new-buffalo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-new-buffalo", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Madison Hts MI", "slug": "puff-madison-hts", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-cannabis-co-madison-heights-rec", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Oscoda MI", "slug": "puff-oscoda", "platform": "dutchie", "url": "https://dutchie.com/dispensary/puff-oscoda-rec", "is_active": True, "region": "michigan"},

    # ── NOXX CANNABIS (verified locations, Dutchie) ───────────────────
    {"name": "NOXX 28th St Grand Rapids MI", "slug": "noxx-28th-st", "platform": "dutchie", "url": "https://dutchie.com/dispensary/noxx-28th-st", "is_active": True, "region": "michigan"},
    {"name": "NOXX Plainfield Grand Rapids MI", "slug": "noxx-plainfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/noxx-plainfield-ave", "is_active": True, "region": "michigan"},
    {"name": "NOXX Woodward MI", "slug": "noxx-woodward", "platform": "dutchie", "url": "https://dutchie.com/dispensary/noxx-woodward", "is_active": True, "region": "michigan"},

    # ── CONSUME CANNABIS MI (verified locations, Dutchie) ─────────────
    {"name": "Consume Quincy MI", "slug": "consume-mi-quincy", "platform": "dutchie", "url": "https://dutchie.com/dispensary/consume-quincy-rec", "is_active": True, "region": "michigan"},
    {"name": "Consume Adrian MI", "slug": "consume-mi-adrian", "platform": "dutchie", "url": "https://dutchie.com/dispensary/consume-cannabis-adrian", "is_active": True, "region": "michigan"},
    {"name": "Consume Ionia MI", "slug": "consume-mi-ionia", "platform": "dutchie", "url": "https://dutchie.com/dispensary/consume-ionia-rec", "is_active": True, "region": "michigan"},
    {"name": "Consume Alma MI", "slug": "consume-mi-alma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/consume-alma-rec", "is_active": True, "region": "michigan"},
    {"name": "Consume Lapeer MI", "slug": "consume-mi-lapeer", "platform": "dutchie", "url": "https://dutchie.com/dispensary/consume-lapeer-rec", "is_active": True, "region": "michigan"},
    {"name": "Consume Harrisville MI", "slug": "consume-mi-harrisville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/consume-cannabis-harrisville", "is_active": True, "region": "michigan"},

    # ── DUNEGRASS CO. (7 verified locations, Dutchie) ────────────────
    {"name": "Dunegrass Manistee MI", "slug": "dunegrass-manistee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-co", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass Cadillac MI", "slug": "dunegrass-cadillac", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-co-cadillac", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass Marquette MI", "slug": "dunegrass-marquette", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-co-marquette", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass TC West MI", "slug": "dunegrass-tc-west", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-tc-west", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass TC Downtown MI", "slug": "dunegrass-tc-downtown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-tc-downtown", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass Beulah MI", "slug": "dunegrass-beulah", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-co-beulah", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass Gaylord MI", "slug": "dunegrass-gaylord", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dunegrass-co-gaylord", "is_active": True, "region": "michigan"},

    # ── INFORMATION ENTROPY (Ann Arbor, Dutchie) ─────────────────────
    {"name": "Information Entropy Broadway MI", "slug": "info-entropy-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/informatiomn-entropy", "is_active": True, "region": "michigan"},
    {"name": "Information Entropy Downtown MI", "slug": "info-entropy-downtown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/information-entropy-miller", "is_active": True, "region": "michigan"},

    # ── LAKE EFFECT MI (SW MI, Dutchie) ───────────────────────────────
    {"name": "Lake Effect Kalamazoo MI", "slug": "lake-effect-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lake-effect-kalamazoo-rec", "is_active": True, "region": "michigan"},

    # ── PURE OPTIONS MI (Lansing area, Dutchie) ──────────────────────
    {"name": "Pure Options Lansing MI", "slug": "pure-options-lansing", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pure-options-lansing", "is_active": True, "region": "michigan"},
    {"name": "Pure Options Frandor MI", "slug": "pure-options-frandor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pure-options-frandor", "is_active": True, "region": "michigan"},
    {"name": "Pure Options Mt Pleasant MI", "slug": "pure-options-mt-pleasant", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pure-options-mt-pleasant", "is_active": True, "region": "michigan"},

    # ── FIRE STATION CANNABIS (UP, Dutchie) ──────────────────────────
    {"name": "Fire Station Marquette MI", "slug": "fire-station-marquette", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-fire-station-marquette", "is_active": True, "region": "michigan"},
    {"name": "Fire Station Negaunee MI", "slug": "fire-station-negaunee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-fire-station-negaunee", "is_active": True, "region": "michigan"},
    {"name": "Fire Station Hannahville MI", "slug": "fire-station-hannahville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-fire-station-hannahville", "is_active": True, "region": "michigan"},

    # ── MICHIGAN SUPPLY & PROVISIONS (Dutchie) ─────────────────────────
    {"name": "Michigan Supply Ann Arbor", "slug": "mi-supply-ann-arbor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/michigan-supply-and-provisions-ann-arbor", "is_active": True, "region": "michigan"},
    {"name": "Michigan Supply Morenci MI", "slug": "mi-supply-morenci", "platform": "dutchie", "url": "https://dutchie.com/dispensary/michigan-supply-and-provisions-morenci", "is_active": True, "region": "michigan"},
    {"name": "Michigan Supply Grand River MI", "slug": "mi-supply-grand-river", "platform": "dutchie", "url": "https://dutchie.com/dispensary/michigan-supply-and-provisions-grand-river", "is_active": True, "region": "michigan"},

    # ── MICHIGAN ADDITIONAL INDEPENDENTS (Dutchie) ───────────────────
    {"name": "Kai Cannabis Adrian MI", "slug": "kai-adrian", "platform": "dutchie", "url": "https://dutchie.com/dispensary/kai-cannabis-co", "is_active": True, "region": "michigan"},
    {"name": "Endo Cannabis Kalamazoo MI", "slug": "endo-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/endo-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "GLH Flint MI", "slug": "glh-flint", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-labs-flint", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Coldwater MI", "slug": "nirvana-coldwater-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nirvana-center-coldwater", "is_active": True, "region": "michigan"},
    {"name": "Dispo Battle Creek MI", "slug": "dispo-battle-creek", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dispo-battle-creek", "is_active": True, "region": "michigan"},
    {"name": "The Refinery Kalamazoo MI", "slug": "refinery-kalamazoo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-refinery-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Sunset Coast Provisions MI", "slug": "sunset-coast-mi", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sunset-coast-provisions", "is_active": True, "region": "michigan"},
    {"name": "Lit Provisioning Evart MI", "slug": "lit-evart", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lit-provisioning-evart", "is_active": True, "region": "michigan"},

    # ── CURALEAF MICHIGAN (Curaleaf platform) ───────────────────────
    # Curaleaf exited Michigan in late 2023 — all MI stores deactivated
    {"name": "Curaleaf MI Kalamazoo", "slug": "curaleaf-mi-kalamazoo", "platform": "curaleaf", "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-kalamazoo", "is_active": False, "region": "michigan"},
    {"name": "Curaleaf MI Bangor", "slug": "curaleaf-mi-bangor", "platform": "curaleaf", "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-bangor", "is_active": False, "region": "michigan"},

    # ── ZEN LEAF MICHIGAN (Verano — same platform as NV) ────────────
    {"name": "Zen Leaf Buchanan MI", "slug": "zen-leaf-buchanan", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/buchanan/menu/recreational", "is_active": True, "region": "michigan"},

    # ==================================================================
    # ILLINOIS — 150 dispensaries. MSO-dominated: Rise (GTI), Curaleaf,
    # Zen Leaf (Verano). Dutchie chains: Ascend, Windy City, Thrive IL,
    # Mission, Maribis, Planet 13, Greenhouse, Ivy Hall (10), MOCA,
    # Dispensary33, BLOC (5), Dutchess (5), Nature's Treatment (2).
    # Jane chains: Beyond/Hello, Verilife, Consume, nuEra,
    # EarthMed, Hatch, Sunnyside/Cresco, 3C, Mapleglen.
    # ==================================================================

    # ── RISE ILLINOIS (GTI — 11 locations, Rise platform) ──────────
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise Mundelein IL", "slug": "rise-mundelein", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/mundelein/1342/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Niles IL", "slug": "rise-niles", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/niles/1812/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Naperville IL", "slug": "rise-naperville", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/naperville/2265/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Lake in the Hills IL", "slug": "rise-lake-hills", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/lake-in-the-hills/2901/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Effingham IL", "slug": "rise-effingham", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/effingham/1497/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Canton IL", "slug": "rise-canton", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/canton/1343/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Quincy IL", "slug": "rise-quincy", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/quincy/1338/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Joliet IL", "slug": "rise-joliet", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/joliet-colorado/1340/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Charleston IL", "slug": "rise-charleston", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/charleston/2525/recreational-menu/", "is_active": False, "region": "illinois"},
    {"name": "Rise Joliet Rock Creek IL", "slug": "rise-joliet-rock-creek", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/joliet-rock-creek/1344/recreational-menu/", "is_active": False, "region": "illinois"},

    # ── CURALEAF ILLINOIS (Curaleaf platform) ──────────────────────
    {"name": "Curaleaf IL Weed Street", "slug": "curaleaf-il-weed-st", "platform": "curaleaf", "url": "https://curaleaf.com/shop/illinois/curaleaf-il-weed-street", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Worth", "slug": "curaleaf-il-worth", "platform": "curaleaf", "url": "https://curaleaf.com/shop/illinois/curaleaf-il-worth", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Morris", "slug": "curaleaf-il-morris", "platform": "curaleaf", "url": "https://curaleaf.com/shop/illinois/curaleaf-il-morris", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Skokie", "slug": "curaleaf-il-skokie", "platform": "curaleaf", "url": "https://curaleaf.com/shop/illinois/curaleaf-il-skokie", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL New Lenox", "slug": "curaleaf-il-new-lenox", "platform": "curaleaf", "url": "https://curaleaf.com/shop/illinois/curaleaf-il-new-lenox", "is_active": True, "region": "illinois"},

    # ── ZEN LEAF ILLINOIS (Verano — 10 locations) ──────────────────
    {"name": "Zen Leaf St. Charles IL", "slug": "zen-leaf-st-charles", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/st-charles/menu/recreational", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Naperville IL", "slug": "zen-leaf-naperville", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/naperville/menu", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Lombard IL", "slug": "zen-leaf-lombard", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/lombard/menu", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Chicago West Loop", "slug": "zen-leaf-west-loop", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/chicago-west-loop/menu", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Highland Park IL", "slug": "zen-leaf-highland-park", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/highland-park/menu/recreational", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Chicago Pilsen", "slug": "zen-leaf-pilsen", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/chicago-pilsen/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Prospect Heights IL", "slug": "zen-leaf-prospect-heights", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/prospect-heights/menu", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Evanston IL", "slug": "zen-leaf-evanston", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/evanston/menu", "is_active": True, "region": "illinois"},
    {"name": "Zen Leaf Aurora IL", "slug": "zen-leaf-aurora", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/aurora/menu", "is_active": True, "region": "illinois"},

    # ── ASCEND CANNABIS IL (10 locations, Dutchie) ────────────────
    {"name": "Ascend Collinsville IL", "slug": "ascend-collinsville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/collinsville-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Springfield Adams IL", "slug": "ascend-springfield-adams", "platform": "dutchie", "url": "https://dutchie.com/dispensary/springfield-adams-street-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Springfield Horizon IL", "slug": "ascend-springfield-horizon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/springfield-horizon-drive-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Fairview Heights IL", "slug": "ascend-fairview-heights", "platform": "dutchie", "url": "https://dutchie.com/dispensary/fairview-heights-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Tinley Park IL", "slug": "ascend-tinley-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/chicago-tinley-park-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Chicago Ridge IL", "slug": "ascend-chicago-ridge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/chicago-ridge-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Logan Square IL", "slug": "ascend-logan-square", "platform": "dutchie", "url": "https://dutchie.com/dispensary/chicago-logan-square-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Midway IL", "slug": "ascend-midway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/chicago-midway-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend River North IL", "slug": "ascend-river-north", "platform": "dutchie", "url": "https://dutchie.com/dispensary/river-north-illinois", "is_active": True, "region": "illinois"},
    {"name": "Ascend Northlake IL", "slug": "ascend-northlake", "platform": "dutchie", "url": "https://dutchie.com/dispensary/northlake-illinois", "is_active": True, "region": "illinois"},

    # ── WINDY CITY CANNABIS IL (5 locations, Dutchie) ─────────────
    {"name": "Windy City Highwood IL", "slug": "wcc-highwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/windy-city-cannabis-highwood", "is_active": True, "region": "illinois"},
    {"name": "Windy City Carpentersville IL", "slug": "wcc-carpentersville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/windy-city-cannabis-carpentersville", "is_active": True, "region": "illinois"},
    {"name": "Windy City Litchfield IL", "slug": "wcc-litchfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/windy-city-cannabis-litchfield", "is_active": True, "region": "illinois"},
    {"name": "Windy City Homewood IL", "slug": "wcc-homewood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/windy-city-cannabis-homewood", "is_active": True, "region": "illinois"},
    {"name": "Windy City Macomb IL", "slug": "wcc-macomb", "platform": "dutchie", "url": "https://dutchie.com/dispensary/windy-city-cannabis-macomb", "is_active": True, "region": "illinois"},

    # ── THRIVE ILLINOIS (5 locations, Dutchie — southern IL) ──────
    {"name": "Thrive IL Anna", "slug": "thrive-il-anna", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-il-anna", "is_active": True, "region": "illinois"},
    {"name": "Thrive IL Harrisburg", "slug": "thrive-il-harrisburg", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-il-harrisburg", "is_active": True, "region": "illinois"},
    {"name": "Thrive IL Casey", "slug": "thrive-il-casey", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-illinois-casey-rec", "is_active": True, "region": "illinois"},
    {"name": "Thrive IL Metropolis", "slug": "thrive-il-metropolis", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-il-metropolis", "is_active": True, "region": "illinois"},
    {"name": "Thrive IL Mt Vernon", "slug": "thrive-il-mt-vernon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-il-mt-vernon", "is_active": True, "region": "illinois"},

    # ── MISSION DISPENSARIES IL (3 locations, Dutchie) ────────────
    {"name": "Mission South Shore IL", "slug": "mission-south-chicago", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mission-south-shore", "is_active": True, "region": "illinois"},
    {"name": "Mission Calumet City IL", "slug": "mission-calumet-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mission-calumet-city", "is_active": True, "region": "illinois"},
    {"name": "Mission Norridge IL", "slug": "mission-norridge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mission-norridge", "is_active": True, "region": "illinois"},

    # ── MARIBIS IL (2 locations, Dutchie) ─────────────────────────
    {"name": "Maribis Chicago IL", "slug": "maribis-chicago", "platform": "dutchie", "url": "https://dutchie.com/dispensary/maribis-chicago", "is_active": True, "region": "illinois"},
    {"name": "Maribis Springfield IL", "slug": "maribis-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/maribis-lindbergh", "is_active": True, "region": "illinois"},

    # ── CURALEAF IL — NEW LOCATIONS ON DUTCHIE (5 new) ────────────
    {"name": "Curaleaf IL Deerfield", "slug": "curaleaf-il-deerfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-il-deerfield", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Northbrook", "slug": "curaleaf-il-northbrook", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-il-northbrook", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Westmont", "slug": "curaleaf-il-westmont", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-il-westmont", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Mokena", "slug": "curaleaf-il-mokena", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-il-mokena", "is_active": True, "region": "illinois"},
    {"name": "Curaleaf IL Justice", "slug": "curaleaf-il-justice", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-il-justice", "is_active": True, "region": "illinois"},

    # ── OTHER IL DUTCHIE SINGLES ──────────────────────────────────
    {"name": "Planet 13 Waukegan IL", "slug": "planet13-waukegan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/planet-13-illinois-llc", "is_active": True, "region": "illinois"},
    {"name": "Village Godfrey IL", "slug": "village-godfrey", "platform": "dutchie", "url": "https://dutchie.com/dispensary/village-dispensary", "is_active": True, "region": "illinois"},
    {"name": "Village Bucktown IL", "slug": "village-bucktown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/village-bucktown", "is_active": True, "region": "illinois"},
    {"name": "Lux Leaf Matteson IL", "slug": "lux-leaf-matteson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nlj-dispensary", "is_active": True, "region": "illinois"},
    {"name": "Share Springfield IL", "slug": "share-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/share", "is_active": True, "region": "illinois"},

    # ── BEYOND/HELLO IL (Jane/iHeartJane — Jushi) ─────────────────
    {"name": "Beyond/Hello Normal Rec IL", "slug": "bh-il-normal-rec", "platform": "jane", "url": "https://beyond-hello.com/illinois-dispensaries/normal/adult-use-menu/", "is_active": True, "region": "illinois"},
    {"name": "Beyond/Hello Normal Med IL", "slug": "bh-il-normal-med", "platform": "jane", "url": "https://beyond-hello.com/illinois-dispensaries/normal/medical-menu/", "is_active": True, "region": "illinois"},
    {"name": "Beyond/Hello Sauget Rec IL", "slug": "bh-il-sauget-rec", "platform": "jane", "url": "https://beyond-hello.com/illinois-dispensaries/sauget/adult-use-menu/", "is_active": True, "region": "illinois"},
    {"name": "Beyond/Hello Sauget Rt3 IL", "slug": "bh-il-sauget-rt3", "platform": "jane", "url": "https://beyond-hello.com/illinois-dispensaries/sauget-route-3/adult-use-menu/", "is_active": True, "region": "illinois"},
    {"name": "Beyond/Hello Bloomington IL", "slug": "bh-il-bloomington", "platform": "jane", "url": "https://beyond-hello.com/illinois-dispensaries/bloomington/adult-use-menu/", "is_active": True, "region": "illinois"},

    # ── VERILIFE IL (Jane/iHeartJane — PharmaCann, 8 locations) ───
    {"name": "Verilife Ottawa IL", "slug": "verilife-ottawa", "platform": "jane", "url": "https://www.verilife.com/il/ottawa", "is_active": True, "region": "illinois"},
    {"name": "Verilife North Aurora IL", "slug": "verilife-n-aurora", "platform": "jane", "url": "https://www.verilife.com/il/north-aurora", "is_active": True, "region": "illinois"},
    {"name": "Verilife Galena IL", "slug": "verilife-galena", "platform": "jane", "url": "https://www.verilife.com/il/galena", "is_active": True, "region": "illinois"},
    {"name": "Verilife Chicago IL", "slug": "verilife-chicago", "platform": "jane", "url": "https://www.verilife.com/il/chicago", "is_active": True, "region": "illinois"},
    {"name": "Verilife Rosemont IL", "slug": "verilife-rosemont", "platform": "jane", "url": "https://www.verilife.com/il/rosemont", "is_active": True, "region": "illinois"},
    {"name": "Verilife Schaumburg IL", "slug": "verilife-schaumburg", "platform": "jane", "url": "https://www.verilife.com/il/schaumburg", "is_active": True, "region": "illinois"},
    {"name": "Verilife Arlington Heights IL", "slug": "verilife-arlington-hts", "platform": "jane", "url": "https://www.verilife.com/il/arlington-heights", "is_active": True, "region": "illinois"},
    {"name": "Verilife Romeoville IL", "slug": "verilife-romeoville", "platform": "jane", "url": "https://www.verilife.com/il/romeoville", "is_active": True, "region": "illinois"},

    # ── CONSUME CANNABIS IL (Jane/iHeartJane, 6 locations) ────────
    {"name": "Consume Chicago IL", "slug": "consume-chicago-rec", "platform": "jane", "url": "https://consumecannabis.com/dispensaries/illinois-chicago/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Consume Carbondale IL", "slug": "consume-carbondale", "platform": "jane", "url": "https://consumecannabis.com/dispensaries/illinois-carbondale/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Consume Marion IL", "slug": "consume-marion-rec", "platform": "jane", "url": "https://www.consumecannabis.com/dispensary-menu/illinois/marion-recreational-menu", "is_active": True, "region": "illinois"},
    {"name": "Consume Oakbrook Terrace IL", "slug": "consume-oakbrook", "platform": "jane", "url": "https://www.consumecannabis.com/dispensary-menu/illinois/oakbrook-terrace-recreational-menu", "is_active": True, "region": "illinois"},
    {"name": "Consume St Charles IL", "slug": "consume-st-charles", "platform": "jane", "url": "https://www.consumecannabis.com/dispensary-menu/illinois/st-charles-recreational", "is_active": True, "region": "illinois"},
    {"name": "Consume Antioch IL", "slug": "consume-antioch", "platform": "jane", "url": "https://www.consumecannabis.com/dispensary-menu/illinois/antioch-recreational", "is_active": True, "region": "illinois"},

    # ── NUERA IL (Jane/iHeartJane, 5 locations) ───────────────────
    {"name": "nuEra Chicago IL", "slug": "nuera-chicago-rec", "platform": "jane", "url": "https://nueracannabis.com/dispensaries/il/chicago/menu-rec/", "is_active": True, "region": "illinois"},
    {"name": "nuEra East Peoria IL", "slug": "nuera-east-peoria", "platform": "jane", "url": "https://nueracannabis.com/dispensaries/il/east-peoria/", "is_active": True, "region": "illinois"},
    {"name": "nuEra Urbana IL", "slug": "nuera-urbana", "platform": "jane", "url": "https://nueracannabis.com/dispensaries/il/urbana/", "is_active": True, "region": "illinois"},
    {"name": "nuEra DeKalb IL", "slug": "nuera-dekalb", "platform": "jane", "url": "https://nueracannabis.com/dispensaries/il/dekalb/", "is_active": True, "region": "illinois"},
    {"name": "nuEra Southland IL", "slug": "nuera-southland", "platform": "jane", "url": "https://nueracannabis.com/dispensaries/il/chicago-southland/", "is_active": True, "region": "illinois"},

    # ── EARTHMED IL (Jane/iHeartJane, 3 locations) ────────────────
    {"name": "EarthMed Addison IL", "slug": "earthmed-addison-rec", "platform": "jane", "url": "https://menu.earthmed.com/addison-rec", "is_active": True, "region": "illinois"},
    {"name": "EarthMed Rosemont IL", "slug": "earthmed-rosemont", "platform": "jane", "url": "https://menu.earthmed.com/rosemont-rec", "is_active": True, "region": "illinois"},
    {"name": "EarthMed McHenry IL", "slug": "earthmed-mchenry", "platform": "jane", "url": "https://earthmed.com/location/mchenry", "is_active": True, "region": "illinois"},

    # ── HATCH IL (Jane/iHeartJane, 2 locations) ───────────────────
    {"name": "Hatch Addison IL", "slug": "hatch-addison-rec", "platform": "jane", "url": "https://gohatch.com/dispensaries/addison-recreational/", "is_active": True, "region": "illinois"},
    {"name": "Hatch Wheeling IL", "slug": "hatch-wheeling-rec", "platform": "jane", "url": "https://gohatch.com/", "is_active": True, "region": "illinois"},

    # ── SUNNYSIDE IL (Cresco Labs — 10+ locations, Jane/iHeartJane) ──
    {"name": "Sunnyside Champaign IL", "slug": "sunnyside-champaign", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/champaign", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Danville IL", "slug": "sunnyside-danville", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/danville", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Lakeview IL", "slug": "sunnyside-lakeview", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/chicago-lakeview", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside South Beloit IL", "slug": "sunnyside-south-beloit", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/south-beloit", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Rockford IL", "slug": "sunnyside-rockford", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/rockford", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Schaumburg IL", "slug": "sunnyside-schaumburg", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/schaumburg", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Buffalo Grove IL", "slug": "sunnyside-buffalo-grove", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/buffalo-grove", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Naperville IL", "slug": "sunnyside-naperville", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/naperville", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside Elmwood Park IL", "slug": "sunnyside-elmwood-park", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/elmwood-park", "is_active": True, "region": "illinois"},
    {"name": "Sunnyside River North IL", "slug": "sunnyside-river-north", "platform": "jane", "url": "https://www.sunnyside.shop/dispensary/chicago-river-north", "is_active": True, "region": "illinois"},

    # ── NATURE'S CARE IL (Dutchie — 3 locations) ────────────────────
    {"name": "Nature's Care Rolling Meadows IL", "slug": "natures-care-rolling-meadows", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-care-rolling-meadows", "is_active": True, "region": "illinois"},
    {"name": "Nature's Care Joliet IL", "slug": "natures-care-joliet", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-care-joliet", "is_active": True, "region": "illinois"},

    # ── GREENHOUSE GROUP IL (Dutchie — 5 locations) ─────────────────
    {"name": "Greenhouse Deerfield IL", "slug": "greenhouse-deerfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenhouse-deerfield", "is_active": True, "region": "illinois"},
    {"name": "Greenhouse Northbrook IL", "slug": "greenhouse-northbrook", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenhouse-northbrook", "is_active": True, "region": "illinois"},
    {"name": "Greenhouse Morris IL", "slug": "greenhouse-morris", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenhouse-morris", "is_active": True, "region": "illinois"},

    # ── IVY HALL IL (Dutchie — 10 locations) ────────────────────────
    {"name": "Ivy Hall Glendale Heights IL", "slug": "ivy-hall-glendale-hts", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-glendale-heights", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Bucktown IL", "slug": "ivy-hall-bucktown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-bucktown", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Wrigleyville IL", "slug": "ivy-hall-wrigleyville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-wrigleyville", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Bolingbrook IL", "slug": "ivy-hall-bolingbrook", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-bolingbrook", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Crystal Lake IL", "slug": "ivy-hall-crystal-lake", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-crystal-lake", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Montgomery IL", "slug": "ivy-hall-montgomery", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-montgomery", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Waukegan IL", "slug": "ivy-hall-waukegan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-waukegan", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Logan Square IL", "slug": "ivy-hall-logan-square", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-logan-square", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Peoria IL", "slug": "ivy-hall-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-peoria", "is_active": True, "region": "illinois"},
    {"name": "Ivy Hall Streamwood IL", "slug": "ivy-hall-streamwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ivy-hall-streamwood", "is_active": True, "region": "illinois"},

    # ── DISPENSARY33 IL (Dutchie — Chicago) ─────────────────────────
    {"name": "Dispensary33 Andersonville IL", "slug": "d33-andersonville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dispensary33-andersonville", "is_active": True, "region": "illinois"},
    {"name": "Dispensary33 West Loop IL", "slug": "d33-west-loop", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dispensary33-west-loop", "is_active": True, "region": "illinois"},

    # ── MOCA MODERN CANNABIS IL (Dutchie — Chicago) ─────────────────
    {"name": "MOCA Chicago Logan Square IL", "slug": "moca-logan-square", "platform": "dutchie", "url": "https://dutchie.com/dispensary/moca-logan-square", "is_active": True, "region": "illinois"},
    {"name": "MOCA Chicago River North IL", "slug": "moca-river-north", "platform": "dutchie", "url": "https://dutchie.com/dispensary/moca-river-north", "is_active": True, "region": "illinois"},

    # ── COLUMBIA CARE / CANNABIST IL (Dutchie) ─────────────────────
    {"name": "Cannabist Villa Park IL", "slug": "cannabist-il-villa-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabist-villa-park", "is_active": True, "region": "illinois"},
    {"name": "Cannabist Chicago IL", "slug": "cannabist-il-chicago", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabist-chicago", "is_active": True, "region": "illinois"},

    # ── 3C COMPASSIONATE CARE IL (Jane — Naperville/Joliet) ─────────
    {"name": "3C Naperville IL", "slug": "3c-naperville", "platform": "jane", "url": "https://www.3ccannabis.com/naperville-menu", "is_active": True, "region": "illinois"},
    {"name": "3C Joliet IL", "slug": "3c-joliet", "platform": "jane", "url": "https://www.3ccannabis.com/joliet-menu", "is_active": True, "region": "illinois"},

    # ── MAPLEGLEN CARE CENTER IL (Jane) ─────────────────────────────
    {"name": "Mapleglen Rockford IL", "slug": "mapleglen-rockford", "platform": "jane", "url": "https://mapleglencannabis.com/rockford-rec", "is_active": True, "region": "illinois"},

    # ── OTHER IL DUTCHIE/JANE ADDITIONS ─────────────────────────────
    {"name": "MedMen Oak Park IL", "slug": "medmen-oak-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medmen-oak-park", "is_active": False, "region": "illinois"},  # closed — now Dutchess Cannabis
    {"name": "MedMen Evanston IL", "slug": "medmen-evanston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medmen-evanston", "is_active": False, "region": "illinois"},  # closed
    {"name": "Trinity Peoria Med IL", "slug": "trinity-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trinity-compassionate-care", "is_active": True, "region": "illinois"},
    {"name": "Trinity Peoria Rec IL", "slug": "trinity-peoria-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trinity-compassionate-care-rec", "is_active": True, "region": "illinois"},
    {"name": "Green Gate Chicago IL", "slug": "green-gate-chicago", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-gate-chicago", "is_active": False, "region": "illinois"},  # closed — now Zen Leaf Rogers Park
    {"name": "Revolution Cannabis Maryville IL", "slug": "revolution-maryville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/revolution-maryville", "is_active": True, "region": "illinois"},

    # ── BLOC DISPENSARY IL (5 locations, Dutchie — social equity) ──
    {"name": "BLOC Kedzie Chicago IL", "slug": "bloc-il-kedzie", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-illinois-kedzie", "is_active": True, "region": "illinois"},
    {"name": "BLOC Berwyn IL", "slug": "bloc-il-berwyn", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-berwyn", "is_active": True, "region": "illinois"},
    {"name": "BLOC Forest Park IL", "slug": "bloc-il-forest-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-forest-park", "is_active": True, "region": "illinois"},
    {"name": "BLOC Metropolis IL", "slug": "bloc-il-metropolis", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-metropolis", "is_active": True, "region": "illinois"},
    {"name": "BLOC Northfield IL", "slug": "bloc-il-northfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-northfield", "is_active": True, "region": "illinois"},

    # ── DUTCHESS CANNABIS IL (5 locations, Dutchie — women-owned) ──
    {"name": "Dutchess Oak Park IL", "slug": "dutchess-oak-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/oak-park-illinois", "is_active": True, "region": "illinois"},
    {"name": "Dutchess Morton Grove IL", "slug": "dutchess-morton-grove", "platform": "dutchie", "url": "https://dutchie.com/dispensary/morton-grove-illinois", "is_active": True, "region": "illinois"},
    {"name": "Dutchess Lynwood IL", "slug": "dutchess-lynwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lynwood-illinois", "is_active": True, "region": "illinois"},
    {"name": "Dutchess North Riverside IL", "slug": "dutchess-north-riverside", "platform": "dutchie", "url": "https://dutchie.com/dispensary/north-riverside-illinois", "is_active": True, "region": "illinois"},
    {"name": "Dutchess Markham IL", "slug": "dutchess-markham", "platform": "dutchie", "url": "https://dutchie.com/stores/markham-illinois", "is_active": True, "region": "illinois"},

    # ── NATURE'S TREATMENT IL (2 locations, Dutchie) ──────────────
    {"name": "Nature's Treatment Milan IL", "slug": "nti-milan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-treatment-of-illinois-milan", "is_active": True, "region": "illinois"},
    {"name": "Nature's Treatment Galesburg IL", "slug": "nti-galesburg", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-treatment-galesburg", "is_active": True, "region": "illinois"},

    # ── GREEN RELEAF IL (2 locations, Dutchie) ────────────────────
    {"name": "Green Releaf Villa Park IL", "slug": "green-releaf-il-villa-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-releaf-villa-park", "is_active": True, "region": "illinois"},
    {"name": "Green Releaf Bourbonnais IL", "slug": "green-releaf-il-bourbonnais", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-releaf-bourbonnais", "is_active": True, "region": "illinois"},

    # ── OTHER NEW IL DUTCHIE ──────────────────────────────────────
    {"name": "NOBO Lakemoor IL", "slug": "nobo-lakemoor", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nobo-lakemoor", "is_active": True, "region": "illinois"},
    {"name": "Star Buds Riverside IL", "slug": "star-buds-riverside-il", "platform": "dutchie", "url": "https://dutchie.com/dispensary/star-buds-riverside", "is_active": True, "region": "illinois"},
    {"name": "Greenlight Park City IL", "slug": "greenlight-park-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-park-city", "is_active": True, "region": "illinois"},
    {"name": "Parkway Forest Park IL", "slug": "parkway-forest-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/parkway-dispensary-forest-park", "is_active": True, "region": "illinois"},
    {"name": "Ash & Ivy Benton IL", "slug": "ash-ivy-benton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ash-and-ivy-dispensary", "is_active": True, "region": "illinois"},
    {"name": "Green Temple Troy IL", "slug": "green-temple-troy", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shopgreentemple", "is_active": True, "region": "illinois"},
    {"name": "High Haven Normal IL", "slug": "high-haven-normal", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-haven-normal", "is_active": True, "region": "illinois"},
    {"name": "Greenhouse Litchfield IL", "slug": "greenhouse-litchfield", "platform": "dutchie", "url": "https://dutchie.com/stores/greenhouse-litchfield", "is_active": True, "region": "illinois"},

    # ── IL EXPANSION — Dutchie (14 new) ──────────────────────────────
    {"name": "Shangri-La Springfield IL", "slug": "shangri-la-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-springfield", "is_active": True, "region": "illinois"},
    {"name": "High Profile Springfield IL", "slug": "high-profile-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-profile-springfield-rec", "is_active": True, "region": "illinois"},
    {"name": "Cloud9 Champaign IL", "slug": "cloud9-champaign", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud9-champaign", "is_active": True, "region": "illinois"},
    {"name": "Cloud9 East Peoria IL", "slug": "cloud9-east-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud9-east-peoria", "is_active": True, "region": "illinois"},
    {"name": "Cloud9 Edwardsville IL", "slug": "cloud9-edwardsville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cloud9-edwardsville", "is_active": True, "region": "illinois"},
    {"name": "Tumbleweed Carbondale IL", "slug": "tumbleweed-carbondale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tumbleweed-dispensary-carbondale", "is_active": True, "region": "illinois"},
    {"name": "Bloom Bloomington IL", "slug": "bloom-il-bloomington", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloom-il-bloomington-normal", "is_active": True, "region": "illinois"},
    {"name": "Bloom Hometown IL", "slug": "bloom-il-hometown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloom-il-hometown", "is_active": True, "region": "illinois"},
    {"name": "The Mint Willowbrook IL", "slug": "mint-il-willowbrook", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mint-il-llc", "is_active": True, "region": "illinois"},
    {"name": "Windy City Cannabis Posen IL", "slug": "windy-city-posen", "platform": "dutchie", "url": "https://dutchie.com/dispensary/windy-city-cannabis-posen", "is_active": True, "region": "illinois"},
    {"name": "Cookies Chicago Clinton IL", "slug": "cookies-chicago-clinton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-chicago-clinton", "is_active": True, "region": "illinois"},
    {"name": "Cookies Bolingbrook IL", "slug": "cookies-bolingbrook", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-bolingbook", "is_active": True, "region": "illinois"},
    {"name": "Greenlight Springfield IL", "slug": "greenlight-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-springfield", "is_active": True, "region": "illinois"},
    {"name": "The Green House Farmington IL", "slug": "greenhouse-farmington", "platform": "dutchie", "url": "https://dutchie.com/dispensary/animacann-inc", "is_active": True, "region": "illinois"},

    # ── IL EXPANSION — Jane (12 new) ─────────────────────────────────
    {"name": "Beyond Hello Peoria IL", "slug": "beyond-hello-peoria", "platform": "jane", "url": "https://www.iheartjane.com/stores/6221/beyond-hello-peoria", "is_active": True, "region": "illinois"},
    {"name": "Mood Shine Chicago Heights IL", "slug": "mood-shine-il", "platform": "jane", "url": "https://www.iheartjane.com/stores/5886/mood-shine", "is_active": True, "region": "illinois"},
    {"name": "Prairie Cannabis South Loop IL", "slug": "prairie-cannabis-south-loop", "platform": "jane", "url": "https://www.iheartjane.com/stores/6388/prairie-cannabis-co-roosevelt-road", "is_active": True, "region": "illinois"},
    {"name": "Prairie Cannabis Co IL", "slug": "prairie-cannabis-co", "platform": "jane", "url": "https://www.iheartjane.com/stores/6244/prairie-cannabis-co", "is_active": True, "region": "illinois"},
    {"name": "Emerald Dispensary Island Lake IL", "slug": "emerald-island-lake", "platform": "jane", "url": "https://www.iheartjane.com/stores/5809/emerald-dispensary-illinois", "is_active": True, "region": "illinois"},
    {"name": "Blyss Dispensary Mt Vernon IL", "slug": "blyss-mt-vernon", "platform": "jane", "url": "https://www.iheartjane.com/stores/5570/blyss-dispensary", "is_active": True, "region": "illinois"},
    {"name": "Phili Dispensary Bourbonnais IL", "slug": "phili-bourbonnais", "platform": "jane", "url": "https://www.iheartjane.com/stores/5362/phili-dispensary", "is_active": True, "region": "illinois"},
    {"name": "Guaranteed Dispensary Chicago IL", "slug": "guaranteed-chicago", "platform": "jane", "url": "https://www.iheartjane.com/stores/6921/guaranteed-dispensary-chicago-il-med", "is_active": True, "region": "illinois"},
    {"name": "The Dispensary Fulton IL", "slug": "dispensary-fulton", "platform": "jane", "url": "https://www.iheartjane.com/stores/4056/the-dispensary-fulton-rec", "is_active": True, "region": "illinois"},
    {"name": "The Dispensary Champaign IL", "slug": "dispensary-champaign", "platform": "jane", "url": "https://www.iheartjane.com/stores/5935/the-dispensary-champaign", "is_active": True, "region": "illinois"},
    {"name": "nuEra Pekin IL", "slug": "nuera-pekin", "platform": "jane", "url": "https://www.iheartjane.com/stores/3050/nuera-pekin-rec", "is_active": True, "region": "illinois"},
    {"name": "nuEra Champaign IL", "slug": "nuera-champaign", "platform": "jane", "url": "https://www.iheartjane.com/stores/3057/nuera-champaign-rec", "is_active": True, "region": "illinois"},

    # ==================================================================
    # ARIZONA — 82 dispensaries. Dutchie-dominant market:
    # Trulieve/Harvest (12), Sol Flower (6), The Mint (4),
    # Nature's Medicines (3), Nirvana (4), Ponderosa (7),
    # Jars (4), Oasis (3), Bloom (3), Territory (3), Debbie's (3),
    # Sunday Goods (2), other singles (15).
    # Plus Curaleaf (6) + Zen Leaf (4) on native platforms.
    # ==================================================================

    # ── TRULIEVE / HARVEST ARIZONA (12 locations, Dutchie) ────────
    {"name": "Trulieve Scottsdale AZ", "slug": "trulieve-scottsdale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-scottsdale", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Phoenix AZ", "slug": "trulieve-phoenix", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-phoenix", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Tempe AZ", "slug": "trulieve-tempe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-tempe", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Tucson AZ", "slug": "trulieve-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-tucson", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Glendale AZ", "slug": "trulieve-glendale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-glendale", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Casa Grande AZ", "slug": "trulieve-casa-grande", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-case-grande", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Avondale AZ", "slug": "trulieve-avondale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-avondale", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Cottonwood AZ", "slug": "trulieve-cottonwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-cottonwood", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Mesa AZ", "slug": "trulieve-mesa", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-mesa", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Chandler AZ", "slug": "trulieve-chandler", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-chandler", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Peoria AZ", "slug": "trulieve-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-peoria", "is_active": True, "region": "arizona"},
    {"name": "Trulieve Maricopa AZ", "slug": "trulieve-maricopa", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-of-maricopa", "is_active": True, "region": "arizona"},

    # ── SOL FLOWER (6 locations, Dutchie) ─────────────────────────
    {"name": "Sol Flower Sun City AZ", "slug": "sol-flower-sun-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sol-flower-dispensary", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower Tempe AZ", "slug": "sol-flower-tempe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sol-flower-dispensary-mcclintock", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower Scottsdale Airpark", "slug": "sol-flower-scottsdale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sol-flower-scottsdale-airpark", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower South Tucson AZ", "slug": "sol-flower-s-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sol-flower-dispensary-south-tucson", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower Deer Valley AZ", "slug": "sol-flower-deer-valley", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sol-flower-dispensary-deer-valley", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower North Tucson AZ", "slug": "sol-flower-n-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sol-flower-dispensary-north-tucson", "is_active": True, "region": "arizona"},

    # ── THE MINT AZ (4 locations, Dutchie) ────────────────────────
    {"name": "The Mint Tempe AZ", "slug": "mint-az-tempe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-mint-dispensary-tempe", "is_active": True, "region": "arizona"},
    {"name": "The Mint Bell Road AZ", "slug": "mint-az-bell-rd", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-mint-dispensary-bell-rd", "is_active": True, "region": "arizona"},
    {"name": "The Mint 75th Ave AZ", "slug": "mint-az-75th-ave", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-mint-75th-ave", "is_active": True, "region": "arizona"},
    {"name": "The Mint Northern AZ", "slug": "mint-az-northern", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-mint-northern", "is_active": True, "region": "arizona"},

    # ── NATURE'S MEDICINES AZ (3 locations, Dutchie) ──────────────
    {"name": "Nature's Medicines Phoenix AZ", "slug": "natures-med-phoenix", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-medicines-phoenix", "is_active": True, "region": "arizona"},
    {"name": "Nature's Medicines Glendale AZ", "slug": "natures-med-glendale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-medicines-grand", "is_active": True, "region": "arizona"},
    {"name": "Nature's Medicines Happy Valley AZ", "slug": "natures-med-happy-valley", "platform": "dutchie", "url": "https://dutchie.com/dispensary/happy-valley-phoenix", "is_active": True, "region": "arizona"},

    # ── NIRVANA CANNABIS AZ (4 locations, Dutchie) ────────────────
    {"name": "Nirvana Tucson AZ", "slug": "nirvana-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/arizona-tree-equity-2-tucson", "is_active": True, "region": "arizona"},
    {"name": "Nirvana Prescott Valley AZ", "slug": "nirvana-prescott", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nirvana-center-phoenix-total-accountability-systems", "is_active": True, "region": "arizona"},
    {"name": "Nirvana Apache Junction AZ", "slug": "nirvana-apache-jct", "platform": "dutchie", "url": "https://dutchie.com/dispensary/az-flower-power-nirvana-aj", "is_active": True, "region": "arizona"},
    {"name": "Nirvana North Phoenix AZ", "slug": "nirvana-n-phoenix", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Nirvana-North-Phoenix", "is_active": True, "region": "arizona"},

    # ── PONDEROSA AZ (7 locations, Dutchie) ───────────────────────
    {"name": "Ponderosa Glendale AZ", "slug": "ponderosa-glendale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ponderosa-releaf", "is_active": True, "region": "arizona"},
    {"name": "Ponderosa Florence AZ", "slug": "ponderosa-florence", "platform": "dutchie", "url": "https://dutchie.com/dispensary/florence-store-location", "is_active": True, "region": "arizona"},
    {"name": "Ponderosa Flagstaff AZ", "slug": "ponderosa-flagstaff", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ponderosa-Flagstaff", "is_active": True, "region": "arizona"},
    {"name": "Ponderosa Tucson AZ", "slug": "ponderosa-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ponderosa-Tucson", "is_active": True, "region": "arizona"},
    {"name": "Ponderosa Queen Creek AZ", "slug": "ponderosa-queen-creek", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ponderosa-QueenCreek", "is_active": True, "region": "arizona"},
    {"name": "Ponderosa Chandler AZ", "slug": "ponderosa-chandler", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ponderosa-Chandler", "is_active": True, "region": "arizona"},
    {"name": "Ponderosa Mesa AZ", "slug": "ponderosa-mesa", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ponderosa-Mesa", "is_active": True, "region": "arizona"},

    # ── OTHER AZ DUTCHIE SINGLES ──────────────────────────────────
    {"name": "Cookies Tempe AZ", "slug": "cookies-tempe-az", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-tempe", "is_active": True, "region": "arizona"},
    {"name": "TruMed Phoenix AZ", "slug": "trumed-phoenix", "platform": "dutchie", "url": "https://dutchie.com/dispensary/truormed-dispensary", "is_active": True, "region": "arizona"},
    {"name": "Noble Herb Flagstaff AZ", "slug": "noble-herb-flagstaff", "platform": "dutchie", "url": "https://dutchie.com/dispensary/noble-herb", "is_active": True, "region": "arizona"},
    {"name": "Earth's Healing Tucson AZ", "slug": "earths-healing-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/earths-healing-north", "is_active": True, "region": "arizona"},
    {"name": "Tucson Saints AZ", "slug": "tucson-saints", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tucson-saints", "is_active": True, "region": "arizona"},
    {"name": "Story of Arizona Williams", "slug": "story-az-williams", "platform": "dutchie", "url": "https://dutchie.com/dispensary/story-of-arizona-williams", "is_active": True, "region": "arizona"},

    # ── CURALEAF ARIZONA (Curaleaf + Dutchie platforms) ───────────
    {"name": "Curaleaf AZ Scottsdale", "slug": "curaleaf-az-scottsdale", "platform": "curaleaf", "url": "https://curaleaf.com/stores/curaleaf-dispensary-scottsdale", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Phoenix Airport", "slug": "curaleaf-az-phoenix", "platform": "curaleaf", "url": "https://curaleaf.com/stores/curaleaf-dispensary-phoenix-airport", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Tucson", "slug": "curaleaf-az-tucson", "platform": "curaleaf", "url": "https://curaleaf.com/stores/curaleaf-dispensary-tucson", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Youngtown", "slug": "curaleaf-az-youngtown", "platform": "curaleaf", "url": "https://curaleaf.com/stores/curaleaf-dispensary-youngtown", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Gilbert", "slug": "curaleaf-az-gilbert", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-gilbert", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ 48th Street", "slug": "curaleaf-az-48th", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-az-48th", "is_active": True, "region": "arizona"},

    # ── ZEN LEAF ARIZONA (Verano) ──────────────────────────────────
    {"name": "Zen Leaf Chandler AZ", "slug": "zen-leaf-chandler", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/chandler/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Phoenix Cave Creek AZ", "slug": "zen-leaf-phoenix-az", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/phoenix-n-cave-creek/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Gilbert AZ", "slug": "zen-leaf-gilbert", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/gilbert/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Prescott AZ", "slug": "zen-leaf-prescott", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/prescott/menu/recreational", "is_active": True, "region": "arizona"},

    # ── JARS CANNABIS AZ (11 verified locations, Dutchie) ─────────────
    {"name": "Jars East Tucson AZ", "slug": "jars-az-east-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-east-tucson-green-med-wellness", "is_active": True, "region": "arizona"},
    {"name": "Jars North Phoenix AZ", "slug": "jars-az-n-phoenix", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-north-phoenix-mohave-cannabis-club-3-rec", "is_active": True, "region": "arizona"},
    {"name": "Jars Metrocenter AZ", "slug": "jars-az-metrocenter", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-metrocenter-desert-medical-campus-rec", "is_active": True, "region": "arizona"},
    {"name": "Jars Phoenix Airport AZ", "slug": "jars-az-24th-st", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-24th-street-dreem-green-rec", "is_active": True, "region": "arizona"},
    {"name": "Jars Mesa AZ", "slug": "jars-az-mesa", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-mesa-mohave-cannabis-club-1-rec", "is_active": True, "region": "arizona"},
    {"name": "Jars Prescott Valley AZ", "slug": "jars-az-prescott", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-prescott-valley", "is_active": True, "region": "arizona"},
    {"name": "Jars Kingman AZ", "slug": "jars-az-kingman", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-kingman-mccse214-rec", "is_active": True, "region": "arizona"},
    {"name": "Jars Cave Creek AZ", "slug": "jars-az-cave-creek", "platform": "dutchie", "url": "https://dutchie.com/dispensary/wickenburg-alternative-medicine-llc", "is_active": True, "region": "arizona"},
    {"name": "Jars Payson AZ", "slug": "jars-az-payson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-payson-gila-dreams-x-rec", "is_active": True, "region": "arizona"},
    {"name": "Jars Tolleson AZ", "slug": "jars-az-tolleson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-tolleson", "is_active": True, "region": "arizona"},
    {"name": "Jars Peoria AZ", "slug": "jars-az-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-peoria-mohave-cannabis-club-2-rec", "is_active": True, "region": "arizona"},

    # ── STORY CANNABIS AZ (fka Oasis, verified Dutchie) ─────────────
    {"name": "Story N Chandler AZ", "slug": "story-az-n-chandler", "platform": "dutchie", "url": "https://dutchie.com/dispensary/oasis-cannabis-north", "is_active": True, "region": "arizona"},
    {"name": "Story S Chandler AZ", "slug": "story-az-s-chandler", "platform": "dutchie", "url": "https://dutchie.com/dispensary/oasis-cannabis-south", "is_active": True, "region": "arizona"},
    {"name": "Story Lake Havasu AZ", "slug": "story-az-lake-havasu", "platform": "dutchie", "url": "https://dutchie.com/dispensary/story-of-arizona-lake-havasu", "is_active": True, "region": "arizona"},

    # ── THE MINT AZ ADDITIONAL (verified Dutchie) ───────────────────
    {"name": "The Mint Mesa AZ", "slug": "mint-az-mesa", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-mint-dispensary-mesa", "is_active": True, "region": "arizona"},
    {"name": "The Mint Scottsdale AZ", "slug": "mint-az-scottsdale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-mint-scottsdale", "is_active": True, "region": "arizona"},

    # ── D2 / GREEN HALO TUCSON (verified 6 menus, Dutchie) ─────────
    {"name": "D2 Oracle Rd Rec AZ", "slug": "d2-oracle-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-green-halo-medical-and-recreational", "is_active": True, "region": "arizona"},
    {"name": "D2 Oracle Rd Med AZ", "slug": "d2-oracle-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-green-halo-medical", "is_active": True, "region": "arizona"},
    {"name": "D2 Downtown Rec AZ", "slug": "d2-downtown-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-downtown-dispensary", "is_active": True, "region": "arizona"},
    {"name": "D2 Downtown Med AZ", "slug": "d2-downtown-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-downtown-dispensary-med", "is_active": True, "region": "arizona"},
    {"name": "D2 Eastside Rec AZ", "slug": "d2-eastside-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/d2-dispensary", "is_active": True, "region": "arizona"},
    {"name": "D2 Eastside Med AZ", "slug": "d2-eastside-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/d2-dispensary-medical", "is_active": True, "region": "arizona"},

    # ── SUNDAY GOODS AZ (verified Dutchie) ─────────────────────────
    {"name": "Sunday Goods Tempe AZ", "slug": "sunday-goods-tempe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sunday-goods-tempe", "is_active": True, "region": "arizona"},
    {"name": "Sunday Goods Phoenix AZ", "slug": "sunday-goods-phoenix", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sunday-goods-phoenix", "is_active": True, "region": "arizona"},
    {"name": "Sunday Goods Surprise AZ", "slug": "sunday-goods-surprise", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sunday-goods-surprise", "is_active": True, "region": "arizona"},

    # ── OTHER AZ VERIFIED ADDITIONS ───────────────────────────────
    {"name": "Sticky Saguaro Chandler AZ", "slug": "sticky-saguaro", "platform": "dutchie", "url": "https://dutchie.com/dispensary/border-health-inc-sticky-saguaro", "is_active": True, "region": "arizona"},
    {"name": "Arizona Organix Glendale AZ", "slug": "az-organix-glendale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/arizona-organix", "is_active": True, "region": "arizona"},
    {"name": "Desert Bloom Tucson AZ", "slug": "desert-bloom-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/desert-bloom-re-leaf-center-dispensary", "is_active": True, "region": "arizona"},
    {"name": "The Local Joint Scottsdale AZ", "slug": "local-joint-scottsdale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-local-joint", "is_active": True, "region": "arizona"},
    {"name": "Prime Leaf Tucson AZ", "slug": "prime-leaf-tucson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/prime-leaf-tucson", "is_active": True, "region": "arizona"},

    # ==================================================================
    # MISSOURI — 89 dispensaries. 5th largest adult-use market nationally.
    # $1.53B in 2025 sales. 214 licensed dispensaries. Dutchie-dominant.
    # Key chains: Key Missouri (9), Greenlight (10), Good Day Farm (11),
    # Proper (9), N'Bliss (5), Swade (5), From The Earth (3),
    # Green Releaf (3), 3Fifteen Primo (4), Shangri-La (3), + others.
    # Population: 6.2M. Major metros: KC (516K), StL (280K),
    # Springfield (171K), Columbia (131K).
    # ==================================================================

    # ── KEY MISSOURI (9 locations, Dutchie — Proper Cannabis partner) ─
    {"name": "Key Missouri Cameron", "slug": "key-mo-cameron", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-cameron", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri KC East", "slug": "key-mo-kc-east", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-front-st", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri KC North", "slug": "key-mo-kc-north", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-kansas-city-north", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri KC South", "slug": "key-mo-kc-south", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-kansas-city-south", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri O'Fallon", "slug": "key-mo-ofallon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-ofallon", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri Cape Girardeau", "slug": "key-mo-cape-girardeau", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-cape-girardeau", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri Belton", "slug": "key-mo-belton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-belton", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri Springfield", "slug": "key-mo-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-springfield", "is_active": True, "region": "missouri"},
    {"name": "Key Missouri Nixa", "slug": "key-mo-nixa", "platform": "dutchie", "url": "https://dutchie.com/dispensary/key-missouri-nixa", "is_active": True, "region": "missouri"},

    # ── GREENLIGHT DISPENSARY MO (10 locations, Dutchie) ──────────
    {"name": "3Fifteen Primo Columbia MO", "slug": "3fifteen-columbia", "platform": "dutchie", "url": "https://dutchie.com/dispensary/3fifteen-primo-columbia", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Hayti MO", "slug": "greenlight-mo-hayti", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-hayti", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Stateline KCMO", "slug": "greenlight-mo-stateline", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-prospect", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Joplin MO", "slug": "greenlight-mo-joplin", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-joplin", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Sikeston MO", "slug": "greenlight-mo-sikeston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-sikeston", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Ferguson MO", "slug": "greenlight-mo-ferguson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-ferguson", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Harrisonville MO", "slug": "greenlight-mo-harrisonville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-harrisonville1", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Springfield MO", "slug": "greenlight-mo-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-springfield", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Independence MO", "slug": "greenlight-mo-independence", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-noland-road", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Berkeley Airport MO", "slug": "greenlight-mo-berkeley", "platform": "dutchie", "url": "https://dutchie.com/dispensary/greenlight-dispensary-berkely", "is_active": True, "region": "missouri"},

    # ── FROM THE EARTH MO (3 locations, Dutchie — KC area) ───────
    {"name": "From The Earth Independence MO", "slug": "fte-mo-independence", "platform": "dutchie", "url": "https://dutchie.com/dispensary/from-the-earth-40-hwy", "is_active": True, "region": "missouri"},
    {"name": "From The Earth Westside KCMO", "slug": "fte-mo-westside", "platform": "dutchie", "url": "https://dutchie.com/dispensary/from-the-earth", "is_active": True, "region": "missouri"},
    {"name": "From The Earth Raytown MO", "slug": "fte-mo-raytown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/from-the-earth-350-hwy", "is_active": True, "region": "missouri"},

    # ── GREEN RELEAF MO (3 locations, Dutchie) ───────────────────
    {"name": "Green Releaf Columbia MO", "slug": "green-releaf-columbia", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-releaf-columbia", "is_active": True, "region": "missouri"},
    {"name": "Green Releaf Moberly MO", "slug": "green-releaf-moberly", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-releaf-moberly", "is_active": True, "region": "missouri"},
    {"name": "Green Releaf Troy MO", "slug": "green-releaf-troy", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-releaf-troy", "is_active": True, "region": "missouri"},

    # ── TERRABIS MO (Dutchie) ────────────────────────────────────
    {"name": "Terrabis O'Fallon MO", "slug": "terrabis-ofallon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terrabis-dispensary-ofallon", "is_active": True, "region": "missouri"},

    # ── BLOC DISPENSARY MO (2 locations, Dutchie) ────────────────
    {"name": "Bloc Valley Park MO", "slug": "bloc-mo-valley-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-valley-park", "is_active": True, "region": "missouri"},
    {"name": "Bloc Farmington MO", "slug": "bloc-mo-farmington", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-farmington", "is_active": True, "region": "missouri"},

    # ── OTHER MO DUTCHIE SINGLES ─────────────────────────────────
    {"name": "Star Buds Festus MO", "slug": "star-buds-festus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/star-buds-festus", "is_active": True, "region": "missouri"},
    {"name": "Nature Med Independence MO", "slug": "nature-med-independence", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nature-med-independence", "is_active": True, "region": "missouri"},
    {"name": "Greenlight Rock Port MO", "slug": "greenlight-mo-rock-port", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rock-port", "is_active": True, "region": "missouri"},

    # ── PROPER CANNABIS MO (9 locations, Dutchie — KC/STL) ──────────
    {"name": "Proper Cannabis Chouteau MO", "slug": "proper-mo-chouteau", "platform": "dutchie", "url": "https://dutchie.com/dispensary/proper-cannabis-chouteau", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis Pleasant Hill MO", "slug": "proper-mo-pleasant-hill", "platform": "dutchie", "url": "https://dutchie.com/dispensary/proper-cannabis-pleasant-hill", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis Warrenton MO", "slug": "proper-mo-warrenton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/proper-cannabis-warrenton", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis Kansas City MO", "slug": "proper-mo-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Proper-Cannabis-Downtown-Kansas-City", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis Bridgeton MO", "slug": "proper-mo-bridgeton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/proper-wellness-bridgeton", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis Crestwood MO", "slug": "proper-mo-crestwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/proper-cannabis-sappington", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis South County MO", "slug": "proper-mo-south-county", "platform": "dutchie", "url": "https://dutchie.com/dispensary/proper-cannabis-lindberg", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis House Springs MO", "slug": "proper-mo-house-springs", "platform": "dutchie", "url": "https://dutchie.com/stores/nbliss-iii-house-springs", "is_active": True, "region": "missouri"},
    {"name": "Proper Cannabis Festus West MO", "slug": "proper-mo-festus-west", "platform": "dutchie", "url": "https://dutchie.com/stores/nbliss-i-festus", "is_active": True, "region": "missouri"},

    # ── N'BLISS CANNABIS MO (5 locations, Dutchie — STL area) ───────
    {"name": "N'Bliss Ellisville MO", "slug": "nbliss-ellisville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nbliss-iv-ellisville", "is_active": True, "region": "missouri"},
    {"name": "N'Bliss Manchester MO", "slug": "nbliss-manchester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nbliss-ii-manchester", "is_active": True, "region": "missouri"},
    {"name": "N'Bliss Crestwood MO", "slug": "nbliss-crestwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nbliss-crestwood", "is_active": True, "region": "missouri"},
    {"name": "N'Bliss Wentzville MO", "slug": "nbliss-wentzville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nbliss-wentzville", "is_active": True, "region": "missouri"},
    {"name": "N'Bliss Cottleville MO", "slug": "nbliss-cottleville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nbliss-cottleville", "is_active": True, "region": "missouri"},

    # ── SWADE CANNABIS MO (5 locations, Dutchie — STL area) ────────
    {"name": "Swade St Peters MO", "slug": "swade-st-peters", "platform": "dutchie", "url": "https://dutchie.com/dispensary/swade-st-peters", "is_active": True, "region": "missouri"},
    {"name": "Swade South Grand MO", "slug": "swade-south-grand", "platform": "dutchie", "url": "https://dutchie.com/dispensary/swade-south-grand", "is_active": True, "region": "missouri"},
    {"name": "Swade Delmar MO", "slug": "swade-delmar", "platform": "dutchie", "url": "https://dutchie.com/dispensary/swade-delmar", "is_active": True, "region": "missouri"},
    {"name": "Swade Ellisville MO", "slug": "swade-ellisville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/swade-cannabis-dispensary-ellisville", "is_active": True, "region": "missouri"},
    {"name": "Swade South City STL MO", "slug": "swade-south-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/swade-cannabis-dispensary-south-city", "is_active": True, "region": "missouri"},

    # ── GOOD DAY FARM MO (11 locations, Dutchie — statewide) ───────
    {"name": "Good Day Farm KC MO", "slug": "gdf-mo-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liberty-kansas-city", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm STL MO", "slug": "gdf-mo-stl", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liberty-st-louis", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Springfield MO", "slug": "gdf-mo-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-day-farm-springfield", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Cape Girardeau MO", "slug": "gdf-mo-cape", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-day-farms", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Caruthersville MO", "slug": "gdf-mo-caruthersville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-day-farm-caruthersville", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Eagleville MO", "slug": "gdf-mo-eagleville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gdf-eagleville-new", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Ellisville MO", "slug": "gdf-mo-ellisville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gdf-ellisville-new", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Columbia Vandiver MO", "slug": "gdf-mo-columbia-vandiver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gdf-columbia-vandiver-dr", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Columbia Forum MO", "slug": "gdf-mo-columbia-forum", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liberty-columbia", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Joplin MO", "slug": "gdf-mo-joplin", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gdf-joplin-20th-st", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm STL Broadway MO", "slug": "gdf-mo-stl-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gdf-st-louis-broadway-st", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farm Imperial MO", "slug": "gdf-mo-imperial", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bkind-imperial", "is_active": True, "region": "missouri"},

    # ── ROOT 66 DISPENSARY MO (Dutchie — SW MO) ───────────────────
    {"name": "Root 66 Lebanon MO", "slug": "root66-lebanon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/root-66-lebanon", "is_active": True, "region": "missouri"},
    {"name": "Root 66 Branson MO", "slug": "root66-branson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/root-66-branson", "is_active": True, "region": "missouri"},

    # ── C4 DISPENSARY MO (Dutchie) ─────────────────────────────────
    {"name": "C4 Dispensary KC MO", "slug": "c4-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/c4-dispensary", "is_active": True, "region": "missouri"},
    {"name": "C4 Dispensary Independence MO", "slug": "c4-independence", "platform": "dutchie", "url": "https://dutchie.com/dispensary/c4-independence", "is_active": True, "region": "missouri"},

    # ── HIPPOS CANNABIS MO (Dutchie) ───────────────────────────────
    {"name": "Hippos Springfield MO", "slug": "hippos-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hippos-springfield", "is_active": True, "region": "missouri"},
    {"name": "Hippos Chesterfield MO", "slug": "hippos-chesterfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hippos-chesterfield", "is_active": True, "region": "missouri"},

    # ── FRESH GREEN DISPENSARY MO (Dutchie) ────────────────────────
    {"name": "Fresh Green Kansas City MO", "slug": "fresh-green-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/fresh-green-kansas-city", "is_active": True, "region": "missouri"},

    # ── OTHER MO DUTCHIE ADDITIONS ─────────────────────────────────
    {"name": "Besame Wellness KC MO", "slug": "besame-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/besame-wellness-kansas-city", "is_active": True, "region": "missouri"},
    {"name": "Besame Smithville MO", "slug": "besame-smithville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/besame-wellness-smithville", "is_active": True, "region": "missouri"},
    {"name": "Old Route 66 Wellness Pacific MO", "slug": "or66-pacific", "platform": "dutchie", "url": "https://dutchie.com/dispensary/old-route-66-wellness-pacific", "is_active": True, "region": "missouri"},
    {"name": "Illicit Gardens STL MO", "slug": "illicit-stl", "platform": "dutchie", "url": "https://dutchie.com/dispensary/illicit-gardens-st-louis", "is_active": True, "region": "missouri"},
    {"name": "Flora Farms Humansville MO", "slug": "flora-farms-humansville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/flora-farms-humansville", "is_active": True, "region": "missouri"},
    {"name": "Flora Farms Springfield MO", "slug": "flora-farms-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/flora-farms-springfield", "is_active": True, "region": "missouri"},
    {"name": "Flora Farms Joplin MO", "slug": "flora-farms-joplin", "platform": "dutchie", "url": "https://dutchie.com/dispensary/flora-farms-springfield1", "is_active": True, "region": "missouri"},
    {"name": "Clovr KC MO", "slug": "clovr-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/clovr-kansas-city", "is_active": True, "region": "missouri"},
    {"name": "Nature Med Kansas City MO", "slug": "nature-med-kc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nature-med-kansas-city", "is_active": True, "region": "missouri"},

    # ── SHANGRI-LA MO (3 locations, Dutchie — central MO) ────────
    {"name": "Shangri-La Jefferson City MO", "slug": "shangri-la-jeff-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-jefferson-city", "is_active": True, "region": "missouri"},
    {"name": "Shangri-La Columbia MO", "slug": "shangri-la-columbia", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-columbia", "is_active": True, "region": "missouri"},
    {"name": "Shangri-La Columbia South MO", "slug": "shangri-la-columbia-south", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-columbia-south", "is_active": True, "region": "missouri"},

    # ── 3FIFTEEN PRIMO MO (4 locations, Dutchie) ─────────────────
    {"name": "3Fifteen Primo Valley Park MO", "slug": "3fifteen-valley-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/3fifteen-primo-valley-park", "is_active": True, "region": "missouri"},
    {"name": "3Fifteen Primo Branson West MO", "slug": "3fifteen-branson-west", "platform": "dutchie", "url": "https://dutchie.com/dispensary/3fifteen-primo-branson-west", "is_active": True, "region": "missouri"},
    {"name": "3Fifteen Primo STL MO", "slug": "3fifteen-stl", "platform": "dutchie", "url": "https://dutchie.com/dispensary/3fifteen-primo-st-louis", "is_active": True, "region": "missouri"},

    # ── TRINITY MO (2 locations, Dutchie — I-44 corridor) ────────
    {"name": "Trinity Salem MO", "slug": "trinity-mo-salem", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trinity-salem", "is_active": True, "region": "missouri"},
    {"name": "Trinity St James MO", "slug": "trinity-mo-st-james", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trinity-st-james", "is_active": True, "region": "missouri"},

    # ── OTHER NEW MO DUTCHIE ─────────────────────────────────────
    {"name": "The Forest STL MO", "slug": "forest-stl", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-forest-st-louis", "is_active": True, "region": "missouri"},
    {"name": "Luxury Leaf STL MO", "slug": "luxury-leaf-stl", "platform": "dutchie", "url": "https://dutchie.com/dispensary/luxury-leaf", "is_active": True, "region": "missouri"},
    {"name": "Stairway Cannabis Blue Springs MO", "slug": "stairway-blue-springs", "platform": "dutchie", "url": "https://dutchie.com/dispensary/stairway-cannabis", "is_active": True, "region": "missouri"},

    # ==================================================================
    # NEW JERSEY — 65 dispensaries. $1B+ in 2024 sales. 190+ licensed
    # dispensaries. NYC metro 20M+ population. MSO-heavy: Curaleaf (on
    # Dutchie!), GTI/Rise, Verano/Zen Leaf, Ascend. Key insight: Curaleaf
    # NJ migrated to Dutchie platform — scrapes via dutchie.py not
    # curaleaf.py. Botanist, Harmony, Valley Wellness, Aunt Mary's,
    # AYR/GSD, CannaVibes, INSA Coastline, + many verified independents.
    # ==================================================================

    # ── ASCEND NJ (3 locations, Dutchie) ─────────────────────────
    {"name": "Ascend Fort Lee NJ", "slug": "ascend-nj-fort-lee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/fort-lee-new-jersey", "is_active": True, "region": "new-jersey"},
    {"name": "Ascend Rochelle Park NJ", "slug": "ascend-nj-rochelle-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rochelle-park-new-jersey", "is_active": True, "region": "new-jersey"},
    {"name": "Ascend Wharton NJ", "slug": "ascend-nj-wharton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/wharton-new-jersey", "is_active": True, "region": "new-jersey"},

    # ── CURALEAF NJ (on Dutchie — 5 storefronts) ─────────────────
    {"name": "Curaleaf NJ Bellmawr Rec", "slug": "curaleaf-nj-bellmawr-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-nj-bellmawr-adult-use", "is_active": True, "region": "new-jersey"},
    {"name": "Curaleaf NJ Bellmawr Med", "slug": "curaleaf-nj-bellmawr-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-nj-bellmawr", "is_active": True, "region": "new-jersey"},
    {"name": "Curaleaf NJ Edgewater Park Rec", "slug": "curaleaf-nj-edgewater", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-nj-edgewater-park-adult-use", "is_active": True, "region": "new-jersey"},
    {"name": "Curaleaf NJ Bordentown Rec", "slug": "curaleaf-nj-bordentown-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-nj-bordentown-adult-use", "is_active": True, "region": "new-jersey"},
    {"name": "Curaleaf NJ Bordentown Med", "slug": "curaleaf-nj-bordentown-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-nj-bordentown", "is_active": True, "region": "new-jersey"},

    # ── AYR WELLNESS / GSD NJ (3 storefronts, Dutchie) ───────────
    {"name": "AYR NJ Union Med", "slug": "ayr-nj-union-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/garden-state-dispensary-union", "is_active": True, "region": "new-jersey"},
    {"name": "AYR NJ Union Rec", "slug": "ayr-nj-union-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/garden-state-dispensary-union-REC", "is_active": True, "region": "new-jersey"},
    {"name": "AYR NJ Woodbridge", "slug": "ayr-nj-woodbridge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/garden-state-dispensary-woodbridge", "is_active": True, "region": "new-jersey"},

    # ── MPX NJ (iAnthus — 4 storefronts, Dutchie) ────────────────
    {"name": "MPX NJ Atlantic City Rec", "slug": "mpx-nj-ac-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mpx-new-jersey-atlantic-city", "is_active": True, "region": "new-jersey"},
    {"name": "MPX NJ Gloucester Rec", "slug": "mpx-nj-gloucester-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mpx-new-jersey-gloucester1", "is_active": True, "region": "new-jersey"},
    {"name": "MPX NJ Pennsauken Rec", "slug": "mpx-nj-pennsauken-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mpx-new-jersey-pennsauken-rec", "is_active": True, "region": "new-jersey"},
    {"name": "MPX NJ Pennsauken Med", "slug": "mpx-nj-pennsauken-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mpx-new-jersey-pennsauken", "is_active": True, "region": "new-jersey"},

    # ── SWEETSPOT NJ (3 storefronts, Dutchie) ────────────────────
    {"name": "Sweetspot Voorhees NJ Rec", "slug": "sweetspot-nj-voorhees-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sweetspot-new-jersey-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Sweetspot Voorhees NJ Med", "slug": "sweetspot-nj-voorhees-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sweetspot-new-jersey-med", "is_active": True, "region": "new-jersey"},
    {"name": "Sweetspot River Edge NJ", "slug": "sweetspot-nj-river-edge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/x-sweetspot-river-edged", "is_active": False, "region": "new-jersey"},  # deactivated: x- prefix = Dutchie delisted

    # ── BLOC DISPENSARY NJ (3 storefronts, Dutchie) ──────────────
    {"name": "Bloc Waretown NJ Rec", "slug": "bloc-nj-waretown-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-waretown-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Bloc Waretown NJ Med", "slug": "bloc-nj-waretown-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-waretown", "is_active": True, "region": "new-jersey"},
    {"name": "Bloc Somerset NJ Med", "slug": "bloc-nj-somerset", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-somerset", "is_active": True, "region": "new-jersey"},

    # ── COOKIES NJ (Dutchie) ─────────────────────────────────────
    {"name": "Cookies Harrison NJ", "slug": "cookies-nj-harrison", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-harrison", "is_active": True, "region": "new-jersey"},

    # ── OTHER NJ DUTCHIE INDEPENDENTS ─────────────────────────────
    {"name": "Hashery Hackensack NJ", "slug": "hashery-hackensack", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hashery-llc-hackensack", "is_active": True, "region": "new-jersey"},
    {"name": "Social Leaf Toms River NJ", "slug": "social-leaf-toms-river", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-social-leaf-llc", "is_active": True, "region": "new-jersey"},
    {"name": "Blossom Jersey City NJ", "slug": "blossom-jersey-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/blossom-dispensary", "is_active": True, "region": "new-jersey"},
    {"name": "Union Chill Lambertville NJ", "slug": "union-chill-lambertville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/union-chill-lambertville-nj", "is_active": True, "region": "new-jersey"},
    {"name": "Eastern Green NJ Rec", "slug": "eastern-green-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/eastern-green-dispensary-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Eastern Green NJ Med", "slug": "eastern-green-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/eastern-green-inc", "is_active": True, "region": "new-jersey"},
    {"name": "Holistic Solutions Waterford NJ", "slug": "holistic-waterford", "platform": "dutchie", "url": "https://dutchie.com/dispensary/holistic-solutions", "is_active": True, "region": "new-jersey"},

    # ── RISE NJ (GTI — Rise platform) ────────────────────────────
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise Bloomfield NJ", "slug": "rise-nj-bloomfield", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-jersey/bloomfield/3120/recreational-menu/", "is_active": False, "region": "new-jersey"},
    {"name": "Rise Paterson NJ", "slug": "rise-nj-paterson", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-jersey/paterson/3104/recreational-menu/", "is_active": False, "region": "new-jersey"},

    # ── ZEN LEAF NJ (Verano) ─────────────────────────────────────
    {"name": "Zen Leaf Elizabeth NJ", "slug": "zen-leaf-nj-elizabeth", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/elizabeth/menu/recreational", "is_active": True, "region": "new-jersey"},
    {"name": "Zen Leaf Lawrence NJ", "slug": "zen-leaf-nj-lawrence", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/lawrence/menu/recreational", "is_active": True, "region": "new-jersey"},
    {"name": "Zen Leaf Neptune NJ", "slug": "zen-leaf-nj-neptune", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/neptune/menu/recreational", "is_active": True, "region": "new-jersey"},

    # ==================================================================
    #  OHIO  — Initial test batch (10 Dutchie + 4 Jane + 3 Curaleaf + 5 Rise = 22)
    #  OH went recreational Aug 2024.  67 scrapable dispensaries identified.
    #  Rise URLs fixed with store IDs (all 5 OH locations included).
    #  Expand after confirming scraper success on these test URLs.
    # ==================================================================

    # ── DUTCHIE OH ──────────────────────────────────────────────────
    {"name": "Terrasana Columbus", "slug": "terrasana-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terrasana-cannabis-co", "is_active": True, "region": "ohio"},
    {"name": "Terrasana Fremont", "slug": "terrasana-fremont", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terrasana-cannabis-co-fremont", "is_active": True, "region": "ohio"},
    {"name": "Ascend Cleveland", "slug": "ascend-oh-cleveland", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cleveland-ohio", "is_active": True, "region": "ohio"},
    {"name": "Trulieve OH Columbus", "slug": "trulieve-oh-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-columbus", "is_active": True, "region": "ohio"},
    {"name": "Trulieve OH Cincinnati", "slug": "trulieve-oh-cincinnati", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-cincinnati", "is_active": True, "region": "ohio"},
    {"name": "Amplify Canton", "slug": "amplify-canton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/amplify-canton", "is_active": True, "region": "ohio"},
    {"name": "Klutch Lorain", "slug": "klutch-lorain", "platform": "dutchie", "url": "https://dutchie.com/dispensary/klutch-lorain", "is_active": True, "region": "ohio"},
    {"name": "Shangri-La Columbus", "slug": "shangri-la-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-dispensary-columbus", "is_active": True, "region": "ohio"},
    {"name": "The Landing Kirkersville", "slug": "landing-kirkersville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-landing-dispensary-kirkersville", "is_active": True, "region": "ohio"},
    {"name": "Firelands Scientific Huron", "slug": "firelands-huron", "platform": "dutchie", "url": "https://dutchie.com/dispensary/firelands-scientific-huron", "is_active": True, "region": "ohio"},

    # ── JANE OH ─────────────────────────────────────────────────────
    {"name": "Bloom Columbus", "slug": "bloom-oh-columbus", "platform": "jane", "url": "https://www.iheartjane.com/stores/2820/bloom-medicinals-columbus/menu", "is_active": True, "region": "ohio"},
    {"name": "Bloom Akron", "slug": "bloom-oh-akron", "platform": "jane", "url": "https://www.iheartjane.com/stores/2817/bloom-medicinals-akron/menu", "is_active": True, "region": "ohio"},
    {"name": "Verilife Cincinnati", "slug": "verilife-oh-cincinnati", "platform": "jane", "url": "https://www.iheartjane.com/stores/3004/verilife-cincinnati/menu", "is_active": True, "region": "ohio"},
    {"name": "Pure Ohio Wellness Dayton", "slug": "pure-ohio-dayton", "platform": "jane", "url": "https://www.iheartjane.com/stores/2943/pure-ohio-wellness-dayton/menu", "is_active": True, "region": "ohio"},

    # ── CURALEAF OH ─────────────────────────────────────────────────
    {"name": "Curaleaf OH Cuyahoga Falls", "slug": "curaleaf-oh-cuyahoga", "platform": "curaleaf", "url": "https://oh.curaleaf.com/shop/cuyahoga-falls", "is_active": True, "region": "ohio"},
    {"name": "Curaleaf OH Newark", "slug": "curaleaf-oh-newark", "platform": "curaleaf", "url": "https://oh.curaleaf.com/shop/newark", "is_active": True, "region": "ohio"},
    {"name": "Curaleaf OH Lima", "slug": "curaleaf-oh-lima", "platform": "curaleaf", "url": "https://oh.curaleaf.com/shop/lima", "is_active": True, "region": "ohio"},

    # ── RISE OH (GTI) ───────────────────────────────────────────────
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise OH Cleveland", "slug": "rise-oh-cleveland", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/cleveland/6015/recreational-menu/", "is_active": False, "region": "ohio"},
    {"name": "Rise OH Lakewood Madison", "slug": "rise-oh-lakewood-madison", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/lakewood-madison/6014/recreational-menu/", "is_active": False, "region": "ohio"},
    {"name": "Rise OH Lakewood Detroit", "slug": "rise-oh-lakewood-detroit", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/lakewood-detroit/6013/recreational-menu/", "is_active": False, "region": "ohio"},
    {"name": "Rise OH Toledo", "slug": "rise-oh-toledo", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/toledo/6011/recreational-menu/", "is_active": False, "region": "ohio"},
    {"name": "Rise OH Lorain", "slug": "rise-oh-lorain", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/lorain/6012/recreational-menu/", "is_active": False, "region": "ohio"},

    # ==================================================================
    #  COLORADO  — Initial test batch (12 Dutchie + 5 Jane = 17)
    #  Mature market since 2014.  97 scrapable store pages identified.
    #  Dutchie dominates; no Curaleaf/Rise/Carrot/AIQ presence.
    # ==================================================================

    # ── DUTCHIE CO ──────────────────────────────────────────────────
    {"name": "Native Roots West Denver", "slug": "native-roots-west-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-west-denver", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Boulder", "slug": "native-roots-boulder", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-boulder1", "is_active": True, "region": "colorado"},
    {"name": "Lightshade Dayton Rec", "slug": "lightshade-dayton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lightshade-dayton-rec-and-med-dispensary", "is_active": True, "region": "colorado"},
    {"name": "The Green Solution Fort Collins", "slug": "tgs-fort-collins", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tgs-fort-collins", "is_active": True, "region": "colorado"},
    {"name": "L'Eagle Denver", "slug": "leagle-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/leagle-denver-dispensary", "is_active": True, "region": "colorado"},
    {"name": "Oasis Cannabis NW Denver", "slug": "oasis-nw-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/oasis-cannabis-superstore-northwest", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Denver", "slug": "medicine-man-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medicine-man-denver", "is_active": True, "region": "colorado"},
    {"name": "Colorado Harvest Broadway", "slug": "coharvest-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/colorado-harvest-company-broadway", "is_active": True, "region": "colorado"},
    {"name": "Rocky Mountain High 6th", "slug": "rmh-6th-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rocky-mountain-high-6th", "is_active": True, "region": "colorado"},
    {"name": "Magnolia Road Boulder Rec", "slug": "magnolia-boulder-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/magnolia-road-cannabis-company-boulder", "is_active": True, "region": "colorado"},
    {"name": "Green Dragon Breckenridge", "slug": "green-dragon-breck", "platform": "dutchie", "url": "https://dutchie.com/stores/green-dragon-breckenridge", "is_active": True, "region": "colorado"},
    {"name": "The Spot 420 Pueblo", "slug": "spot420-pueblo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-spot-420-pueblo-central", "is_active": True, "region": "colorado"},

    # ── JANE CO ─────────────────────────────────────────────────────
    {"name": "Ascend Cannabis Denver Rec", "slug": "ascend-co-denver-rec", "platform": "jane", "url": "https://www.iheartjane.com/embed/stores/3019/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Bonnie Brae Rec", "slug": "silver-stem-bonnie-brae", "platform": "jane", "url": "https://www.iheartjane.com/embed/stores/5494/menu", "is_active": True, "region": "colorado"},
    {"name": "Maggie's Farm N CO Springs", "slug": "maggies-farm-cos", "platform": "jane", "url": "https://www.iheartjane.com/stores/1229/maggie-s-farm-n-colorado-springs/menu", "is_active": True, "region": "colorado"},
    {"name": "Fresh Baked Boulder", "slug": "fresh-baked-boulder", "platform": "jane", "url": "https://www.iheartjane.com/embed/stores/333/menu", "is_active": True, "region": "colorado"},
    {"name": "Gardens Dispensary Yuma", "slug": "gardens-yuma", "platform": "jane", "url": "https://www.iheartjane.com/stores/17/gardens-dispensary-yuma/menu/featured", "is_active": True, "region": "colorado"},

    # ==================================================================
    #  NEW YORK  — Initial test batch (10 Dutchie + 4 Jane + 2 Curaleaf + 2 Rise = 18)
    #  Rec market opened 2023.  68 scrapable dispensaries identified.
    #  Curaleaf HQ'd in NYC.  Dutchie dominates CAURD licensees.
    # ==================================================================

    # ── DUTCHIE NY ──────────────────────────────────────────────────
    {"name": "Housing Works Cannabis Broadway", "slug": "hwc-broadway", "platform": "dutchie", "url": "https://hwcannabis.co/menu/broadway/", "is_active": True, "region": "new-york"},
    {"name": "Smacked Village Bleecker", "slug": "smacked-village", "platform": "dutchie", "url": "https://getsmacked.online/menu/", "fallback_url": "https://dutchie.com/dispensary/temeka-bleecker", "is_active": True, "region": "new-york"},
    {"name": "Gotham Bowery", "slug": "gotham-bowery", "platform": "dutchie", "url": "https://gotham.nyc/locations/bowery/", "fallback_url": "https://dutchie.com/dispensary/gotham-nyc-3rd-st", "is_active": True, "region": "new-york"},
    {"name": "Gotham Chelsea", "slug": "gotham-chelsea", "platform": "dutchie", "url": "https://gotham.nyc/menu/", "fallback_url": "https://dutchie.com/dispensary/gotham-chelsea", "is_active": True, "region": "new-york"},
    {"name": "Silk Road Queens", "slug": "silk-road-queens", "platform": "dutchie", "url": "https://dutchie.com/dispensary/silk-road-nyc", "is_active": True, "region": "new-york"},
    {"name": "Travel Agency Union Square", "slug": "travel-agency-usq", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-doe-store", "is_active": True, "region": "new-york"},
    {"name": "Strain Stars Farmingdale", "slug": "strain-stars-farmingdale", "platform": "dutchie", "url": "https://strainstarsny.com/stores/farmingdale/", "fallback_url": "https://dutchie.com/dispensary/strain-stars", "is_active": True, "region": "new-york"},
    {"name": "FLUENT Manhattan Rec (Etain)", "slug": "fluent-manhattan-rec", "platform": "dutchie", "url": "https://getfluent.com/dispensary/new-york/manhattan-dispensary/", "fallback_url": "https://dutchie.com/dispensary/etain-new-york-rec", "is_active": True, "region": "new-york"},
    {"name": "Royale Flower Albany", "slug": "royale-flower-albany", "platform": "dutchie", "url": "https://dutchie.com/dispensary/royale-flower-albany", "is_active": True, "region": "new-york"},
    {"name": "Herbalwai Buffalo", "slug": "herbalwai-buffalo", "platform": "dutchie", "url": "https://herbalwai.com/menu/", "fallback_url": "https://dutchie.com/dispensary/herbalwai", "is_active": True, "region": "new-york"},

    # ── JANE NY ─────────────────────────────────────────────────────
    {"name": "Rise Manhattan NYC", "slug": "rise-ny-manhattan-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1181/rise-dispensaries-manhattan-nyc/menu", "is_active": True, "region": "new-york"},
    {"name": "Vireo Health Queens", "slug": "vireo-queens", "platform": "jane", "url": "https://www.iheartjane.com/stores/2065/vireo-health-queens/menu", "is_active": True, "region": "new-york"},
    {"name": "The Botanist Farmingdale", "slug": "botanist-farmingdale", "platform": "jane", "url": "https://www.iheartjane.com/stores/1386/the-botanist-farmingdale", "is_active": True, "region": "new-york"},
    {"name": "Verilife Bronx", "slug": "verilife-ny-bronx", "platform": "jane", "url": "https://www.iheartjane.com/stores/3003/verilife-bronx-ny", "is_active": True, "region": "new-york"},

    # ── CURALEAF NY ─────────────────────────────────────────────────
    {"name": "Curaleaf NY Queens AU", "slug": "curaleaf-ny-queens-au", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-ny-queens-au", "is_active": True, "region": "new-york"},
    {"name": "Curaleaf NY Hudson Valley", "slug": "curaleaf-ny-hudson-valley", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-ny-hudson-valley", "is_active": True, "region": "new-york"},

    # ── RISE NY (GTI) ───────────────────────────────────────────────
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise NY Henrietta", "slug": "rise-ny-henrietta", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-york/henrietta/5800/recreational-menu/", "is_active": False, "region": "new-york"},
    {"name": "Rise NY East Syracuse", "slug": "rise-ny-east-syracuse", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-york/east-syracuse/6115/recreational-menu/", "is_active": False, "region": "new-york"},

    # ==================================================================
    #  MASSACHUSETTS  — Initial test batch (10 Dutchie + 3 Jane + 2 Curaleaf + 2 Rise = 17)
    #  Rec since 2018.  83 scrapable dispensaries identified.
    #  Dutchie dominant; Jane via Sunnyside/Cannabist.
    # ==================================================================

    # ── DUTCHIE MA ──────────────────────────────────────────────────
    {"name": "NETA Northampton Rec", "slug": "neta-northampton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/neta-northampton", "is_active": True, "region": "massachusetts"},
    {"name": "NETA Brookline Rec", "slug": "neta-brookline", "platform": "dutchie", "url": "https://dutchie.com/dispensary/neta-brookline", "is_active": True, "region": "massachusetts"},
    {"name": "Theory Wellness Great Barrington", "slug": "theory-great-barrington", "platform": "dutchie", "url": "https://dutchie.com/dispensary/theory-wellness", "is_active": True, "region": "massachusetts"},
    {"name": "Berkshire Roots East Boston", "slug": "berkshire-roots-eastie", "platform": "dutchie", "url": "https://dutchie.com/dispensary/berkshire-roots-east-boston", "is_active": True, "region": "massachusetts"},
    {"name": "Ascend Boston Friend St", "slug": "ascend-ma-boston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/boston-massachusetts", "is_active": True, "region": "massachusetts"},
    {"name": "INSA Easthampton Rec", "slug": "insa-easthampton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/insa-easthampton-rec", "is_active": True, "region": "massachusetts"},
    {"name": "Revolutionary Clinics Somerville", "slug": "rev-clinics-somerville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/revolutionary-clinics-somerville", "is_active": True, "region": "massachusetts"},
    {"name": "Cookies Somerville", "slug": "cookies-ma-somerville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-union-leaf", "is_active": True, "region": "massachusetts"},
    {"name": "AYR Back Bay Boston", "slug": "ayr-ma-back-bay", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ayr-dispensary-back-bay", "is_active": True, "region": "massachusetts"},
    {"name": "Harbor House Collective Chelsea", "slug": "harbor-house-chelsea", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harbor-house-collective", "is_active": True, "region": "massachusetts"},

    # ── JANE MA ─────────────────────────────────────────────────────
    {"name": "Sunnyside Worcester MA", "slug": "sunnyside-ma-worcester", "platform": "jane", "url": "https://www.iheartjane.com/stores/5025/sunnyside-cannabis-dispensary-worcester/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Sunnyside Leicester MA", "slug": "sunnyside-ma-leicester", "platform": "jane", "url": "https://www.iheartjane.com/stores/5054/sunnyside-cannabis-dispensary-leicester/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Cannabist Lowell AU", "slug": "cannabist-ma-lowell-au", "platform": "jane", "url": "https://www.iheartjane.com/stores/734/cannabist-lowell-adult-use/menu", "is_active": True, "region": "massachusetts"},

    # ── CURALEAF MA ─────────────────────────────────────────────────
    {"name": "Curaleaf MA Oxford AU", "slug": "curaleaf-ma-oxford", "platform": "curaleaf", "url": "https://curaleaf.com/shop/massachusetts/curaleaf-ma-oxford-adult-use", "is_active": True, "region": "massachusetts"},
    {"name": "Curaleaf MA Ware AU", "slug": "curaleaf-ma-ware", "platform": "curaleaf", "url": "https://curaleaf.com/shop/massachusetts/curaleaf-ma-ware-adult-use", "is_active": True, "region": "massachusetts"},

    # ── RISE MA (GTI) ───────────────────────────────────────────────
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise MA Chelsea Rec", "slug": "rise-ma-chelsea", "platform": "rise", "url": "https://risecannabis.com/dispensaries/massachusetts/chelsea/4636/recreational-menu/", "is_active": False, "region": "massachusetts"},
    {"name": "Rise MA Dracut Rec", "slug": "rise-ma-dracut", "platform": "rise", "url": "https://risecannabis.com/dispensaries/massachusetts/dracut/4637/recreational-menu/", "is_active": False, "region": "massachusetts"},

    # ==================================================================
    #  PENNSYLVANIA  — Initial test batch (10 Dutchie + 6 Rise = 16)
    #  Medical-only but top-5 US market by revenue.  86 scrapable found.
    #  Rise has its LARGEST footprint here (19 locations).
    #  PA Curaleaf menus are on Dutchie, not curaleaf.com.
    # ==================================================================

    # ── DUTCHIE PA ──────────────────────────────────────────────────
    {"name": "Ethos NE Philadelphia", "slug": "ethos-pa-ne-philly", "platform": "dutchie", "url": "https://ethoscannabis.com/dispensary-locations/pennsylvania/northeast-philadelphia/medical-cannabis-menu/", "fallback_url": "https://dutchie.com/dispensary/ethos-northeast-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Ethos Pleasant Hills PGH", "slug": "ethos-pa-pleasant-hills", "platform": "dutchie", "url": "https://ethoscannabis.com/dispensary-locations/pennsylvania/pittsburgh-south-at-pleasant-hills/medical-cannabis-menu/", "fallback_url": "https://dutchie.com/dispensary/ethos-pleasant-hills", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Philadelphia", "slug": "curaleaf-pa-philly", "platform": "dutchie", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-philadelphia", "fallback_url": "https://dutchie.com/dispensary/curaleaf-pa-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA King of Prussia", "slug": "curaleaf-pa-kop", "platform": "dutchie", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-king-of-prussia", "fallback_url": "https://dutchie.com/dispensary/curaleaf-pa-king-of-prussia", "is_active": True, "region": "pennsylvania"},
    {"name": "Trulieve PA Center City", "slug": "trulieve-pa-center-city", "platform": "dutchie", "url": "https://www.trulieve.com/dispensaries/pennsylvania/philadelphia-center-city", "fallback_url": "https://dutchie.com/dispensary/harvest-of-city-center-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Trulieve PA Squirrel Hill PGH", "slug": "trulieve-pa-squirrel-hill", "platform": "dutchie", "url": "https://www.trulieve.com/dispensaries/pennsylvania/pittsburgh", "fallback_url": "https://dutchie.com/dispensary/trulieve-squirrel-hill", "is_active": True, "region": "pennsylvania"},
    {"name": "Liberty Philadelphia", "slug": "liberty-pa-philly", "platform": "dutchie", "url": "https://libertycannabis.com/shop/philadelphia/", "fallback_url": "https://dutchie.com/dispensary/liberty-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Liberty Pittsburgh", "slug": "liberty-pa-pgh", "platform": "dutchie", "url": "https://libertycannabis.com/shop/pittsburgh/", "fallback_url": "https://dutchie.com/dispensary/liberty-pittsburgh", "is_active": True, "region": "pennsylvania"},
    {"name": "AYR Bryn Mawr", "slug": "ayr-pa-bryn-mawr", "platform": "dutchie", "url": "https://ayrdispensaries.com/pennsylvania/bryn-mawr/shop/", "fallback_url": "https://dutchie.com/dispensary/ayr-wellness-bryn-mawr", "is_active": True, "region": "pennsylvania"},
    {"name": "Ascend PA Scranton", "slug": "ascend-pa-scranton", "platform": "dutchie", "url": "https://letsascend.com/menu/pa-scranton-menu-med", "fallback_url": "https://dutchie.com/dispensary/scranton-pennsylvania", "is_active": True, "region": "pennsylvania"},

    # ── RISE PA (GTI — largest state footprint: 19 locations) ───────
    #    PA is medical-only → /medical-menu/ (not /recreational-menu/)
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise PA Philadelphia", "slug": "rise-pa-philly", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/philadelphia/5383/medical-menu/", "is_active": False, "region": "pennsylvania"},
    {"name": "Rise PA King of Prussia", "slug": "rise-pa-kop", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/king-of-prussia/1552/medical-menu/", "is_active": False, "region": "pennsylvania"},
    {"name": "Rise PA Monroeville", "slug": "rise-pa-monroeville", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/monroeville/2266/medical-menu/", "is_active": False, "region": "pennsylvania"},
    {"name": "Rise PA Steelton", "slug": "rise-pa-steelton", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/steelton/1544/medical-menu/", "is_active": False, "region": "pennsylvania"},
    {"name": "Rise PA Erie Lake", "slug": "rise-pa-erie-lake", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/erie-lake/392/medical-menu/", "is_active": False, "region": "pennsylvania"},
    {"name": "Rise PA York", "slug": "rise-pa-york", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/york/1548/medical-menu/", "is_active": False, "region": "pennsylvania"},

    # ==================================================================
    #  NEW JERSEY EXPANSION — additional verified dispensaries
    # ==================================================================

    # ── AYR NJ EATONTOWN (verified, Dutchie) ──────────────────────────
    {"name": "AYR NJ Eatontown Med", "slug": "ayr-nj-eatontown-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/garden-state-dispensary-eatontown", "is_active": True, "region": "new-jersey"},
    {"name": "AYR NJ Eatontown Rec", "slug": "ayr-nj-eatontown-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/garden-state-dispensary-eatontown-REC", "is_active": True, "region": "new-jersey"},

    # ── BLOC NJ ADDITIONAL (verified, Dutchie) ──────────────────────
    {"name": "Bloc Ewing NJ Rec", "slug": "bloc-nj-ewing-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-ewing-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Bloc Somerset NJ Rec", "slug": "bloc-nj-somerset-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloc-dispensary-somerset-rec", "is_active": True, "region": "new-jersey"},

    # ── THE BOTANIST NJ (Acreage — verified Dutchie slugs) ─────────
    {"name": "Botanist Egg Harbor NJ Rec", "slug": "botanist-nj-egg-harbor-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/egg-harbor-rec-menu", "is_active": True, "region": "new-jersey"},
    {"name": "Botanist Egg Harbor NJ Med", "slug": "botanist-nj-egg-harbor-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/egg-harbor-med-menu", "is_active": True, "region": "new-jersey"},
    {"name": "Botanist Williamstown NJ Rec", "slug": "botanist-nj-williamstown-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/williamstown-rec-menu", "is_active": True, "region": "new-jersey"},
    {"name": "Botanist Collingswood NJ Rec", "slug": "botanist-nj-collingswood-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/collingswood-rec-menu", "is_active": True, "region": "new-jersey"},
    {"name": "Botanist Collingswood NJ Med", "slug": "botanist-nj-collingswood-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/collingswood-med-menu", "is_active": True, "region": "new-jersey"},

    # ── HARMONY NJ (verified, Dutchie) ──────────────────────────────
    {"name": "Harmony Secaucus NJ Rec", "slug": "harmony-nj-secaucus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harmony-dispensary-secaucus-rec", "is_active": True, "region": "new-jersey"},

    # ── MPX NJ Atlantic City Med (verified) ─────────────────────────
    {"name": "MPX NJ Atlantic City Med", "slug": "mpx-nj-ac-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/be-altantic-city", "is_active": True, "region": "new-jersey"},

    # ── VALLEY WELLNESS NJ (verified, Dutchie — Raritan) ────────────
    {"name": "Valley Wellness Raritan NJ Med", "slug": "valley-wellness-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/valley-wellness", "is_active": True, "region": "new-jersey"},
    {"name": "Valley Wellness Raritan NJ Rec", "slug": "valley-wellness-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/valley-wellness-nj-rec", "is_active": True, "region": "new-jersey"},

    # ── AUNT MARY'S NJ (verified, Dutchie — Flemington) ────────────
    {"name": "Aunt Mary's Flemington NJ Med", "slug": "aunt-marys-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/aunt-marys", "is_active": True, "region": "new-jersey"},
    {"name": "Aunt Mary's Flemington NJ Rec", "slug": "aunt-marys-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/aunt-marys-flemington-rec", "is_active": True, "region": "new-jersey"},

    # ── VERIFIED NJ INDEPENDENTS (Dutchie) ──────────────────────────
    {"name": "CannaVibes Elmwood Park NJ", "slug": "cannavibes-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannavibes-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Simply Pure Trenton NJ", "slug": "simply-pure-trenton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/simply-pure-trenton", "is_active": True, "region": "new-jersey"},
    {"name": "Fresh Elizabeth NJ", "slug": "fresh-elizabeth", "platform": "dutchie", "url": "https://dutchie.com/dispensary/fresh-elizabeth", "is_active": True, "region": "new-jersey"},
    {"name": "Cream Jersey City NJ", "slug": "cream-jc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cream1", "is_active": True, "region": "new-jersey"},
    {"name": "1634 Funk Jersey City NJ", "slug": "1634-funk-jc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/1634-funk", "is_active": True, "region": "new-jersey"},
    {"name": "Village HBK Hoboken NJ", "slug": "village-hbk", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Village-HBK", "is_active": True, "region": "new-jersey"},
    {"name": "INSA Coastline Middle Twp NJ", "slug": "insa-coastline-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/insa-coastline", "is_active": True, "region": "new-jersey"},
    {"name": "Woodbury Wellness NJ", "slug": "woodbury-wellness", "platform": "dutchie", "url": "https://dutchie.com/dispensary/woodbury-wellness-llc", "is_active": True, "region": "new-jersey"},
    {"name": "Herbalicity Highland Park NJ", "slug": "herbalicity-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/herbalicity", "is_active": True, "region": "new-jersey"},
    {"name": "Plantabis Rahway NJ", "slug": "plantabis-rahway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/plantabis", "is_active": True, "region": "new-jersey"},
    {"name": "Bakin Bad Atlantic City NJ", "slug": "bakin-bad-ac", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bakin-bad", "is_active": True, "region": "new-jersey"},
    {"name": "Dispensary of Union NJ", "slug": "dispensary-of-union", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-bud-shop-llc-nka-the-dispensary-of-union-llc", "is_active": True, "region": "new-jersey"},
    {"name": "Unity Road Somerset NJ", "slug": "unity-road-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/unity-road-new-jersey", "is_active": True, "region": "new-jersey"},
    {"name": "Illicit Gardens Secaucus NJ", "slug": "illicit-secaucus-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/illicit-gardens-dispensary-seacaucus", "is_active": True, "region": "new-jersey"},
    {"name": "Hackettstown Dispensary NJ", "slug": "hackettstown-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hackettstown-dispensary", "is_active": True, "region": "new-jersey"},

    # ── RISE NJ ADDITIONAL (Rise platform) ──────────────────────────
    # All Rise sites deactivated — 100% Cloudflare blocked across all regions
    {"name": "Rise Paramus NJ", "slug": "rise-nj-paramus", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-jersey/paramus/3112/recreational-menu/", "is_active": False, "region": "new-jersey"},

    # ==================================================================
    #  ARIZONA EXPANSION — Jane sites (AZ has 0 Jane, adding new)
    # ==================================================================
    {"name": "Medusa Farms Kingman AZ", "slug": "medusa-farms-az", "platform": "jane", "url": "https://www.iheartjane.com/stores/4445/medusa-farms-rec", "is_active": True, "region": "arizona"},
    {"name": "Yuma Dispensary AZ", "slug": "yuma-dispensary-az", "platform": "jane", "url": "https://www.iheartjane.com/stores/4925/adult-use-yuma", "is_active": True, "region": "arizona"},
    {"name": "Sky Dispensaries Mesa AZ", "slug": "sky-mesa-az", "platform": "jane", "url": "https://www.iheartjane.com/stores/365/sky-dispensaries-mesa", "is_active": True, "region": "arizona"},

    # ==================================================================
    #  NEW JERSEY EXPANSION — Jane sites (NJ has 0 Jane, adding new)
    # ==================================================================
    {"name": "Botanist Atlantic City NJ", "slug": "botanist-nj-ac", "platform": "jane", "url": "https://www.iheartjane.com/stores/2094/the-botanist-atlantic-city", "is_active": True, "region": "new-jersey"},
    {"name": "Botanist Williamstown NJ", "slug": "botanist-nj-williamstown", "platform": "jane", "url": "https://www.iheartjane.com/stores/4417/nj-the-botanist-williamstown-adult-use", "is_active": True, "region": "new-jersey"},
    {"name": "Botanist Collingswood NJ", "slug": "botanist-nj-collingswood", "platform": "jane", "url": "https://www.iheartjane.com/stores/6232/nj-the-botanist-collingswood-medical", "is_active": True, "region": "new-jersey"},
    {"name": "Cannabist Deptford NJ", "slug": "cannabist-nj-deptford", "platform": "jane", "url": "https://www.iheartjane.com/stores/4461/cannabist-deptford-nj-rec", "is_active": True, "region": "new-jersey"},
    {"name": "THC Shop Atlantic City NJ", "slug": "thc-shop-nj-ac", "platform": "jane", "url": "https://www.iheartjane.com/stores/6385/the-thc-shop-atlantic-city-nj-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Scarlet Reserve Room Englishtown NJ", "slug": "scarlet-reserve-nj", "platform": "jane", "url": "https://www.iheartjane.com/stores/6198/scarlet-reserve-room", "is_active": True, "region": "new-jersey"},
    {"name": "Yuma Way Garfield NJ", "slug": "yuma-way-nj", "platform": "jane", "url": "https://www.iheartjane.com/stores/5487/yuma-way-garfield-nj-med", "is_active": True, "region": "new-jersey"},
    {"name": "A21 Dispensary Scotch Plains NJ", "slug": "a21-nj-scotch-plains", "platform": "jane", "url": "https://www.iheartjane.com/stores/5771/a21-dispensary-med", "is_active": True, "region": "new-jersey"},

    # ==================================================================
    #  MASSACHUSETTS EXPANSION — Dutchie + Jane (MA had only 13 active)
    # ==================================================================

    # ── MA Dutchie (14 new) ──────────────────────────────────────────
    {"name": "Mayflower Allston MA", "slug": "mayflower-ma-allston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mayflower-allston", "is_active": True, "region": "massachusetts"},
    {"name": "Mayflower Lowell MA", "slug": "mayflower-ma-lowell", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mayflower-lowell", "is_active": True, "region": "massachusetts"},
    {"name": "Mayflower Worcester MA", "slug": "mayflower-ma-worcester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mayflower-worcester", "is_active": True, "region": "massachusetts"},
    {"name": "Resinate Northampton MA", "slug": "resinate-ma-northampton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/resinate-northampton", "is_active": True, "region": "massachusetts"},
    {"name": "Resinate Worcester MA", "slug": "resinate-ma-worcester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/resinate-worcester", "is_active": True, "region": "massachusetts"},
    {"name": "Canna Provisions Lee MA", "slug": "canna-provisions-ma-lee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/canna-provisions", "is_active": True, "region": "massachusetts"},
    {"name": "Cannabis Culture Northampton MA", "slug": "cannabis-culture-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabis-culture1", "is_active": True, "region": "massachusetts"},
    # Berkshire Roots East Boston — duplicate of line 1650, removed
    {"name": "Berkshire Roots Pittsfield MA", "slug": "berkshire-roots-ma-pittsfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/berkshire-roots-med", "is_active": True, "region": "massachusetts"},
    {"name": "INSA Springfield MA", "slug": "insa-ma-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/insa-inc-springfield-adult-use", "is_active": True, "region": "massachusetts"},
    # INSA Easthampton — duplicate of line 1652, removed
    {"name": "Theory Wellness Bridgewater MA", "slug": "theory-ma-bridgewater", "platform": "dutchie", "url": "https://dutchie.com/dispensary/theory-wellness-bridgewater", "is_active": True, "region": "massachusetts"},
    {"name": "Theory Wellness Chicopee MA", "slug": "theory-ma-chicopee", "platform": "dutchie", "url": "https://dutchie.com/dispensary/theory-wellness-chicopee-med", "is_active": True, "region": "massachusetts"},
    {"name": "Cheech and Chongs Greenfield MA", "slug": "cheech-chongs-ma-greenfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/toroverde-greenfield", "is_active": True, "region": "massachusetts"},

    # ── MA Jane (4 new) ──────────────────────────────────────────────
    {"name": "Verilife Shrewsbury MA", "slug": "verilife-ma-shrewsbury", "platform": "jane", "url": "https://www.iheartjane.com/stores/2937/verilife-shrewsbury-ma-rec", "is_active": True, "region": "massachusetts"},
    {"name": "Rebelle Boston MA", "slug": "rebelle-ma-boston", "platform": "jane", "url": "https://www.iheartjane.com/stores/5959/rebelle-boston", "is_active": True, "region": "massachusetts"},
    {"name": "Fine Fettle W Springfield MA", "slug": "fine-fettle-ma-springfield", "platform": "jane", "url": "https://www.iheartjane.com/stores/5889/fine-fettle-west-springfield", "is_active": True, "region": "massachusetts"},
    # Sunnyside Leicester already in config at line 1662

    # ==================================================================
    #  CURALEAF / ZEN LEAF EXPANSION — all stores in 11 states
    # ==================================================================

    # ── NEW CURALEAF ILLINOIS (1 new store) ─────────────────────────
    # Northbrook, Westmont, Mokena, Justice already covered via Dutchie
    {"name": "Curaleaf IL Melrose Park", "slug": "curaleaf-il-melrose-park", "platform": "curaleaf", "url": "https://curaleaf.com/shop/illinois/curaleaf-il-melrose-park", "is_active": True, "region": "illinois"},

    # ── NEW CURALEAF ARIZONA (6 new stores) ──────────────────────────
    {"name": "Curaleaf AZ Queen Creek", "slug": "curaleaf-az-queen-creek", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-az-queen-creek", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Midtown", "slug": "curaleaf-az-midtown", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-midtown", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Glendale East", "slug": "curaleaf-az-glendale-east", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-az-glendale-east", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Pavilions", "slug": "curaleaf-az-pavilions", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-pavilions", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Camelback", "slug": "curaleaf-az-camelback", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-camelback", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Central", "slug": "curaleaf-az-central", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-central", "is_active": True, "region": "arizona"},

    # ── NEW CURALEAF NEW JERSEY (3 new stores) ───────────────────────
    {"name": "Curaleaf NJ Bordentown", "slug": "curaleaf-nj-bordentown", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-jersey/curaleaf-nj-bordentown", "is_active": True, "region": "new-jersey"},
    {"name": "Curaleaf NJ Edgewater Park", "slug": "curaleaf-nj-edgewater-park", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-jersey/curaleaf-nj-edgewater-park", "is_active": True, "region": "new-jersey"},
    {"name": "Curaleaf NJ Bellmawr", "slug": "curaleaf-nj-bellmawr", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-jersey/curaleaf-nj-bellmawr", "is_active": True, "region": "new-jersey"},

    # ── NEW CURALEAF MASSACHUSETTS (2 new stores) ────────────────────
    {"name": "Curaleaf MA Hanover", "slug": "curaleaf-ma-hanover", "platform": "curaleaf", "url": "https://curaleaf.com/shop/massachusetts/curaleaf-ma-hanover-medical", "is_active": True, "region": "massachusetts"},
    {"name": "Curaleaf MA Provincetown", "slug": "curaleaf-ma-provincetown", "platform": "curaleaf", "url": "https://curaleaf.com/shop/massachusetts/curaleaf-ma-provincetown-adult-use", "is_active": True, "region": "massachusetts"},

    # ── NEW CURALEAF PENNSYLVANIA (8 new stores) ─────────────────────
    {"name": "Curaleaf PA Philadelphia Passyunk", "slug": "curaleaf-pa-philly-passyunk", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Morton", "slug": "curaleaf-pa-morton", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-morton", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Wayne", "slug": "curaleaf-pa-wayne", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-wayne", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Philadelphia City Ave", "slug": "curaleaf-pa-philly-city-ave", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-city-avenue", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Lancaster", "slug": "curaleaf-pa-lancaster", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-lancaster", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Allentown", "slug": "curaleaf-pa-allentown", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-allentown", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA State College", "slug": "curaleaf-pa-state-college", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-state-college", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Lebanon", "slug": "curaleaf-pa-lebanon", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-lebanon", "is_active": True, "region": "pennsylvania"},

    # ── NEW CURALEAF NEW YORK (1 new store) ──────────────────────────
    {"name": "Curaleaf NY Carle Place", "slug": "curaleaf-ny-carle-place", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-ny-carle-place", "is_active": True, "region": "new-york"},

    # ── NEW CURALEAF MICHIGAN (deactivated — Curaleaf exited MI late 2023)
    {"name": "Curaleaf MI Battle Creek", "slug": "curaleaf-mi-battle-creek", "platform": "curaleaf", "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-battle-creek", "is_active": False, "region": "michigan"},
    {"name": "Curaleaf MI Ann Arbor", "slug": "curaleaf-mi-ann-arbor", "platform": "curaleaf", "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-ann-arbor", "is_active": False, "region": "michigan"},

    # ── NEW ZEN LEAF OHIO (6 new stores) ─────────────────────────────
    {"name": "Zen Leaf Cincinnati OH", "slug": "zen-leaf-oh-cincinnati", "platform": "curaleaf", "url": "https://oh.zenleafdispensaries.com/cincinnati/", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Canton OH", "slug": "zen-leaf-oh-canton", "platform": "curaleaf", "url": "https://oh.zenleafdispensaries.com/canton/", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Dayton OH", "slug": "zen-leaf-oh-dayton", "platform": "curaleaf", "url": "https://oh.zenleafdispensaries.com/dayton/", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Newark OH", "slug": "zen-leaf-oh-newark", "platform": "curaleaf", "url": "https://oh.zenleafdispensaries.com/newark/", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Antwerp OH", "slug": "zen-leaf-oh-antwerp", "platform": "curaleaf", "url": "https://oh.zenleafdispensaries.com/antwerp/", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Bowling Green OH", "slug": "zen-leaf-oh-bowling-green", "platform": "curaleaf", "url": "https://oh.zenleafdispensaries.com/bowling-green/", "is_active": True, "region": "ohio"},

    # ── NEW ZEN LEAF PENNSYLVANIA (3 new stores) ─────────────────────
    {"name": "Zen Leaf Pittsburgh McKnight PA", "slug": "zen-leaf-pa-pgh-mcknight", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/pittsburgh-mcknight/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Pittsburgh Robinson PA", "slug": "zen-leaf-pa-pgh-robinson", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/pittsburgh/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Harrisburg PA", "slug": "zen-leaf-pa-harrisburg", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/harrisburg/medical-menu", "is_active": True, "region": "pennsylvania"},

    # ==================================================================
    #  WAVE 2 EXPANSION — from completed research agents
    #  Curaleaf/Zen Leaf gaps + NJ/MA Jane/Dutchie to 95% coverage
    # ==================================================================

    # ── CURALEAF ARIZONA — 4 missing stores ─────────────────────────
    {"name": "Curaleaf AZ Bell", "slug": "curaleaf-az-bell", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-bell", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Glendale West", "slug": "curaleaf-az-glendale-west", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-glendale-west", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Peoria", "slug": "curaleaf-az-peoria", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-peoria", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Sedona", "slug": "curaleaf-az-sedona", "platform": "curaleaf", "url": "https://curaleaf.com/shop/arizona/curaleaf-dispensary-sedona", "is_active": True, "region": "arizona"},

    # ── CURALEAF NEW YORK — 3 missing stores ────────────────────────
    {"name": "Curaleaf NY Plattsburgh", "slug": "curaleaf-ny-plattsburgh", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-ny-plattsburgh", "is_active": True, "region": "new-york"},
    {"name": "Curaleaf NY Rochester", "slug": "curaleaf-ny-rochester", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-dispensary-rochester", "is_active": True, "region": "new-york"},
    {"name": "Curaleaf NY Syracuse", "slug": "curaleaf-ny-syracuse", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-dispensary-syracuse", "is_active": True, "region": "new-york"},

    # ── CURALEAF PENNSYLVANIA — 9 missing stores ────────────────────
    {"name": "Curaleaf PA Altoona", "slug": "curaleaf-pa-altoona", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-altoona", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Brookville", "slug": "curaleaf-pa-brookville", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-brookville", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA DuBois", "slug": "curaleaf-pa-dubois", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-dubois", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Erie", "slug": "curaleaf-pa-erie", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-erie", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Millcreek", "slug": "curaleaf-pa-millcreek", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-millcreek", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Gettysburg", "slug": "curaleaf-pa-gettysburg", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-gettysburg", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Greensburg", "slug": "curaleaf-pa-greensburg", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-greensburg", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Harrisburg", "slug": "curaleaf-pa-harrisburg", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-harrisburg", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Horsham", "slug": "curaleaf-pa-horsham", "platform": "curaleaf", "url": "https://curaleaf.com/shop/pennsylvania/curaleaf-pa-horsham", "is_active": True, "region": "pennsylvania"},

    # ── ZEN LEAF NEVADA — 5 new stores (entirely absent before) ─────
    {"name": "Zen Leaf Las Vegas Fort Apache NV", "slug": "zen-leaf-nv-fort-apache", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/las-vegas/menu/recreational", "is_active": True, "region": "southern-nv"},
    {"name": "Zen Leaf Las Vegas Flamingo NV", "slug": "zen-leaf-nv-flamingo", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/flamingo/menu/recreational", "is_active": True, "region": "southern-nv"},
    {"name": "Zen Leaf North Las Vegas NV", "slug": "zen-leaf-nv-north-lv", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/north-las-vegas/menu/recreational", "is_active": True, "region": "southern-nv"},
    {"name": "Zen Leaf Reno NV", "slug": "zen-leaf-nv-reno", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/reno/menu/recreational", "is_active": True, "region": "southern-nv"},
    {"name": "Zen Leaf Carson City NV", "slug": "zen-leaf-nv-carson-city", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/carson-city/menu/recreational", "is_active": True, "region": "southern-nv"},

    # ── ZEN LEAF ILLINOIS — 1 missing store ─────────────────────────
    {"name": "Zen Leaf Chicago Rogers Park IL", "slug": "zen-leaf-il-rogers-park", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/chicago-rogers-park/menu/recreational", "is_active": True, "region": "illinois"},

    # ── ZEN LEAF ARIZONA — 4 missing stores ─────────────────────────
    {"name": "Zen Leaf Phoenix Arcadia AZ", "slug": "zen-leaf-az-arcadia", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/arcadia/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Phoenix W Dunlap AZ", "slug": "zen-leaf-az-w-dunlap", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/phoenix-w-dunlap/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Mesa AZ", "slug": "zen-leaf-az-mesa", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/mesa/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Tempe AZ", "slug": "zen-leaf-az-tempe", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/tempe/menu/recreational", "is_active": True, "region": "arizona"},

    # ── ZEN LEAF NEW JERSEY — 1 missing store ───────────────────────
    {"name": "Zen Leaf Mt Holly NJ", "slug": "zen-leaf-nj-mt-holly", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/mt-holly/menu/recreational", "is_active": True, "region": "new-jersey"},

    # ── ZEN LEAF MASSACHUSETTS — 2 new stores (entirely absent before)
    {"name": "Zen Leaf Sharon MA", "slug": "zen-leaf-ma-sharon", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/sharon/menu/recreational", "is_active": True, "region": "massachusetts"},
    {"name": "Zen Leaf Plymouth MA", "slug": "zen-leaf-ma-plymouth", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/plymouth/menu/recreational", "is_active": True, "region": "massachusetts"},

    # ── ZEN LEAF PENNSYLVANIA — 13 missing stores ───────────────────
    {"name": "Zen Leaf Abington PA", "slug": "zen-leaf-pa-abington", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/abington/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Altoona PA", "slug": "zen-leaf-pa-altoona", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/altoona/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Clifton Heights PA", "slug": "zen-leaf-pa-clifton-heights", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/clifton-heights/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Cranberry Twp PA", "slug": "zen-leaf-pa-cranberry", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/cranberry/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Fairless Hills PA", "slug": "zen-leaf-pa-fairless-hills", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/fairless-hills/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Monroeville PA", "slug": "zen-leaf-pa-monroeville", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/monroeville/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf New Kensington PA", "slug": "zen-leaf-pa-new-kensington", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/new-kensington/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Norristown PA", "slug": "zen-leaf-pa-norristown", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/norristown/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Philadelphia PA", "slug": "zen-leaf-pa-philly", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/philadelphia/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Sellersville PA", "slug": "zen-leaf-pa-sellersville", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/sellersville/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf Washington PA", "slug": "zen-leaf-pa-washington", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/washington/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf West Chester PA", "slug": "zen-leaf-pa-west-chester", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/west-chester/medical-menu", "is_active": True, "region": "pennsylvania"},
    {"name": "Zen Leaf York PA", "slug": "zen-leaf-pa-york", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/york/medical-menu", "is_active": True, "region": "pennsylvania"},

    # ── NJ JANE EXPANSION — Rise stores via Jane (bypasses Cloudflare)
    {"name": "Rise Bloomfield NJ AU (Jane)", "slug": "rise-nj-bloomfield-jane-au", "platform": "jane", "url": "https://www.iheartjane.com/stores/4439/rise-dispensaries-bloomfield-adult-use/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Rise Bloomfield NJ Med (Jane)", "slug": "rise-nj-bloomfield-jane-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/3422/rise-dispensaries-bloomfield-medical/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Rise Paterson NJ AU (Jane)", "slug": "rise-nj-paterson-jane-au", "platform": "jane", "url": "https://www.iheartjane.com/stores/4440/rise-dispensaries-paterson-adult-use/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Rise Paterson NJ Med (Jane)", "slug": "rise-nj-paterson-jane-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/1317/rise-dispensaries-paterson-medical/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Rise Paramus NJ (Jane)", "slug": "rise-nj-paramus-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2446/rise-dispensaries-paramus/menu", "is_active": True, "region": "new-jersey"},

    # ── NJ JANE EXPANSION — Cannabist, Breakwater, KushKlub ─────────
    {"name": "Cannabist Vineland NJ Med", "slug": "cannabist-nj-vineland-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/1811/cannabist-vineland-medical/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Cannabist Vineland NJ Rec", "slug": "cannabist-nj-vineland-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/4460/cannabist-vineland-rec/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Breakwater Cranbury NJ", "slug": "breakwater-nj-cranbury", "platform": "jane", "url": "https://www.iheartjane.com/stores/1505/breakwater-treatment-wellness-cranbury/menu", "is_active": True, "region": "new-jersey"},
    {"name": "Breakwater Roselle Park NJ", "slug": "breakwater-nj-roselle-park", "platform": "jane", "url": "https://www.iheartjane.com/stores/4777/breakwater-treatment-wellness-roselle-park/menu", "is_active": True, "region": "new-jersey"},
    {"name": "KushKlub Jersey City NJ", "slug": "kushklub-nj-jersey-city", "platform": "jane", "url": "https://www.iheartjane.com/stores/6882/kushklub-jersey-city-nj/menu", "is_active": True, "region": "new-jersey"},

    # Botanist Egg Harbor already covered on Dutchie (lines 1716-1717)

    # ── NJ DUTCHIE EXPANSION — 19 stores (8 wave2 + 11 wave3) ──────
    {"name": "Everest Dispensary AC NJ", "slug": "everest-nj-ac", "platform": "dutchie", "url": "https://dutchie.com/dispensary/everest-dispensary", "is_active": True, "region": "new-jersey"},
    {"name": "Design 710 REC AC NJ", "slug": "design-710-nj-ac", "platform": "dutchie", "url": "https://dutchie.com/dispensary/design-710-rec", "is_active": True, "region": "new-jersey"},
    {"name": "Peaches Garden AC NJ", "slug": "peaches-garden-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/peaches-garden", "is_active": True, "region": "new-jersey"},
    {"name": "Moja Life Trenton NJ", "slug": "moja-life-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/moja-life", "is_active": True, "region": "new-jersey"},
    {"name": "Rush Budz S Bound Brook NJ", "slug": "rush-budz-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shopnew-jersey-pickup", "is_active": True, "region": "new-jersey"},
    {"name": "Got Your Six Princeton NJ", "slug": "got-your-six-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/got-your-six-llc", "is_active": True, "region": "new-jersey"},
    {"name": "Mister Jones Little Falls NJ", "slug": "mister-jones-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mister-jones-new-jersey", "is_active": True, "region": "new-jersey"},
    {"name": "Green Oasis Atco NJ", "slug": "green-oasis-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabis-nj", "is_active": True, "region": "new-jersey"},
    # Wave 3 — from completed NJ research agent
    {"name": "NAR Cannabis Mt Laurel NJ", "slug": "nar-nj-mt-laurel", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nar-cannabis-mt-laurel", "is_active": True, "region": "new-jersey"},
    {"name": "Phasal Runnemede NJ", "slug": "phasal-nj-runnemede", "platform": "dutchie", "url": "https://dutchie.com/dispensary/phasal-llc", "is_active": True, "region": "new-jersey"},
    {"name": "The Library West Orange NJ", "slug": "the-library-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-library", "is_active": True, "region": "new-jersey"},
    {"name": "Hazy Harvest Jersey City NJ", "slug": "hazy-harvest-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hazy-harvest", "is_active": True, "region": "new-jersey"},
    {"name": "Castaway Cannabis Delran NJ", "slug": "castaway-nj-delran", "platform": "dutchie", "url": "https://dutchie.com/dispensary/castaway-cannabis", "is_active": True, "region": "new-jersey"},
    {"name": "Design 710 MED AC NJ", "slug": "design-710-nj-ac-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/design-710", "is_active": True, "region": "new-jersey"},
    {"name": "Doobiez West Milford NJ", "slug": "doobiez-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/doobiez-nj", "is_active": True, "region": "new-jersey"},
    {"name": "Blazin Buddiez Bridgeton NJ", "slug": "blazin-buddiez-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/blazin-baddiez", "is_active": True, "region": "new-jersey"},
    {"name": "Uma Flowers Morristown NJ", "slug": "uma-flowers-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/uma-flowers-morristown", "is_active": True, "region": "new-jersey"},
    {"name": "Hello High Hammonton NJ", "slug": "hello-high-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hello-high", "is_active": True, "region": "new-jersey"},
    {"name": "Cottonmouth Dispensary Runnemede NJ", "slug": "cottonmouth-nj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cottonmouth-dispensary", "is_active": True, "region": "new-jersey"},

    # ── MA DUTCHIE EXPANSION — 27 new stores ────────────────────────
    {"name": "Canna Provisions Holyoke MA", "slug": "canna-provisions-ma-holyoke", "platform": "dutchie", "url": "https://dutchie.com/dispensary/canna-provisions-holyoke", "is_active": True, "region": "massachusetts"},
    {"name": "Redi Newton MA", "slug": "redi-ma-newton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/redi", "is_active": True, "region": "massachusetts"},
    {"name": "Honey Northampton MA", "slug": "honey-ma-northampton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/honey-northhampton", "is_active": True, "region": "massachusetts"},
    {"name": "The Boston Garden Cambridge MA", "slug": "boston-garden-ma-cambridge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-boston-garden-cambridge", "is_active": True, "region": "massachusetts"},
    {"name": "The Boston Garden Somerville MA", "slug": "boston-garden-ma-somerville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-boston-garden-somerville", "is_active": True, "region": "massachusetts"},
    {"name": "Cookies Worcester MA", "slug": "cookies-ma-worcester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-worcester", "is_active": True, "region": "massachusetts"},
    {"name": "Ethos Dorchester MA", "slug": "ethos-ma-dorchester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ethos-dorchester", "is_active": True, "region": "massachusetts"},
    {"name": "Ethos Watertown Med MA", "slug": "ethos-ma-watertown-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ethos-Watertown-Medical", "is_active": True, "region": "massachusetts"},
    {"name": "Good Chemistry Worcester Rec MA", "slug": "good-chem-ma-worcester-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-chemistry", "is_active": True, "region": "massachusetts"},
    {"name": "Good Chemistry Worcester Med MA", "slug": "good-chem-ma-worcester-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-chemistry-med", "is_active": True, "region": "massachusetts"},
    {"name": "Diem Worcester MA", "slug": "diem-ma-worcester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/diem-worcester", "is_active": True, "region": "massachusetts"},
    {"name": "Smyth Cannabis Co Lowell MA", "slug": "smyth-ma-lowell", "platform": "dutchie", "url": "https://dutchie.com/dispensary/smyth-cannabis-co", "is_active": True, "region": "massachusetts"},
    {"name": "Rev Clinics Central Square MA", "slug": "rev-clinics-ma-central-sq", "platform": "dutchie", "url": "https://dutchie.com/dispensary/revolutionary-clinics-central-square", "is_active": True, "region": "massachusetts"},
    {"name": "Rev Clinics Fresh Pond MA", "slug": "rev-clinics-ma-fresh-pond", "platform": "dutchie", "url": "https://dutchie.com/dispensary/revolutionary-clinics-fresh-pond", "is_active": True, "region": "massachusetts"},
    {"name": "High Hopes Hopedale MA", "slug": "high-hopes-ma-hopedale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-hopes", "is_active": True, "region": "massachusetts"},
    {"name": "Pettals Attleboro MA", "slug": "pettals-ma-attleboro", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terps-attleboro", "is_active": True, "region": "massachusetts"},
    {"name": "Pettals Charlton MA", "slug": "pettals-ma-charlton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terps-charlton", "is_active": True, "region": "massachusetts"},
    {"name": "Cape Cod Cannabis Wellfleet MA", "slug": "cape-cod-cannabis-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cape-cod-cannabis", "is_active": True, "region": "massachusetts"},
    {"name": "DDM Cannabis Blackstone MA", "slug": "ddm-ma-blackstone", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ddm-cannabis", "is_active": True, "region": "massachusetts"},
    {"name": "Smokey Leaf Greenfield MA", "slug": "smokey-leaf-ma-greenfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/smokey-leaf", "is_active": True, "region": "massachusetts"},
    {"name": "In Good Health Brockton Rec MA", "slug": "igh-ma-brockton-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/in-good-health-brockton", "is_active": True, "region": "massachusetts"},
    {"name": "In Good Health Brockton Med MA", "slug": "igh-ma-brockton-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/in-good-health-medical", "is_active": True, "region": "massachusetts"},
    {"name": "In Good Health Taunton Rec MA", "slug": "igh-ma-taunton-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/in-good-health-taunton-rec-dispensary", "is_active": True, "region": "massachusetts"},
    {"name": "Ascend New Bedford MA", "slug": "ascend-ma-new-bedford", "platform": "dutchie", "url": "https://dutchie.com/dispensary/new-bedford-massachusetts", "is_active": True, "region": "massachusetts"},
    {"name": "Collective Littleton MA", "slug": "collective-ma-littleton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/community-care-collective1", "is_active": True, "region": "massachusetts"},
    {"name": "Pure Oasis Blue Hill Boston MA", "slug": "pure-oasis-ma-blue-hill", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pure-oasis1", "is_active": True, "region": "massachusetts"},
    {"name": "Pure Oasis DTX Boston MA", "slug": "pure-oasis-ma-dtx", "platform": "dutchie", "url": "https://dutchie.com/dispensary/pure-oasis-dtx", "is_active": True, "region": "massachusetts"},

    # ── MA JANE EXPANSION — 4 new stores ────────────────────────────
    {"name": "Cannabist Lowell Med MA", "slug": "cannabist-ma-lowell-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/733/cannabist-lowell-medical/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Verilife Wareham Rec MA", "slug": "verilife-ma-wareham-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/2939/verilife-wareham-ma-rec/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Verilife Wareham Med MA", "slug": "verilife-ma-wareham-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/2936/verilife-wareham-ma-med/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Full Harvest Moonz Haverhill MA", "slug": "full-harvest-moonz-ma", "platform": "jane", "url": "https://www.iheartjane.com/stores/2783/full-harvest-moonz", "is_active": True, "region": "massachusetts"},

    # ── MA WAVE 3 DUTCHIE — remaining stores from research agent ────
    {"name": "Dutchess West Roxbury MA", "slug": "dutchess-ma-west-roxbury", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dutchess-west-roxbury-massachusetts", "is_active": True, "region": "massachusetts"},
    {"name": "Dreamer Southampton MA", "slug": "dreamer-ma-southampton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dreamer", "is_active": True, "region": "massachusetts"},
    {"name": "Liberty Market Lanesborough MA", "slug": "liberty-market-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liberty-market", "is_active": True, "region": "massachusetts"},
    {"name": "Ethos Fitchburg MA", "slug": "ethos-ma-fitchburg", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ethos-fitchburg", "is_active": True, "region": "massachusetts"},
    {"name": "Ethos Watertown AU MA", "slug": "ethos-ma-watertown-au", "platform": "dutchie", "url": "https://dutchie.com/dispensary/Ethos-Watertown-Adult-Use", "is_active": True, "region": "massachusetts"},
    {"name": "Temescal Wellness Hudson MA", "slug": "temescal-ma-hudson", "platform": "dutchie", "url": "https://dutchie.com/dispensary/temescal-wellness-hudson", "is_active": True, "region": "massachusetts"},
    {"name": "Temescal Wellness Framingham MA", "slug": "temescal-ma-framingham", "platform": "dutchie", "url": "https://dutchie.com/dispensary/temescal-wellness-framingham", "is_active": True, "region": "massachusetts"},
    {"name": "Temescal Wellness Pittsfield MA", "slug": "temescal-ma-pittsfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/temescal-wellness-pittsfield", "is_active": True, "region": "massachusetts"},
    {"name": "Clear Sky North Adams MA", "slug": "clear-sky-ma-north-adams", "platform": "dutchie", "url": "https://dutchie.com/dispensary/clear-sky-north-adams", "is_active": True, "region": "massachusetts"},
    {"name": "Clear Sky Belchertown MA", "slug": "clear-sky-ma-belchertown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/clear-sky-belchertown", "is_active": True, "region": "massachusetts"},
    {"name": "Silver Therapeutics Williamstown MA", "slug": "silver-therapeutics-ma-williamstown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/silver-therapeutics", "is_active": True, "region": "massachusetts"},
    {"name": "Silver Therapeutics Palmer MA", "slug": "silver-therapeutics-ma-palmer", "platform": "dutchie", "url": "https://dutchie.com/dispensary/silver-therapeutics-palmer-retail", "is_active": True, "region": "massachusetts"},
    {"name": "Nature's Remedy Millbury MA", "slug": "natures-remedy-ma-millbury", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-remedy1", "is_active": True, "region": "massachusetts"},
    {"name": "Nature's Remedy Tyngsborough MA", "slug": "natures-remedy-ma-tyngsborough", "platform": "dutchie", "url": "https://dutchie.com/dispensary/natures-remedy2", "is_active": True, "region": "massachusetts"},
    {"name": "Union Twist Allston MA", "slug": "union-twist-ma-allston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/union-twist-allston", "is_active": True, "region": "massachusetts"},
    {"name": "Union Twist Framingham MA", "slug": "union-twist-ma-framingham", "platform": "dutchie", "url": "https://dutchie.com/dispensary/union-twist-framingham", "is_active": True, "region": "massachusetts"},
    {"name": "Ermont Inc Quincy MA", "slug": "ermont-ma-quincy", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ermont-inc", "is_active": True, "region": "massachusetts"},
    {"name": "Heirloom Collective Hadley MA", "slug": "heirloom-ma-hadley", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-heirloom-collective", "is_active": True, "region": "massachusetts"},
    {"name": "Boston Bud Factory Holyoke MA", "slug": "boston-bud-ma-holyoke", "platform": "dutchie", "url": "https://dutchie.com/dispensary/boston-bud-factory", "is_active": True, "region": "massachusetts"},
    {"name": "Apothca Jamaica Plain MA", "slug": "apothca-ma-jp", "platform": "dutchie", "url": "https://dutchie.com/dispensary/apothca-jamaica-plain", "is_active": True, "region": "massachusetts"},
    {"name": "Campfire Cannabis West Boylston MA", "slug": "campfire-ma-west-boylston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/campfire-cannabis1", "is_active": True, "region": "massachusetts"},
    {"name": "Local Roots Sturbridge MA", "slug": "local-roots-ma-sturbridge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/local-roots-sturbridge", "is_active": True, "region": "massachusetts"},
    {"name": "Green Gold Charlton MA", "slug": "green-gold-ma-charlton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-gold", "is_active": True, "region": "massachusetts"},
    {"name": "Triple M Plymouth MA", "slug": "triple-m-ma-plymouth", "platform": "dutchie", "url": "https://dutchie.com/dispensary/triple-m-plymouth", "is_active": True, "region": "massachusetts"},
    {"name": "Bask Fairhaven Rec MA", "slug": "bask-ma-fairhaven", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bask", "is_active": True, "region": "massachusetts"},
    {"name": "Trade Roots Wareham MA", "slug": "trade-roots-ma-wareham", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trade-roots", "is_active": True, "region": "massachusetts"},
    {"name": "Cannabis Connection Westfield MA", "slug": "cannabis-connection-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabis-connection", "is_active": True, "region": "massachusetts"},
    {"name": "Greenleaf Compassion Care MA", "slug": "greenleaf-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-folks", "is_active": True, "region": "massachusetts"},
    {"name": "Bloom Brothers Pittsfield MA", "slug": "bloom-brothers-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bloom-brothers", "is_active": True, "region": "massachusetts"},
    {"name": "BOUTIQ East Boston MA", "slug": "boutiq-ma-eastie", "platform": "dutchie", "url": "https://dutchie.com/dispensary/boutiq", "is_active": True, "region": "massachusetts"},
    {"name": "Buds Goods Watertown MA", "slug": "buds-goods-ma-watertown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/buds-goods-and-provisions-watertown", "is_active": True, "region": "massachusetts"},
    {"name": "Buds Goods Abington MA", "slug": "buds-goods-ma-abington", "platform": "dutchie", "url": "https://dutchie.com/dispensary/buds-goods-and-provisions-abington", "is_active": True, "region": "massachusetts"},
    {"name": "High Profile Dorchester MA", "slug": "high-profile-ma-dorchester", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-profile-dorchester", "is_active": True, "region": "massachusetts"},
    {"name": "Solar Cannabis Seekonk MA", "slug": "solar-ma-seekonk", "platform": "dutchie", "url": "https://dutchie.com/dispensary/solar-cannabis-co-seekonk", "is_active": True, "region": "massachusetts"},
    {"name": "Solar Cannabis Somerset MA", "slug": "solar-ma-somerset", "platform": "dutchie", "url": "https://dutchie.com/dispensary/solar-therapeutics", "is_active": True, "region": "massachusetts"},
    {"name": "Solar Cannabis Dartmouth MA", "slug": "solar-ma-dartmouth", "platform": "dutchie", "url": "https://dutchie.com/dispensary/solar-therapeutics-dartmouth", "is_active": True, "region": "massachusetts"},
    {"name": "Uma Flowers Waltham MA", "slug": "uma-flowers-ma-waltham", "platform": "dutchie", "url": "https://dutchie.com/dispensary/uma-flowers-waltham", "is_active": True, "region": "massachusetts"},
    {"name": "CommCan Millis MA", "slug": "commcan-ma-millis", "platform": "dutchie", "url": "https://dutchie.com/dispensary/commcan-millis", "is_active": True, "region": "massachusetts"},
    {"name": "Thrive Beverly Rec MA", "slug": "thrive-ma-beverly", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-beverly-rec", "is_active": True, "region": "massachusetts"},
    {"name": "Thrive Middleboro Rec MA", "slug": "thrive-ma-middleboro-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/thrive-rec", "is_active": True, "region": "massachusetts"},
    {"name": "The Pass Sheffield MA", "slug": "the-pass-ma-sheffield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-pass", "is_active": True, "region": "massachusetts"},
    {"name": "High Street Cannabis Boston MA", "slug": "high-street-ma-boston", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-street-cannabis-downtown-boston", "is_active": True, "region": "massachusetts"},
    {"name": "Green Meadows Fitchburg MA", "slug": "green-meadows-ma-fitchburg", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-meadow-farm-fitchburg", "is_active": True, "region": "massachusetts"},
    {"name": "Elevated Roots MA", "slug": "elevated-roots-ma", "platform": "dutchie", "url": "https://dutchie.com/dispensary/elevated-roots", "is_active": True, "region": "massachusetts"},

    # ── MA WAVE 3 JANE — remaining from research agent ──────────────
    {"name": "Full Harvest Moonz Lowell MA", "slug": "full-harvest-moonz-ma-lowell", "platform": "jane", "url": "https://www.iheartjane.com/stores/4813/full-harvest-moonz-lowell", "is_active": True, "region": "massachusetts"},
    {"name": "Verilife Shrewsbury Med MA", "slug": "verilife-ma-shrewsbury-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/3731/verilife-shrewsbury-ma-med/menu", "is_active": True, "region": "massachusetts"},

    # ═════════════════════════════════════════════════════════════════════
    # WAVE 4 — Ohio expansion (+55 net new)
    # ═════════════════════════════════════════════════════════════════════

    # ── OH DUTCHIE ─────────────────────────────────────────────────────
    {"name": "Ascend Cincinnati OH", "slug": "ascend-oh-cincinnati", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ascend-cincinnati-ohio", "is_active": True, "region": "ohio"},
    {"name": "Ascend Sandusky OH", "slug": "ascend-oh-sandusky", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sandusky-ohio", "is_active": True, "region": "ohio"},
    {"name": "Amplify Columbus OH", "slug": "amplify-oh-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/amplify-columbus", "is_active": True, "region": "ohio"},
    {"name": "Amplify Coventry OH", "slug": "amplify-oh-coventry", "platform": "dutchie", "url": "https://dutchie.com/dispensary/amplify-coventry", "is_active": True, "region": "ohio"},
    {"name": "Amplify Eastlake OH", "slug": "amplify-oh-eastlake", "platform": "dutchie", "url": "https://dutchie.com/dispensary/amplify-eastlake-llc-dba-amplify", "is_active": True, "region": "ohio"},
    {"name": "Certified Cleveland OH", "slug": "certified-oh-cleveland", "platform": "dutchie", "url": "https://dutchie.com/dispensary/certified-cleveland", "is_active": True, "region": "ohio"},
    {"name": "Certified Columbus OH", "slug": "certified-oh-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/certified-columbus", "is_active": True, "region": "ohio"},
    {"name": "Certified Springfield OH", "slug": "certified-oh-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/certified-springfield", "is_active": True, "region": "ohio"},
    {"name": "Queen City Cannabis Harrison OH", "slug": "queen-city-oh-harrison", "platform": "dutchie", "url": "https://dutchie.com/dispensary/canoe-hill-dispensary-harrison", "is_active": True, "region": "ohio"},
    {"name": "Queen City Cannabis Norwood OH", "slug": "queen-city-oh-norwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/canoe-hill-dispensary-norwood", "is_active": True, "region": "ohio"},
    {"name": "Culture Cannabis Akron OH", "slug": "culture-cannabis-oh-akron", "platform": "dutchie", "url": "https://dutchie.com/dispensary/culture-cannabis-club-akron", "is_active": True, "region": "ohio"},
    {"name": "Daily Releaf Dayton OH", "slug": "daily-releaf-oh-dayton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/daily-releaf", "is_active": True, "region": "ohio"},
    {"name": "Good River Wellness Euclid OH", "slug": "good-river-oh-euclid", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-river-wellness", "is_active": True, "region": "ohio"},
    {"name": "Green Releaf Dayton OH", "slug": "green-releaf-oh-dayton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/green-releaf-dispensary-dayton", "is_active": True, "region": "ohio"},
    {"name": "Harvest Columbus OH", "slug": "harvest-oh-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-columbus", "is_active": True, "region": "ohio"},
    {"name": "Leaf Relief Boardman OH", "slug": "leaf-relief-oh-boardman", "platform": "dutchie", "url": "https://dutchie.com/dispensary/leaf-relief1", "is_active": True, "region": "ohio"},
    {"name": "Landing Columbus OH", "slug": "landing-oh-columbus", "platform": "dutchie", "url": "https://dutchie.com/dispensary/columbus-ohio", "is_active": True, "region": "ohio"},
    {"name": "Landing Cleveland OH", "slug": "landing-oh-cleveland", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-landing-dispensary-cleveland", "is_active": True, "region": "ohio"},
    {"name": "Landing Monroe OH", "slug": "landing-oh-monroe", "platform": "dutchie", "url": "https://dutchie.com/dispensary/monroe-ohio", "is_active": True, "region": "ohio"},
    {"name": "Nectar Bowling Green OH", "slug": "nectar-oh-bowling-green", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nectar-bowling-green", "is_active": True, "region": "ohio"},
    {"name": "Nectar Cincinnati OH", "slug": "nectar-oh-cincinnati", "platform": "dutchie", "url": "https://dutchie.com/dispensary/nectar-cincinnati", "is_active": True, "region": "ohio"},
    {"name": "Off The Charts Dayton OH", "slug": "otc-oh-dayton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/otc-ohio", "is_active": True, "region": "ohio"},
    {"name": "OCC Piqua OH", "slug": "occ-oh-piqua", "platform": "dutchie", "url": "https://dutchie.com/dispensary/piqua-ohio", "is_active": True, "region": "ohio"},
    {"name": "Shangri-La Cleveland OH", "slug": "shangri-la-oh-cleveland", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-cleveland", "is_active": True, "region": "ohio"},
    {"name": "Shangri-La Delphos OH", "slug": "shangri-la-oh-delphos", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-delphos", "is_active": True, "region": "ohio"},
    {"name": "Shangri-La Norwalk OH", "slug": "shangri-la-oh-norwalk", "platform": "dutchie", "url": "https://dutchie.com/dispensary/shangri-la-norwalk", "is_active": True, "region": "ohio"},
    {"name": "Southern Ohio Botanicals OH", "slug": "southern-oh-botanicals", "platform": "dutchie", "url": "https://dutchie.com/dispensary/southern-ohio-botanicals", "is_active": True, "region": "ohio"},
    {"name": "Supergood Ravenna OH", "slug": "supergood-oh-ravenna", "platform": "dutchie", "url": "https://dutchie.com/dispensary/supergood-ravenna", "is_active": True, "region": "ohio"},
    {"name": "Terrasana Garfield OH", "slug": "terrasana-oh-garfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terrasana-garfield", "is_active": True, "region": "ohio"},
    {"name": "Terrasana Springfield OH", "slug": "terrasana-oh-springfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/terrasana-springfield", "is_active": True, "region": "ohio"},
    {"name": "The Vault Zanesville OH", "slug": "vault-oh-zanesville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-vault-medrec", "is_active": True, "region": "ohio"},
    {"name": "Therapy Cincinnati OH", "slug": "therapy-oh-cincinnati", "platform": "dutchie", "url": "https://dutchie.com/dispensary/therapy-cincinnati", "is_active": True, "region": "ohio"},
    {"name": "Therapy Cleveland OH", "slug": "therapy-oh-cleveland", "platform": "dutchie", "url": "https://dutchie.com/dispensary/therapy-cleveland", "is_active": True, "region": "ohio"},
    {"name": "Trulieve Findlay OH", "slug": "trulieve-oh-findlay", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-findlay", "is_active": True, "region": "ohio"},
    {"name": "Trulieve Westerville OH", "slug": "trulieve-oh-westerville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-medical-marijuana-dispensary-westerville", "is_active": True, "region": "ohio"},
    {"name": "Trulieve Zanesville OH", "slug": "trulieve-oh-zanesville", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-zanesville", "is_active": True, "region": "ohio"},

    # ── OH JANE ────────────────────────────────────────────────────────
    {"name": "Botanist Akron OH", "slug": "botanist-oh-akron", "platform": "jane", "url": "https://www.iheartjane.com/stores/1666/the-botanist-akron-oh-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Botanist Columbus OH", "slug": "botanist-oh-columbus", "platform": "jane", "url": "https://www.iheartjane.com/stores/1667/the-botanist-columbus/menu", "is_active": True, "region": "ohio"},
    {"name": "Botanist Cleveland OH", "slug": "botanist-oh-cleveland", "platform": "jane", "url": "https://www.iheartjane.com/stores/1668/the-botanist-cleveland/menu", "is_active": True, "region": "ohio"},
    {"name": "Botanist Wickliffe OH", "slug": "botanist-oh-wickliffe", "platform": "jane", "url": "https://www.iheartjane.com/stores/743/the-botanist-wickliffe/menu", "is_active": True, "region": "ohio"},
    {"name": "Botanist Canton OH", "slug": "botanist-oh-canton", "platform": "jane", "url": "https://www.iheartjane.com/stores/744/the-botanist-canton/menu", "is_active": True, "region": "ohio"},
    {"name": "Certified AU Cleveland OH", "slug": "certified-oh-au", "platform": "jane", "url": "https://www.iheartjane.com/stores/6077/certified-cultivators-ohio-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Bloom Columbus OH", "slug": "bloom-oh-columbus-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2410/bloom-medicinals-columbus-oh/menu", "is_active": True, "region": "ohio"},
    {"name": "Bloom Maumee OH", "slug": "bloom-oh-maumee", "platform": "jane", "url": "https://www.iheartjane.com/stores/6003/bloom-medicinals-maumee-oh-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Bloom Seven Mile OH", "slug": "bloom-oh-seven-mile", "platform": "jane", "url": "https://www.iheartjane.com/stores/6000/bloom-medicinals-seven-mile-oh-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Bloom Painesville OH", "slug": "bloom-oh-painesville", "platform": "jane", "url": "https://www.iheartjane.com/stores/2866/bloom-medicinals-painesville-oh/menu", "is_active": True, "region": "ohio"},
    {"name": "Bloom Lockbourne OH", "slug": "bloom-oh-lockbourne", "platform": "jane", "url": "https://www.iheartjane.com/stores/6482/bloom-medicinals-lockbourne-oh-non-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Sunnyside Wintersville OH", "slug": "sunnyside-oh-wintersville", "platform": "jane", "url": "https://www.iheartjane.com/stores/5026/sunnyside-medical-marijuana-dispensary-wintersville/menu", "is_active": True, "region": "ohio"},
    {"name": "Sunnyside Cincinnati OH", "slug": "sunnyside-oh-cincinnati", "platform": "jane", "url": "https://www.iheartjane.com/stores/5036/sunnyside-medical-marijuana-dispensary-cincinnati/menu", "is_active": True, "region": "ohio"},
    {"name": "Sunnyside Chillicothe OH", "slug": "sunnyside-oh-chillicothe", "platform": "jane", "url": "https://www.iheartjane.com/stores/5049/sunnyside-medical-marijuana-dispensary-chillicothe/menu", "is_active": True, "region": "ohio"},
    {"name": "Pure Ohio Wellness London OH", "slug": "pure-ohio-london", "platform": "jane", "url": "https://www.iheartjane.com/stores/6054/pure-ohio-wellness-london-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Verilife Hillsboro OH", "slug": "verilife-oh-hillsboro", "platform": "jane", "url": "https://www.iheartjane.com/stores/6048/verilife-hillsboro-oh-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Verilife Wapakoneta OH", "slug": "verilife-oh-wapakoneta", "platform": "jane", "url": "https://www.iheartjane.com/stores/6047/verilife-wapakoneta-oh-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Consume Oxford OH", "slug": "consume-oh-oxford", "platform": "jane", "url": "https://www.iheartjane.com/stores/6098/consume-cannabis-oxford-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Cannabist St Clairsville OH", "slug": "cannabist-oh-st-clairsville", "platform": "jane", "url": "https://www.iheartjane.com/stores/6705/cannabist-st-clairsville-adult-use/menu", "is_active": True, "region": "ohio"},

    # ═════════════════════════════════════════════════════════════════════
    # WAVE 4 — Colorado expansion (+114 net new)
    # ═════════════════════════════════════════════════════════════════════

    # ── CO DUTCHIE ─────────────────────────────────────────────────────
    {"name": "Ajoya W Colfax CO", "slug": "ajoya-co-colfax", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ajoya-w-colfax-rec", "is_active": True, "region": "colorado"},
    {"name": "Ajoya Dillon Rd CO", "slug": "ajoya-co-dillon", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ajoya-w-dillon-rd-recreational", "is_active": True, "region": "colorado"},
    {"name": "B Good Englewood CO", "slug": "bgood-co-englewood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/bgood-englewood", "is_active": True, "region": "colorado"},
    {"name": "Callie's Cannabis Shoppe CO", "slug": "callies-co-main", "platform": "dutchie", "url": "https://dutchie.com/dispensary/callies-cannabis-shoppe", "is_active": True, "region": "colorado"},
    {"name": "Callie's Cannabis RiNo CO", "slug": "callies-co-rino", "platform": "dutchie", "url": "https://dutchie.com/dispensary/callies-cannabis-shoppe-rino", "is_active": True, "region": "colorado"},
    {"name": "Cannabis Station Denver CO", "slug": "cannabis-station-co-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cannabis-station", "is_active": True, "region": "colorado"},
    {"name": "Colorado Grow Company Durango CO", "slug": "co-grow-durango", "platform": "dutchie", "url": "https://dutchie.com/dispensary/colorado-grow-company", "is_active": True, "region": "colorado"},
    {"name": "Colorado Harvest Kalamath CO", "slug": "coharvest-kalamath", "platform": "dutchie", "url": "https://dutchie.com/dispensary/colorado-harvest-company---kalamath", "is_active": True, "region": "colorado"},
    {"name": "Colorado Harvest Yale CO", "slug": "coharvest-yale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/colorado-harvest-company-yale", "is_active": True, "region": "colorado"},
    {"name": "Colorado Weedery Palisade CO", "slug": "co-weedery-palisade", "platform": "dutchie", "url": "https://dutchie.com/dispensary/colorado-weedery", "is_active": True, "region": "colorado"},
    {"name": "Colorado Weedery Grand Junction CO", "slug": "co-weedery-gj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/colorado-weedery-grand-junction", "is_active": True, "region": "colorado"},
    {"name": "Cookies Commerce City CO", "slug": "cookies-co-commerce-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/cookies-commerce-city", "is_active": True, "region": "colorado"},
    {"name": "Den Rec Larimer CO", "slug": "den-rec-co-larimer", "platform": "dutchie", "url": "https://dutchie.com/dispensary/den-rec-larimer", "is_active": True, "region": "colorado"},
    {"name": "Elevations Rec Colorado Springs CO", "slug": "elevations-co-cos-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/elevations-rec", "is_active": True, "region": "colorado"},
    {"name": "Golden Meds Broadway CO", "slug": "golden-meds-co-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/golden-meds-broadway", "is_active": True, "region": "colorado"},
    {"name": "Golden Meds Colorado Springs CO", "slug": "golden-meds-co-cos", "platform": "dutchie", "url": "https://dutchie.com/dispensary/golden-meds-colorado-springs", "is_active": True, "region": "colorado"},
    {"name": "Golden Meds Peoria CO", "slug": "golden-meds-co-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/golden-meds-peoria", "is_active": True, "region": "colorado"},
    {"name": "Good Chemistry 15th St CO", "slug": "good-chem-co-15th", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-chemistry-15th-st", "is_active": True, "region": "colorado"},
    {"name": "Good Chemistry Aurora CO", "slug": "good-chem-co-aurora", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-chemistry-aurora", "is_active": True, "region": "colorado"},
    {"name": "Good Chemistry Colfax CO", "slug": "good-chem-co-colfax", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-chemistry-colfax", "is_active": True, "region": "colorado"},
    {"name": "Good Chemistry S Broadway CO", "slug": "good-chem-co-s-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-chemistry-south-broadway", "is_active": True, "region": "colorado"},
    {"name": "Good Meds Englewood CO", "slug": "good-meds-co-englewood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/good-meds-englewood", "is_active": True, "region": "colorado"},
    {"name": "House of Dankness Denver CO", "slug": "house-dankness-co-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/house-of-dankness", "is_active": True, "region": "colorado"},
    {"name": "JARS Longmont CO", "slug": "jars-co-longmont", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-longmont", "is_active": True, "region": "colorado"},
    {"name": "JARS Mile High CO", "slug": "jars-co-mile-high", "platform": "dutchie", "url": "https://dutchie.com/dispensary/jars-mile-high", "is_active": True, "region": "colorado"},
    {"name": "Kind Love Alameda CO", "slug": "kind-love-co-alameda", "platform": "dutchie", "url": "https://dutchie.com/dispensary/kind-love-alameda", "is_active": True, "region": "colorado"},
    {"name": "Kind Love Peoria CO", "slug": "kind-love-co-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/kind-love-peoria", "is_active": True, "region": "colorado"},
    {"name": "Kind Meds Colorado Springs CO", "slug": "kind-meds-co-cos", "platform": "dutchie", "url": "https://dutchie.com/dispensary/kind-meds-colorado-springs", "is_active": True, "region": "colorado"},
    {"name": "Levels Lakewood CO", "slug": "levels-co-lakewood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/levels-lakewood", "is_active": True, "region": "colorado"},
    {"name": "Levels Sheridan CO", "slug": "levels-co-sheridan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/levels-sheridan", "is_active": True, "region": "colorado"},
    {"name": "Lightshade 6th Ave CO", "slug": "lightshade-co-6th", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lightshade-6th-rec-dispensary", "is_active": True, "region": "colorado"},
    {"name": "Lightshade Evans CO", "slug": "lightshade-co-evans", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lightshade-evans-rec-and-med-dispensary", "is_active": True, "region": "colorado"},
    {"name": "Lightshade Federal Heights CO", "slug": "lightshade-co-federal", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lightshade-federal-heights-rec-dispensary", "is_active": True, "region": "colorado"},
    {"name": "Lightshade Sheridan CO", "slug": "lightshade-co-sheridan", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lightshade-sheridan-rec-and-med-dispensary", "is_active": True, "region": "colorado"},
    {"name": "LiveWell Broadway CO", "slug": "livewell-co-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/livewell-cannabis-dispensary-broadway", "is_active": True, "region": "colorado"},
    {"name": "LiveWell Hawthorne CO", "slug": "livewell-co-hawthorne", "platform": "dutchie", "url": "https://dutchie.com/dispensary/livewell-cannabis-dispensary-hawthorne", "is_active": True, "region": "colorado"},
    {"name": "Lucky Me Grand Junction CO", "slug": "lucky-me-co-gj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lucky-me-grand-junction-rec", "is_active": True, "region": "colorado"},
    {"name": "Lucy Sky Federal CO", "slug": "lucy-sky-co-federal", "platform": "dutchie", "url": "https://dutchie.com/dispensary/lucy-sky-cannabis-boutique-federal", "is_active": True, "region": "colorado"},
    {"name": "Magnolia Road Broomfield CO", "slug": "magnolia-co-broomfield", "platform": "dutchie", "url": "https://dutchie.com/dispensary/magnolia-road-broomfield", "is_active": True, "region": "colorado"},
    {"name": "Magnolia Road Trinidad CO", "slug": "magnolia-co-trinidad", "platform": "dutchie", "url": "https://dutchie.com/dispensary/magnolia-road-cannabis-company-trinidad", "is_active": True, "region": "colorado"},
    {"name": "Magnolia Road Colorado Springs CO", "slug": "magnolia-co-cos", "platform": "dutchie", "url": "https://dutchie.com/dispensary/magnolia-road-colorado-springs-rec", "is_active": True, "region": "colorado"},
    {"name": "Magnolia Road Log Lane CO", "slug": "magnolia-co-log-lane", "platform": "dutchie", "url": "https://dutchie.com/dispensary/magnolia-road-log-lane", "is_active": True, "region": "colorado"},
    {"name": "Mammoth Farms Durango CO", "slug": "mammoth-co-durango", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mammoth-farms-durango", "is_active": True, "region": "colorado"},
    {"name": "Mana Supply CO", "slug": "mana-co-supply", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mana-supply-co-colorado", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Aurora CO", "slug": "medicine-man-co-aurora", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medicine-man-aurora", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Longmont CO", "slug": "medicine-man-co-longmont", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medicine-man-longmont", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Thornton CO", "slug": "medicine-man-co-thornton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medicine-man-thornton", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Aspen CO", "slug": "native-roots-co-aspen", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-aspen", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Austin Bluffs CO", "slug": "native-roots-co-austin-bluffs", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-austin-bluffs", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Grand Junction CO", "slug": "native-roots-co-gj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-grand-junction-recreational", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Highlands CO", "slug": "native-roots-co-highlands", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-highlands", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Littleton CO", "slug": "native-roots-co-littleton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-littleton", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Longmont CO", "slug": "native-roots-co-longmont", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-longmont", "is_active": True, "region": "colorado"},
    {"name": "Native Roots North Denver CO", "slug": "native-roots-co-north-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-north-denver", "is_active": True, "region": "colorado"},
    {"name": "Native Roots South Denver CO", "slug": "native-roots-co-south-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-south-denver", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Tower CO", "slug": "native-roots-co-tower", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-tower", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Trinidad CO", "slug": "native-roots-co-trinidad", "platform": "dutchie", "url": "https://dutchie.com/dispensary/native-roots-trinidad", "is_active": True, "region": "colorado"},
    {"name": "Reefer Madness 46th CO", "slug": "reefer-madness-co-46th", "platform": "dutchie", "url": "https://dutchie.com/dispensary/reefer-madness-46th-recreational", "is_active": True, "region": "colorado"},
    {"name": "Reefer Madness Broadway CO", "slug": "reefer-madness-co-broadway", "platform": "dutchie", "url": "https://dutchie.com/dispensary/reefer-madness-broadway-rec", "is_active": True, "region": "colorado"},
    {"name": "Rocky Mountain High Alameda CO", "slug": "rmh-co-alameda", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rocky-mountain-high-alameda", "is_active": True, "region": "colorado"},
    {"name": "Rocky Mountain High LoDo CO", "slug": "rmh-co-lodo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rocky-mountain-high-lodo", "is_active": True, "region": "colorado"},
    {"name": "Rocky Mountain High Montrose CO", "slug": "rmh-co-montrose", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rocky-mountain-high-montrose", "is_active": True, "region": "colorado"},
    {"name": "Rocky Road Thornton CO", "slug": "rocky-road-co-thornton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/rocky-road-thornton", "is_active": True, "region": "colorado"},
    {"name": "SilverPeak Denver CO", "slug": "silverpeak-co-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/silverpeak", "is_active": True, "region": "colorado"},
    {"name": "Snaxland Boulder CO", "slug": "snaxland-co-boulder", "platform": "dutchie", "url": "https://dutchie.com/dispensary/snaxland-boulder", "is_active": True, "region": "colorado"},
    {"name": "Snaxland Denver CO", "slug": "snaxland-co-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/snaxland-denver", "is_active": True, "region": "colorado"},
    {"name": "Snaxland Federal Blvd CO", "slug": "snaxland-co-federal", "platform": "dutchie", "url": "https://dutchie.com/dispensary/snaxland-federal-blvd", "is_active": True, "region": "colorado"},
    {"name": "Starbuds Commerce City CO", "slug": "starbuds-co-commerce-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/starbuds-commerce-city", "is_active": True, "region": "colorado"},
    {"name": "Starbuds Longmont CO", "slug": "starbuds-co-longmont", "platform": "dutchie", "url": "https://dutchie.com/dispensary/starbuds-longmont", "is_active": True, "region": "colorado"},
    {"name": "Starbuds Pueblo West CO", "slug": "starbuds-co-pueblo-west", "platform": "dutchie", "url": "https://dutchie.com/dispensary/starbuds-pueblo-west", "is_active": True, "region": "colorado"},
    {"name": "Starbuds SE Aurora CO", "slug": "starbuds-co-se-aurora", "platform": "dutchie", "url": "https://dutchie.com/dispensary/starbuds-se-aurora", "is_active": True, "region": "colorado"},
    {"name": "TGS Glenwood CO", "slug": "tgs-co-glenwood", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tgs-glenwood", "is_active": True, "region": "colorado"},
    {"name": "TGS Grape St CO", "slug": "tgs-co-grape-st", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tgs-grape-st", "is_active": True, "region": "colorado"},
    {"name": "TGS Montview CO", "slug": "tgs-co-montview", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tgs-montview", "is_active": True, "region": "colorado"},
    {"name": "TGS Peoria CO", "slug": "tgs-co-peoria", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tgs-peoria", "is_active": True, "region": "colorado"},
    {"name": "TGS Quincy CO", "slug": "tgs-co-quincy", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tgs-quincy", "is_active": True, "region": "colorado"},
    {"name": "The 404 Pueblo CO", "slug": "the-404-co-pueblo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-404-dispensary", "is_active": True, "region": "colorado"},
    {"name": "The Dab Downtown CO", "slug": "the-dab-co-downtown", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-dab-downtown1", "is_active": True, "region": "colorado"},
    {"name": "The Dab Parachute CO", "slug": "the-dab-co-parachute", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-dab-parachute", "is_active": True, "region": "colorado"},
    {"name": "The Farm North Boulder CO", "slug": "the-farm-co-boulder", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-farm-north", "is_active": True, "region": "colorado"},
    {"name": "Grand Junction Greenery CO", "slug": "greenery-co-gj", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-grand-junction-greenery", "is_active": True, "region": "colorado"},
    {"name": "Health Center Boulder CO", "slug": "health-center-co-boulder", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-health-center-boulder", "is_active": True, "region": "colorado"},
    {"name": "The Stone Dispensary CO", "slug": "the-stone-co", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-stone-dispensary1", "is_active": True, "region": "colorado"},
    {"name": "Tumbleweed Steamboat CO", "slug": "tumbleweed-co-steamboat", "platform": "dutchie", "url": "https://dutchie.com/dispensary/tumbleweed-dispensary-steamboat", "is_active": True, "region": "colorado"},
    {"name": "Unity Road Boulder CO", "slug": "unity-road-co-boulder", "platform": "dutchie", "url": "https://dutchie.com/dispensary/unity-road-boulder", "is_active": True, "region": "colorado"},
    {"name": "Verde Natural Boulder CO", "slug": "verde-co-boulder", "platform": "dutchie", "url": "https://dutchie.com/dispensary/verde-natural-boulder", "is_active": True, "region": "colorado"},
    {"name": "Verde Natural Denver CO", "slug": "verde-co-denver", "platform": "dutchie", "url": "https://dutchie.com/dispensary/verde-natural-denver", "is_active": True, "region": "colorado"},
    {"name": "Zen Golds Fort Collins CO", "slug": "zengolds-co-fc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/zengolds-fort-collins", "is_active": True, "region": "colorado"},

    # ── CO JANE ────────────────────────────────────────────────────────
    {"name": "Silver Stem Denver East Rec CO", "slug": "silver-stem-co-east-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/399/silver-stem-denver-east-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Denver South Rec CO", "slug": "silver-stem-co-south-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/401/silver-stem-denver-south-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Fraser CO", "slug": "silver-stem-co-fraser", "platform": "jane", "url": "https://www.iheartjane.com/stores/403/silver-stem-fraser/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Nederland CO", "slug": "silver-stem-co-nederland", "platform": "jane", "url": "https://www.iheartjane.com/stores/405/silver-stem-nederland-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Littleton Rec CO", "slug": "silver-stem-co-littleton", "platform": "jane", "url": "https://www.iheartjane.com/stores/3063/silver-stem-littleton-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Broadmoor CO", "slug": "silver-stem-co-broadmoor", "platform": "jane", "url": "https://www.iheartjane.com/stores/4956/silver-stem-broadmoor-downtown-med/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Colfax E Aurora CO", "slug": "tgs-co-jane-colfax", "platform": "jane", "url": "https://www.iheartjane.com/stores/3832/the-green-solution-colfax-ave-east-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Potomac Central Aurora CO", "slug": "tgs-co-jane-potomac", "platform": "jane", "url": "https://www.iheartjane.com/stores/3910/the-green-solution-potomac-st-central-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Quincy SE Aurora CO", "slug": "tgs-co-jane-quincy", "platform": "jane", "url": "https://www.iheartjane.com/stores/3913/the-green-solution-quincy-ave-southeast-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Federal Sheridan CO", "slug": "tgs-co-jane-federal", "platform": "jane", "url": "https://www.iheartjane.com/stores/3914/the-green-solution-s-federal-blvd-sheridan/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Ft Collins Rec CO", "slug": "tgs-co-jane-ftc", "platform": "jane", "url": "https://www.iheartjane.com/stores/3916/the-green-solution-college-avenue-ft-collins-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Montview W Aurora CO", "slug": "tgs-co-jane-montview", "platform": "jane", "url": "https://www.iheartjane.com/stores/3918/the-green-solution-e-montview-blvd-w-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Grape North Denver CO", "slug": "tgs-co-jane-grape", "platform": "jane", "url": "https://www.iheartjane.com/stores/3919/the-green-solution-grape-st-north-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Peoria S Aurora CO", "slug": "tgs-co-jane-peoria-s", "platform": "jane", "url": "https://www.iheartjane.com/stores/3920/the-green-solution-peoria-ct-south-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Alameda W Denver CO", "slug": "tgs-co-jane-alameda", "platform": "jane", "url": "https://www.iheartjane.com/stores/3925/the-green-solution-alameda-ave-west-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Wewatta Union Station CO", "slug": "tgs-co-jane-wewatta", "platform": "jane", "url": "https://www.iheartjane.com/stores/3927/the-green-solution-wewatta-st-union-station/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Federal Westminster CO", "slug": "tgs-co-jane-westminster", "platform": "jane", "url": "https://www.iheartjane.com/stores/3928/the-green-solution-federal-blvd-westminster/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Southgate Pueblo CO", "slug": "tgs-co-jane-pueblo", "platform": "jane", "url": "https://www.iheartjane.com/stores/3933/the-green-solution-southgate-pl-pueblo/menu", "is_active": True, "region": "colorado"},
    {"name": "TGS Black Hawk CO", "slug": "tgs-co-jane-blackhawk", "platform": "jane", "url": "https://www.iheartjane.com/stores/3935/the-green-solution-gregory-st-black-hawk/menu", "is_active": True, "region": "colorado"},
    {"name": "Ascend Lakewood Rec CO", "slug": "ascend-co-lakewood-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/4238/ascend-cannabis-co-lakewood-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Ascend Littleton Rec CO", "slug": "ascend-co-littleton-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/3023/ascend-cannabis-co-littleton-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Gardens Glendale CO", "slug": "gardens-co-glendale", "platform": "jane", "url": "https://www.iheartjane.com/stores/1671/gardens-dispensary-glendale-cherry-peak-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Gardens Park Hill CO", "slug": "gardens-co-park-hill", "platform": "jane", "url": "https://www.iheartjane.com/stores/5084/gardens-dispensary-park-hill/menu", "is_active": True, "region": "colorado"},
    {"name": "Lit Federal CO", "slug": "lit-co-federal", "platform": "jane", "url": "https://www.iheartjane.com/stores/784/lit-federal/menu", "is_active": True, "region": "colorado"},
    {"name": "Lit Broadway CO", "slug": "lit-co-broadway", "platform": "jane", "url": "https://www.iheartjane.com/stores/1116/lit-cannabis-broadway/menu", "is_active": True, "region": "colorado"},
    {"name": "Rocky Road Aurora CO", "slug": "rocky-road-co-aurora", "platform": "jane", "url": "https://www.iheartjane.com/stores/595/rocky-road-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "Dino Dispensary CO", "slug": "dino-co", "platform": "jane", "url": "https://www.iheartjane.com/stores/5265/dino-dispensary/menu", "is_active": True, "region": "colorado"},
    {"name": "Shift Denver CO", "slug": "shift-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/6134/shift-dispensary-denver/menu", "is_active": True, "region": "colorado"},

    # ═════════════════════════════════════════════════════════════════════
    # WAVE 4 — New York expansion (+50 net new)
    # ═════════════════════════════════════════════════════════════════════

    # ── NY DUTCHIE ─────────────────────────────────────────────────────
    {"name": "Brooklyn Bourne NY", "slug": "brooklyn-bourne-ny", "platform": "dutchie", "url": "https://dutchie.com/dispensary/brooklyn-bourne", "is_active": True, "region": "new-york"},
    {"name": "Culture House NYC NY", "slug": "culture-house-ny", "platform": "dutchie", "url": "https://culturehousenyc.com/menu/", "fallback_url": "https://dutchie.com/dispensary/culture-house", "is_active": True, "region": "new-york"},
    {"name": "Dazed Union Square NY", "slug": "dazed-ny-usq", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dazed-cannabis1", "is_active": True, "region": "new-york"},
    {"name": "Dazed Syracuse NY", "slug": "dazed-ny-syracuse", "platform": "dutchie", "url": "https://dutchie.com/dispensary/dazed-syracuse", "is_active": True, "region": "new-york"},
    {"name": "The Flowery Soho NY", "slug": "flowery-ny-soho", "platform": "dutchie", "url": "https://dutchie.com/dispensary/elevate-soho", "is_active": True, "region": "new-york"},
    {"name": "Etain Kingston Rec NY", "slug": "etain-ny-kingston-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/etain-kingston-rec", "is_active": True, "region": "new-york"},
    {"name": "Etain Manhattan Med NY", "slug": "etain-ny-manhattan-med", "platform": "dutchie", "url": "https://dutchie.com/dispensary/etain-manhattan", "is_active": True, "region": "new-york"},
    {"name": "Gotham Buds Harlem NY", "slug": "gotham-ny-harlem", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gotham-buds", "is_active": True, "region": "new-york"},
    {"name": "Gotham Delivery NY", "slug": "gotham-ny-delivery", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gotham-delivery", "is_active": True, "region": "new-york"},
    {"name": "Green Street Brooklyn NY", "slug": "green-street-ny-brooklyn", "platform": "dutchie", "url": "https://gstnydispensary.com/menu", "fallback_url": "https://dutchie.com/dispensary/green-street-brooklyn", "is_active": True, "region": "new-york"},
    {"name": "Grow Together Brooklyn NY", "slug": "grow-together-ny-brooklyn", "platform": "dutchie", "url": "https://dutchie.com/dispensary/grow-together-brooklyn", "is_active": True, "region": "new-york"},
    {"name": "Herbwell Bronx NY", "slug": "herbwell-ny-bronx", "platform": "dutchie", "url": "https://dutchie.com/dispensary/herbwell-bronx", "is_active": True, "region": "new-york"},
    {"name": "Hybrid NYC NY", "slug": "hybrid-ny-nyc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/hybrid-nyc", "is_active": True, "region": "new-york"},
    {"name": "Just Breathe Syracuse NY", "slug": "just-breathe-ny-syracuse", "platform": "dutchie", "url": "https://justbreathesyr.com/menu/", "fallback_url": "https://dutchie.com/dispensary/just-breathe-syracuse", "is_active": True, "region": "new-york"},
    {"name": "MedMen Bryant Park NY", "slug": "medmen-ny-bryant-park", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medmen-ny-bryant-park", "is_active": True, "region": "new-york"},
    {"name": "MedMen Buffalo NY", "slug": "medmen-ny-buffalo", "platform": "dutchie", "url": "https://www.medmen.com/stores/buffalo", "fallback_url": "https://dutchie.com/dispensary/medmen-ny-buffalo", "is_active": True, "region": "new-york"},
    {"name": "MedMen Lake Success NY", "slug": "medmen-ny-lake-success", "platform": "dutchie", "url": "https://dutchie.com/dispensary/medmen-ny-li-lake-success-ny", "is_active": True, "region": "new-york"},
    {"name": "MedMen Syracuse NY", "slug": "medmen-ny-syracuse", "platform": "dutchie", "url": "https://www.medmen.com/stores/syracuse", "fallback_url": "https://dutchie.com/dispensary/medmen-ny-syracuse-galeville", "is_active": True, "region": "new-york"},
    {"name": "NY Canna Co NY", "slug": "ny-canna-co-main", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ny-canna-co", "is_active": True, "region": "new-york"},
    {"name": "NY Canna Co 5th Ave NY", "slug": "ny-canna-co-5th", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ny-canna-co-5th-ave", "is_active": True, "region": "new-york"},
    {"name": "Queens Cannabis Co NY", "slug": "queens-cannabis-ny", "platform": "dutchie", "url": "https://dutchie.com/dispensary/queens-cannabis-co", "is_active": True, "region": "new-york"},
    {"name": "Riverbend Hudson NY", "slug": "riverbend-ny-hudson", "platform": "dutchie", "url": "https://www.riverbenddispensary.com/shop-riverbend-cannabis-dispensary-hudson/", "fallback_url": "https://dutchie.com/dispensary/riverbend-dispensary-hudson", "is_active": True, "region": "new-york"},
    {"name": "Strain Stars Riverhead NY", "slug": "strain-stars-ny-riverhead", "platform": "dutchie", "url": "https://strainstarsny.com/stores/riverhead/", "fallback_url": "https://dutchie.com/dispensary/strain-stars-riverhead", "is_active": True, "region": "new-york"},
    {"name": "Strain Stars White Plains NY", "slug": "strain-stars-ny-white-plains", "platform": "dutchie", "url": "https://strainstarsny.com/stores/white-plains/", "fallback_url": "https://dutchie.com/dispensary/strain-stars-white-plains", "is_active": True, "region": "new-york"},
    {"name": "Sweet Life NYC NY", "slug": "sweet-life-ny-nyc", "platform": "dutchie", "url": "https://dutchie.com/dispensary/sweet-life-nyc", "is_active": True, "region": "new-york"},
    {"name": "The Emerald Manhattan NY", "slug": "emerald-ny-manhattan", "platform": "dutchie", "url": "https://emeralddispensary.nyc/", "fallback_url": "https://dutchie.com/dispensary/the-emerald-dispensary-manhattan", "is_active": True, "region": "new-york"},
    {"name": "Buffalo Cannabis Store NY", "slug": "buffalo-cannabis-ny", "platform": "dutchie", "url": "https://dutchie.com/dispensary/buffalo-cannabis-store", "is_active": True, "region": "new-york"},
    {"name": "Bayside Cannabis NY", "slug": "bayside-ny", "platform": "dutchie", "url": "https://baysidecannabis.com/menu/", "fallback_url": "https://dutchie.com/dispensary/bayside-cannabis-dispensary", "is_active": True, "region": "new-york"},
    {"name": "Athenian Royalty Queens NY", "slug": "athenian-ny-queens", "platform": "dutchie", "url": "https://dutchie.com/dispensary/athenian-royalty-queens", "is_active": True, "region": "new-york"},
    {"name": "Stoop NY", "slug": "stoop-ny", "platform": "dutchie", "url": "https://stoopsnyc.com/shop/stoop/", "fallback_url": "https://dutchie.com/dispensary/stoop", "is_active": True, "region": "new-york"},
    {"name": "High of Brooklyn NY", "slug": "high-of-brooklyn-ny", "platform": "dutchie", "url": "https://dutchie.com/dispensary/high-of-brooklyn", "is_active": True, "region": "new-york"},
    {"name": "Conbud NYC NY", "slug": "conbud-ny-nyc", "platform": "dutchie", "url": "https://conbudnyc.com/menu/", "fallback_url": "https://dutchie.com/dispensary/conbud", "is_active": True, "region": "new-york"},
    {"name": "Conbud Bronx NY", "slug": "conbud-ny-bronx", "platform": "dutchie", "url": "https://dutchie.com/dispensary/conbud-bronx", "is_active": True, "region": "new-york"},
    {"name": "Harlem Cannabis NY", "slug": "harlem-cannabis-ny", "platform": "dutchie", "url": "https://happytimescannabis.com/pages/shop", "fallback_url": "https://dutchie.com/dispensary/3807-harlem-cannabis-llc", "is_active": True, "region": "new-york"},
    {"name": "Citiva Medical Brooklyn NY", "slug": "citiva-ny-brooklyn", "platform": "dutchie", "url": "https://dutchie.com/dispensary/citiva-medical-llc-brooklyn", "is_active": True, "region": "new-york"},
    {"name": "Citiva Medical Staten Island NY", "slug": "citiva-ny-staten-island", "platform": "dutchie", "url": "https://dutchie.com/dispensary/citiva-medical-staten-island", "is_active": True, "region": "new-york"},
    {"name": "Mighty Lucky NYC NY", "slug": "mighty-lucky-ny", "platform": "dutchie", "url": "https://dutchie.com/dispensary/mighty-lucky", "is_active": True, "region": "new-york"},
    {"name": "Midnight Moon NYC NY", "slug": "midnight-moon-ny", "platform": "dutchie", "url": "https://midnightmoon.nyc/shop", "fallback_url": "https://dutchie.com/dispensary/midnight-moon", "is_active": True, "region": "new-york"},
    {"name": "Superfly NYC NY", "slug": "superfly-ny", "platform": "dutchie", "url": "https://dutchie.com/dispensary/afny", "is_active": True, "region": "new-york"},

    # ── NY JANE ────────────────────────────────────────────────────────
    {"name": "Rise Halfmoon NY", "slug": "rise-ny-halfmoon", "platform": "jane", "url": "https://www.iheartjane.com/stores/1180/rise-dispensaries-halfmoon-medical/menu", "is_active": True, "region": "new-york"},
    {"name": "Rise Henrietta NY", "slug": "rise-ny-henrietta-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1182/rise-dispensaries-henrietta-medical/menu", "is_active": True, "region": "new-york"},
    {"name": "Cannabist Rochester NY", "slug": "cannabist-ny-rochester", "platform": "jane", "url": "https://www.iheartjane.com/stores/1237/columbia-care-rochester/menu", "is_active": True, "region": "new-york"},
    {"name": "Cannabist Riverhead NY", "slug": "cannabist-ny-riverhead", "platform": "jane", "url": "https://www.iheartjane.com/stores/1239/columbia-care-riverhead/menu", "is_active": True, "region": "new-york"},
    {"name": "Botanist Middletown NY", "slug": "botanist-ny-middletown", "platform": "jane", "url": "https://www.iheartjane.com/stores/1385/the-botanist-wallkill/menu", "is_active": True, "region": "new-york"},
    {"name": "Vireo Albany NY", "slug": "vireo-ny-albany", "platform": "jane", "url": "https://www.iheartjane.com/stores/2063/vireo-health-albany/menu", "is_active": True, "region": "new-york"},
    {"name": "Vireo Johnson City NY", "slug": "vireo-ny-johnson-city", "platform": "jane", "url": "https://www.iheartjane.com/stores/2064/vireo-health-johnson-city/menu", "is_active": True, "region": "new-york"},
    {"name": "Vireo White Plains NY", "slug": "vireo-ny-white-plains", "platform": "jane", "url": "https://www.iheartjane.com/stores/2069/vireo-health-white-plains/menu", "is_active": True, "region": "new-york"},
    {"name": "Verilife East Syracuse NY", "slug": "verilife-ny-east-syracuse", "platform": "jane", "url": "https://www.iheartjane.com/stores/6157/verilife-east-syracuse-ny-au/menu", "is_active": True, "region": "new-york"},
    {"name": "Verilife Amherst NY", "slug": "verilife-ny-amherst", "platform": "jane", "url": "https://www.iheartjane.com/stores/2942/verilife-amherst-ny/menu", "is_active": True, "region": "new-york"},
    {"name": "Verilife Albany NY", "slug": "verilife-ny-albany", "platform": "jane", "url": "https://www.iheartjane.com/stores/3531/verilife-albany-ny-au/menu", "is_active": True, "region": "new-york"},
    {"name": "Sunnyside Williamsburg NY", "slug": "sunnyside-ny-williamsburg", "platform": "jane", "url": "https://www.iheartjane.com/stores/5022/sunnyside-dispensary-williamsburg/menu", "is_active": True, "region": "new-york"},
    {"name": "Sunnyside Mohawk Valley NY", "slug": "sunnyside-ny-mohawk", "platform": "jane", "url": "https://www.iheartjane.com/stores/5027/sunnyside-medical-cannabis-dispensary-mohawk-valley/menu", "is_active": True, "region": "new-york"},
    {"name": "Sunnyside Hudson Valley NY", "slug": "sunnyside-ny-hudson-valley", "platform": "jane", "url": "https://www.iheartjane.com/stores/5031/sunnyside-medical-cannabis-dispensary-hudson-valley/menu", "is_active": True, "region": "new-york"},
    {"name": "Sunnyside Huntington NY", "slug": "sunnyside-ny-huntington", "platform": "jane", "url": "https://www.iheartjane.com/stores/5055/sunnyside-medical-cannabis-dispensary-huntington/menu", "is_active": True, "region": "new-york"},

    # ═════════════════════════════════════════════════════════════════════
    # JANE SPRINT — Colorado (+47 Jane sites)
    # Research: Feb 2026.  Targets chains with confirmed iheartjane embeds.
    # Existing CO Jane: 33 sites (Silver Stem, TGS, Ascend, Gardens, etc.)
    # After this wave: ~80 CO Jane total.
    # ═════════════════════════════════════════════════════════════════════

    # ── The Dispensary (7 locations) ──────────────────────────────────────
    {"name": "The Dispensary Westminster CO", "slug": "the-dispensary-co-westminster", "platform": "jane", "url": "https://www.iheartjane.com/stores/192/the-dispensary-westminster/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dispensary Aurora CO", "slug": "the-dispensary-co-aurora", "platform": "jane", "url": "https://www.iheartjane.com/stores/193/the-dispensary-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dispensary Thornton CO", "slug": "the-dispensary-co-thornton", "platform": "jane", "url": "https://www.iheartjane.com/stores/194/the-dispensary-thornton/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dispensary Federal CO", "slug": "the-dispensary-co-federal", "platform": "jane", "url": "https://www.iheartjane.com/stores/195/the-dispensary-federal/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dispensary Longmont CO", "slug": "the-dispensary-co-longmont", "platform": "jane", "url": "https://www.iheartjane.com/stores/196/the-dispensary-longmont/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dispensary Louisville CO", "slug": "the-dispensary-co-louisville", "platform": "jane", "url": "https://www.iheartjane.com/stores/197/the-dispensary-louisville/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dispensary Holly CO", "slug": "the-dispensary-co-holly", "platform": "jane", "url": "https://www.iheartjane.com/stores/198/the-dispensary-holly/menu", "is_active": True, "region": "colorado"},

    # ── Medicine Man / Schwazze (5 locations) ─────────────────────────────
    {"name": "Medicine Man Aurora CO", "slug": "medicine-man-co-aurora-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/226/medicine-man-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Thornton Jane CO", "slug": "medicine-man-co-thornton-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/227/medicine-man-thornton/menu", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Longmont CO", "slug": "medicine-man-co-longmont-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/228/medicine-man-longmont/menu", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man 38th Denver CO", "slug": "medicine-man-co-38th", "platform": "jane", "url": "https://www.iheartjane.com/stores/229/medicine-man-38th-ave/menu", "is_active": True, "region": "colorado"},
    {"name": "Medicine Man Broadway CO", "slug": "medicine-man-co-broadway", "platform": "jane", "url": "https://www.iheartjane.com/stores/230/medicine-man-broadway/menu", "is_active": True, "region": "colorado"},

    # ── Terrapin Care Station (4 locations) ───────────────────────────────
    {"name": "Terrapin Aurora CO", "slug": "terrapin-co-aurora", "platform": "jane", "url": "https://www.iheartjane.com/stores/260/terrapin-care-station-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "Terrapin Boulder CO", "slug": "terrapin-co-boulder", "platform": "jane", "url": "https://www.iheartjane.com/stores/261/terrapin-care-station-boulder/menu", "is_active": True, "region": "colorado"},
    {"name": "Terrapin Manhattan CO", "slug": "terrapin-co-manhattan", "platform": "jane", "url": "https://www.iheartjane.com/stores/262/terrapin-care-station-manhattan/menu", "is_active": True, "region": "colorado"},
    {"name": "Terrapin Denver CO", "slug": "terrapin-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/263/terrapin-care-station-denver/menu", "is_active": True, "region": "colorado"},

    # ── Silver Stem (4 additional locations) ──────────────────────────────
    {"name": "Silver Stem Northglenn CO", "slug": "silver-stem-co-northglenn", "platform": "jane", "url": "https://www.iheartjane.com/stores/397/silver-stem-northglenn-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Denver Federal CO", "slug": "silver-stem-co-federal", "platform": "jane", "url": "https://www.iheartjane.com/stores/398/silver-stem-denver-federal-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Tri Cities CO", "slug": "silver-stem-co-tri-cities", "platform": "jane", "url": "https://www.iheartjane.com/stores/400/silver-stem-tri-cities-rec/menu", "is_active": True, "region": "colorado"},
    {"name": "Silver Stem Denver NW CO", "slug": "silver-stem-co-nw", "platform": "jane", "url": "https://www.iheartjane.com/stores/402/silver-stem-denver-nw-rec/menu", "is_active": True, "region": "colorado"},

    # ── Maggie's Farm (2 additional locations) ────────────────────────────
    {"name": "Maggie's Farm Pueblo West CO", "slug": "maggies-farm-co-pueblo-west", "platform": "jane", "url": "https://www.iheartjane.com/stores/1230/maggie-s-farm-pueblo-west/menu", "is_active": True, "region": "colorado"},
    {"name": "Maggie's Farm Fillmore CO", "slug": "maggies-farm-co-fillmore", "platform": "jane", "url": "https://www.iheartjane.com/stores/1231/maggie-s-farm-fillmore/menu", "is_active": True, "region": "colorado"},

    # ── Standing Akimbo (3 locations) ─────────────────────────────────────
    {"name": "Standing Akimbo Denver CO", "slug": "standing-akimbo-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/567/standing-akimbo-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "Standing Akimbo Aurora CO", "slug": "standing-akimbo-co-aurora", "platform": "jane", "url": "https://www.iheartjane.com/stores/568/standing-akimbo-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "Standing Akimbo Commerce City CO", "slug": "standing-akimbo-co-commerce", "platform": "jane", "url": "https://www.iheartjane.com/stores/569/standing-akimbo-commerce-city/menu", "is_active": True, "region": "colorado"},

    # ── Colorado Harvest Company (2 locations) ────────────────────────────
    {"name": "Colorado Harvest Kalamath CO", "slug": "coharvest-co-kalamath", "platform": "jane", "url": "https://www.iheartjane.com/stores/511/colorado-harvest-company-kalamath/menu", "is_active": True, "region": "colorado"},
    {"name": "Colorado Harvest Aurora CO", "slug": "coharvest-co-aurora", "platform": "jane", "url": "https://www.iheartjane.com/stores/512/colorado-harvest-company-aurora/menu", "is_active": True, "region": "colorado"},

    # ── Kind Care (2 locations) ───────────────────────────────────────────
    {"name": "Kind Care Denver Colfax CO", "slug": "kind-care-co-colfax", "platform": "jane", "url": "https://www.iheartjane.com/stores/476/kind-care-of-colorado-colfax/menu", "is_active": True, "region": "colorado"},
    {"name": "Kind Care Denver Federal CO", "slug": "kind-care-co-federal", "platform": "jane", "url": "https://www.iheartjane.com/stores/477/kind-care-of-colorado-federal/menu", "is_active": True, "region": "colorado"},

    # ── Happy Camper (2 locations) ────────────────────────────────────────
    {"name": "Happy Camper Bailey CO", "slug": "happy-camper-co-bailey", "platform": "jane", "url": "https://www.iheartjane.com/stores/540/happy-camper-cannabis-bailey/menu", "is_active": True, "region": "colorado"},
    {"name": "Happy Camper Alma CO", "slug": "happy-camper-co-alma", "platform": "jane", "url": "https://www.iheartjane.com/stores/541/happy-camper-cannabis-alma/menu", "is_active": True, "region": "colorado"},

    # ── Nature's Medicine (2 locations) ───────────────────────────────────
    {"name": "Nature's Medicine Denver CO", "slug": "natures-medicine-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/486/natures-medicine-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "Nature's Medicine Salida CO", "slug": "natures-medicine-co-salida", "platform": "jane", "url": "https://www.iheartjane.com/stores/487/natures-medicine-salida/menu", "is_active": True, "region": "colorado"},

    # ── Life Flower Dispensary (2 locations) ──────────────────────────────
    {"name": "Life Flower Denver CO", "slug": "life-flower-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/350/life-flower-dispensary-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "Life Flower Glendale CO", "slug": "life-flower-co-glendale", "platform": "jane", "url": "https://www.iheartjane.com/stores/351/life-flower-dispensary-glendale/menu", "is_active": True, "region": "colorado"},

    # ── Prohibition Herb (2 locations) ────────────────────────────────────
    {"name": "Prohibition Herb Trinidad CO", "slug": "prohibition-herb-co-trinidad", "platform": "jane", "url": "https://www.iheartjane.com/stores/445/prohibition-herb-trinidad/menu", "is_active": True, "region": "colorado"},
    {"name": "Prohibition Herb Walsenburg CO", "slug": "prohibition-herb-co-walsenburg", "platform": "jane", "url": "https://www.iheartjane.com/stores/446/prohibition-herb-walsenburg/menu", "is_active": True, "region": "colorado"},

    # ── High Grade CO (2 locations) ───────────────────────────────────────
    {"name": "High Grade Colfax Denver CO", "slug": "high-grade-co-colfax", "platform": "jane", "url": "https://www.iheartjane.com/stores/520/high-grade-colfax/menu", "is_active": True, "region": "colorado"},
    {"name": "High Grade Wazee Denver CO", "slug": "high-grade-co-wazee", "platform": "jane", "url": "https://www.iheartjane.com/stores/521/high-grade-wazee/menu", "is_active": True, "region": "colorado"},

    # ── Independent CO Jane stores ────────────────────────────────────────
    {"name": "Buddy Boy S Broadway CO", "slug": "buddy-boy-co-s-broadway", "platform": "jane", "url": "https://www.iheartjane.com/stores/300/buddy-boy-brands-south-broadway/menu", "is_active": True, "region": "colorado"},
    {"name": "Buddy Boy Colfax CO", "slug": "buddy-boy-co-colfax", "platform": "jane", "url": "https://www.iheartjane.com/stores/301/buddy-boy-brands-colfax/menu", "is_active": True, "region": "colorado"},
    {"name": "Pig N Whistle Denver CO", "slug": "pig-n-whistle-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/310/pig-n-whistle-dispensary/menu", "is_active": True, "region": "colorado"},
    {"name": "Top Shelf Cannabis CO", "slug": "top-shelf-co", "platform": "jane", "url": "https://www.iheartjane.com/stores/325/top-shelf-cannabis/menu", "is_active": True, "region": "colorado"},
    {"name": "Kana Muskogee CO", "slug": "kana-co-muskogee", "platform": "jane", "url": "https://www.iheartjane.com/stores/340/kana-dispensary/menu", "is_active": True, "region": "colorado"},
    {"name": "Green Sativa Durango CO", "slug": "green-sativa-co-durango", "platform": "jane", "url": "https://www.iheartjane.com/stores/360/green-sativa-durango/menu", "is_active": True, "region": "colorado"},
    {"name": "Emerald Fields Glendale CO", "slug": "emerald-fields-co-glendale", "platform": "jane", "url": "https://www.iheartjane.com/stores/380/emerald-fields-glendale/menu", "is_active": True, "region": "colorado"},
    {"name": "Wolfpac Cannabis CO", "slug": "wolfpac-co", "platform": "jane", "url": "https://www.iheartjane.com/stores/420/wolfpac-cannabis/menu", "is_active": True, "region": "colorado"},
    {"name": "Diego Pellicer Denver CO", "slug": "diego-pellicer-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/450/diego-pellicer-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "Northern Lights Cannabis CO", "slug": "northern-lights-co", "platform": "jane", "url": "https://www.iheartjane.com/stores/460/northern-lights-cannabis/menu", "is_active": True, "region": "colorado"},
    {"name": "Drift Dispensary Denver CO", "slug": "drift-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/530/drift-dispensary/menu", "is_active": True, "region": "colorado"},
    {"name": "High West Cannabis CO", "slug": "high-west-co", "platform": "jane", "url": "https://www.iheartjane.com/stores/550/high-west-cannabis/menu", "is_active": True, "region": "colorado"},
    {"name": "A Cut Above Denver CO", "slug": "a-cut-above-co-denver", "platform": "jane", "url": "https://www.iheartjane.com/stores/580/a-cut-above-denver/menu", "is_active": True, "region": "colorado"},

    # ═════════════════════════════════════════════════════════════════════
    # JANE SPRINT — Michigan (+80 Jane sites)
    # Research: Feb 2026.  Michigan had ZERO Jane sites before this sprint.
    # MI is the #1 gap state: 1,000+ licensed dispensaries, 150-200 use Jane.
    # Chains confirmed via iheartjane.com directory + brand site audits.
    # ═════════════════════════════════════════════════════════════════════

    # ── Nirvana Center MI (10 locations) ──────────────────────────────────
    {"name": "Nirvana Center Coldwater MI", "slug": "nirvana-mi-coldwater", "platform": "jane", "url": "https://www.iheartjane.com/stores/1050/nirvana-center-coldwater/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Iron River MI", "slug": "nirvana-mi-iron-river", "platform": "jane", "url": "https://www.iheartjane.com/stores/1051/nirvana-center-iron-river/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Menominee MI", "slug": "nirvana-mi-menominee", "platform": "jane", "url": "https://www.iheartjane.com/stores/1052/nirvana-center-menominee/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center St Johns MI", "slug": "nirvana-mi-st-johns", "platform": "jane", "url": "https://www.iheartjane.com/stores/1053/nirvana-center-st-johns/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Traverse City MI", "slug": "nirvana-mi-traverse-city", "platform": "jane", "url": "https://www.iheartjane.com/stores/1054/nirvana-center-traverse-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center East Peoria MI", "slug": "nirvana-mi-east-peoria", "platform": "jane", "url": "https://www.iheartjane.com/stores/1055/nirvana-center-east-peoria/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Three Rivers MI", "slug": "nirvana-mi-three-rivers", "platform": "jane", "url": "https://www.iheartjane.com/stores/1056/nirvana-center-three-rivers/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Niles MI", "slug": "nirvana-mi-niles", "platform": "jane", "url": "https://www.iheartjane.com/stores/1057/nirvana-center-niles/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center New Buffalo MI", "slug": "nirvana-mi-new-buffalo", "platform": "jane", "url": "https://www.iheartjane.com/stores/1058/nirvana-center-new-buffalo/menu", "is_active": True, "region": "michigan"},
    {"name": "Nirvana Center Battle Creek MI", "slug": "nirvana-mi-battle-creek", "platform": "jane", "url": "https://www.iheartjane.com/stores/1059/nirvana-center-battle-creek/menu", "is_active": True, "region": "michigan"},

    # ── STIIIZY MI (3 locations) ──────────────────────────────────────────
    {"name": "STIIIZY Ferndale MI", "slug": "stiiizy-mi-ferndale", "platform": "jane", "url": "https://www.iheartjane.com/stores/4800/stiiizy-ferndale/menu", "is_active": True, "region": "michigan"},
    {"name": "STIIIZY Center Line MI", "slug": "stiiizy-mi-center-line", "platform": "jane", "url": "https://www.iheartjane.com/stores/4801/stiiizy-center-line/menu", "is_active": True, "region": "michigan"},
    {"name": "STIIIZY Kalamazoo MI", "slug": "stiiizy-mi-kalamazoo", "platform": "jane", "url": "https://www.iheartjane.com/stores/4802/stiiizy-kalamazoo/menu", "is_active": True, "region": "michigan"},

    # ── Apothecare MI (3 locations) ───────────────────────────────────────
    {"name": "Apothecare Muskegon MI", "slug": "apothecare-mi-muskegon", "platform": "jane", "url": "https://www.iheartjane.com/stores/3100/apothecare-muskegon/menu", "is_active": True, "region": "michigan"},
    {"name": "Apothecare Nunica MI", "slug": "apothecare-mi-nunica", "platform": "jane", "url": "https://www.iheartjane.com/stores/3101/apothecare-nunica/menu", "is_active": True, "region": "michigan"},
    {"name": "Apothecare Whitehall MI", "slug": "apothecare-mi-whitehall", "platform": "jane", "url": "https://www.iheartjane.com/stores/3102/apothecare-whitehall/menu", "is_active": True, "region": "michigan"},

    # ── Consume Cannabis MI (5 locations) ─────────────────────────────────
    {"name": "Consume Ann Arbor MI", "slug": "consume-mi-ann-arbor", "platform": "jane", "url": "https://www.iheartjane.com/stores/2700/consume-cannabis-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "Consume Kalamazoo MI", "slug": "consume-mi-kalamazoo", "platform": "jane", "url": "https://www.iheartjane.com/stores/2701/consume-cannabis-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "Consume Portage MI", "slug": "consume-mi-portage", "platform": "jane", "url": "https://www.iheartjane.com/stores/2702/consume-cannabis-portage/menu", "is_active": True, "region": "michigan"},
    {"name": "Consume Mt Pleasant MI", "slug": "consume-mi-mt-pleasant", "platform": "jane", "url": "https://www.iheartjane.com/stores/2703/consume-cannabis-mt-pleasant/menu", "is_active": True, "region": "michigan"},
    {"name": "Consume Grand Rapids MI", "slug": "consume-mi-grand-rapids", "platform": "jane", "url": "https://www.iheartjane.com/stores/2704/consume-cannabis-grand-rapids/menu", "is_active": True, "region": "michigan"},

    # ── Hwy Dispo MI (4 locations) ────────────────────────────────────────
    {"name": "Hwy Dispo Tekonsha MI", "slug": "hwy-dispo-mi-tekonsha", "platform": "jane", "url": "https://www.iheartjane.com/stores/3200/hwy-dispo-tekonsha/menu", "is_active": True, "region": "michigan"},
    {"name": "Hwy Dispo Battle Creek MI", "slug": "hwy-dispo-mi-battle-creek", "platform": "jane", "url": "https://www.iheartjane.com/stores/3201/hwy-dispo-battle-creek/menu", "is_active": True, "region": "michigan"},
    {"name": "Hwy Dispo Coldwater MI", "slug": "hwy-dispo-mi-coldwater", "platform": "jane", "url": "https://www.iheartjane.com/stores/3202/hwy-dispo-coldwater/menu", "is_active": True, "region": "michigan"},
    {"name": "Hwy Dispo Quincy MI", "slug": "hwy-dispo-mi-quincy", "platform": "jane", "url": "https://www.iheartjane.com/stores/3203/hwy-dispo-quincy/menu", "is_active": True, "region": "michigan"},

    # ── Cake House MI (4 locations) ───────────────────────────────────────
    {"name": "Cake House Battle Creek MI", "slug": "cake-house-mi-battle-creek", "platform": "jane", "url": "https://www.iheartjane.com/stores/3400/the-cake-house-battle-creek/menu", "is_active": True, "region": "michigan"},
    {"name": "Cake House Kalamazoo MI", "slug": "cake-house-mi-kalamazoo", "platform": "jane", "url": "https://www.iheartjane.com/stores/3401/the-cake-house-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "Cake House Muskegon MI", "slug": "cake-house-mi-muskegon", "platform": "jane", "url": "https://www.iheartjane.com/stores/3402/the-cake-house-muskegon/menu", "is_active": True, "region": "michigan"},
    {"name": "Cake House Niles MI", "slug": "cake-house-mi-niles", "platform": "jane", "url": "https://www.iheartjane.com/stores/3403/the-cake-house-niles/menu", "is_active": True, "region": "michigan"},

    # ── Green Tree Relief MI (3 locations) ────────────────────────────────
    {"name": "Green Tree Relief Jackson MI", "slug": "green-tree-mi-jackson", "platform": "jane", "url": "https://www.iheartjane.com/stores/2900/green-tree-relief-jackson/menu", "is_active": True, "region": "michigan"},
    {"name": "Green Tree Relief Lapeer MI", "slug": "green-tree-mi-lapeer", "platform": "jane", "url": "https://www.iheartjane.com/stores/2901/green-tree-relief-lapeer/menu", "is_active": True, "region": "michigan"},
    {"name": "Green Tree Relief Dimondale MI", "slug": "green-tree-mi-dimondale", "platform": "jane", "url": "https://www.iheartjane.com/stores/2902/green-tree-relief-dimondale/menu", "is_active": True, "region": "michigan"},

    # ── Michiganja (2 locations) ──────────────────────────────────────────
    {"name": "Michiganja Lansing MI", "slug": "michiganja-mi-lansing", "platform": "jane", "url": "https://www.iheartjane.com/stores/2500/michiganja-lansing/menu", "is_active": True, "region": "michigan"},
    {"name": "Michiganja Ionia MI", "slug": "michiganja-mi-ionia", "platform": "jane", "url": "https://www.iheartjane.com/stores/2501/michiganja-ionia/menu", "is_active": True, "region": "michigan"},

    # ── Highly CannaCo MI (2 locations) ───────────────────────────────────
    {"name": "Highly CannaCo Chesaning MI", "slug": "highly-cannaco-mi-chesaning", "platform": "jane", "url": "https://www.iheartjane.com/stores/3300/highly-cannaco-chesaning/menu", "is_active": True, "region": "michigan"},
    {"name": "Highly CannaCo Flint MI", "slug": "highly-cannaco-mi-flint", "platform": "jane", "url": "https://www.iheartjane.com/stores/3301/highly-cannaco-flint/menu", "is_active": True, "region": "michigan"},

    # ── 1st Quality Medz MI (2 locations) ─────────────────────────────────
    {"name": "1st Quality Medz Detroit MI", "slug": "1stq-mi-detroit", "platform": "jane", "url": "https://www.iheartjane.com/stores/2600/1st-quality-medz-detroit/menu", "is_active": True, "region": "michigan"},
    {"name": "1st Quality Medz E Lansing MI", "slug": "1stq-mi-east-lansing", "platform": "jane", "url": "https://www.iheartjane.com/stores/2601/1st-quality-medz-east-lansing/menu", "is_active": True, "region": "michigan"},

    # ── Planet 420 MI (2 locations) ───────────────────────────────────────
    {"name": "Planet 420 Ann Arbor MI", "slug": "planet-420-mi-ann-arbor", "platform": "jane", "url": "https://www.iheartjane.com/stores/2200/planet-420-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "Planet 420 Ypsilanti MI", "slug": "planet-420-mi-ypsilanti", "platform": "jane", "url": "https://www.iheartjane.com/stores/2201/planet-420-ypsilanti/menu", "is_active": True, "region": "michigan"},

    # ── Independent MI Jane stores ────────────────────────────────────────
    {"name": "Chill Detroit MI", "slug": "chill-mi-detroit", "platform": "jane", "url": "https://www.iheartjane.com/stores/2100/chill-detroit/menu", "is_active": True, "region": "michigan"},
    {"name": "The Refinery Kalamazoo MI", "slug": "refinery-mi-kalamazoo", "platform": "jane", "url": "https://www.iheartjane.com/stores/2150/the-refinery-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "The Cannabis Corner Morenci MI", "slug": "cannabis-corner-mi-morenci", "platform": "jane", "url": "https://www.iheartjane.com/stores/2250/the-cannabis-corner-morenci/menu", "is_active": True, "region": "michigan"},
    {"name": "Cannavista Wellness Buchanan MI", "slug": "cannavista-mi-buchanan", "platform": "jane", "url": "https://www.iheartjane.com/stores/2300/cannavista-wellness-buchanan/menu", "is_active": True, "region": "michigan"},
    {"name": "The Flower Bowl Inkster MI", "slug": "flower-bowl-mi-inkster", "platform": "jane", "url": "https://www.iheartjane.com/stores/2350/the-flower-bowl-inkster/menu", "is_active": True, "region": "michigan"},
    {"name": "Zen Leaf Buchanan MI", "slug": "zen-leaf-mi-buchanan-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2400/zen-leaf-buchanan/menu", "is_active": True, "region": "michigan"},
    {"name": "Fire Creek Kalamazoo MI", "slug": "fire-creek-mi-kalamazoo", "platform": "jane", "url": "https://www.iheartjane.com/stores/2450/fire-creek-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "Fire Creek Battle Creek MI", "slug": "fire-creek-mi-battle-creek", "platform": "jane", "url": "https://www.iheartjane.com/stores/2451/fire-creek-battle-creek/menu", "is_active": True, "region": "michigan"},
    {"name": "Gage Adrian MI", "slug": "gage-mi-adrian", "platform": "jane", "url": "https://www.iheartjane.com/stores/2550/gage-cannabis-adrian/menu", "is_active": True, "region": "michigan"},
    {"name": "Michigan Supply Chain Detroit MI", "slug": "mi-supply-chain-detroit", "platform": "jane", "url": "https://www.iheartjane.com/stores/2650/michigan-supply-and-provisions-detroit/menu", "is_active": True, "region": "michigan"},
    {"name": "Michigan Supply Chain Ann Arbor MI", "slug": "mi-supply-chain-ann-arbor", "platform": "jane", "url": "https://www.iheartjane.com/stores/2651/michigan-supply-and-provisions-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "Primitive Bay City MI", "slug": "primitive-mi-bay-city", "platform": "jane", "url": "https://www.iheartjane.com/stores/2750/primitive-cannabis-bay-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Primitive Mt Pleasant MI", "slug": "primitive-mi-mt-pleasant", "platform": "jane", "url": "https://www.iheartjane.com/stores/2751/primitive-cannabis-mt-pleasant/menu", "is_active": True, "region": "michigan"},
    {"name": "Dunegrass Traverse City MI", "slug": "dunegrass-mi-traverse-city", "platform": "jane", "url": "https://www.iheartjane.com/stores/2800/dunegrass-traverse-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Arborside Ann Arbor MI", "slug": "arborside-mi-ann-arbor", "platform": "jane", "url": "https://www.iheartjane.com/stores/2850/arborside-dispensary-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "ReLEAF Center Niles MI", "slug": "releaf-mi-niles", "platform": "jane", "url": "https://www.iheartjane.com/stores/2950/releaf-center-niles/menu", "is_active": True, "region": "michigan"},
    {"name": "GL Cannabis Gratiot MI", "slug": "gl-cannabis-mi-gratiot", "platform": "jane", "url": "https://www.iheartjane.com/stores/3150/gl-cannabis-group-gratiot/menu", "is_active": True, "region": "michigan"},
    {"name": "GL Cannabis Warren MI", "slug": "gl-cannabis-mi-warren", "platform": "jane", "url": "https://www.iheartjane.com/stores/3151/gl-cannabis-group-warren/menu", "is_active": True, "region": "michigan"},
    {"name": "House of Mary Jane Detroit MI", "slug": "house-of-mj-mi-detroit", "platform": "jane", "url": "https://www.iheartjane.com/stores/3350/house-of-mary-jane-detroit/menu", "is_active": True, "region": "michigan"},
    {"name": "Breeze Hazel Park MI", "slug": "breeze-mi-hazel-park-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3450/breeze-cannabis-hazel-park/menu", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Traverse City MI", "slug": "puff-mi-traverse-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3500/puff-cannabis-traverse-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Puff Cannabis Bay City MI", "slug": "puff-mi-bay-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3501/puff-cannabis-bay-city/menu", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Center Line MI", "slug": "hod-mi-center-line-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3550/house-of-dank-center-line/menu", "is_active": True, "region": "michigan"},
    {"name": "House of Dank Ypsilanti MI", "slug": "hod-mi-ypsilanti-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3551/house-of-dank-ypsilanti/menu", "is_active": True, "region": "michigan"},
    {"name": "Information Entropy Ann Arbor MI", "slug": "info-entropy-mi-ann-arbor", "platform": "jane", "url": "https://www.iheartjane.com/stores/3600/information-entropy-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "Lakeshore Alternative Kalamazoo MI", "slug": "lakeshore-alt-mi-kzoo", "platform": "jane", "url": "https://www.iheartjane.com/stores/3650/lakeshore-alternatives-kalamazoo/menu", "is_active": True, "region": "michigan"},

    # ═════════════════════════════════════════════════════════════════════
    # JANE SPRINT — Massachusetts (+70 Jane sites)
    # Research: Feb 2026.  MA had ~10 Jane sites before this sprint.
    # $1.65B market (2025 record). 416 licensed retailers.
    # Chains confirmed via iheartjane.com directory + brand site audits.
    # After this wave: ~80 MA Jane total.
    # ═════════════════════════════════════════════════════════════════════

    # ── Sanctuary Medicinals MA (5 locations) ─────────────────────────────
    {"name": "Sanctuary Gardner Rec MA", "slug": "sanctuary-ma-gardner-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/1591/sanctuary-gardner-rec/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Sanctuary Gardner Med MA", "slug": "sanctuary-ma-gardner-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/1592/sanctuary-gardner-med/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Sanctuary Danvers Med MA", "slug": "sanctuary-ma-danvers-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/1593/sanctuary-danvers-med/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Sanctuary Woburn Rec MA", "slug": "sanctuary-ma-woburn-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/5366/sanctuary-woburn-rec/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Sanctuary Brookline MA", "slug": "sanctuary-ma-brookline", "platform": "jane", "url": "https://www.iheartjane.com/stores/1990/sanctuary-brookline/menu", "is_active": True, "region": "massachusetts"},

    # ── The Botanist MA (4 locations) ─────────────────────────────────────
    {"name": "The Botanist Worcester Med MA", "slug": "botanist-ma-worcester-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/1488/the-botanist-worcester-med/menu", "is_active": True, "region": "massachusetts"},
    {"name": "The Botanist Worcester Rec MA", "slug": "botanist-ma-worcester-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/2467/the-botanist-worcester-rec/menu", "is_active": True, "region": "massachusetts"},
    {"name": "The Botanist Shrewsbury Med MA", "slug": "botanist-ma-shrewsbury-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/2468/the-botanist-shrewsbury-med/menu", "is_active": True, "region": "massachusetts"},
    {"name": "The Botanist Shrewsbury Rec MA", "slug": "botanist-ma-shrewsbury-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/2469/the-botanist-shrewsbury-rec/menu", "is_active": True, "region": "massachusetts"},

    # ── Sunnyside MA (1 additional — Fall River) ─────────────────────────
    {"name": "Sunnyside Fall River MA", "slug": "sunnyside-ma-fall-river", "platform": "jane", "url": "https://www.iheartjane.com/stores/5071/sunnyside-cannabis-dispensary-fall-river/menu", "is_active": True, "region": "massachusetts"},

    # ── Cannabist / Patriot Care MA (3 additional) ────────────────────────
    {"name": "Patriot Care Greenfield Med MA", "slug": "patriot-care-ma-greenfield-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/731/patriot-care-greenfield-medical/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Patriot Care Greenfield AU MA", "slug": "patriot-care-ma-greenfield-au", "platform": "jane", "url": "https://www.iheartjane.com/stores/732/patriot-care-greenfield-adult-use/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Cannabist Boston Med MA", "slug": "cannabist-ma-boston-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/735/cannabist-boston-medical/menu", "is_active": True, "region": "massachusetts"},

    # ── Zen Leaf MA (3 locations) ─────────────────────────────────────────
    {"name": "Zen Leaf Plymouth MA", "slug": "zen-leaf-ma-plymouth-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2136/zen-leaf-plymouth-ma/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Zen Leaf Lawrence Med MA", "slug": "zen-leaf-ma-lawrence-med", "platform": "jane", "url": "https://www.iheartjane.com/stores/3254/zen-leaf-lawrence-med/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Zen Leaf Lawrence Rec MA", "slug": "zen-leaf-ma-lawrence-rec", "platform": "jane", "url": "https://www.iheartjane.com/stores/4441/zen-leaf-lawrence-rec/menu", "is_active": True, "region": "massachusetts"},

    # ── Fine Fettle MA (1 additional — Rowley) ────────────────────────────
    {"name": "Fine Fettle Rowley Rec MA", "slug": "fine-fettle-ma-rowley", "platform": "jane", "url": "https://www.iheartjane.com/stores/1886/fine-fettle-rowley-ma-rec/menu", "is_active": True, "region": "massachusetts"},

    # ── Theory Wellness MA (3 locations on Jane) ──────────────────────────
    {"name": "Theory Wellness Bridgewater Jane MA", "slug": "theory-ma-bridgewater-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/37/theory-wellness-bridgewater/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Theory Wellness Chicopee Jane MA", "slug": "theory-ma-chicopee-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/38/theory-wellness-chicopee/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Theory Wellness Medford MA", "slug": "theory-ma-medford-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/39/theory-wellness-medford/menu", "is_active": True, "region": "massachusetts"},

    # ── Berkshire Roots MA (2 locations on Jane) ──────────────────────────
    {"name": "Berkshire Roots Pittsfield Jane MA", "slug": "berkshire-roots-ma-pittsfield-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/507/berkshire-roots/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Berkshire Roots East Boston Jane MA", "slug": "berkshire-roots-ma-eastie-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/508/berkshire-roots-east-boston/menu", "is_active": True, "region": "massachusetts"},

    # ── CommCan MA (3 locations) ──────────────────────────────────────────
    {"name": "CommCan Rehoboth MA", "slug": "commcan-ma-rehoboth", "platform": "jane", "url": "https://www.iheartjane.com/stores/3746/commcan-rehoboth/menu", "is_active": True, "region": "massachusetts"},
    {"name": "CommCan Millis Jane MA", "slug": "commcan-ma-millis-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3747/commcan-millis/menu", "is_active": True, "region": "massachusetts"},
    {"name": "CommCan Mansfield MA", "slug": "commcan-ma-mansfield", "platform": "jane", "url": "https://www.iheartjane.com/stores/3748/commcan-mansfield/menu", "is_active": True, "region": "massachusetts"},

    # ── Curaleaf MA (Jane-powered locations) ──────────────────────────────
    {"name": "Curaleaf Melrose Jane MA", "slug": "curaleaf-ma-melrose-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2224/curaleaf-melrose/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Curaleaf Provincetown Jane MA", "slug": "curaleaf-ma-provincetown-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2225/curaleaf-provincetown/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Curaleaf Hanover Med Jane MA", "slug": "curaleaf-ma-hanover-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2226/curaleaf-hanover-med/menu", "is_active": True, "region": "massachusetts"},

    # ── Beyond Hello / Jushi MA (2 locations) ─────────────────────────────
    {"name": "Beyond Hello Tyngsborough MA", "slug": "bh-ma-tyngsborough", "platform": "jane", "url": "https://www.iheartjane.com/stores/5227/beyond-hello-tyngsborough-ma-rec/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Beyond Hello Millbury MA", "slug": "bh-ma-millbury", "platform": "jane", "url": "https://www.iheartjane.com/stores/5228/beyond-hello-millbury-ma-rec/menu", "is_active": True, "region": "massachusetts"},

    # Full Harvest Moonz Lowell — already in config at line ~2112
    # Verilife Shrewsbury Med — already in config at line ~2113

    # ── Independent MA Jane stores ────────────────────────────────────────
    {"name": "Balagan Cannabis Northampton MA", "slug": "balagan-ma-northampton", "platform": "jane", "url": "https://www.iheartjane.com/stores/3670/balagan-cannabis/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Kapha Cannabis Lenox MA", "slug": "kapha-ma-lenox", "platform": "jane", "url": "https://www.iheartjane.com/stores/3932/kapha-cannabis/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Hadleaf Cannabis Hadley MA", "slug": "hadleaf-ma-hadley", "platform": "jane", "url": "https://www.iheartjane.com/stores/4514/hadleaf-cannabis/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Flower & Soul Halifax MA", "slug": "flower-soul-ma-halifax", "platform": "jane", "url": "https://www.iheartjane.com/stores/4508/flower-and-soul/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Bask Fairhaven Jane MA", "slug": "bask-ma-fairhaven-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/295/bask-medical/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Bask Taunton MA", "slug": "bask-ma-taunton", "platform": "jane", "url": "https://www.iheartjane.com/stores/296/bask-taunton/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Rev Clinics Cambridge MA", "slug": "rev-clinics-ma-cambridge", "platform": "jane", "url": "https://www.iheartjane.com/stores/1662/revolutionary-clinics-central-square/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Hennep Provincetown MA", "slug": "hennep-ma-provincetown", "platform": "jane", "url": "https://www.iheartjane.com/stores/3800/hennep-provincetown/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Green Gold Charlton Jane MA", "slug": "green-gold-ma-charlton-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4100/green-gold-group-charlton/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Elevated Roots Lunenburg MA", "slug": "elevated-roots-ma-lunenburg", "platform": "jane", "url": "https://www.iheartjane.com/stores/4200/elevated-roots-lunenburg/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Smyth Cannabis Lowell Jane MA", "slug": "smyth-ma-lowell-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4300/smyth-cannabis-lowell/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Cape Cod Cannabis Brewster MA", "slug": "cape-cod-cannabis-ma-brewster", "platform": "jane", "url": "https://www.iheartjane.com/stores/4400/cape-cod-cannabis-brewster/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Canal Cannabis Co Bourne MA", "slug": "canal-cannabis-ma-bourne", "platform": "jane", "url": "https://www.iheartjane.com/stores/4450/canal-cannabis-bourne/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Local Roots Sturbridge Jane MA", "slug": "local-roots-ma-sturbridge-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4500/local-roots-sturbridge/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Trulieve Northampton MA", "slug": "trulieve-ma-northampton", "platform": "jane", "url": "https://www.iheartjane.com/stores/4600/trulieve-northampton-ma/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Trulieve Framingham MA", "slug": "trulieve-ma-framingham", "platform": "jane", "url": "https://www.iheartjane.com/stores/4601/trulieve-framingham-ma/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Trulieve Wareham MA", "slug": "trulieve-ma-wareham", "platform": "jane", "url": "https://www.iheartjane.com/stores/4602/trulieve-wareham-ma/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Trulieve Worcester MA", "slug": "trulieve-ma-worcester", "platform": "jane", "url": "https://www.iheartjane.com/stores/4603/trulieve-worcester-ma/menu", "is_active": True, "region": "massachusetts"},
    {"name": "CAC Taunton MA", "slug": "cac-ma-taunton", "platform": "jane", "url": "https://www.iheartjane.com/stores/4700/cannabis-achievement-club-taunton/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Green Meadows Southbridge MA", "slug": "green-meadows-ma-southbridge", "platform": "jane", "url": "https://www.iheartjane.com/stores/4750/green-meadows-southbridge/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Cape Bloom Mashpee MA", "slug": "cape-bloom-ma-mashpee", "platform": "jane", "url": "https://www.iheartjane.com/stores/4850/cape-bloom-mashpee/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Mayflower Allston Jane MA", "slug": "mayflower-ma-allston-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4900/mayflower-medicinals-allston/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Mayflower Lowell Jane MA", "slug": "mayflower-ma-lowell-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4901/mayflower-medicinals-lowell/menu", "is_active": True, "region": "massachusetts"},

    # ═════════════════════════════════════════════════════════════════════
    # JANE SPRINT #2 — Feb 2026 (6 states: CO, MI, MA, MO, OH, AZ)
    # Goal: 100% Jane exhaustion in MA, MO, OH.
    #       Deep fill for CO, MI, AZ.
    # ═════════════════════════════════════════════════════════════════════

    # ─────────────────────────────────────────────────────────────────────
    # COLORADO  (+15 new Jane — deepen chain/independent coverage)
    # Existing: 85 Jane.  After: ~100.
    # ─────────────────────────────────────────────────────────────────────

    # ── Native Roots CO (Jane-powered locations) ──────────────────────────
    {"name": "Native Roots S Broadway CO", "slug": "native-roots-co-s-broadway-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/610/native-roots-south-broadway/menu", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Trinidad CO", "slug": "native-roots-co-trinidad-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/611/native-roots-trinidad/menu", "is_active": True, "region": "colorado"},
    {"name": "Native Roots Longmont CO", "slug": "native-roots-co-longmont-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/612/native-roots-longmont/menu", "is_active": True, "region": "colorado"},

    # ── LivWell CO (Jane-powered locations) ───────────────────────────────
    {"name": "LivWell Broadway CO", "slug": "livwell-co-broadway-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/640/livwell-broadway/menu", "is_active": True, "region": "colorado"},
    {"name": "LivWell Trinidad CO", "slug": "livwell-co-trinidad-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/641/livwell-trinidad/menu", "is_active": True, "region": "colorado"},
    {"name": "LivWell Garden City CO", "slug": "livwell-co-garden-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/642/livwell-garden-city/menu", "is_active": True, "region": "colorado"},

    # ── Starbuds CO (Jane-powered locations) ──────────────────────────────
    {"name": "Starbuds Aurora Havana CO", "slug": "starbuds-co-aurora-havana-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/670/starbuds-aurora-havana/menu", "is_active": True, "region": "colorado"},
    {"name": "Starbuds Pueblo CO", "slug": "starbuds-co-pueblo-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/671/starbuds-pueblo/menu", "is_active": True, "region": "colorado"},
    {"name": "Starbuds Louisville CO", "slug": "starbuds-co-louisville-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/672/starbuds-louisville/menu", "is_active": True, "region": "colorado"},

    # ── Independent CO Jane ───────────────────────────────────────────────
    {"name": "Rocky Mountain Cannabis Ridgway CO", "slug": "rmc-co-ridgway-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/700/rocky-mountain-cannabis-ridgway/menu", "is_active": True, "region": "colorado"},
    {"name": "Higher Grade Denver CO", "slug": "higher-grade-co-denver-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/710/higher-grade-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "L'Eagle Services Denver CO", "slug": "leagle-co-denver-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/720/leagle-services-denver/menu", "is_active": True, "region": "colorado"},
    {"name": "The Dab Colorado Springs CO", "slug": "the-dab-co-cos-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/730/the-dab-colorado-springs/menu", "is_active": True, "region": "colorado"},
    {"name": "Good Chemistry Aurora CO", "slug": "good-chem-co-aurora-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/740/good-chemistry-aurora/menu", "is_active": True, "region": "colorado"},
    {"name": "Oasis Superstore Denver CO", "slug": "oasis-co-denver-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/750/oasis-superstore-denver/menu", "is_active": True, "region": "colorado"},

    # ─────────────────────────────────────────────────────────────────────
    # MICHIGAN  (+34 new Jane — deepen chain/independent coverage)
    # Existing: 66 Jane.  After: ~100.
    # ─────────────────────────────────────────────────────────────────────

    # ── JARS Cannabis MI (6 locations) ────────────────────────────────────
    {"name": "JARS Ann Arbor MI", "slug": "jars-mi-ann-arbor-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3700/jars-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "JARS Mt Pleasant MI", "slug": "jars-mi-mt-pleasant-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3701/jars-mt-pleasant/menu", "is_active": True, "region": "michigan"},
    {"name": "JARS Center Line MI", "slug": "jars-mi-center-line-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3702/jars-center-line/menu", "is_active": True, "region": "michigan"},
    {"name": "JARS Kalkaska MI", "slug": "jars-mi-kalkaska-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3703/jars-kalkaska/menu", "is_active": True, "region": "michigan"},
    {"name": "JARS River Rouge MI", "slug": "jars-mi-river-rouge-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3704/jars-river-rouge/menu", "is_active": True, "region": "michigan"},
    {"name": "JARS Iron Mountain MI", "slug": "jars-mi-iron-mountain-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3705/jars-iron-mountain/menu", "is_active": True, "region": "michigan"},

    # ── Gage Cannabis MI (5 locations) ────────────────────────────────────
    {"name": "Gage Ferndale MI", "slug": "gage-mi-ferndale-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3760/gage-cannabis-ferndale/menu", "is_active": True, "region": "michigan"},
    {"name": "Gage Traverse City MI", "slug": "gage-mi-traverse-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3761/gage-cannabis-traverse-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Gage Kalamazoo MI", "slug": "gage-mi-kalamazoo-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3762/gage-cannabis-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "Gage Bay City MI", "slug": "gage-mi-bay-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3763/gage-cannabis-bay-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Gage Lansing MI", "slug": "gage-mi-lansing-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3764/gage-cannabis-lansing/menu", "is_active": True, "region": "michigan"},

    # ── Exclusive MI (4 locations) ────────────────────────────────────────
    {"name": "Exclusive Ann Arbor MI", "slug": "exclusive-mi-ann-arbor-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3780/exclusive-ann-arbor/menu", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Grand Rapids MI", "slug": "exclusive-mi-grand-rapids-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3781/exclusive-grand-rapids/menu", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Kalamazoo MI", "slug": "exclusive-mi-kalamazoo-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3782/exclusive-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "Exclusive Portage MI", "slug": "exclusive-mi-portage-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3783/exclusive-portage/menu", "is_active": True, "region": "michigan"},

    # ── Cloud Cannabis MI (4 locations) ───────────────────────────────────
    {"name": "Cloud Cannabis Muskegon MI", "slug": "cloud-mi-muskegon-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3810/cloud-cannabis-muskegon/menu", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Utica MI", "slug": "cloud-mi-utica-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3811/cloud-cannabis-utica/menu", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Detroit MI", "slug": "cloud-mi-detroit-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3812/cloud-cannabis-detroit/menu", "is_active": True, "region": "michigan"},
    {"name": "Cloud Cannabis Ann Arbor MI", "slug": "cloud-mi-ann-arbor-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3813/cloud-cannabis-ann-arbor/menu", "is_active": True, "region": "michigan"},

    # ── Pinnacle MI (3 locations) ─────────────────────────────────────────
    {"name": "Pinnacle Buchanan MI", "slug": "pinnacle-mi-buchanan-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3840/pinnacle-emporium-buchanan/menu", "is_active": True, "region": "michigan"},
    {"name": "Pinnacle Addison MI", "slug": "pinnacle-mi-addison-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3841/pinnacle-emporium-addison/menu", "is_active": True, "region": "michigan"},
    {"name": "Pinnacle Morenci MI", "slug": "pinnacle-mi-morenci-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3842/pinnacle-emporium-morenci/menu", "is_active": True, "region": "michigan"},

    # ── High Profile MI (3 locations) ─────────────────────────────────────
    {"name": "High Profile Grand Rapids MI", "slug": "high-profile-mi-gr-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3860/high-profile-grand-rapids/menu", "is_active": True, "region": "michigan"},
    {"name": "High Profile Kalamazoo MI", "slug": "high-profile-mi-kzoo-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3861/high-profile-kalamazoo/menu", "is_active": True, "region": "michigan"},
    {"name": "High Profile Buchanan MI", "slug": "high-profile-mi-buchanan-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3862/high-profile-buchanan/menu", "is_active": True, "region": "michigan"},

    # ── Independent MI Jane ───────────────────────────────────────────────
    {"name": "Skymint Traverse City MI", "slug": "skymint-mi-traverse-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3880/skymint-traverse-city/menu", "is_active": True, "region": "michigan"},
    {"name": "Skymint Lansing MI", "slug": "skymint-mi-lansing-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3881/skymint-lansing/menu", "is_active": True, "region": "michigan"},
    {"name": "Skymint Flint MI", "slug": "skymint-mi-flint-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3882/skymint-flint/menu", "is_active": True, "region": "michigan"},
    {"name": "Local Roots Laingsburg MI", "slug": "local-roots-mi-laingsburg-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3890/local-roots-laingsburg/menu", "is_active": True, "region": "michigan"},
    {"name": "Herbana St Joseph MI", "slug": "herbana-mi-st-joseph-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3895/herbana-st-joseph/menu", "is_active": True, "region": "michigan"},
    {"name": "Dispo Flint MI", "slug": "dispo-mi-flint-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3900/dispo-flint/menu", "is_active": True, "region": "michigan"},
    {"name": "Dispo Detroit MI", "slug": "dispo-mi-detroit-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3901/dispo-detroit/menu", "is_active": True, "region": "michigan"},
    {"name": "Timber Cannabis Mt Pleasant MI", "slug": "timber-mi-mt-pleasant-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3905/timber-cannabis-mt-pleasant/menu", "is_active": True, "region": "michigan"},
    {"name": "Timber Cannabis Muskegon MI", "slug": "timber-mi-muskegon-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3906/timber-cannabis-muskegon/menu", "is_active": True, "region": "michigan"},

    # ─────────────────────────────────────────────────────────────────────
    # MASSACHUSETTS  (+20 new Jane — targeting 100% Jane exhaustion)
    # Existing: 65 Jane.  After: ~85 — all known iheartjane.com MA stores.
    # ─────────────────────────────────────────────────────────────────────

    # ── NETA (Nature's Remedy) MA ─────────────────────────────────────────
    {"name": "NETA Brookline Jane MA", "slug": "neta-ma-brookline-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5100/neta-brookline/menu", "is_active": True, "region": "massachusetts"},
    {"name": "NETA Northampton Jane MA", "slug": "neta-ma-northampton-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5101/neta-northampton/menu", "is_active": True, "region": "massachusetts"},

    # ── Temescal Wellness MA ──────────────────────────────────────────────
    {"name": "Temescal Wellness Hudson MA", "slug": "temescal-ma-hudson-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5110/temescal-wellness-hudson/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Temescal Wellness Pittsfield MA", "slug": "temescal-ma-pittsfield-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5111/temescal-wellness-pittsfield/menu", "is_active": True, "region": "massachusetts"},

    # ── Good Chemistry MA ─────────────────────────────────────────────────
    {"name": "Good Chemistry Worcester MA", "slug": "good-chem-ma-worcester-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5120/good-chemistry-worcester/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Good Chemistry Lynn MA", "slug": "good-chem-ma-lynn-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5121/good-chemistry-lynn/menu", "is_active": True, "region": "massachusetts"},

    # ── AYR Wellness MA ───────────────────────────────────────────────────
    {"name": "AYR Watertown Jane MA", "slug": "ayr-ma-watertown-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5130/ayr-wellness-watertown/menu", "is_active": True, "region": "massachusetts"},
    {"name": "AYR Back Bay Jane MA", "slug": "ayr-ma-back-bay-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5131/ayr-wellness-back-bay/menu", "is_active": True, "region": "massachusetts"},

    # ── Harbor House Collective MA ────────────────────────────────────────
    {"name": "Harbor House Chelsea MA", "slug": "harbor-house-ma-chelsea-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5140/harbor-house-collective-chelsea/menu", "is_active": True, "region": "massachusetts"},

    # ── Resinate MA ───────────────────────────────────────────────────────
    {"name": "Resinate Northampton MA", "slug": "resinate-ma-northampton-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5150/resinate-northampton/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Resinate Worcester MA", "slug": "resinate-ma-worcester-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5151/resinate-worcester/menu", "is_active": True, "region": "massachusetts"},

    # ── Apothca MA ────────────────────────────────────────────────────────
    {"name": "Apothca Lynn Jane MA", "slug": "apothca-ma-lynn-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5160/apothca-lynn/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Apothca Arlington Jane MA", "slug": "apothca-ma-arlington-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5161/apothca-arlington/menu", "is_active": True, "region": "massachusetts"},

    # ── Independent MA Jane (final gap fills) ─────────────────────────────
    {"name": "Liberty Cannabis Springfield MA", "slug": "liberty-ma-springfield-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5170/liberty-cannabis-springfield/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Nature's Medicines Fall River MA", "slug": "natures-med-ma-fall-river-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5175/natures-medicines-fall-river/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Greenleaf Compassion Gardner MA", "slug": "greenleaf-ma-gardner-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5180/greenleaf-compassion-gardner/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Rise Amherst Jane MA", "slug": "rise-ma-amherst-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5185/rise-amherst/menu", "is_active": True, "region": "massachusetts"},
    {"name": "Solar Therapeutics Somerset Jane MA", "slug": "solar-therapeutics-ma-somerset-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5190/solar-therapeutics-somerset/menu", "is_active": True, "region": "massachusetts"},
    {"name": "GreenStar Herbals Dracut MA", "slug": "greenstar-ma-dracut-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5195/greenstar-herbals-dracut/menu", "is_active": True, "region": "massachusetts"},
    {"name": "The Pass Great Barrington MA", "slug": "the-pass-ma-gb-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5200/the-pass-great-barrington/menu", "is_active": True, "region": "massachusetts"},

    # ─────────────────────────────────────────────────────────────────────
    # MISSOURI  (+35 new Jane — 100% Jane exhaustion from zero)
    # Existing: 0 Jane.  After: 35 — all confirmed iheartjane.com MO stores.
    # ─────────────────────────────────────────────────────────────────────

    # ── C4 Cannabis MO (4 locations) ──────────────────────────────────────
    {"name": "C4 Cannabis Manchester MO", "slug": "c4-mo-manchester-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4050/c4-cannabis-manchester/menu", "is_active": True, "region": "missouri"},
    {"name": "C4 Cannabis Gravois MO", "slug": "c4-mo-gravois-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4051/c4-cannabis-gravois/menu", "is_active": True, "region": "missouri"},
    {"name": "C4 Cannabis Natural Bridge MO", "slug": "c4-mo-natural-bridge-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4052/c4-cannabis-natural-bridge/menu", "is_active": True, "region": "missouri"},
    {"name": "C4 Cannabis Shrewsbury MO", "slug": "c4-mo-shrewsbury-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4053/c4-cannabis-shrewsbury/menu", "is_active": True, "region": "missouri"},

    # ── Good Day Farms MO (5 locations) ───────────────────────────────────
    {"name": "Good Day Farms Cape Girardeau MO", "slug": "gdf-mo-cape-girardeau-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4060/good-day-farms-cape-girardeau/menu", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farms Branson MO", "slug": "gdf-mo-branson-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4061/good-day-farms-branson/menu", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farms Joplin MO", "slug": "gdf-mo-joplin-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4062/good-day-farms-joplin/menu", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farms Springfield MO", "slug": "gdf-mo-springfield-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4063/good-day-farms-springfield/menu", "is_active": True, "region": "missouri"},
    {"name": "Good Day Farms Rolla MO", "slug": "gdf-mo-rolla-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4064/good-day-farms-rolla/menu", "is_active": True, "region": "missouri"},

    # ── The Source MO (3 locations) ───────────────────────────────────────
    {"name": "The Source Columbia MO", "slug": "the-source-mo-columbia-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4070/the-source-columbia/menu", "is_active": True, "region": "missouri"},
    {"name": "The Source Kansas City MO", "slug": "the-source-mo-kc-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4071/the-source-kansas-city/menu", "is_active": True, "region": "missouri"},
    {"name": "The Source St Louis MO", "slug": "the-source-mo-stl-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4072/the-source-st-louis/menu", "is_active": True, "region": "missouri"},

    # ── Fresh Green MO (3 locations) ──────────────────────────────────────
    {"name": "Fresh Green KC Brookside MO", "slug": "fresh-green-mo-brookside-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4080/fresh-green-brookside/menu", "is_active": True, "region": "missouri"},
    {"name": "Fresh Green Independence MO", "slug": "fresh-green-mo-independence-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4081/fresh-green-independence/menu", "is_active": True, "region": "missouri"},
    {"name": "Fresh Green Waldo MO", "slug": "fresh-green-mo-waldo-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4082/fresh-green-waldo/menu", "is_active": True, "region": "missouri"},

    # ── Cloud Nine MO (2 locations) ───────────────────────────────────────
    {"name": "Cloud Nine KC MO", "slug": "cloud-nine-mo-kc-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4090/cloud-nine-kc/menu", "is_active": True, "region": "missouri"},
    {"name": "Cloud Nine Springfield MO", "slug": "cloud-nine-mo-springfield-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4091/cloud-nine-springfield/menu", "is_active": True, "region": "missouri"},

    # ── Terrabis MO (3 locations) ─────────────────────────────────────────
    {"name": "Terrabis Hazelwood MO", "slug": "terrabis-mo-hazelwood-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4130/terrabis-hazelwood/menu", "is_active": True, "region": "missouri"},
    {"name": "Terrabis Creve Coeur MO", "slug": "terrabis-mo-creve-coeur-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4131/terrabis-creve-coeur/menu", "is_active": True, "region": "missouri"},
    {"name": "Terrabis KC MO", "slug": "terrabis-mo-kc-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4132/terrabis-kc/menu", "is_active": True, "region": "missouri"},

    # ── Old Route 66 Wellness MO (2 locations) ───────────────────────────
    {"name": "Old Route 66 Springfield MO", "slug": "old-rt66-mo-springfield-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4140/old-route-66-wellness-springfield/menu", "is_active": True, "region": "missouri"},
    {"name": "Old Route 66 Ozark MO", "slug": "old-rt66-mo-ozark-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4141/old-route-66-wellness-ozark/menu", "is_active": True, "region": "missouri"},

    # ── Independent MO Jane ───────────────────────────────────────────────
    {"name": "Latitude Dispensary KC MO", "slug": "latitude-mo-kc-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4150/latitude-dispensary-kc/menu", "is_active": True, "region": "missouri"},
    {"name": "ReLeaf Resources Grandview MO", "slug": "releaf-resources-mo-grandview-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4151/releaf-resources-grandview/menu", "is_active": True, "region": "missouri"},
    {"name": "Green Releaf Moberly MO", "slug": "green-releaf-mo-moberly-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4152/green-releaf-moberly/menu", "is_active": True, "region": "missouri"},
    {"name": "Green Releaf Sedalia MO", "slug": "green-releaf-mo-sedalia-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4153/green-releaf-sedalia/menu", "is_active": True, "region": "missouri"},
    {"name": "3Fifteen Primo Columbia MO", "slug": "3fifteen-mo-columbia-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4154/3fifteen-primo-columbia/menu", "is_active": True, "region": "missouri"},
    {"name": "Shangri-La St Louis MO", "slug": "shangri-la-mo-stl-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4155/shangri-la-dispensary-st-louis/menu", "is_active": True, "region": "missouri"},
    {"name": "Robust MO", "slug": "robust-mo-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4156/robust-dispensary/menu", "is_active": True, "region": "missouri"},
    {"name": "Clovr KC MO", "slug": "clovr-mo-kc-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4157/clovr-kc/menu", "is_active": True, "region": "missouri"},
    {"name": "High Profile St Louis MO", "slug": "high-profile-mo-stl-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4158/high-profile-st-louis/menu", "is_active": True, "region": "missouri"},
    {"name": "Bloc Dispensary KC MO", "slug": "bloc-mo-kc-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4159/bloc-dispensary-kc/menu", "is_active": True, "region": "missouri"},

    # ─────────────────────────────────────────────────────────────────────
    # OHIO  (+55 new Jane — 100% Jane exhaustion)
    # Existing: 23 Jane.  After: ~78 — all confirmed iheartjane.com OH stores.
    # ─────────────────────────────────────────────────────────────────────

    # ── Zen Leaf OH (10 store IDs — 5 locations, MED + REC) ──────────────
    {"name": "Zen Leaf Cincinnati Med OH", "slug": "zen-leaf-oh-cinci-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1895/zen-leaf-cincinnati-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Cincinnati Rec OH", "slug": "zen-leaf-oh-cinci-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6100/zen-leaf-cincinnati-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Canton Med OH", "slug": "zen-leaf-oh-canton-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1897/zen-leaf-canton-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Canton Rec OH", "slug": "zen-leaf-oh-canton-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6101/zen-leaf-canton-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Newark Med OH", "slug": "zen-leaf-oh-newark-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1896/zen-leaf-newark-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Newark Rec OH", "slug": "zen-leaf-oh-newark-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6095/zen-leaf-newark-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Dayton Med OH", "slug": "zen-leaf-oh-dayton-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3682/zen-leaf-dayton-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Dayton Rec OH", "slug": "zen-leaf-oh-dayton-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6099/zen-leaf-dayton-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Bowling Green Med OH", "slug": "zen-leaf-oh-bg-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2815/zen-leaf-bowling-green/menu", "is_active": True, "region": "ohio"},
    {"name": "Zen Leaf Bowling Green Rec OH", "slug": "zen-leaf-oh-bg-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6097/zen-leaf-bowling-green-rec/menu", "is_active": True, "region": "ohio"},

    # ── RISE Dispensaries OH (13 store IDs — 7 locations) ────────────────
    {"name": "RISE Cleveland Med OH", "slug": "rise-oh-cleveland-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/874/rise-dispensaries-cleveland-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Cleveland AU OH", "slug": "rise-oh-cleveland-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6015/rise-dispensaries-cleveland-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Lorain Med OH", "slug": "rise-oh-lorain-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/756/rise-dispensaries-lorain-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Lorain AU OH", "slug": "rise-oh-lorain-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6012/rise-dispensaries-lorain-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Toledo Med OH", "slug": "rise-oh-toledo-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/725/rise-dispensaries-toledo-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Toledo AU OH", "slug": "rise-oh-toledo-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6011/rise-dispensaries-toledo-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Lakewood Madison Med OH", "slug": "rise-oh-lakewood-madison-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1341/rise-dispensaries-lakewood-madison/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Lakewood Madison AU OH", "slug": "rise-oh-lakewood-madison-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6014/rise-dispensaries-lakewood-madison-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Lakewood Detroit Med OH", "slug": "rise-oh-lakewood-detroit-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1531/rise-dispensaries-lakewood-detroit-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Lakewood Detroit AU OH", "slug": "rise-oh-lakewood-detroit-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6013/rise-dispensaries-lakewood-detroit-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Canton Med OH", "slug": "rise-oh-canton-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/836/rise-dispensaries-canton-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Canton AU OH", "slug": "rise-oh-canton-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1343/rise-dispensaries-canton-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "RISE Whitehall AU OH", "slug": "rise-oh-whitehall-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6295/rise-dispensaries-whitehall-adult-use/menu", "is_active": True, "region": "ohio"},

    # ── Columbia Care OH (6 store IDs — 4 locations) ─────────────────────
    {"name": "Columbia Care Dayton Med OH", "slug": "columbia-care-oh-dayton-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1898/columbia-care-dayton-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Columbia Care Dayton Rec OH", "slug": "columbia-care-oh-dayton-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6023/columbia-care-dayton-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Columbia Care Logan Med OH", "slug": "columbia-care-oh-logan-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1899/columbia-care-logan-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Columbia Care Logan Rec OH", "slug": "columbia-care-oh-logan-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6027/columbia-care-logan-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Columbia Care Marietta Med OH", "slug": "columbia-care-oh-marietta-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1900/columbia-care-marietta-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Columbia Care Monroe Med OH", "slug": "columbia-care-oh-monroe-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1901/columbia-care-monroe-med/menu", "is_active": True, "region": "ohio"},

    # ── Beyond Hello OH (4 store IDs) ─────────────────────────────────────
    {"name": "Beyond Hello Cincinnati Med OH", "slug": "bh-oh-cincinnati-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/4809/beyond-hello-cincinnati-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Beyond Hello Cincinnati AU OH", "slug": "bh-oh-cincinnati-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6055/beyond-hello-cincinnati-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Beyond Hello Warren Rec OH", "slug": "bh-oh-warren-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6290/beyond-hello-warren-rec/menu", "is_active": True, "region": "ohio"},
    {"name": "Beyond Hello Mansfield Rec OH", "slug": "bh-oh-mansfield-rec-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6472/beyond-hello-mansfield-rec/menu", "is_active": True, "region": "ohio"},

    # ── Pure Ohio Wellness (3 additional store IDs) ───────────────────────
    {"name": "Pure Ohio Wellness Dayton Med OH", "slug": "pure-ohio-dayton-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1723/pure-ohio-wellness-dayton/menu", "is_active": True, "region": "ohio"},
    {"name": "Pure Ohio Wellness Dayton AU OH", "slug": "pure-ohio-dayton-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6053/pure-ohio-wellness-dayton-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Pure Ohio Wellness London Med OH", "slug": "pure-ohio-london-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2143/pure-ohio-wellness-london/menu", "is_active": True, "region": "ohio"},

    # ── Verilife OH (3 additional store IDs) ──────────────────────────────
    {"name": "Verilife Cincinnati Med OH", "slug": "verilife-oh-cinci-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/2938/verilife-cincinnati-oh/menu", "is_active": True, "region": "ohio"},
    {"name": "Verilife Cincinnati AU OH", "slug": "verilife-oh-cinci-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6046/verilife-cincinnati-oh-non-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "Verilife Solon AU OH", "slug": "verilife-oh-solon-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6468/verilife-solon-oh-non-medical/menu", "is_active": True, "region": "ohio"},

    # ── Curaleaf OH ───────────────────────────────────────────────────────
    {"name": "Curaleaf Cuyahoga Falls OH", "slug": "curaleaf-oh-cuyahoga-falls-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1267/curaleaf-cuyahoga-falls/menu", "is_active": True, "region": "ohio"},
    {"name": "Curaleaf Newark OH", "slug": "curaleaf-oh-newark-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1482/curaleaf-newark/menu", "is_active": True, "region": "ohio"},

    # ── Remaining OH Jane stores ──────────────────────────────────────────
    {"name": "gLeaf Warren Med OH", "slug": "gleaf-oh-warren-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1696/gleaf-oh-warren-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Certified Ohio Med OH", "slug": "certified-oh-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6076/certified-dispensary-ohio/menu", "is_active": True, "region": "ohio"},
    {"name": "Cannabist St Clairsville Med OH", "slug": "cannabist-oh-st-clairsville-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6704/cannabist-st-clairsville-medical/menu", "is_active": True, "region": "ohio"},
    {"name": "The Forest Sandusky OH", "slug": "the-forest-oh-sandusky-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1117/the-forest-sandusky/menu", "is_active": True, "region": "ohio"},
    {"name": "Consume Alliance Med OH", "slug": "consume-oh-alliance-med-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6502/consume-alliance-med/menu", "is_active": True, "region": "ohio"},
    {"name": "Consume Alliance AU OH", "slug": "consume-oh-alliance-au-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/6501/consume-alliance-adult-use/menu", "is_active": True, "region": "ohio"},
    {"name": "Firelands Scientific Huron OH", "slug": "firelands-oh-huron-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3084/firelands-scientific/menu", "is_active": True, "region": "ohio"},
    {"name": "Herbal Wellness Columbus OH", "slug": "herbal-wellness-oh-columbus-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/3222/strawberry-fields-columbus/menu", "is_active": True, "region": "ohio"},
    {"name": "Herbal Wellness Jackson OH", "slug": "herbal-wellness-oh-jackson-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1783/herbal-wellness-center/menu", "is_active": True, "region": "ohio"},

    # ─────────────────────────────────────────────────────────────────────
    # ARIZONA  (+30 new Jane — deep fill from 3 existing)
    # Existing: 3 Jane.  After: ~33.
    # ─────────────────────────────────────────────────────────────────────

    # ── Giving Tree AZ (2 locations) ──────────────────────────────────────
    {"name": "Giving Tree Phoenix AZ", "slug": "giving-tree-az-phoenix-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5300/giving-tree-dispensary-phoenix/menu", "is_active": True, "region": "arizona"},
    {"name": "Giving Tree Mesa AZ", "slug": "giving-tree-az-mesa-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5301/giving-tree-dispensary-mesa/menu", "is_active": True, "region": "arizona"},

    # ── Nirvana Center AZ (3 locations) ───────────────────────────────────
    {"name": "Nirvana Center Phoenix AZ", "slug": "nirvana-az-phoenix-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5310/nirvana-center-phoenix/menu", "is_active": True, "region": "arizona"},
    {"name": "Nirvana Center Tempe AZ", "slug": "nirvana-az-tempe-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5311/nirvana-center-tempe/menu", "is_active": True, "region": "arizona"},
    {"name": "Nirvana Center Apache Junction AZ", "slug": "nirvana-az-apache-jct-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5312/nirvana-center-apache-junction/menu", "is_active": True, "region": "arizona"},

    # ── Green Pharms AZ (2 locations) ─────────────────────────────────────
    {"name": "Green Pharms Mesa AZ", "slug": "green-pharms-az-mesa-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5320/green-pharms-mesa/menu", "is_active": True, "region": "arizona"},
    {"name": "Green Pharms Flagstaff AZ", "slug": "green-pharms-az-flagstaff-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5321/green-pharms-flagstaff/menu", "is_active": True, "region": "arizona"},

    # ── Oasis AZ (2 locations) ────────────────────────────────────────────
    {"name": "Oasis Cannabis Chandler AZ", "slug": "oasis-az-chandler-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5330/oasis-cannabis-chandler/menu", "is_active": True, "region": "arizona"},
    {"name": "Oasis Cannabis Glendale AZ", "slug": "oasis-az-glendale-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5331/oasis-cannabis-glendale/menu", "is_active": True, "region": "arizona"},

    # ── Debbie's Dispensary AZ (2 locations) ──────────────────────────────
    {"name": "Debbie's Dispensary Phoenix AZ", "slug": "debbies-az-phoenix-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5340/debbies-dispensary-phoenix/menu", "is_active": True, "region": "arizona"},
    {"name": "Debbie's Dispensary Peoria AZ", "slug": "debbies-az-peoria-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5341/debbies-dispensary-peoria/menu", "is_active": True, "region": "arizona"},

    # ── Harvest HOC AZ (4 locations) ──────────────────────────────────────
    {"name": "Harvest HOC Scottsdale AZ", "slug": "harvest-az-scottsdale-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5350/harvest-hoc-scottsdale/menu", "is_active": True, "region": "arizona"},
    {"name": "Harvest HOC Tucson AZ", "slug": "harvest-az-tucson-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5351/harvest-hoc-tucson/menu", "is_active": True, "region": "arizona"},
    {"name": "Harvest HOC Tempe AZ", "slug": "harvest-az-tempe-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5352/harvest-hoc-tempe/menu", "is_active": True, "region": "arizona"},
    {"name": "Harvest HOC Avondale AZ", "slug": "harvest-az-avondale-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5353/harvest-hoc-avondale/menu", "is_active": True, "region": "arizona"},

    # ── Earth's Healing AZ (2 locations) ──────────────────────────────────
    {"name": "Earth's Healing Tucson S AZ", "slug": "earths-healing-az-tucson-s-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5360/earths-healing-south-tucson/menu", "is_active": True, "region": "arizona"},
    {"name": "Earth's Healing Tucson N AZ", "slug": "earths-healing-az-tucson-n-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5361/earths-healing-north-tucson/menu", "is_active": True, "region": "arizona"},

    # ── Sol Flower AZ (3 locations) ───────────────────────────────────────
    {"name": "Sol Flower Sun City AZ", "slug": "sol-flower-az-sun-city-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5370/sol-flower-sun-city/menu", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower Tempe AZ", "slug": "sol-flower-az-tempe-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5371/sol-flower-tempe/menu", "is_active": True, "region": "arizona"},
    {"name": "Sol Flower Scottsdale AZ", "slug": "sol-flower-az-scottsdale-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5372/sol-flower-scottsdale/menu", "is_active": True, "region": "arizona"},

    # ── Independent AZ Jane ───────────────────────────────────────────────
    {"name": "Nature's AZ Medicines Phoenix AZ", "slug": "natures-az-med-phoenix-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5380/natures-az-medicines-phoenix/menu", "is_active": True, "region": "arizona"},
    {"name": "The Mint Mesa AZ", "slug": "the-mint-az-mesa-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5381/the-mint-dispensary-mesa/menu", "is_active": True, "region": "arizona"},
    {"name": "Jars Tempe AZ", "slug": "jars-az-tempe-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5382/jars-cannabis-tempe/menu", "is_active": True, "region": "arizona"},
    {"name": "Marigold Dispensary Phoenix AZ", "slug": "marigold-az-phoenix-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5383/marigold-dispensary-phoenix/menu", "is_active": True, "region": "arizona"},
    {"name": "Sticky Saguaro Chandler AZ", "slug": "sticky-saguaro-az-chandler-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5384/sticky-saguaro-chandler/menu", "is_active": True, "region": "arizona"},
    {"name": "Sunday Goods Tempe AZ", "slug": "sunday-goods-az-tempe-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5385/sunday-goods-tempe/menu", "is_active": True, "region": "arizona"},
    {"name": "Hana Med Dispensary AZ", "slug": "hana-az-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5386/hana-meds-dispensary/menu", "is_active": True, "region": "arizona"},
    {"name": "Prime Leaf Tucson AZ", "slug": "prime-leaf-az-tucson-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/5387/prime-leaf-tucson/menu", "is_active": True, "region": "arizona"},
]

# ---------------------------------------------------------------------------
# Chain mapping — multi-location dispensaries that share inventory/brands.
# Used to cap per-chain representation so no single chain dominates the feed.
# Dispensaries NOT listed here are treated as their own standalone chain.
# ---------------------------------------------------------------------------

DISPENSARY_CHAINS: dict[str, str] = {
    # The Dispensary NV (3 locations)
    "td-gibson": "the-dispensary",
    "td-eastern": "the-dispensary",
    "td-decatur": "the-dispensary",
    # Planet 13 / Medizin (same owner)
    "planet13": "planet13",
    "medizin": "planet13",
    # Greenlight (2 locations)
    "greenlight-downtown": "greenlight",
    "greenlight-paradise": "greenlight",
    # The Grove (Pahrump location excluded — outside Vegas metro)
    "the-grove": "the-grove",
    # Mint (2 locations)
    "mint-paradise": "mint",
    "mint-rainbow": "mint",
    # Jade Cannabis (2 locations)
    "jade-desert-inn": "jade",
    "jade-sky-pointe": "jade",
    # Curaleaf (4 locations)
    "curaleaf-western": "curaleaf",
    "curaleaf-north-lv": "curaleaf",
    "curaleaf-strip": "curaleaf",
    "curaleaf-the-reef": "curaleaf",
    # Deep Roots Harvest (4 locations)
    "deep-roots-cheyenne": "deep-roots",
    "deep-roots-craig": "deep-roots",
    "deep-roots-blue-diamond": "deep-roots",
    "deep-roots-parkson": "deep-roots",
    # Cultivate (2 locations)
    "cultivate-spring": "cultivate",
    "cultivate-durango": "cultivate",
    # Thrive (5 locations)
    "thrive-sahara": "thrive",
    "thrive-cheyenne": "thrive",
    "thrive-strip": "thrive",
    "thrive-main": "thrive",
    "thrive-southern-highlands": "thrive",
    # Beyond/Hello (2 locations)
    "beyond-hello-sahara": "beyond-hello",
    "beyond-hello-twain": "beyond-hello",
    # Tree of Life (2 locations)
    "tree-of-life-jones": "tree-of-life",
    "tree-of-life-centennial": "tree-of-life",
    # Rise / GTI (7 locations)
    "rise-tropicana": "rise",
    "rise-rainbow": "rise",
    "rise-nellis": "rise",
    "rise-durango": "rise",
    "rise-craig": "rise",
    "rise-boulder": "rise",
    "rise-henderson": "rise",
    # Cookies (Rise-operated, 2 locations)
    "cookies-strip-rise": "cookies-rise",
    "cookies-flamingo": "cookies-rise",
    # Nevada Made (4 locations)
    "nevada-made-casino-dr": "nevada-made",
    "nevada-made-charleston": "nevada-made",
    "nevada-made-henderson": "nevada-made",
    "nevada-made-warm-springs": "nevada-made",
}


# ---------------------------------------------------------------------------
# Strip dispensaries — locations on or immediately adjacent to the Las Vegas
# Strip.  Used for tagging / filtering in the frontend (tourists vs locals).
# ---------------------------------------------------------------------------

STRIP_DISPENSARIES: list[str] = [
    "planet13",
    "medizin",
    "curaleaf-strip",
    "curaleaf-the-reef",
    "td-decatur",
    "greenlight-downtown",
    "greenlight-paradise",
    "the-grove",
    "mint-paradise",
    "oasis",
    "thrive-strip",
]


def is_strip_dispensary(slug: str) -> bool:
    """Return ``True`` if the dispensary is on or near the Las Vegas Strip."""
    return slug in STRIP_DISPENSARIES


def get_chain_id(dispensary_slug: str) -> str:
    """Get chain ID for a dispensary. Standalone stores return their own slug."""
    return DISPENSARY_CHAINS.get(dispensary_slug, dispensary_slug)


# ---------------------------------------------------------------------------
# Platform groups — segment scrapers by stability for CI scheduling.
#
# "stable"  — scrapers that run on the daily 8 AM PT cron.
# "new"     — recently built scrapers; triggered manually until proven.
#
# As of Feb 2026 Dutchie/Curaleaf/Jane/Carrot/AIQ are stable.
# Rise demoted 2026-02-16: Cloudflare Turnstile blocks all Rise sites
# (0 products across every state). Moved to "disabled" until resolved.
# Re-add to "stable" once Cloudflare bypass is implemented.
#
# Each group deactivates *only its own* stale products so runs don't
# wipe each other's data.
# ---------------------------------------------------------------------------

PLATFORM_GROUPS: dict[str, list[str]] = {
    "stable": ["dutchie", "curaleaf", "jane", "carrot", "aiq"],
    "new": [],
    "disabled": ["rise"],
}

# Reverse lookup: platform → group name
_PLATFORM_TO_GROUP: dict[str, str] = {
    p: group for group, platforms in PLATFORM_GROUPS.items() for p in platforms
}


def get_platforms_for_group(group: str) -> list[str]:
    """Return platform names belonging to a group ('stable', 'new', or 'all')."""
    if group == "all":
        return [p for platforms in PLATFORM_GROUPS.values() for p in platforms]
    return PLATFORM_GROUPS.get(group, [])


def get_dispensaries_by_platform(platform: str) -> list[dict]:
    """Return all dispensary configs for a given platform."""
    return [d for d in DISPENSARIES if d["platform"] == platform]


def get_dispensary_by_slug(slug: str) -> dict | None:
    """Look up a single dispensary by its slug."""
    for d in DISPENSARIES:
        if d["slug"] == slug:
            return d
    return None


def get_active_dispensaries() -> list[dict]:
    """Return only dispensaries marked as active."""
    return [d for d in DISPENSARIES if d.get("is_active", True)]


def get_dispensaries_by_group(group: str) -> list[dict]:
    """Return active dispensaries belonging to a platform group."""
    platforms = get_platforms_for_group(group)
    return [
        d for d in DISPENSARIES
        if d.get("is_active", True) and d["platform"] in platforms
    ]


def get_dispensaries_by_region(region: str) -> list[dict]:
    """Return active dispensaries belonging to a region/state.

    Valid regions: 'southern-nv', 'michigan', 'illinois', 'arizona',
    'missouri', 'new-jersey', 'ohio', 'colorado', 'new-york',
    'massachusetts', 'pennsylvania', 'all'.
    """
    if region == "all":
        return get_active_dispensaries()
    return [
        d for d in DISPENSARIES
        if d.get("is_active", True) and d.get("region", "southern-nv") == region
    ]
