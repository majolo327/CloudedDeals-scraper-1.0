"""
Dispensary configuration for Las Vegas locations across 4 platforms.

Platforms:
  - dutchie: iframe-based menus (Dutchie/TD sites)  — 15 sites
  - curaleaf: direct page loads (Curaleaf + Zen Leaf) — 6 sites
  - jane: hybrid iframe/direct with "View More" pagination — 19 sites
  - rise: proprietary Next.js SPA (Rise/GTI + Cookies) — 8 sites

Total active: 48 dispensaries

Sites marked ``is_active: False`` are known-broken (redirects, rebrands,
etc.) and will be skipped by the orchestrator.  They remain in the config
so the DB seed keeps their rows for historical data.
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
    # DUTCHIE SITES  (15)
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
        "name": "Beyond/Hello Twain",
        "slug": "beyond-hello-twain",
        "platform": "jane",
        "url": "https://nuleafnv.com/dispensaries/las-vegas/menu/",
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

    # ------------------------------------------------------------------
    # PENDING PLATFORMS — Phase 3+ (inactive until scrapers are built)
    # ------------------------------------------------------------------
    # Carrot (6 sites) — getcarrot.io embed
    # AIQ (5-7 sites) — alpineiq.com / dispenseapp.com
    #
    # SLV has Dutchie markers but age gate redirect needs investigation.
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
