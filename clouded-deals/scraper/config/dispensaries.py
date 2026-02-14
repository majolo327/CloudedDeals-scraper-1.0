"""
Dispensary configuration across 4 regions and 6 platforms.

Regions:
  - southern-nv: Las Vegas metro — 63 dispensaries (production)
  - michigan:    MI data collection — 18 dispensaries (Dutchie/Curaleaf)
  - illinois:    IL data collection — 17 dispensaries (Rise/Curaleaf/Zen Leaf)
  - arizona:     AZ data collection — 16 dispensaries (Dutchie/Curaleaf/Zen Leaf)

Platforms:
  - dutchie: iframe-based menus (Dutchie/TD sites)
  - curaleaf: direct page loads (Curaleaf + Zen Leaf)
  - jane: hybrid iframe/direct with "View More" pagination
  - rise: proprietary Next.js SPA (Rise/GTI + Cookies)
  - carrot: JS widget via getcarrot.io
  - aiq: Alpine IQ / Dispense React SPA

Total active: 114 dispensaries (63 NV + 18 MI + 17 IL + 16 AZ)

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
    "Chrome/120.0.0.0 Safari/537.36"
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
        "wait_until": "domcontentloaded",
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
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",
    },
    {
        "name": "The Dispensary - Eastern",
        "slug": "td-eastern",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",
    },
    {
        "name": "The Dispensary - Decatur",
        "slug": "td-decatur",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
        "embed_type": "js_embed",
    },
    {
        "name": "Planet 13",
        "slug": "planet13",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/planet-13-dispensary/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Medizin",
        "slug": "medizin",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/medizin-dispensary/specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Greenlight Downtown",
        "slug": "greenlight-downtown",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Greenlight Paradise",
        "slug": "greenlight-paradise",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "The Grove",
        "slug": "the-grove",
        "platform": "dutchie",
        "url": "https://www.thegrovenv.com/lasvegas/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Mint Paradise",
        "slug": "mint-paradise",
        "platform": "dutchie",
        "url": "https://mintdeals.com/paradise-lv/menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Mint Rainbow",
        "slug": "mint-rainbow",
        "platform": "dutchie",
        "url": "https://mintdeals.com/rainbow-lv/menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    # --- Phase 1 additions (recon-confirmed Dutchie JS embeds) ---
    {
        "name": "Jade Cannabis Desert Inn",
        "slug": "jade-desert-inn",
        "platform": "dutchie",
        "url": "https://jadecannabisco.com/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Jade Cannabis Sky Pointe",
        "slug": "jade-sky-pointe",
        "platform": "dutchie",
        "url": "https://skypointe.jadecannabisco.com/?dtche%5Bpath%5D=specials",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "The Grove Pahrump",
        "slug": "grove-pahrump",
        "platform": "dutchie",
        "url": "https://www.thegrovenv.com/pahrump/?dtche%5Bpath%5D=specials",
        "is_active": True,
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
        "is_active": True,
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # CURALEAF SITES  (4) + ZEN LEAF (2)
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
    # --- Phase 1: Zen Leaf (Verano) — uses ProductCard like Curaleaf ---
    {
        "name": "Zen Leaf Flamingo",
        "slug": "zen-leaf-flamingo",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/flamingo/menu/recreational",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Zen Leaf North Las Vegas",
        "slug": "zen-leaf-north-lv",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/north-las-vegas/menu/recreational",
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
        "url": "https://oasiscannabis.com/shop/menu/specials",
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
    },
    {
        "name": "Deep Roots Harvest Craig",
        "slug": "deep-roots-craig",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/craig",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Deep Roots Harvest Blue Diamond",
        "slug": "deep-roots-blue-diamond",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/blue-diamond",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Deep Roots Harvest Parkson",
        "slug": "deep-roots-parkson",
        "platform": "jane",
        "url": "https://www.deeprootsharvest.com/parkson",
        "is_active": True,
        "region": "southern-nv",
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
        "name": "Beyond/Hello Sahara",
        "slug": "beyond-hello-sahara",
        "platform": "jane",
        "url": "https://beyond-hello.com/nevada-dispensaries/las-vegas-sahara/adult-use-menu/",
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
        "is_active": True,
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
        "name": "Tree of Life Jones",
        "slug": "tree-of-life-jones",
        "platform": "jane",
        "url": "https://lasvegas.treeoflifenv.com/store",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Tree of Life Centennial",
        "slug": "tree-of-life-centennial",
        "platform": "jane",
        "url": "https://northlasvegas.treeoflifenv.com/store",
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
    # RISE SITES  (8) — proprietary Next.js SPA via cdn-bong.risecannabis.com
    # ------------------------------------------------------------------
    {
        "name": "Rise Tropicana West",
        "slug": "rise-tropicana",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/tropicana-west/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Rise Rainbow",
        "slug": "rise-rainbow",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/rainbow/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Rise Nellis",
        "slug": "rise-nellis",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/nellis/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Rise Durango",
        "slug": "rise-durango",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/durango/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Rise Craig",
        "slug": "rise-craig",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/craig/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Rise Boulder Highway",
        "slug": "rise-boulder",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/boulder-highway/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Cookies on the Strip",
        "slug": "cookies-strip-rise",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/cookies-on-the-strip/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Rise-operated (recon confirmed: Rise score=2, 89 products)
        "name": "Cookies Flamingo",
        "slug": "cookies-flamingo",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/cookies-flamingo/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Listed as "Henderson" on risecannabis.com but located on Sunset Rd
        "name": "Rise Henderson (Sunset)",
        "slug": "rise-henderson",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/nevada/henderson/recreational-menu",
        "is_active": True,
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # DUTCHIE — supplemental sites added post-recon
    # ------------------------------------------------------------------
    {
        # Double age gate: first "Yes", then "I'M AT LEAST 21 YEARS OLD".
        # Dutchie-powered — specials page targets deals directly.
        "name": "SLV Dispensary",
        "slug": "slv",
        "platform": "dutchie",
        "url": "https://slvcannabis.com/specials/",
        "embed_type": "direct",
        "is_active": True,
        "region": "southern-nv",
    },

    # ------------------------------------------------------------------
    # CARROT SITES (6) — JS widget via nevada-store-core.getcarrot.io
    # ------------------------------------------------------------------
    {
        "name": "Wallflower Blue Diamond",
        "slug": "wallflower-blue-diamond",
        "platform": "carrot",
        "url": "https://wallflower-house.com/deals/",
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
        "url": "https://jennysdispensary.com/store/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Euphoria Wellness",
        "slug": "euphoria-wellness",
        "platform": "carrot",
        "url": "https://euphoriawellnessnv.com/menu/",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        "name": "Silver Sage Wellness",
        "slug": "silver-sage",
        "platform": "carrot",
        "url": "https://store.sswlv.com/",
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
        # Recon: 189 products, score 3
        "name": "Jardin",
        "slug": "jardin",
        "platform": "aiq",
        "url": "https://www.jardinlasvegas.com/store",
        "is_active": True,
        "region": "southern-nv",
    },
    {
        # Switched from AIQ to Dutchie — specials page with embedded menu
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
    # MICHIGAN DISPENSARIES — Data collection (not consumer-facing)
    # Dutchie-dominant market. Using direct Dutchie URLs for simplicity.
    # ==================================================================

    # --- Lume Cannabis (MI's largest chain, 30+ locations, Dutchie) ---
    {
        "name": "Lume Walled Lake",
        "slug": "lume-walled-lake",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/lume-cannabis-co-walled-lake",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Lume Monroe",
        "slug": "lume-monroe",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/lume-monroe",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Lume Petoskey",
        "slug": "lume-petoskey",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/lume-cannabis-co-petoskey",
        "is_active": True,
        "region": "michigan",
    },

    # --- Skymint (20+ locations, Dutchie) ---
    {
        "name": "Skymint Ann Arbor",
        "slug": "skymint-ann-arbor",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/skymint-ann-arbor",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Skymint Kalamazoo",
        "slug": "skymint-kalamazoo",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/skymint-kalamazoo",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Skymint Grand Rapids",
        "slug": "skymint-grand-rapids",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/skymint-division",
        "is_active": True,
        "region": "michigan",
    },

    # --- JARS Cannabis (20+ locations, Dutchie) ---
    {
        "name": "JARS Ann Arbor",
        "slug": "jars-ann-arbor",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/jars-ann-arbor-packard",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "JARS Grand Rapids",
        "slug": "jars-grand-rapids",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/jars-grand-rapids",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "JARS Monroe",
        "slug": "jars-monroe-mi",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/jars-monroe",
        "is_active": True,
        "region": "michigan",
    },

    # --- Cloud Cannabis (10+ locations, Dutchie) ---
    {
        "name": "Cloud Cannabis Detroit",
        "slug": "cloud-detroit",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/cloud-cannabis-detroit",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Cloud Cannabis Kalamazoo",
        "slug": "cloud-kalamazoo",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/cloud-cannabis-kalamazoo",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Cloud Cannabis Traverse City",
        "slug": "cloud-traverse-city",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/cloud-cannabis-traverse-city",
        "is_active": True,
        "region": "michigan",
    },

    # --- Joyology (10+ locations, Dutchie) ---
    {
        "name": "Joyology Center Line",
        "slug": "joyology-center-line",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/joyology-of-center-line",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Joyology Portage",
        "slug": "joyology-portage",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/joyology-of-portage",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Joyology Three Rivers",
        "slug": "joyology-three-rivers",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/joyology-three-rivers",
        "is_active": True,
        "region": "michigan",
    },

    # --- Curaleaf Michigan (Curaleaf platform) ---
    {
        "name": "Curaleaf MI Kalamazoo",
        "slug": "curaleaf-mi-kalamazoo",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/michigan/curaleaf-mi-kalamazoo",
        "is_active": True,
        "region": "michigan",
    },
    {
        "name": "Curaleaf MI Bangor",
        "slug": "curaleaf-mi-bangor",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/dispensary/michigan?%2Fbangor%2F=",
        "is_active": True,
        "region": "michigan",
    },

    # --- Zen Leaf Michigan (Verano — same platform as NV) ---
    {
        "name": "Zen Leaf Buchanan",
        "slug": "zen-leaf-buchanan",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/buchanan/recreational/menu/",
        "is_active": True,
        "region": "michigan",
    },

    # ==================================================================
    # ILLINOIS DISPENSARIES — Data collection (not consumer-facing)
    # MSO-dominated market: Rise (GTI), Curaleaf, Zen Leaf (Verano).
    # ==================================================================

    # --- Rise Illinois (GTI — 11 locations, Rise platform) ---
    {
        "name": "Rise Mundelein IL",
        "slug": "rise-mundelein",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/mundelein/1342/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Niles IL",
        "slug": "rise-niles",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/niles/1812/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Naperville IL",
        "slug": "rise-naperville",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/naperville/2265/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Lake in the Hills IL",
        "slug": "rise-lake-hills",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/lake-in-the-hills/2901/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Effingham IL",
        "slug": "rise-effingham",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/effingham/1497/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Canton IL",
        "slug": "rise-canton",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/canton/1343/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Quincy IL",
        "slug": "rise-quincy",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/quincy/1338/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Rise Joliet IL",
        "slug": "rise-joliet",
        "platform": "rise",
        "url": "https://risecannabis.com/dispensaries/illinois/joliet-colorado/1340/recreational-menu/",
        "is_active": True,
        "region": "illinois",
    },

    # --- Curaleaf Illinois (Curaleaf platform) ---
    {
        "name": "Curaleaf IL Weed Street",
        "slug": "curaleaf-il-weed-st",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/illinois/curaleaf-il-weed-street",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Curaleaf IL Worth",
        "slug": "curaleaf-il-worth",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/illinois/curaleaf-il-worth",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Curaleaf IL Morris",
        "slug": "curaleaf-il-morris",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/illinois/curaleaf-il-morris",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Curaleaf IL Skokie",
        "slug": "curaleaf-il-skokie",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/illinois/curaleaf-il-skokie",
        "is_active": True,
        "region": "illinois",
    },

    # --- Zen Leaf Illinois (Verano — 10 locations, same platform as NV) ---
    {
        "name": "Zen Leaf St. Charles IL",
        "slug": "zen-leaf-st-charles",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/st-charles/menu/recreational",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Zen Leaf Naperville IL",
        "slug": "zen-leaf-naperville",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/naperville/menu",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Zen Leaf Lombard IL",
        "slug": "zen-leaf-lombard",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/lombard/menu",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Zen Leaf Chicago West Loop",
        "slug": "zen-leaf-west-loop",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/chicago-west-loop/menu",
        "is_active": True,
        "region": "illinois",
    },
    {
        "name": "Zen Leaf Highland Park IL",
        "slug": "zen-leaf-highland-park",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/highland-park/menu/recreational",
        "is_active": True,
        "region": "illinois",
    },

    # ==================================================================
    # ARIZONA DISPENSARIES — Data collection (not consumer-facing)
    # Dutchie-dominant market. Trulieve (Harvest) is the largest chain.
    # ==================================================================

    # --- Trulieve/Harvest Arizona (20+ locations, Dutchie) ---
    {
        "name": "Trulieve Scottsdale AZ",
        "slug": "trulieve-scottsdale",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/harvest-of-scottsdale",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Trulieve Phoenix AZ",
        "slug": "trulieve-phoenix",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/harvest-of-phoenix",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Trulieve Tempe AZ",
        "slug": "trulieve-tempe",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/harvest-of-tempe",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Trulieve Tucson AZ",
        "slug": "trulieve-tucson",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/harvest-of-tucson",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Trulieve Glendale AZ",
        "slug": "trulieve-glendale",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/harvest-of-glendale",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Trulieve Casa Grande AZ",
        "slug": "trulieve-casa-grande",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/harvest-of-case-grande",
        "is_active": True,
        "region": "arizona",
    },

    # --- Sol Flower (5+ locations, Dutchie) ---
    {
        "name": "Sol Flower Sun City AZ",
        "slug": "sol-flower-sun-city",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/sol-flower-dispensary",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Sol Flower Tempe AZ",
        "slug": "sol-flower-tempe",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/sol-flower-dispensary-mcclintock",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Sol Flower Scottsdale Airpark",
        "slug": "sol-flower-scottsdale",
        "platform": "dutchie",
        "url": "https://dutchie.com/dispensary/sol-flower-scottsdale-airpark",
        "is_active": True,
        "region": "arizona",
    },

    # --- Curaleaf Arizona (8-10 locations, Curaleaf platform) ---
    {
        "name": "Curaleaf AZ Scottsdale",
        "slug": "curaleaf-az-scottsdale",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-dispensary-scottsdale",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Curaleaf AZ Phoenix Airport",
        "slug": "curaleaf-az-phoenix",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-dispensary-phoenix-airport",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Curaleaf AZ Tucson",
        "slug": "curaleaf-az-tucson",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-dispensary-tucson",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Curaleaf AZ Youngtown",
        "slug": "curaleaf-az-youngtown",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/dispensary/arizona/curaleaf-dispensary-youngtown",
        "is_active": True,
        "region": "arizona",
    },

    # --- Zen Leaf Arizona (Verano — 7 locations, same platform as NV) ---
    {
        "name": "Zen Leaf Chandler AZ",
        "slug": "zen-leaf-chandler",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/chandler/menu/recreational",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Zen Leaf Phoenix Cave Creek AZ",
        "slug": "zen-leaf-phoenix-az",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/phoenix-n-cave-creek/menu/recreational",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Zen Leaf Gilbert AZ",
        "slug": "zen-leaf-gilbert",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/gilbert/menu/recreational",
        "is_active": True,
        "region": "arizona",
    },
    {
        "name": "Zen Leaf Prescott AZ",
        "slug": "zen-leaf-prescott",
        "platform": "curaleaf",
        "url": "https://zenleafdispensaries.com/locations/prescott/menu/recreational",
        "is_active": True,
        "region": "arizona",
    },
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
    "stable": ["dutchie", "curaleaf", "jane", "rise", "carrot", "aiq"],
    "new": [],
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

    Valid regions: 'southern-nv', 'michigan', 'illinois', 'arizona', 'all'.
    """
    if region == "all":
        return get_active_dispensaries()
    return [
        d for d in DISPENSARIES
        if d.get("is_active", True) and d.get("region", "southern-nv") == region
    ]
