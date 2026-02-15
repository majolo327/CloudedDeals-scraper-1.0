"""
Dispensary configuration across 11 regions and 6 platforms.

Regions:
  - southern-nv:   Las Vegas metro — 63 dispensaries (production)
  - michigan:      MI data collection — 114 dispensaries (Dutchie-dominant)
  - illinois:      IL data collection — 88 dispensaries (Rise/Curaleaf/Dutchie/Jane)
  - arizona:       AZ data collection — 52 dispensaries (Dutchie-dominant)
  - missouri:      MO data collection — 31 dispensaries (Dutchie-only)
  - new-jersey:    NJ data collection — 34 dispensaries (Dutchie + Rise + Zen Leaf)
  - ohio:          OH test batch — 20 dispensaries (Dutchie + Jane + Curaleaf + Rise)
  - colorado:      CO test batch — 17 dispensaries (Dutchie + Jane)
  - new-york:      NY test batch — 18 dispensaries (Dutchie + Jane + Curaleaf + Rise)
  - massachusetts: MA test batch — 17 dispensaries (Dutchie + Jane + Curaleaf + Rise)
  - pennsylvania:  PA test batch — 16 dispensaries (Dutchie + Rise)

Platforms (~470 total):
  - dutchie: ~340 — iframe-based menus (Dutchie/TD sites)
  - jane:     ~70 — hybrid iframe/direct with "View More" pagination
  - curaleaf: ~40 — direct page loads (Curaleaf + Zen Leaf)
  - rise:     ~35 — proprietary Next.js SPA (Rise/GTI + Cookies)
  - carrot:    6 — JS widget via getcarrot.io
  - aiq:       3 — Alpine IQ / Dispense React SPA

Total active: ~470 dispensaries across 11 states
  Original 6: 382 (63 NV + 114 MI + 88 IL + 52 AZ + 31 MO + 34 NJ)
  Expansion 5:  88 test batch (20 OH + 17 CO + 18 NY + 17 MA + 16 PA)
  Full pipeline: 401 additional dispensaries identified for expansion

Sites marked ``is_active: False`` are known-broken (redirects, rebrands,
etc.) and will be skipped by the orchestrator.  They remain in the config
so the DB seed keeps their rows for historical data.

Multi-state dispensaries use the ``region`` field for filtering.
The ``REGION`` env var in main.py controls which state is scraped.
"""

# ---------------------------------------------------------------------------
# Browser / Playwright defaults
# ---------------------------------------------------------------------------

BROWSER_ARGS = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
]

VIEWPORT = {"width": 1920, "height": 1080}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

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
        "wait_until": "load",             # scripts must fully execute to create iframe
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
        "fallback_url": "https://dutchie.com/embedded-menu/the-dispensary-henderson/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",
    },
    {
        "name": "The Dispensary - Eastern",
        "slug": "td-eastern",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-dispensary-eastern-express/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",
    },
    {
        "name": "The Dispensary - Decatur",
        "slug": "td-decatur",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-dispensary-las-vegas/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",
    },
    {
        "name": "Planet 13",
        "slug": "planet13",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/planet-13-dispensary/specials",
        "fallback_url": "https://dutchie.com/embedded-menu/planet-13-dispensary/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",   # P13 uses Dutchie iframe — hint avoids 60s js_embed detection
    },
    {
        "name": "Medizin",
        "slug": "medizin",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/medizin-dispensary/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "iframe",   # same as Planet 13
    },
    {
        "name": "Greenlight Downtown",
        "slug": "greenlight-downtown",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
    },
    {
        "name": "Greenlight Paradise",
        "slug": "greenlight-paradise",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
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
        "url": "https://mintdeals.com/paradise-lv/menu/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-mint-paradise/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
    },
    {
        "name": "Mint Rainbow",
        "slug": "mint-rainbow",
        "platform": "dutchie",
        "url": "https://mintdeals.com/rainbow-lv/menu/?dtche%5Bpath%5D=specials",
        "fallback_url": "https://dutchie.com/embedded-menu/the-mint-spring-valley/specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
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
        "embed_type": "js_embed",  # dtche param confirms JS embed
    },
    {
        "name": "Jade Cannabis Sky Pointe",
        "slug": "jade-sky-pointe",
        "platform": "dutchie",
        "url": "https://skypointe.jadecannabisco.com/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",  # dtche param confirms JS embed
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
        # Euphoria's Carrot integration renders deals/specials on the main
        # /menu page — /menu/category/specials is not a valid route.
        "name": "Euphoria Wellness",
        "slug": "euphoria-wellness",
        "platform": "carrot",
        "url": "https://euphoriawellnessnv.com/menu",
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
        # No embed_type hint — auto-detect via full cascade, same as the
        # working Charleston/Henderson/Warm Springs siblings.
        "name": "Nevada Made Laughlin",
        "slug": "nevada-made-casino-dr",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-laughlin/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — specials page with embedded menu
        "name": "Nevada Made Charleston",
        "slug": "nevada-made-charleston",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-charleston/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — was 403 on old platform, now active
        "name": "Nevada Made Henderson",
        "slug": "nevada-made-henderson",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-henderson1/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — was 403 on old platform, now active
        "name": "Nevada Made Warm Springs",
        "slug": "nevada-made-warm-springs",
        "platform": "dutchie",
        "url": "https://nevadamademarijuana.com/stores/nevada-made-marijuana-warm-springs/specials",
        "is_active": True,
        "region": "southern-nv",
    },

    # ==================================================================
    # MICHIGAN — Data collection. Dutchie-dominant market (350-400 on
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

    # ── CURALEAF MICHIGAN (Curaleaf platform) ───────────────────────
    {"name": "Curaleaf MI Kalamazoo", "slug": "curaleaf-mi-kalamazoo", "platform": "curaleaf", "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-kalamazoo", "is_active": True, "region": "michigan"},
    {"name": "Curaleaf MI Bangor", "slug": "curaleaf-mi-bangor", "platform": "curaleaf", "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-bangor", "is_active": True, "region": "michigan"},

    # ── ZEN LEAF MICHIGAN (Verano — same platform as NV) ────────────
    {"name": "Zen Leaf Buchanan MI", "slug": "zen-leaf-buchanan", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/buchanan/menu/recreational", "is_active": True, "region": "michigan"},

    # ==================================================================
    # ILLINOIS — 88 dispensaries. MSO-dominated: Rise (GTI), Curaleaf,
    # Zen Leaf (Verano). Dutchie chains: Ascend, Windy City, Thrive IL,
    # Mission, Maribis, Planet 13. Jane chains: Beyond/Hello, Verilife,
    # Consume, nuEra, EarthMed, Hatch.
    # ==================================================================

    # ── RISE ILLINOIS (GTI — 11 locations, Rise platform) ──────────
    {"name": "Rise Mundelein IL", "slug": "rise-mundelein", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/mundelein/1342/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Niles IL", "slug": "rise-niles", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/niles/1812/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Naperville IL", "slug": "rise-naperville", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/naperville/2265/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Lake in the Hills IL", "slug": "rise-lake-hills", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/lake-in-the-hills/2901/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Effingham IL", "slug": "rise-effingham", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/effingham/1497/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Canton IL", "slug": "rise-canton", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/canton/1343/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Quincy IL", "slug": "rise-quincy", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/quincy/1338/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Joliet IL", "slug": "rise-joliet", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/joliet-colorado/1340/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Charleston IL", "slug": "rise-charleston", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/charleston/2525/recreational-menu/", "is_active": True, "region": "illinois"},
    {"name": "Rise Joliet Rock Creek IL", "slug": "rise-joliet-rock-creek", "platform": "rise", "url": "https://risecannabis.com/dispensaries/illinois/joliet-rock-creek/1344/recreational-menu/", "is_active": True, "region": "illinois"},

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

    # ==================================================================
    # ARIZONA — 52 dispensaries. Dutchie-dominant market:
    # Trulieve/Harvest (12), Sol Flower (6), The Mint (4),
    # Nature's Medicines (3), Nirvana (4), Ponderosa (7),
    # Cookies (1), TruMed (1), other singles (6).
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
    {"name": "Curaleaf AZ Youngtown", "slug": "curaleaf-az-youngtown", "platform": "curaleaf", "url": "https://curaleaf.com/dispensary/arizona/curaleaf-dispensary-youngtown", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ Gilbert", "slug": "curaleaf-az-gilbert", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-gilbert", "is_active": True, "region": "arizona"},
    {"name": "Curaleaf AZ 48th Street", "slug": "curaleaf-az-48th", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-az-48th", "is_active": True, "region": "arizona"},

    # ── ZEN LEAF ARIZONA (Verano) ──────────────────────────────────
    {"name": "Zen Leaf Chandler AZ", "slug": "zen-leaf-chandler", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/chandler/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Phoenix Cave Creek AZ", "slug": "zen-leaf-phoenix-az", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/phoenix-n-cave-creek/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Gilbert AZ", "slug": "zen-leaf-gilbert", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/gilbert/menu/recreational", "is_active": True, "region": "arizona"},
    {"name": "Zen Leaf Prescott AZ", "slug": "zen-leaf-prescott", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/prescott/menu/recreational", "is_active": True, "region": "arizona"},

    # ==================================================================
    # MISSOURI — Data collection. 5th largest adult-use market nationally.
    # $1.53B in 2025 sales. 214 licensed dispensaries. Dutchie-dominant.
    # Key chains: Key Missouri (9), Greenlight (10), From The Earth (3),
    # Green Releaf (3), Terrabis, Bloc, Star Buds, Nature Med.
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
    {"name": "Greenlight Columbia MO", "slug": "greenlight-mo-columbia", "platform": "dutchie", "url": "https://dutchie.com/dispensary/3fifteen-primo-columbia", "is_active": True, "region": "missouri"},
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

    # ==================================================================
    # NEW JERSEY — Data collection. $1B+ in 2024 sales. 190+ licensed
    # dispensaries. NYC metro 20M+ population. MSO-heavy: Curaleaf (on
    # Dutchie!), GTI/Rise, Verano/Zen Leaf, Ascend. Key insight: Curaleaf
    # NJ migrated to Dutchie platform — scrapes via dutchie.py not
    # curaleaf.py. Strong independent scene: MPX NJ, Sweetspot, Hashery,
    # Bloc, AYR/GSD.
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
    {"name": "Sweetspot River Edge NJ", "slug": "sweetspot-nj-river-edge", "platform": "dutchie", "url": "https://dutchie.com/dispensary/x-sweetspot-river-edged", "is_active": True, "region": "new-jersey"},

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
    {"name": "Rise Bloomfield NJ", "slug": "rise-nj-bloomfield", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-jersey/bloomfield/3120/recreational-menu/", "is_active": True, "region": "new-jersey"},
    {"name": "Rise Paterson NJ", "slug": "rise-nj-paterson", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-jersey/paterson/3104/recreational-menu/", "is_active": True, "region": "new-jersey"},

    # ── ZEN LEAF NJ (Verano) ─────────────────────────────────────
    {"name": "Zen Leaf Elizabeth NJ", "slug": "zen-leaf-nj-elizabeth", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/elizabeth/menu/recreational", "is_active": True, "region": "new-jersey"},
    {"name": "Zen Leaf Lawrence NJ", "slug": "zen-leaf-nj-lawrence", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/lawrence/menu/recreational", "is_active": True, "region": "new-jersey"},
    {"name": "Zen Leaf Neptune NJ", "slug": "zen-leaf-nj-neptune", "platform": "curaleaf", "url": "https://zenleafdispensaries.com/locations/neptune/menu/recreational", "is_active": True, "region": "new-jersey"},

    # ==================================================================
    #  OHIO  — Initial test batch (10 Dutchie + 4 Jane + 3 Curaleaf + 3 Rise = 20)
    #  OH went recreational Aug 2024.  67 scrapable dispensaries identified.
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
    {"name": "Rise OH Cleveland", "slug": "rise-oh-cleveland", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/cleveland/recreational-menu/", "is_active": True, "region": "ohio"},
    {"name": "Rise OH Lakewood", "slug": "rise-oh-lakewood", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/lakewood-madison/recreational-menu/", "is_active": True, "region": "ohio"},
    {"name": "Rise OH Toledo", "slug": "rise-oh-toledo", "platform": "rise", "url": "https://oh.risecannabis.com/dispensaries/ohio/toledo/recreational-menu/", "is_active": True, "region": "ohio"},

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
    {"name": "Smacked Village Bleecker", "slug": "smacked-village", "platform": "dutchie", "url": "https://dutchie.com/dispensary/temeka-bleecker", "is_active": True, "region": "new-york"},
    {"name": "Gotham Bowery", "slug": "gotham-bowery", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gotham-nyc-3rd-st", "is_active": True, "region": "new-york"},
    {"name": "Gotham Chelsea", "slug": "gotham-chelsea", "platform": "dutchie", "url": "https://dutchie.com/dispensary/gotham-chelsea", "is_active": True, "region": "new-york"},
    {"name": "Silk Road Queens", "slug": "silk-road-queens", "platform": "dutchie", "url": "https://dutchie.com/dispensary/silk-road-nyc", "is_active": True, "region": "new-york"},
    {"name": "Travel Agency Union Square", "slug": "travel-agency-usq", "platform": "dutchie", "url": "https://dutchie.com/dispensary/the-doe-store", "is_active": True, "region": "new-york"},
    {"name": "Strain Stars Farmingdale", "slug": "strain-stars-farmingdale", "platform": "dutchie", "url": "https://dutchie.com/dispensary/strain-stars", "is_active": True, "region": "new-york"},
    {"name": "FLUENT Manhattan Rec (Etain)", "slug": "fluent-manhattan-rec", "platform": "dutchie", "url": "https://dutchie.com/dispensary/etain-new-york-rec", "is_active": True, "region": "new-york"},
    {"name": "Royale Flower Albany", "slug": "royale-flower-albany", "platform": "dutchie", "url": "https://dutchie.com/dispensary/royale-flower-albany", "is_active": True, "region": "new-york"},
    {"name": "Herbalwai Buffalo", "slug": "herbalwai-buffalo", "platform": "dutchie", "url": "https://dutchie.com/dispensary/herbalwai", "is_active": True, "region": "new-york"},

    # ── JANE NY ─────────────────────────────────────────────────────
    {"name": "Rise Manhattan NYC", "slug": "rise-ny-manhattan-jane", "platform": "jane", "url": "https://www.iheartjane.com/stores/1181/rise-dispensaries-manhattan-nyc/menu", "is_active": True, "region": "new-york"},
    {"name": "Vireo Health Queens", "slug": "vireo-queens", "platform": "jane", "url": "https://www.iheartjane.com/stores/2065/vireo-health-queens/menu", "is_active": True, "region": "new-york"},
    {"name": "The Botanist Farmingdale", "slug": "botanist-farmingdale", "platform": "jane", "url": "https://www.iheartjane.com/stores/1386/the-botanist-farmingdale", "is_active": True, "region": "new-york"},
    {"name": "Verilife Bronx", "slug": "verilife-ny-bronx", "platform": "jane", "url": "https://www.iheartjane.com/stores/3003/verilife-bronx-ny", "is_active": True, "region": "new-york"},

    # ── CURALEAF NY ─────────────────────────────────────────────────
    {"name": "Curaleaf NY Queens AU", "slug": "curaleaf-ny-queens-au", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-ny-queens-au", "is_active": True, "region": "new-york"},
    {"name": "Curaleaf NY Hudson Valley", "slug": "curaleaf-ny-hudson-valley", "platform": "curaleaf", "url": "https://curaleaf.com/shop/new-york/curaleaf-ny-hudson-valley", "is_active": True, "region": "new-york"},

    # ── RISE NY (GTI) ───────────────────────────────────────────────
    {"name": "Rise NY Henrietta", "slug": "rise-ny-henrietta", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-york/henrietta/5800/recreational-menu/", "is_active": True, "region": "new-york"},
    {"name": "Rise NY East Syracuse", "slug": "rise-ny-east-syracuse", "platform": "rise", "url": "https://risecannabis.com/dispensaries/new-york/east-syracuse/6115/recreational-menu/", "is_active": True, "region": "new-york"},

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
    {"name": "Rise MA Chelsea Rec", "slug": "rise-ma-chelsea", "platform": "rise", "url": "https://risecannabis.com/dispensaries/massachusetts/chelsea/4636/recreational-menu/", "is_active": True, "region": "massachusetts"},
    {"name": "Rise MA Dracut Rec", "slug": "rise-ma-dracut", "platform": "rise", "url": "https://risecannabis.com/dispensaries/massachusetts/dracut/4637/recreational-menu/", "is_active": True, "region": "massachusetts"},

    # ==================================================================
    #  PENNSYLVANIA  — Initial test batch (10 Dutchie + 6 Rise = 16)
    #  Medical-only but top-5 US market by revenue.  86 scrapable found.
    #  Rise has its LARGEST footprint here (19 locations).
    #  PA Curaleaf menus are on Dutchie, not curaleaf.com.
    # ==================================================================

    # ── DUTCHIE PA ──────────────────────────────────────────────────
    {"name": "Ethos NE Philadelphia", "slug": "ethos-pa-ne-philly", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ethos-northeast-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Ethos Pleasant Hills PGH", "slug": "ethos-pa-pleasant-hills", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ethos-pleasant-hills", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA Philadelphia", "slug": "curaleaf-pa-philly", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-pa-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Curaleaf PA King of Prussia", "slug": "curaleaf-pa-kop", "platform": "dutchie", "url": "https://dutchie.com/dispensary/curaleaf-pa-king-of-prussia", "is_active": True, "region": "pennsylvania"},
    {"name": "Trulieve PA Center City", "slug": "trulieve-pa-center-city", "platform": "dutchie", "url": "https://dutchie.com/dispensary/harvest-of-city-center-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Trulieve PA Squirrel Hill PGH", "slug": "trulieve-pa-squirrel-hill", "platform": "dutchie", "url": "https://dutchie.com/dispensary/trulieve-squirrel-hill", "is_active": True, "region": "pennsylvania"},
    {"name": "Liberty Philadelphia", "slug": "liberty-pa-philly", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liberty-philadelphia", "is_active": True, "region": "pennsylvania"},
    {"name": "Liberty Pittsburgh", "slug": "liberty-pa-pgh", "platform": "dutchie", "url": "https://dutchie.com/dispensary/liberty-pittsburgh", "is_active": True, "region": "pennsylvania"},
    {"name": "AYR Bryn Mawr", "slug": "ayr-pa-bryn-mawr", "platform": "dutchie", "url": "https://dutchie.com/dispensary/ayr-wellness-bryn-mawr", "is_active": True, "region": "pennsylvania"},
    {"name": "Ascend PA Scranton", "slug": "ascend-pa-scranton", "platform": "dutchie", "url": "https://dutchie.com/dispensary/scranton-pennsylvania", "is_active": True, "region": "pennsylvania"},

    # ── RISE PA (GTI — largest state footprint: 19 locations) ───────
    #    PA is medical-only → /medical-menu/ (not /recreational-menu/)
    {"name": "Rise PA Philadelphia", "slug": "rise-pa-philly", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/philadelphia/5383/medical-menu/", "is_active": True, "region": "pennsylvania"},
    {"name": "Rise PA King of Prussia", "slug": "rise-pa-kop", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/king-of-prussia/1552/medical-menu/", "is_active": True, "region": "pennsylvania"},
    {"name": "Rise PA Monroeville", "slug": "rise-pa-monroeville", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/monroeville/2266/medical-menu/", "is_active": True, "region": "pennsylvania"},
    {"name": "Rise PA Steelton", "slug": "rise-pa-steelton", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/steelton/1544/medical-menu/", "is_active": True, "region": "pennsylvania"},
    {"name": "Rise PA Erie Lake", "slug": "rise-pa-erie-lake", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/erie-lake/392/medical-menu/", "is_active": True, "region": "pennsylvania"},
    {"name": "Rise PA York", "slug": "rise-pa-york", "platform": "rise", "url": "https://risecannabis.com/dispensaries/pennsylvania/york/1548/medical-menu/", "is_active": True, "region": "pennsylvania"},
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
# As of Feb 2026 all 6 platforms are promoted to stable (63 dispensaries).
# Rise/Carrot/AIQ were promoted after initial manual testing period.
# Note: Rise (risecannabis.com) may hit Cloudflare challenges — monitor
# scrape_runs for 0-product failures and check debug artifacts if so.
#
# Each group deactivates *only its own* stale products so runs don't
# wipe each other's data.
# ---------------------------------------------------------------------------

PLATFORM_GROUPS: dict[str, list[str]] = {
    "stable": ["dutchie", "curaleaf", "jane", "carrot", "aiq"],
    "new": ["rise"],
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
