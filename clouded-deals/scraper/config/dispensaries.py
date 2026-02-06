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

# Per-site scrape timeout in seconds.  Must accommodate the 45 s
# post-age-gate wait for Dutchie sites plus iframe loading + pagination.
SITE_TIMEOUT_SEC = 180

# ---------------------------------------------------------------------------
# Platform-level configuration
# ---------------------------------------------------------------------------

PLATFORM_DEFAULTS = {
    "dutchie": {
        "wait_after_age_gate_sec": 45,
        "wait_after_iframe_found_sec": 5,
        "pagination": "aria-label",       # paginate via aria-label buttons
        "between_pages_sec": 5,
        "embed_type": "iframe",
    },
    "curaleaf": {
        "wait_after_age_gate_sec": 30,
        "embed_type": "direct",
    },
    "jane": {
        "wait_after_age_gate_sec": 10,
        "pagination": "view_more",        # click "View More" button
        "between_view_more_sec": 1.5,
        "embed_type": "hybrid",           # iframe or direct depending on site
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
    # DUTCHIE / TD SITES — core 3 (MVP)
    # ------------------------------------------------------------------
    {
        "name": "The Dispensary NV - Gibson",
        "slug": "td-gibson",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "The Dispensary NV - Eastern",
        "slug": "td-eastern",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },
    {
        "name": "The Dispensary NV - Decatur",
        "slug": "td-decatur",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",
        "is_active": True,
    },

    # ------------------------------------------------------------------
    # DUTCHIE / TD SITES — expansion (deactivated until verified)
    # ------------------------------------------------------------------
    {
        "name": "The Dispensary NV - Henderson",
        "slug": "td-henderson",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-henderson/?dtche%5Bpath%5D=specials",
        "is_active": False,  # not in core MVP
    },
    {
        "name": "The Dispensary NV - Reno",
        "slug": "td-reno",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-reno/?dtche%5Bpath%5D=specials",
        "is_active": False,  # not in core MVP
    },
    {
        "name": "Jardín Premium Cannabis Dispensary",
        "slug": "jardin",
        "platform": "dutchie",
        "url": "https://jardinlasvegas.com/shop/?dtche%5Bpath%5D=specials",
        "is_active": False,  # redirects to different page, no Dutchie iframe
    },
    {
        "name": "Essence Cannabis Dispensary - The Strip",
        "slug": "essence-strip",
        "platform": "dutchie",
        "url": "https://essencevegas.com/strip/?dtche%5Bpath%5D=specials",
        "is_active": False,  # redirects to risecannabis.com
    },
    {
        "name": "Essence Cannabis Dispensary - Tropicana",
        "slug": "essence-tropicana",
        "platform": "dutchie",
        "url": "https://essencevegas.com/tropicana/?dtche%5Bpath%5D=specials",
        "is_active": False,  # redirects to risecannabis.com
    },
    {
        "name": "Essence Cannabis Dispensary - Henderson",
        "slug": "essence-henderson",
        "platform": "dutchie",
        "url": "https://essencevegas.com/henderson/?dtche%5Bpath%5D=specials",
        "is_active": False,  # redirects to risecannabis.com
    },
    {
        "name": "Thrive Cannabis Marketplace",
        "slug": "thrive",
        "platform": "dutchie",
        "url": "https://thrivecannabismarketplace.com/shop/?dtche%5Bpath%5D=specials",
        "is_active": False,  # times out consistently
    },

    # ------------------------------------------------------------------
    # CURALEAF SITES — core 4 (MVP, updated URLs)
    # ------------------------------------------------------------------
    {
        "name": "Curaleaf - Western Ave",
        "slug": "curaleaf-western",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/nevada/curaleaf-las-vegas-western-ave-(formerly-acres)/specials",
        "is_active": True,
    },
    {
        "name": "Curaleaf - North Las Vegas",
        "slug": "curaleaf-north-lv",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/nevada/curaleaf-north-las-vegas/specials",
        "is_active": True,
    },
    {
        "name": "Curaleaf - The Reef",
        "slug": "curaleaf-the-reef",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/nevada/reef-dispensary-las-vegas-strip/specials",
        "is_active": True,
    },
    {
        "name": "Curaleaf - Las Vegas Strip",
        "slug": "curaleaf-strip",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/shop/nevada/curaleaf-nv-las-vegas/specials",
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
