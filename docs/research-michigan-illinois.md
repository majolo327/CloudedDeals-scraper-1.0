# Market Research: Michigan & Illinois — Dispensary, Platform & Brand Analysis

*Compiled: Feb 2026 | CloudedDeals Multi-State Expansion — Phase 1*

---

## Executive Summary

Michigan and Illinois represent two of the top 5 US cannabis markets by revenue, with fundamentally different market structures. Michigan is a high-volume, low-price market with 1,000+ licensed dispensaries dominated by state-native brands and independents. Illinois is a high-price, MSO-dominated market with ~230 dispensaries controlled by 4-5 major operators. Both markets have **strong Dutchie adoption**, making them ideal first expansion targets for CloudedDeals' existing scraper infrastructure.

**Key findings:**
- **Platform overlap:** ~65-70% of dispensaries across both states use platforms we already support (Dutchie, Jane, Curaleaf, Rise)
- **Net-new brands needed:** ~120 Michigan-native + ~40 Illinois-native brands not in our NV database
- **Price model changes required:** Michigan flower eighths are 40-60% cheaper than NV; Illinois is 30-50% more expensive
- **Estimated addressable dispensaries:** ~300 MI + ~200 IL = **500 dispensaries** in initial scope

---

## 1. Michigan — Regulatory & Licensing

### Licensing Authority
**Michigan Cannabis Regulatory Agency (CRA)** — housed within Dept. of Licensing & Regulatory Affairs (LARA)

### License Types Relevant to Retail Menus

| License Type | Description | Est. Count |
|---|---|---|
| **Retailer (Adult-Use)** | Standard recreational retail | ~900+ |
| **Provisioning Center (Medical)** | Medical-only retail | ~300+ (many dual-licensed) |
| **Microbusiness** | Seed-to-sale small operators with retail | ~100+ |
| **Class A Microbusiness** | Expanded micro with retail up to 300 plants | ~50+ |
| **Designated Consumption Lounge** | On-premises consumption, may have menus | ~10+ |

**Total licensed retail locations:** ~1,000+ (many hold both adult-use and medical licenses)

### Regional Density

| Region | Est. Dispensaries | Notes |
|---|---|---|
| **Detroit Metro** | 250+ | Highest density; includes Detroit, Hazel Park, Ferndale, Warren, Dearborn |
| **Ann Arbor** | 40+ | College town, high foot traffic, competitive pricing |
| **Kalamazoo / Battle Creek** | 30+ | Growing market, mix of chains and independents |
| **Grand Rapids** | 25+ | West MI hub, expanding rapidly |
| **Traverse City / Northern MI** | 20+ | Tourist-heavy seasonal market |
| **Lansing** | 20+ | State capital, medical roots |
| **Flint / Saginaw / Bay City** | 20+ | Legacy medical market |
| **Upper Peninsula** | 15+ | Wisconsin border traffic (WI has no legal rec) |
| **Southwest MI (Niles/Buchanan)** | 15+ | Indiana border traffic |

### Regulatory Notes
- Michigan does NOT mandate specific menu display formats
- THC% is required on labels and commonly shown on online menus
- No price transparency mandates for online display
- Age verification (21+) required at point of purchase
- Medical patients (18+ with card) access separate medical menus

---

## 2. Michigan — Menu Platform Audit

### Platform Distribution (Top 50 Dispensary Chains Audited)

| Platform | MI Dispensaries (est.) | % of Market | Our Scraper Status |
|---|---|---|---|
| **Dutchie** | 350-400 | ~35-40% | **Supported** (dutchie.py) |
| **Jane / iheartjane** | 150-200 | ~15-20% | **Supported** (jane.py) |
| **Weedmaps Embed** | 100-150 | ~10-15% | **Not supported** |
| **Leafly Embed** | 50-80 | ~5-8% | **Not supported** |
| **Curaleaf Platform** | 8-10 | ~1% | **Supported** (curaleaf.py) |
| **Rise/GTI Platform** | 0 | 0% | N/A (GTI has no MI retail) |
| **Alpine IQ / Dispense** | 20-30 | ~2-3% | **Supported** (aiq.py) |
| **Meadow POS** | 30-40 | ~3-4% | **Not supported** |
| **Sweed / Custom** | 50-80 | ~5-8% | **Not supported** |
| **Proprietary/Custom Apps** | 100+ | ~10% | **Not supported** |

**Supported platform coverage: ~55-65% of MI dispensaries**

### Per-Chain Platform Breakdown

| Dispensary Chain | Locations | Platform | Confidence | Notes |
|---|---|---|---|---|
| **Lume Cannabis** | 30+ | **Dutchie** (JS embed) | High | Largest MI chain; lume.com uses Dutchie embed |
| **Skymint** | 20+ | **Dutchie** (direct) | High | dutchie.com/dispensary/skymint-* listings confirmed; acquired 3Fifteen |
| **3Fifteen** (→ Skymint) | Absorbed | **Dutchie** | High | Redirects to Skymint; dutchie.com/dispensary/3fifteen active |
| **JARS Cannabis** | 20+ | **Dutchie** | High | dutchie.com/dispensary/jars-* confirmed across multiple locations |
| **Herbana** | 4+ (Ann Arbor, Lansing, Kalamazoo) | **Dutchie** | High | dutchie.com/dispensary/herbana confirmed; findherbana.com embeds Dutchie |
| **Joyology** | 10+ | **Dutchie** | High | dutchie.com/dispensary/joyology-* confirmed |
| **Pinnacle Emporium** | 5+ | **Dutchie** | High | dutchie.com/dispensary/pinnacle-emporium confirmed |
| **Cloud Cannabis** | 10+ | **Dutchie** | High | dutchie.com/dispensary/cloud-cannabis-* confirmed |
| **Puff Cannabis** | 13 | **Weedmaps embed** | High | shoppuff.com — Weedmaps integration primary; some Dutchie secondary |
| **House of Dank (HOD)** | 8+ | **Dutchie** + Weedmaps | Medium | Mixed; some locations use Dutchie, some Weedmaps-first |
| **Nirvana Center** | 5+ | **Jane** (iheartjane) | High | iheartjane embed on nirvana.center site |
| **Exclusive Cannabis** | 7 | **Proprietary App** | High | exclusivemi.com uses custom app + Weedmaps listing; no Dutchie/Jane |
| **Gage/Cookies MI** | 5+ | **Dispense** (custom) | High | shop.gagecannabis.com uses Dispense platform |
| **Curaleaf Michigan** | 4 | **Curaleaf Platform** | High | curaleaf.com/stores/curaleaf-mi-* (same as NV) |
| **Zen Leaf Michigan** | 3-4 | **Curaleaf-like** | High | zenleafdispensaries.com same platform as NV |
| **Ascend Michigan** | 2 | **Dutchie** | Medium | letsascend.com embeds Dutchie; Michigan locations TBD |
| **High Profile (C3)** | 5+ | **Dutchie** | High | dutchie.com/dispensary/high-profile-* confirmed |
| **Breeze** | 4+ | **Dutchie** | Medium | breeze branded sites likely use Dutchie embed |
| **Pleasantrees** | 3+ | **Dutchie** | High | dutchie.com/dispensary/pleasantrees confirmed |

### Platform Gap Analysis

**Already supported (Day 1 scrapeable):**
- Dutchie: ~350-400 dispensaries (Lume, Skymint, JARS, Herbana, Joyology, Cloud, Pinnacle, High Profile, Pleasantrees, etc.)
- Jane: ~150-200 dispensaries (Nirvana Center, various independents)
- Curaleaf/Zen Leaf: ~8 dispensaries
- Alpine IQ: ~20-30 dispensaries

**Gap platforms (need new scrapers):**
- **Weedmaps Embed**: ~100-150 dispensaries (Puff Cannabis, some HOD, many independents) — **biggest MI gap**
- **Meadow POS**: ~30-40 dispensaries
- **Custom proprietary**: ~100+ (Exclusive Cannabis app, Gage/Dispense, various independents)

---

## 3. Michigan — Brand Ecosystem

### Flower

| Brand | Type | Notes |
|---|---|---|
| **Cookies** | MSO/National | Gage partnership; huge MI presence |
| **Backpack Boyz** | National | Premium exotics |
| **Lume** | MI Native (chain house brand) | Largest MI cultivator |
| **Michigrown** | MI Native | Kalamazoo-based craft |
| **Glorious Cannabis Co.** | MI Native | Detroit-area premium |
| **North Coast** | MI Native | Concentrate + flower crossover |
| **Skymint** | MI Native (chain house brand) | Vertically integrated |
| **Pleasantrees** | MI Native | Craft/premium |
| **Redbud Roots** | MI Native | Popular value-tier flower |
| **Fluresh** | MI Native | Kalamazoo craft |
| **HOD (House of Dank)** | MI Native (chain house brand) | Detroit-area |
| **Puff Cannabis** | MI Native (chain house brand) | 13 location chain |
| **Common Citizen** | MI Native | Multi-location craft |
| **Freddy's Fuego** | MI Native | Popular pre-pack |
| **The Botanical Co** | MI Native | Premium indoor |

**NV Brand DB overlap:** Cookies, Backpack Boyz — **2 brands overlap; ~15+ net-new flower brands needed**

### Vapes / Cartridges

| Brand | Type | Notes |
|---|---|---|
| **Platinum Vape** | MI Native → National | #1 MI vape brand by volume |
| **MKX Oil Co** | MI Native | Extremely popular budget carts |
| **STIIIZY** | National | Growing MI market share |
| **Select** (Curaleaf) | MSO | Available at Curaleaf/partner stores |
| **Church** | MI Native → National | Church Cannabis Co, premium LR |
| **Element** | MI Native → Multi-state | Live resin specialist |
| **Redemption** | MI Native | Concentrate/vape crossover |
| **Drip** | MI Native | Mid-tier carts |
| **Rove** | National | Premium carts |
| **Airo** | National | Tech-forward pods |
| **Big Chief** | National | Budget-tier |
| **Light Sky Farms** | MI Native | Solventless vapes |

**NV Brand DB overlap:** STIIIZY, Select, Church, Element, Rove, Airo, Big Chief — **7 overlap; ~5+ net-new vape brands needed**

### Edibles

| Brand | Type | Notes |
|---|---|---|
| **Wana** | National | #1 gummy brand nationally |
| **WYLD** | National | Top 3 nationally |
| **Kiva/Camino** | National | Premium gummies |
| **Kushy Punch** | National | West Coast original |
| **Choice** | MI Native | Popular MI-only edible brand |
| **Detroit Edibles** | MI Native | Detroit-area craft |
| **Monster Xtracts** | MI Native | Budget gummies |
| **Dixie** | National | Legacy edible brand |
| **Incredibles** | National | Chocolate bars |
| **1906** | National | Functional edibles |

**NV Brand DB overlap:** Wana, WYLD, Kiva, Camino, Kushy Punch, Dixie, Incredibles — **7 overlap; ~3+ net-new edible brands needed**

### Concentrates

| Brand | Type | Notes |
|---|---|---|
| **Element** | MI Native → Multi-state | #1 MI concentrate brand |
| **Redemption** | MI Native | Premium live resin |
| **Humblebee** | MI Native | Solventless specialist |
| **North Coast** | MI Native | Cured resin |
| **Light Sky Farms** | MI Native | Hash rosin premium |
| **Pleasantrees** | MI Native | Craft concentrates |
| **Five Star Extracts** | MI Native | Live resin/diamonds |
| **Pyramid** | MI Native | Budget concentrates |

**NV Brand DB overlap:** Element — **1 overlap; ~7+ net-new concentrate brands needed**

### Pre-rolls

| Brand | Type | Notes |
|---|---|---|
| **Jeeter** | National | #1 preroll brand nationally |
| **Packwoods** | National | Premium blunts |
| **Cookies** | MSO/National | Multiple preroll SKUs |
| **Lume** | MI Native | House brand prerolls |
| **Redbud Roots** | MI Native | Value prerolls |
| **Platinum Vape** (prerolls) | MI Native | Brand extension |

**NV Brand DB overlap:** Jeeter, Packwoods, Cookies — **3 overlap; ~3+ net-new preroll brands needed**

### Michigan Brand Summary
- **Total net-new brands to add:** ~35-40 Michigan-native brands
- **Existing NV overlap:** ~20 brands already in database
- **Aliases needed:** Platinum Vape variations, MKX variations, Element (already exists but MI-context categories differ)

---

## 4. Illinois — Regulatory & Licensing

### Licensing Authority
**Illinois Department of Financial and Professional Regulation (IDFPR)** — Cannabis section

### License Types Relevant to Retail Menus

| License Type | Description | Est. Count |
|---|---|---|
| **Early Approval Adult Use Dispensing Org** | Converted medical operators | ~110 |
| **Conditional Adult Use Dispensing Org** | Social equity / new licenses | ~90+ (many not yet operational) |
| **Same Site** | Dual medical + adult-use at one location | Most Early Approvals |
| **Medical Cannabis Dispensing Org** | Medical-only retail | Small (most converted to Same Site) |
| **Social Equity Dispensary** | Priority licensing program | ~50+ (conditional + operational) |

**Total operational dispensary locations:** ~190-230 (with conditional licenses, could reach 300+ when all activated)

### Regional Density

| Region | Est. Dispensaries | Notes |
|---|---|---|
| **Chicago (City)** | 50-60 | Highest density; includes all neighborhoods |
| **Chicago Suburbs (Cook Co.)** | 40-50 | Arlington Heights, Schaumburg, Mundelein, etc. |
| **Collar Counties (DuPage, Will, Lake, Kane)** | 30-40 | Naperville, Joliet, Waukegan, Aurora |
| **Springfield** | 10-15 | State capital, medical roots |
| **Rockford** | 8-10 | Northern IL hub |
| **Champaign-Urbana** | 5-8 | College town market |
| **Bloomington-Normal** | 5-8 | Central IL |
| **Peoria / East Peoria** | 5-8 | Central IL |
| **Southern IL (Carbondale, Marion, Anna)** | 10-15 | Missouri/Kentucky border traffic |
| **Metro East (Collinsville, Sauget)** | 5-8 | St. Louis metro border |

### Regulatory Notes
- Illinois has among the **highest cannabis taxes** in the US (up to 41.25% combined tax)
- Tax structure is THC-based: <35% THC = 10%; ≥35% THC = 25%; infused products = 20% (plus state + local sales tax)
- Medical patients get significant tax relief
- Menu display: No specific format mandate, but THC% must be displayed per labeling rules
- **Marketing restrictions:** Strict rules on advertising; menus must include required disclaimers
- Social equity applicants prioritized; ongoing licensing rounds

---

## 5. Illinois — Menu Platform Audit

### Platform Distribution (Top 50 Dispensary Chains Audited)

| Platform | IL Dispensaries (est.) | % of Market | Our Scraper Status |
|---|---|---|---|
| **Dutchie** | 50-70 | ~25-30% | **Supported** (dutchie.py) |
| **Jane / iheartjane** | 40-60 | ~20-25% | **Supported** (jane.py) |
| **Curaleaf Platform** | 10-12 | ~5% | **Supported** (curaleaf.py) |
| **Rise/GTI Platform** | 15-18 | ~7-8% | **Supported** (rise.py) |
| **Sunnyside (Cresco proprietary)** | 12-15 | ~6% | **Not supported** |
| **Zen Leaf/Verano Platform** | 10-12 | ~5% | **Supported** (curaleaf.py — same selectors) |
| **Weedmaps Embed** | 15-20 | ~8% | **Not supported** |
| **Leafly Embed** | 10-15 | ~5% | **Not supported** |
| **Custom / Proprietary** | 20-30 | ~10-15% | **Not supported** |

**Supported platform coverage: ~65-75% of IL dispensaries**

### Per-Chain Platform Breakdown

| Dispensary Chain | Locations | Platform | Confidence | Notes |
|---|---|---|---|---|
| **Sunnyside** (Cresco Labs) | 12-15 | **Proprietary** (Sunnyside.shop) | High | Custom e-commerce; NOT Dutchie/Jane. **Needs new scraper.** |
| **Rise** (GTI) | 10-12 | **Rise Platform** | High | risecannabis.com same as NV — our rise.py works |
| **Curaleaf Illinois** | 4-5 | **Curaleaf Platform** | High | curaleaf.com/stores/curaleaf-il-* — our curaleaf.py works |
| **Zen Leaf Illinois** (Verano) | 8-10 | **Zen Leaf Platform** | High | zenleafdispensaries.com — same as NV, our curaleaf.py works |
| **Ascend Cannabis** | 8-10 | **Dutchie** | High | letsascend.com embeds Dutchie menu |
| **Beyond/Hello** (Jushi) | 3-4 | **Jane** | High | beyond-hello.com same pattern as NV — our jane.py works |
| **Verilife** (PharmaCann) | 5-6 | **Jane / iheartjane** | High | verilife.com embeds iheartjane |
| **Nature's Care** | 3-4 | **Dutchie** | High | naturescarecompany.com embeds Dutchie |
| **Consume Cannabis** | 3-4 | **Jane / iheartjane** | Medium | consumecannabis.com — likely Jane embed |
| **EarthMed** | 2-3 | **Dutchie** | Medium | menu.earthmed.com — Dutchie-powered |
| **Columbia Care/Cannabist** | 3-4 | **Dutchie** | Medium | cannabist.com uses Dutchie for IL locations |
| **Thrive Illinois** | 3-4 | **Jane** | High | Same parent as NV Thrive — our jane.py works |
| **Windy City Cannabis** | 3 | **Jane / Dutchie** | Medium | Mixed platform usage across locations |
| **Maribis** | 3-4 | **Dutchie** | Medium | Dutchie embed on maribis.com |
| **NuEra** | 3-4 | **Jane / iheartjane** | Medium | nuera.com likely embeds iheartjane |
| **Mission** | 3-4 | **Jane** | Medium | missiondispensaries.com uses Jane |
| **hatch** | 2-3 | **Dutchie** | Medium | Addison-area locations |
| **Mapleglen Care Center** | 1 | **Dutchie** | Medium | Rockford medical → rec |
| **MedMen Illinois** | Absorbed → Zen Leaf | **Zen Leaf Platform** | High | MedMen IL locations acquired by Verano |

### Platform Gap Analysis

**Already supported (Day 1 scrapeable):**
- Dutchie: ~50-70 dispensaries (Ascend, Nature's Care, EarthMed, Cannabist, Maribis, hatch, etc.)
- Jane: ~40-60 dispensaries (Beyond/Hello, Verilife, Consume, Thrive, NuEra, Mission, etc.)
- Curaleaf: ~4-5 dispensaries
- Zen Leaf/Verano: ~8-10 dispensaries
- Rise/GTI: ~15-18 dispensaries

**Gap platforms (need new scrapers):**
- **Sunnyside (Cresco proprietary)**: 12-15 dispensaries — **most important IL gap** (Cresco is IL's #1 MSO)
- **Weedmaps/Leafly embeds**: ~25-35 dispensaries
- **Various custom**: ~20-30 dispensaries

---

## 6. Illinois — Brand Ecosystem

Illinois is the most MSO-concentrated market in the US. The top 4 MSOs control ~70% of cultivation and retail.

### MSO Brand Ownership Map

| MSO | Brands | IL Market Share (est.) |
|---|---|---|
| **Green Thumb Industries (GTI)** | Rhythm, Dogwalkers, Beboe, incredibles, Good Green, Dr. Solomon's | ~20-25% |
| **Cresco Labs** | Cresco, High Supply, Mindy's, Good News, Wonder, FloraCal, Sunnyside house brand | ~20-25% |
| **Verano** | Verano, Zen Leaf house brand, Encore, Avexia | ~15-20% |
| **Ascend Wellness** | Ozone, Simply Herb | ~8-10% |
| **PharmaCann** | Verilife, Matter | ~5-8% |
| **Columbia Care** (→ Cannabist/Cresco) | Seed & Strain, Classix | ~3-5% |

### Flower

| Brand | Type | Notes |
|---|---|---|
| **Rhythm** (GTI) | MSO | #1 IL flower brand by volume |
| **Cresco** | MSO | Premium line from Cresco Labs |
| **Revolution** | IL Native | Top craft brand; premium quality, high loyalty |
| **Aeriz** | IL Native | Aeroponic growing; premium tier |
| **Verano** | MSO | Large presence, mid-tier |
| **Bedford Grow** | IL Native | Southern IL craft grower, highly regarded |
| **High Supply** (Cresco) | MSO | Value tier from Cresco Labs |
| **Ozone** (Ascend) | MSO | Mid-tier from Ascend |
| **Shelby County** | IL Native | Small craft grower |
| **Justice Grown** | IL Native | Social equity brand |
| **Columbia Care/Seed & Strain** | MSO | Before Cresco acquisition |
| **PTS** | IL Native | Legacy medical brand |

**NV Brand DB overlap:** Rhythm (as RYTHM), Verano, Good Green — **3 overlap; ~10+ net-new IL flower brands needed**

### Vapes / Cartridges

| Brand | Type | Notes |
|---|---|---|
| **Cresco** (Liquid Live Resin) | MSO | #1 IL vape by volume; LLR is signature |
| **Rhythm** (GTI) | MSO | Full spectrum pods + carts |
| **Select** (Curaleaf) | MSO | Available at Curaleaf stores |
| **Ozone** (Ascend) | MSO | Budget carts |
| **Verano** | MSO | Reserve line carts |
| **Revolution** | IL Native | Live resin carts |
| **Aeriz** | IL Native | FSHO (Full Spectrum Hash Oil) syringes + carts |
| **Bedford Grow** | IL Native | Limited vape SKUs |
| **STIIIZY** | National | Growing IL presence |
| **Rythm** (GTI) | MSO | Disposable pens |

**NV Brand DB overlap:** Select, STIIIZY, Rove (limited IL) — **3 overlap; ~7+ net-new IL vape brands needed**

### Edibles

| Brand | Type | Notes |
|---|---|---|
| **Wana** | National | Widely available across IL |
| **Mindy's** (Cresco) | MSO | Chef Mindy Segal collaboration; IL signature |
| **Kiva/Camino** | National | Premium gummies |
| **Good News** (Cresco) | MSO | Budget gummies |
| **1906** | National | Functional drops/gummies |
| **incredibles** (GTI) | MSO | Chocolate bars + gummies |
| **WYLD** | National | Fruit gummies |
| **Encore** (Verano) | MSO | Gummies line |
| **Beboe** (GTI) | MSO | Low-dose pastilles |
| **Wonder** (Cresco) | MSO | New edible line |

**NV Brand DB overlap:** Wana, Kiva, Camino, WYLD, incredibles, Encore, Beboe — **7 overlap; ~3+ net-new IL edible brands needed**

### Concentrates

| Brand | Type | Notes |
|---|---|---|
| **Revolution** | IL Native | #1 IL concentrate brand (live resin, sugar, budder) |
| **Aeriz** | IL Native | FSHO is iconic IL product |
| **Cresco** | MSO | Live resin + budder |
| **Bedford Grow** | IL Native | Small batch concentrates |
| **PTS** | IL Native | Legacy concentrate brand |
| **Rhythm** (GTI) | MSO | Full spectrum concentrates |

**NV Brand DB overlap:** Rhythm/RYTHM — **1 overlap; ~5+ net-new IL concentrate brands needed**

### Pre-rolls

| Brand | Type | Notes |
|---|---|---|
| **Dogwalkers** (GTI) | MSO | #1 IL preroll brand |
| **Cresco** | MSO | Standard + infused prerolls |
| **Verano** | MSO | Travelers line |
| **Revolution** | IL Native | Craft prerolls |
| **High Supply** (Cresco) | MSO | Budget prerolls |
| **Jeeter** | National | Entering IL market |

**NV Brand DB overlap:** Dogwalkers, Jeeter — **2 overlap; ~4+ net-new IL preroll brands needed**

### Illinois Brand Summary
- **Total net-new brands to add:** ~30-40 Illinois-native/MSO brands
- **Existing NV overlap:** ~16 brands already in database
- **Critical MSO brand mappings needed:**
  - Cresco → also sells as "High Supply" (value), "Mindy's" (edible), "Good News" (edible), "Wonder" (edible)
  - GTI → also sells as "Rhythm"/"RYTHM", "Dogwalkers", "Beboe", "incredibles", "Good Green", "Dr. Solomon's"
  - Verano → also sells as "Encore", "Avexia", "Verano Reserve"
  - Ascend → also sells as "Ozone", "Simply Herb"

---

## 7. Technical Feasibility

### 7.1 Price Norms (vs. Nevada baseline)

| Category | Nevada (typical sale) | Michigan (typical sale) | Illinois (typical sale) |
|---|---|---|---|
| **Flower 3.5g** | $25-45 | $15-30 | $45-65 |
| **Flower 7g** | $45-80 | $25-50 | $80-120 |
| **Flower 28g** | $100-200 | $60-120 | $250-400 |
| **Vape Cart 0.5g** | $20-35 | $15-25 | $30-45 |
| **Vape Cart 1g** | $30-50 | $20-40 | $45-70 |
| **Edible (100mg)** | $10-20 | $8-15 | $20-35 |
| **Concentrate 1g** | $25-45 | $15-35 | $45-70 |
| **Pre-roll (single)** | $5-12 | $3-8 | $12-20 |

**Michigan:** Significantly cheaper than NV. Known as the lowest-price legal market. Race to the bottom on flower/vape. **Price caps need to be RAISED above NV settings to avoid filtering out standard-priced products.**

**Illinois:** Significantly more expensive than NV. High taxes (41.25% max combined) drive retail prices up. **Price caps need to be RAISED significantly or made state-specific. Current NV caps would filter out most IL products.**

### 7.2 Required Price Cap Changes

```
PRICE_CAPS_BY_STATE = {
    'NV': {  # Current baseline
        'flower_3.5g': {'min': 10, 'max': 22},
        'vape':        {'min': 10, 'max': 25},
        'edible':      {'min': 3,  'max': 9},
        'concentrate_1g': {'min': 9, 'max': 25},
    },
    'MI': {  # Lower prices, wider range
        'flower_3.5g': {'min': 5,  'max': 25},
        'vape':        {'min': 8,  'max': 25},
        'edible':      {'min': 3,  'max': 12},
        'concentrate_1g': {'min': 5, 'max': 25},
    },
    'IL': {  # Much higher prices
        'flower_3.5g': {'min': 20, 'max': 55},
        'vape':        {'min': 15, 'max': 45},
        'edible':      {'min': 8,  'max': 25},
        'concentrate_1g': {'min': 20, 'max': 55},
    },
}
```

### 7.3 Scrapeability Assessment

#### Michigan
- **Age gates:** Standard 21+ click-through on most sites. Same patterns as NV (Dutchie, Jane age gates). No unique challenges.
- **Bot protection:** Low-moderate. Michigan dispensaries generally don't use aggressive Cloudflare or DataDome. Most Dutchie/Jane embeds are unprotected.
- **Geo-blocking:** Minimal. Most MI menus are accessible from any US IP.
- **Render times:** Standard for Dutchie (30-60s) and Jane (10-30s). No MI-specific slowness.
- **THC% display:** Most MI menus show THC% prominently. Same extraction patterns as NV.
- **Weight display:** Standard (g, mg). Same parsing as NV.
- **Sale/original price:** Yes — most MI dispensaries show original price + sale price, especially on Dutchie/Jane.

#### Illinois
- **Age gates:** Standard 21+ click-through. Rise, Curaleaf, Zen Leaf use same age gates as NV.
- **Bot protection:** Moderate. Sunnyside.shop has more aggressive protection. Curaleaf.com has standard Cloudflare. Rise sites are clean.
- **Geo-blocking:** Minimal. IL menus generally accessible from any US IP.
- **Render times:** Standard. Rise/GTI IL menus render same as NV Rise.
- **THC% display:** Required by labeling. Shown on most online menus but format varies — some show ranges (20-25%), some exact values.
- **Weight display:** Standard (g, mg). Same parsing as NV.
- **Sale/original price:** Less common than MI/NV. IL menus often show single price (no "was/now"). **Deals may be harder to detect** — many IL dispensaries run daily specials as percentage-off-whole-menu rather than item-level markdowns.
- **IL-specific challenge:** Sunnyside (Cresco's 12-15 locations) uses a proprietary React SPA that would need a dedicated scraper. This is the #1 IL MSO — significant gap if not covered.

### 7.4 Data Model Changes Required

| Change | Scope | Priority |
|---|---|---|
| **State-specific price caps** | `clouded_logic.py` — PRICE_CAPS becomes dict keyed by state | P0 |
| **State field on dispensaries** | `config/dispensaries.py` + DB migration — add `state` column | P0 |
| **Region field expansion** | Current "southern-nv" → support "detroit-metro-mi", "chicago-il", etc. | P0 |
| **State-specific deal scoring** | `deal_detector.py` — MIN_DISCOUNT may vary by state (IL deals are rarer) | P1 |
| **Brand DB state awareness** | Some brands are state-specific (MKX = MI only, Cresco LLR = IL-strong) | P1 |
| **Tax-inclusive pricing flag** | IL menus sometimes show post-tax prices; need flag to normalize | P1 |
| **New Sunnyside scraper** | `platforms/sunnyside.py` — proprietary React SPA | P1 (IL-critical) |

### 7.5 Menu Structure Differences

| Aspect | Nevada | Michigan | Illinois |
|---|---|---|---|
| **Price display** | Pre-tax, was/now common | Pre-tax, was/now common | Often pre-tax; some post-tax |
| **THC% format** | Exact (e.g., "27.3%") | Exact or range ("25-29%") | Range more common |
| **Weight formats** | Standard g/mg | Standard g/mg | Standard g/mg |
| **Specials page** | Common (Dutchie /specials) | Common (Dutchie /specials) | Less common; daily deals may be banner-only |
| **Categories** | flower/preroll/vape/edible/concentrate | Same + topicals/tinctures more prominent | Same + tinctures prominent |
| **Unique categories** | N/A | "Topicals" significant | "Tinctures" (FSHO/RSO) very significant |

---

## 8. Recommended Rollout Order

### Michigan (Phase 1A — High ROI, low friction)

| Priority | Dispensaries | Platform | Count |
|---|---|---|---|
| **Wave 1** | Lume, Skymint, JARS, Cloud Cannabis | Dutchie | ~80 locations |
| **Wave 2** | Herbana, Joyology, High Profile, Pleasantrees, Pinnacle | Dutchie | ~30 locations |
| **Wave 3** | Curaleaf MI, Zen Leaf MI | Curaleaf | ~8 locations |
| **Wave 4** | Nirvana Center + Jane independents | Jane | ~50+ locations |
| **Wave 5** | HOD, remaining Dutchie independents | Dutchie | ~50+ locations |
| **Future** | Puff (Weedmaps), Exclusive (custom), Gage (Dispense) | New scrapers | ~30+ locations |

**Wave 1-4 target: ~170 dispensaries with existing scrapers**

### Illinois (Phase 1B — MSO-heavy, higher complexity)

| Priority | Dispensaries | Platform | Count |
|---|---|---|---|
| **Wave 1** | Rise IL (10-12 locations) | Rise | ~12 locations |
| **Wave 2** | Zen Leaf IL + Curaleaf IL | Curaleaf | ~14 locations |
| **Wave 3** | Ascend + Nature's Care + EarthMed + Cannabist | Dutchie | ~20 locations |
| **Wave 4** | Beyond/Hello + Verilife + Consume + Thrive IL | Jane | ~15 locations |
| **Wave 5** | Remaining Dutchie + Jane independents | Dutchie/Jane | ~30+ locations |
| **Future** | Sunnyside (Cresco) — **needs new scraper** | Sunnyside | ~15 locations |

**Wave 1-5 target: ~90 dispensaries with existing scrapers**
**With Sunnyside scraper: ~105 dispensaries**

---

## 9. MI+IL Combined Summary

| Metric | Michigan | Illinois | Combined |
|---|---|---|---|
| **Licensed dispensaries** | ~1,000+ | ~230 | ~1,230+ |
| **Addressable with existing scrapers** | ~500+ | ~130+ | ~630+ |
| **Day 1 target (Wave 1-2)** | ~110 | ~25 | ~135 |
| **Net-new brands needed** | ~35-40 | ~30-40 | ~65-80 |
| **Platform overlap with NV** | ~55-65% | ~65-75% | ~60-70% |
| **New scrapers needed** | Weedmaps embed (stretch) | Sunnyside (important) | 1-2 new scrapers |
| **Price cap changes** | Lower all caps | Raise all caps | State-specific caps required |
| **Biggest technical risk** | Weedmaps coverage gap | Sunnyside coverage gap + tax complexity | State-specific scoring |

---

*End of Michigan & Illinois Market Research*
