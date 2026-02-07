"""
Dispensary configuration for Las Vegas locations across 3 platforms.

Platforms:
  - dutchie: iframe-based menus (Dutchie/TD sites)
  - curaleaf: direct page loads (new /shop/nevada/ paths)
  - jane: hybrid iframe/direct with "View More" pagination

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

# Navigation timeout in milliseconds (PRD: 60 000).
GOTO_TIMEOUT_MS = 60_000

# Per-site scrape timeout in seconds.  Must accommodate the 60 s
# post-age-gate wait for Dutchie sites plus iframe loading + pagination.
SITE_TIMEOUT_SEC = 240

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
    # DUTCHIE SITES  (10)
    # ------------------------------------------------------------------
    {
        "name": "The Dispensary - Gibson",
        "slug": "td-gibson",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "The Dispensary - Eastern",
        "slug": "td-eastern",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "The Dispensary - Decatur",
        "slug": "td-decatur",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "Planet 13",
        "slug": "planet13",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/planet-13-dispensary/specials",
        "is_active": True,
    },
    {
        "name": "Medizin",
        "slug": "medizin",
        "platform": "dutchie",
        "url": "https://planet13.com/stores/medizin-dispensary/specials",
        "is_active": True,
    },
    {
        "name": "Greenlight Downtown",
        "slug": "greenlight-downtown",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "Greenlight Paradise",
        "slug": "greenlight-paradise",
        "platform": "dutchie",
        "url": "https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "The Grove",
        "slug": "the-grove",
        "platform": "dutchie",
        "url": "https://www.thegrovenv.com/lasvegas/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "Mint Paradise",
        "slug": "mint-paradise",
        "platform": "dutchie",
        "url": "https://mintdeals.com/paradise-lv/menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "Mint Rainbow",
        "slug": "mint-rainbow",
        "platform": "dutchie",
        "url": "https://mintdeals.com/rainbow-lv/menu/?dtche%5Bpath%5D=specials",
        "is_active": True,
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
    },
    {
        "name": "Curaleaf North LV",
        "slug": "curaleaf-north-lv",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-north-las-vegas/specials",
        "is_active": True,
    },
    {
        "name": "Curaleaf Strip",
        "slug": "curaleaf-strip",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-nv-las-vegas/specials",
        "is_active": True,
    },
    {
        "name": "Curaleaf The Reef",
        "slug": "curaleaf-the-reef",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/reef-dispensary-las-vegas-strip/specials",
        "is_active": True,
    },

    # ------------------------------------------------------------------
    # JANE SITES — core 1 (MVP)
    # ------------------------------------------------------------------
    {
        "name": "Oasis Cannabis",
        "slug": "oasis",
        "platform": "jane",
        "url": "https://www.oasiscannabis.com/las-vegas-cannabis-dispensary",
        "is_active": True,
    },

    # ------------------------------------------------------------------
    # JANE SITES — expansion (deactivated until verified)
    # ------------------------------------------------------------------
    {
        "name": "Planet 13",
        "slug": "planet-13",
        "platform": "jane",
        "url": "https://planet13lasvegas.com/menu/",
        "is_active": False,
    },
    {
        "name": "Reef Dispensaries",
        "slug": "reef",
        "platform": "jane",
        "url": "https://www.reefdispensaries.com/las-vegas-menu/",
        "is_active": False,
    },
    {
        "name": "ShowGrow",
        "slug": "showgrow",
        "platform": "jane",
        "url": "https://showgrow.com/las-vegas-menu/",
        "is_active": False,
    },
    {
        "name": "Zen Leaf - Las Vegas",
        "slug": "zen-leaf-lv",
        "platform": "jane",
        "url": "https://zenleafdispensaries.com/locations/nevada/las-vegas/menu/",
        "is_active": False,
    },
    {
        "name": "NuWu Cannabis Marketplace",
        "slug": "nuwu",
        "platform": "jane",
        "url": "https://nuwucannabis.com/menu/",
        "is_active": False,
    },
    {
        "name": "Acres Cannabis",
        "slug": "acres",
        "platform": "jane",
        "url": "https://acrescannabis.com/menu/",
        "is_active": False,
    },
    {
        "name": "Jenny's Dispensary - Henderson",
        "slug": "jennys-henderson",
        "platform": "jane",
        "url": "https://jennysdispensary.com/henderson-menu/",
        "is_active": False,
    },
    {
        "name": "Jenny's Dispensary - North Las Vegas",
        "slug": "jennys-north-lv",
        "platform": "jane",
        "url": "https://jennysdispensary.com/north-las-vegas-menu/",
        "is_active": False,
    },
    {
        "name": "Silver Sage Wellness",
        "slug": "silver-sage",
        "platform": "jane",
        "url": "https://silversagewellness.com/menu/",
        "is_active": False,
    },
    {
        "name": "Pisos",
        "slug": "pisos",
        "platform": "jane",
        "url": "https://pisoslv.com/menu/",
        "is_active": False,
    },
    {
        "name": "Green Therapeutics",
        "slug": "green-therapeutics",
        "platform": "jane",
        "url": "https://greentherapeutics.com/menu/",
        "is_active": False,
    },
    {
        "name": "Las Vegas ReLeaf",
        "slug": "lv-releaf",
        "platform": "jane",
        "url": "https://lasvegasreleaf.com/menu/",
        "is_active": False,
    },
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
