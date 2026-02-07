"""
Dispensary configuration for all 27 Las Vegas locations across 3 platforms.

Platforms:
  - dutchie: iframe-based menus (Dutchie/TD sites)
  - curaleaf: direct page loads with state selection
  - jane: hybrid iframe/direct with "View More" pagination
"""

# ---------------------------------------------------------------------------
# Browser / Playwright defaults
# ---------------------------------------------------------------------------

BROWSER_ARGS = [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
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

# ---------------------------------------------------------------------------
# Platform-level configuration
# ---------------------------------------------------------------------------

PLATFORM_DEFAULTS = {
    "dutchie": {
        "wait_after_age_gate_sec": 60,
        "pagination": "aria-label",       # paginate via aria-label buttons
        "embed_type": "iframe",
    },
    "curaleaf": {
        "wait_after_load_sec": 30,
        "state_selection": "Nevada",
        "embed_type": "direct",
    },
    "jane": {
        "pagination": "view_more",        # click "View More" button
        "embed_type": "hybrid",           # iframe or direct depending on site
    },
}

# ---------------------------------------------------------------------------
# Dispensary definitions — 27 locations
# ---------------------------------------------------------------------------

DISPENSARIES = [
    # ------------------------------------------------------------------
    # DUTCHIE / TD SITES  (10)
    # ------------------------------------------------------------------
    {
        "name": "The Dispensary NV - Gibson",
        "slug": "td-gibson",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "The Dispensary NV - Eastern",
        "slug": "td-eastern",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "The Dispensary NV - Decatur",
        "slug": "td-decatur",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "The Dispensary NV - Henderson",
        "slug": "td-henderson",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-henderson/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "The Dispensary NV - Reno",
        "slug": "td-reno",
        "platform": "dutchie",
        "url": "https://thedispensarynv.com/shop-reno/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "Jardín Premium Cannabis Dispensary",
        "slug": "jardin",
        "platform": "dutchie",
        "url": "https://jardinlasvegas.com/shop/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "Essence Cannabis Dispensary - The Strip",
        "slug": "essence-strip",
        "platform": "dutchie",
        "url": "https://essencevegas.com/strip/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "Essence Cannabis Dispensary - Tropicana",
        "slug": "essence-tropicana",
        "platform": "dutchie",
        "url": "https://essencevegas.com/tropicana/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "Essence Cannabis Dispensary - Henderson",
        "slug": "essence-henderson",
        "platform": "dutchie",
        "url": "https://essencevegas.com/henderson/?dtche%5Bpath%5D=specials",
    },
    {
        "name": "Thrive Cannabis Marketplace",
        "slug": "thrive",
        "platform": "dutchie",
        "url": "https://thrivecannabismarketplace.com/shop/?dtche%5Bpath%5D=specials",
    },

    # ------------------------------------------------------------------
    # CURALEAF SITES  (4)
    # ------------------------------------------------------------------
    {
        "name": "Curaleaf - Western Ave",
        "slug": "curaleaf-western",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-las-vegas-western-ave-(formerly-acres)/specials",
    },
    {
        "name": "Curaleaf - North Las Vegas",
        "slug": "curaleaf-north-lv",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-north-las-vegas/specials",
    },
    {
        "name": "Curaleaf - The Reef",
        "slug": "curaleaf-the-reef",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/reef-dispensary-las-vegas-strip/specials",
    },
    {
        "name": "Curaleaf - Las Vegas Strip",
        "slug": "curaleaf-strip",
        "platform": "curaleaf",
        "url": "https://curaleaf.com/stores/curaleaf-nv-las-vegas/specials",
    },

    # ------------------------------------------------------------------
    # JANE SITES  (13)
    # ------------------------------------------------------------------
    {
        "name": "Oasis Cannabis",
        "slug": "oasis",
        "platform": "jane",
        "url": "https://www.oasiscannabis.com/las-vegas-cannabis-dispensary",
    },
    {
        "name": "Planet 13",
        "slug": "planet-13",
        "platform": "jane",
        "url": "https://planet13lasvegas.com/menu/",
    },
    {
        "name": "Reef Dispensaries",
        "slug": "reef",
        "platform": "jane",
        "url": "https://www.reefdispensaries.com/las-vegas-menu/",
    },
    {
        "name": "ShowGrow",
        "slug": "showgrow",
        "platform": "jane",
        "url": "https://showgrow.com/las-vegas-menu/",
    },
    {
        "name": "Zen Leaf - Las Vegas",
        "slug": "zen-leaf-lv",
        "platform": "jane",
        "url": "https://zenleafdispensaries.com/locations/nevada/las-vegas/menu/",
    },
    {
        "name": "NuWu Cannabis Marketplace",
        "slug": "nuwu",
        "platform": "jane",
        "url": "https://nuwucannabis.com/menu/",
    },
    {
        "name": "Acres Cannabis",
        "slug": "acres",
        "platform": "jane",
        "url": "https://acrescannabis.com/menu/",
    },
    {
        "name": "Jenny's Dispensary - Henderson",
        "slug": "jennys-henderson",
        "platform": "jane",
        "url": "https://jennysdispensary.com/henderson-menu/",
    },
    {
        "name": "Jenny's Dispensary - North Las Vegas",
        "slug": "jennys-north-lv",
        "platform": "jane",
        "url": "https://jennysdispensary.com/north-las-vegas-menu/",
    },
    {
        "name": "Silver Sage Wellness",
        "slug": "silver-sage",
        "platform": "jane",
        "url": "https://silversagewellness.com/menu/",
    },
    {
        "name": "Pisos",
        "slug": "pisos",
        "platform": "jane",
        "url": "https://pisoslv.com/menu/",
    },
    {
        "name": "Green Therapeutics",
        "slug": "green-therapeutics",
        "platform": "jane",
        "url": "https://greentherapeutics.com/menu/",
    },
    {
        "name": "Las Vegas ReLeaf",
        "slug": "lv-releaf",
        "platform": "jane",
        "url": "https://lasvegasreleaf.com/menu/",
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
