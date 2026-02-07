/* eslint-disable @typescript-eslint/no-unused-vars, react/jsx-key */
"use client";

import { useState, useMemo } from "react";

// ============================================================================
// CLOUDED DEALS — SCRAPER HANDOFF DOCUMENT
// Complete reference for all working patterns, business logic, and dispensary
// configurations. Oriented for frontend webapp deal display (not tweets).
// ============================================================================

// ─── CONSTANTS & BUSINESS LOGIC ─────────────────────────────────────────────

const PRICE_CAP_GLOBAL = 30;

const PRICE_CAPS: Record<string, { min: number; max: number; label: string }> = {
  edible:          { min: 3,  max: 9,  label: "Edibles (100-200mg)" },
  preroll:         { min: 2,  max: 6,  label: "Prerolls (1g only)" },
  vape:            { min: 10, max: 25, label: "Vapes (0.5g–1g)" },
  flower_3_5g:     { min: 10, max: 22, label: "Flower (3.5g)" },
  flower_7g:       { min: 15, max: 35, label: "Flower (7g)" },
  flower_14g:      { min: 20, max: 50, label: "Flower (14g)" },
  concentrate_1g:  { min: 9,  max: 25, label: "Concentrates (1g)" },
};

const MIN_DISCOUNT = 20;
const MAX_DISCOUNT = 75;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  preroll:     ["pre-roll", "preroll", "joint", "blunt"],
  flower:      ["flower", "shake", "popcorn", "smalls", "buds"],
  edible:      ["gummies", "gummy", "chocolate", "candy", "edible", "brownie", "cookie"],
  concentrate: ["badder", "sugar", "shatter", "sauce", "diamonds", "live resin", "rosin", "concentrate", "wax", "dab", "rso"],
  vape:        ["vape", "cart", "cartridge", "disposable", "pod", "pen", "510"],
};

const WEIGHT_PATTERNS = [
  { regex: "(\\d*\\.?\\d+)\\s*g\\b",   unit: "g" },
  { regex: "(\\d+)\\s*mg\\b",          unit: "mg" },
  { regex: "(\\d*\\.?\\d+)\\s*oz\\b",  unit: "oz" },
  { regex: "(\\d+)pk\\b",              unit: "pk" },
  { regex: "(\\d+)\\s*pack\\b",        unit: "pk" },
];

const CATEGORY_ABBREV: Record<string, string> = { preroll: "PR", flower: "F", edible: "E", concentrate: "W", vape: "V" };

const SMART_STOP_CONFIG = {
  wyld_brand_names: ["wyld", "WYLD", "Wyld"],
  min_pages_before_stop: 10,
  min_products_before_stop: 100,
};

// ─── SCORING SYSTEM ─────────────────────────────────────────────────────────

const SCORING_RULES = {
  discount: { max_points: 60, description: "Discount % (capped at 60pts)" },
  price_tier: {
    tiers: [
      { max_price: 10, points: 20, label: "≤$10" },
      { max_price: 20, points: 10, label: "≤$20" },
    ],
  },
  category_bonus: {
    flower: 5, preroll: 5, concentrate: 3, edible: 4, vape: 2,
  } as Record<string, number>,
  mega_deal_bonus: {
    points: 15,
    requires: { min_discount: 60, min_savings: 30 },
    description: "Mega deal: ≥60% off AND ≥$30 savings",
  },
};

// ─── DISPENSARY CONFIGURATIONS ──────────────────────────────────────────────

interface Dispensary {
  key: string;
  name: string;
  platform: string;
  url: string;
  link: string;
  pages?: string;
  smart_stop?: boolean;
  strip: boolean;
  view_more?: number;
  hybrid?: boolean;
}

const DUTCHIE_DISPENSARIES: Dispensary[] = [
  { key: "gibson",               name: "TD-Gibson",            platform: "td_iframe",       url: "https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials",           link: "https://bit.ly/3JN2i5g",  pages: "1–18", smart_stop: true,  strip: false },
  { key: "eastern",              name: "TD-Eastern",           platform: "td_iframe",       url: "https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials",          link: "https://bit.ly/4njh0PY",  pages: "1–18", smart_stop: true,  strip: false },
  { key: "decatur",              name: "TD-Decatur",           platform: "td_iframe",       url: "https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials",          link: "https://bit.ly/3VH075H",  pages: "1–18", smart_stop: true,  strip: true  },
  { key: "planet13",             name: "Planet13",             platform: "direct",          url: "https://planet13.com/stores/planet-13-dispensary/specials",                   link: "https://bit.ly/484Mox4",  pages: "1–18", smart_stop: true,  strip: true  },
  { key: "medizin",              name: "Medizin",              platform: "direct",          url: "https://planet13.com/stores/medizin-dispensary/specials",                     link: "https://bit.ly/3JRmkvm",  pages: "1–18", smart_stop: true,  strip: true  },
  { key: "greenlight_downtown",  name: "Greenlight Downtown",  platform: "dutchie_iframe",  url: "https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials",  link: "",  pages: "1–18", smart_stop: false, strip: true  },
  { key: "greenlight_paradise",  name: "Greenlight Paradise",  platform: "dutchie_iframe",  url: "https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials",            link: "",  pages: "1–18", smart_stop: false, strip: true  },
  { key: "the_grove",            name: "The Grove",            platform: "dutchie_iframe",  url: "https://www.thegrovenv.com/lasvegas/?dtche%5Bpath%5D=specials",                       link: "",  pages: "1–18", smart_stop: false, strip: true  },
  { key: "mint_paradise",        name: "Mint Paradise",        platform: "dutchie_iframe",  url: "https://mintdeals.com/paradise-lv/menu/?dtche%5Bpath%5D=specials",                    link: "",  pages: "1–18", smart_stop: false, strip: true  },
  { key: "mint_rainbow",         name: "Mint Rainbow",         platform: "dutchie_iframe",  url: "https://mintdeals.com/rainbow-lv/menu/?dtche%5Bpath%5D=specials",                    link: "",  pages: "1–18", smart_stop: false, strip: false },
];

const CURALEAF_DISPENSARIES: Dispensary[] = [
  { key: "curaleaf_western", name: "Curaleaf Western", platform: "curaleaf", url: "https://curaleaf.com/stores/curaleaf-las-vegas-western-ave/specials", link: "", pages: "1–18", smart_stop: true, strip: false },
  { key: "curaleaf_north",   name: "Curaleaf North",   platform: "curaleaf", url: "https://curaleaf.com/stores/curaleaf-north-las-vegas/specials",       link: "", pages: "1–18", smart_stop: true, strip: false },
  { key: "curaleaf_strip",   name: "Curaleaf Strip",   platform: "curaleaf", url: "https://curaleaf.com/stores/curaleaf-nv-las-vegas/specials",          link: "", pages: "1–18", smart_stop: true, strip: true  },
  { key: "curaleaf_reef",    name: "Curaleaf Reef",    platform: "curaleaf", url: "https://curaleaf.com/stores/reef-dispensary-las-vegas-strip/specials", link: "", pages: "1–18", smart_stop: true, strip: true  },
];

const JANE_DISPENSARIES: Dispensary[] = [
  { key: "oasis",                  name: "Oasis Cannabis",       platform: "jane", url: "https://oasiscannabis.com/shop/menu/specials",                                        link: "https://oasiscannabis.com/shop/",        view_more: 10, strip: true,  hybrid: false },
  { key: "deep_roots_cheyenne",    name: "Deep Roots Cheyenne",  platform: "jane", url: "https://www.deeprootsharvest.com/cheyenne",                                           link: "https://www.deeprootsharvest.com/cheyenne",  view_more: 10, strip: false, hybrid: true  },
  { key: "deep_roots_craig",       name: "Deep Roots Craig",     platform: "jane", url: "https://www.deeprootsharvest.com/craig",                                              link: "https://www.deeprootsharvest.com/craig",     view_more: 10, strip: false, hybrid: true  },
  { key: "deep_roots_blue_diamond",name: "Deep Roots Blue Diamond",platform: "jane",url: "https://www.deeprootsharvest.com/blue-diamond",                                      link: "",  view_more: 10, strip: false, hybrid: true  },
  { key: "deep_roots_parkson",     name: "Deep Roots Parkson",   platform: "jane", url: "https://www.deeprootsharvest.com/parkson",                                            link: "",  view_more: 10, strip: false, hybrid: true  },
  { key: "cultivate_spring",       name: "Cultivate Spring",     platform: "jane", url: "https://cultivatelv.com/online-menu/",                                                link: "",  view_more: 10, strip: false, hybrid: false },
  { key: "cultivate_durango",      name: "Cultivate Durango",    platform: "jane", url: "https://cultivatelv.com/online-menu-durango/",                                        link: "",  view_more: 10, strip: false, hybrid: false },
  { key: "thrive_sahara",          name: "Thrive Sahara",        platform: "jane", url: "https://thrivenevada.com/west-sahara-weed-dispensary-menu/",                           link: "",  view_more: 10, strip: false, hybrid: false },
  { key: "thrive_cheyenne",        name: "Thrive Cheyenne",      platform: "jane", url: "https://thrivenevada.com/north-las-vegas-dispensary-menu/",                            link: "",  view_more: 10, strip: false, hybrid: false },
  { key: "thrive_strip",           name: "Thrive Strip",         platform: "jane", url: "https://thrivenevada.com/las-vegas-strip-dispensary-menu/",                            link: "",  view_more: 10, strip: true,  hybrid: false },
  { key: "thrive_main",            name: "Thrive Main",          platform: "jane", url: "https://thrivenevada.com/art-district/",                                              link: "",  view_more: 10, strip: false, hybrid: false },
  { key: "beyond_hello_sahara",    name: "Beyond Hello Sahara",  platform: "jane", url: "https://beyond-hello.com/nevada-dispensaries/las-vegas-sahara/adult-use-menu/",        link: "",  view_more: 10, strip: false, hybrid: false },
  { key: "beyond_hello_twain",     name: "Beyond Hello Twain",   platform: "jane", url: "https://nuleafnv.com/dispensaries/las-vegas/menu/",                                   link: "",  view_more: 10, strip: false, hybrid: false },
];

const ALL_DISPENSARIES = [...DUTCHIE_DISPENSARIES, ...CURALEAF_DISPENSARIES, ...JANE_DISPENSARIES];

const STRIP_DISPENSARY_KEYS = [
  "planet13", "medizin", "curaleaf_strip", "curaleaf_reef", "decatur",
  "greenlight_downtown", "greenlight_paradise", "the_grove", "mint_paradise",
  "oasis", "thrive_strip",
];

// ─── BRAND DATABASE ─────────────────────────────────────────────────────────

const BRANDS = [
  "Advanced Vapor Devices","Airo","Alien Labs","AMA","Avexia","Backpack Boyz",
  "Bad Batch","Bad Boy","Ballers","Bear Quartz","Bic","Big Chief Extracts",
  "BirthJays","Bits","Blazer","Blazy Susan","Blink","BLUEBIRDS","Blvd","BLVD",
  "Bonanza Cannabis","Boom Town","Bounti","Brass Knuckles","Bud Bandz","Cake",
  "Cali Traditional","Camino","Camo","CAMP","Cannafornia","Cannabreezy",
  "Cannavative","Cannavore","Cannavore Confections","Caviar Gold","Church",
  "Circle S Farms","City Trees","Claybourne Co.","Clout King","Connected",
  "Cookies","Cotton Mouth","Dabwoods","Dadirri","DADiRRi","Dazed!",
  "Deep Roots","Desert Blaze","Desert Bloom","Dimension Engineering LLC",
  "Dime Industries","Dipper","Doctor Solomon's","Dogwalkers","Doinks",
  "Dope Dope","Dr. Dabber","Dreamland","Dreamland Chocolates","Drink Loud",
  "Edie Parker","Element","Emperors Choice","Encore","Encore Edibles",
  "Entourage","EPC","Escape Pod","Essence","The Essence","EVOL","Eyce",
  "Featured Farms","Find.","Flora Vega","FloraVega","Fuze Extracts",
  "GB Sciences","Golden Savvy","Golden State Banana","Good Green","Good Tide",
  "GRAV Labs","Green Life Productions","Greenway LV","Grön","HaHa Edibles",
  "Hamilton Devices","Haze","High Hemp","Hippies Peaces","Hits Blunt",
  "Huni Badger","Hustlers Ambition","Hustler's Ambition","Jasper","KANHA",
  "Keef","Khalifa Kush","Khalifa Yellow","Kiva","Kiva Lost Farm","Kynd",
  "Later Days","LEVEL","LIT","Locals Only","Lost Farm","LP Exotics",
  "Matrix","Medizin","Moxie","Mystic Timbers","Nature's Chemistry",
  "No Brand Name","Nordic Goddess","OCB Rolling Papers & Cones","Old Pal",
  "OMG THC","PACKS","Phantom Farms","Pheno Exotics","Pis WMS","Planet 13",
  "Poke a Bowl","Prospectors","Raw Garden","REEFORM","Remedy","Resin8",
  "Rove","Ruby Pearl Co.","Sauce","Savvy","Scorch","SeCHe","Select",
  "Sin City","SIP","Skunk","Smokebuddy","Smokiez Edibles","Solopipe",
  "Special Blue","Srene","StackHouse NV","State Flower","Stiiizy","STIIIZY",
  "Storz & Bickel","StundenGlass","Sundae Co.","Super Good","Tahoe Hydro",
  "The Bank","The Dispensary","The Grower Circle","Toker Poker","Torch",
  "Trendi","Tsunami","Tsunami Labs","Twisted Hemp","Tyson 2.0","Ukiyohi",
  "Uncle Arnie's","Uncle Arnies","Vapure","Vegas Valley Growers","Verano",
  "Vert","VERT","VERT Unlimited","Virtue","Vlasic Labs","Voon","VYBZ",
  "Wana","Wyld","Yocan","YoTips","Your Highness","Zig Zag",
];

const NOT_BRANDS = [
  "sale","special","deal","gummies","flower","vape","infused","hybrid",
  "indica","sativa","cbd","thc","preroll","edible","concentrate","extract",
  "disposable","tincture","topical","black","white","blue","green","red",
  "gold","silver","animal","candy","fruit","berry","cream","sugar","honey",
];

// ─── PLATFORM SCRAPING PATTERNS ─────────────────────────────────────────────

interface PlatformPattern {
  label: string;
  selector: string;
  navigation: string;
  iframe_detection: string;
  age_gate: string;
  notes: string;
}

const PLATFORM_PATTERNS: Record<string, PlatformPattern> = {
  td_iframe: {
    label: "TD / Treez Iframe (The Dispensary NV)",
    selector: '[data-testid*="product"]',
    navigation: "Pagination via button[aria-label='go to page N']",
    iframe_detection: "iframe src contains 'dutchie'",
    age_gate: "button#agc_yes / button:has-text('Yes')",
    notes: "High volume (300-500 products). Smart stop when Wyld brand appears after page 10 + 100 products. Uses specials URL parameter.",
  },
  dutchie_iframe: {
    label: "Dutchie Iframe (Greenlight, Grove, Mint)",
    selector: '[data-testid*="product"]',
    navigation: "Same pagination as TD — button[aria-label='go to page N']",
    iframe_detection: "iframe src contains 'dutchie'",
    age_gate: "button#agc_yes / button:has-text('Yes') + JS overlay removal",
    notes: "Identical to TD architecture. Some sites need force_wait_for_iframe and geo-redirected param. 51 products per page typical.",
  },
  direct: {
    label: "Direct Sites (Planet13, Medizin)",
    selector: '[data-testid*="product"]',
    navigation: "Same Dutchie pagination pattern",
    iframe_detection: "No iframe — products in main page DOM (still Dutchie-powered)",
    age_gate: "Standard age gate buttons",
    notes: "Planet13 and Medizin share Dutchie backend but render directly. Same selectors and parsing work.",
  },
  curaleaf: {
    label: "Curaleaf (State Selection Required)",
    selector: '[data-testid*="product"]',
    navigation: "Pagination via button[aria-label='go to page N']",
    iframe_detection: "No iframe — direct DOM",
    age_gate: "State dropdown → select 'Nevada' → button:has-text(\"I'm over 21\") → 'Shop this Store'",
    notes: "Requires 3-step entry: state selection, age verification, store confirmation. Extra 10s wait after age gate. 60s initial timeout, 10s pagination timeout.",
  },
  jane: {
    label: "Jane Platform (Oasis, Deep Roots, Cultivate, Thrive, Beyond Hello)",
    selector: "._flex_80y9c_1[style*='--box-height: 100%'] / [data-testid='product-card'] / ._box_qnw0i_1",
    navigation: "View More button clicks (up to 10 attempts), NOT pagination",
    iframe_detection: "iframe src contains 'iheartjane.com'",
    age_gate: "Standard age gate within iframe",
    notes: "No pagination — loads via 'View More' button. Jane sites need LOOSE qualification rules (no original price displayed → can't calculate discount %). Deep Roots uses hybrid_strategy. Products load inside iframe identical to Dutchie pattern.",
  },
};

const JANE_SELECTORS = [
  "._flex_80y9c_1[style*='--box-height: 100%']",
  "[data-testid='product-card']",
  "._box_qnw0i_1",
];

const AGE_GATE_SELECTORS = [
  "button#agc_yes",
  'button:has-text("Yes")',
  'button:has-text("I am 21")',
  'button:has-text("21+")',
  'button:has-text("Enter")',
  "button:has-text(\"I'm over 21\")",
];

// ─── DEAL QUALIFICATION LOGIC ───────────────────────────────────────────────

const QUALIFICATION_RULES = [
  { rule: "Must have deal_price",           reject_reason: "no_price" },
  { rule: "deal_price ≤ $30 global cap",    reject_reason: "over_30" },
  { rule: "Must have recognized brand",     reject_reason: "no_brand" },
  { rule: "discount_percent ≥ 20%",         reject_reason: "low_discount" },
  { rule: "discount_percent ≤ 75%",         reject_reason: "suspicious_discount" },
  { rule: "Must have weight",               reject_reason: "no_weight" },
  { rule: "category ≠ 'other'",             reject_reason: "unknown_category" },
  { rule: "product_name length ≥ 3 chars",  reject_reason: "bad_quality" },
  { rule: "Category-specific price caps",   reject_reason: "price_cap" },
  { rule: "Prerolls must be 1g only",       reject_reason: "preroll_filter" },
  { rule: "Edibles must be 100mg or 200mg", reject_reason: "tiny_edible" },
  { rule: "Concentrates must be 1g",        reject_reason: "wrong_weight" },
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

const tabs = [
  { id: "overview",      label: "Overview" },
  { id: "dispensaries",  label: "Dispensaries" },
  { id: "platforms",     label: "Platform Patterns" },
  { id: "logic",         label: "Business Logic" },
  { id: "brands",        label: "Brand DB" },
  { id: "scoring",       label: "Scoring" },
  { id: "frontend",      label: "Frontend API" },
];

function Badge({ children, color = "green" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    green:  { bg: "#0d3320", border: "#1a6b42", text: "#4ade80" },
    blue:   { bg: "#0c2340", border: "#1a4a80", text: "#60a5fa" },
    amber:  { bg: "#3d2e00", border: "#7a5c00", text: "#fbbf24" },
    red:    { bg: "#3d0a0a", border: "#7a1a1a", text: "#f87171" },
    purple: { bg: "#2d1b4e", border: "#5b3a9e", text: "#c084fc" },
    slate:  { bg: "#1e293b", border: "#334155", text: "#94a3b8" },
  };
  const c = colors[color] || colors.green;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11,
      fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>{children}</span>
  );
}

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div style={{
      background: "#0f1419", border: "1px solid #1e2a35", borderRadius: 8,
      padding: "16px 20px", flex: "1 1 140px", minWidth: 140,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#4ade80", letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 12,
        paddingBottom: 8, borderBottom: "1px solid #1e2a35",
        letterSpacing: 0.5,
      }}>{title}</h2>
      {children}
    </div>
  );
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {title && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>}
      <pre style={{
        background: "#0a0e13", border: "1px solid #1e2a35", borderRadius: 6,
        padding: 14, fontSize: 12, lineHeight: 1.6, color: "#a5f3c4",
        overflow: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}>{children}</pre>
    </div>
  );
}

function TableRow({ cells, header }: { cells: React.ReactNode[]; header?: boolean }) {
  const Tag = header ? "th" : "td";
  return (
    <tr style={{ borderBottom: "1px solid #1e2a35" }}>
      {cells.map((cell, i) => (
        <Tag key={i} style={{
          padding: "8px 12px", fontSize: 12, textAlign: "left",
          color: header ? "#64748b" : "#cbd5e1",
          fontWeight: header ? 700 : 400,
          letterSpacing: header ? 1 : 0,
          textTransform: header ? "uppercase" : "none",
          whiteSpace: "nowrap",
        }}>{cell}</Tag>
      ))}
    </tr>
  );
}

// ─── TAB CONTENT ────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <StatCard value={ALL_DISPENSARIES.length} label="Dispensaries" sub="27 stores across LV" />
        <StatCard value="6" label="Platform Types" sub="td, dutchie, direct, curaleaf, jane" />
        <StatCard value="6,600+" label="Products / Day" sub="Scraped from all stores" />
        <StatCard value="~1,500" label="Qualifying Deals" sub="After all filters applied" />
        <StatCard value={BRANDS.length + "+"} label="Brands in DB" sub="Fuzzy matching enabled" />
      </div>

      <Section title="Architecture Summary">
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
          <p style={{ marginBottom: 12 }}>
            The scraper uses <strong style={{ color: "#e2e8f0" }}>Python + Playwright</strong> for browser automation across 6 distinct platform architectures. It processes products through a pipeline:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 16 }}>
            {["1. Navigate & Age Gate", "2. Detect Platform/iframe", "3. Extract Raw Text", "4. Parse Product Fields", "5. Detect Brand (fuzzy)", "6. Classify Category", "7. Extract Weight + THC", "8. Qualify Deal", "9. Score & Rank", "10. Deduplicate"].map((step, i) => (
              <div key={i} style={{
                background: "#0a0e13", border: "1px solid #1e2a35", borderRadius: 6,
                padding: "8px 12px", fontSize: 12, color: "#4ade80", fontWeight: 500,
              }}>{step}</div>
            ))}
          </div>
          <p>
            For the <strong style={{ color: "#e2e8f0" }}>frontend webapp</strong>, the scraper outputs a JSON array of qualified deals. Each deal has: <code style={{ color: "#fbbf24" }}>brand, product_name, category, weight, deal_price, original_price, discount_percent, dispensary, score, thc_percent, unique_id</code>.
          </p>
        </div>
      </Section>

      <Section title="Daily Output Targets">
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><TableRow header cells={["Metric", "Target", "Status"]} /></thead>
            <tbody>
              <TableRow cells={["Total products scraped", "3,500+", <Badge color="green">Achieved</Badge>]} />
              <TableRow cells={["Qualifying deals", "200–400", <Badge color="green">Achieved</Badge>]} />
              <TableRow cells={["Dispensary coverage", "27+ stores", <Badge color="green">Achieved</Badge>]} />
              <TableRow cells={["Brand recognition rate", ">80%", <Badge color="green">Achieved</Badge>]} />
              <TableRow cells={["Runtime", "<30 min", <Badge color="green">~29 min</Badge>]} />
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function DispensariesTab() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = ALL_DISPENSARIES;
    if (filter === "strip") list = list.filter(d => d.strip);
    if (filter === "dutchie") list = list.filter(d => ["td_iframe", "dutchie_iframe", "direct"].includes(d.platform));
    if (filter === "curaleaf") list = list.filter(d => d.platform === "curaleaf");
    if (filter === "jane") list = list.filter(d => d.platform === "jane");
    if (search) list = list.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [filter, search]);

  const platformColor = (p: string) => {
    if (p === "td_iframe") return "blue";
    if (p === "dutchie_iframe") return "purple";
    if (p === "direct") return "green";
    if (p === "curaleaf") return "amber";
    if (p === "jane") return "red";
    return "slate";
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "strip", "dutchie", "curaleaf", "jane"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid",
            borderColor: filter === f ? "#4ade80" : "#1e2a35",
            background: filter === f ? "#0d3320" : "#0f1419",
            color: filter === f ? "#4ade80" : "#94a3b8",
            fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
          }}>{f === "all" ? `All (${ALL_DISPENSARIES.length})` : f}</button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search dispensaries..."
          style={{
            padding: "6px 12px", borderRadius: 6, border: "1px solid #1e2a35",
            background: "#0a0e13", color: "#e2e8f0", fontSize: 12, flex: "1 1 180px",
            outline: "none", minWidth: 120,
          }}
        />
      </div>

      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead>
            <TableRow header cells={["Name", "Platform", "Navigation", "Strip", "Special Config"]} />
          </thead>
          <tbody>
            {filtered.map(d => (
              <TableRow key={d.key} cells={[
                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{d.name}</span>,
                <Badge color={platformColor(d.platform)}>{d.platform}</Badge>,
                d.platform === "jane" ? `View More ×${d.view_more}` : d.pages ? `Pages ${d.pages}` : "—",
                d.strip ? <Badge color="amber">Strip</Badge> : <span style={{ color: "#334155" }}>—</span>,
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {d.smart_stop ? "smart_stop " : ""}
                  {d.hybrid ? "hybrid_strategy " : ""}
                  {d.platform === "curaleaf" ? "state_select " : ""}
                </span>,
              ]} />
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 12 }}>
        Showing {filtered.length} of {ALL_DISPENSARIES.length} dispensaries
      </div>
    </div>
  );
}

function PlatformsTab() {
  const [selected, setSelected] = useState("td_iframe");
  const p = PLATFORM_PATTERNS[selected];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(PLATFORM_PATTERNS).map(([key]) => (
          <button key={key} onClick={() => setSelected(key)} style={{
            padding: "8px 14px", borderRadius: 6, border: "1px solid",
            borderColor: selected === key ? "#60a5fa" : "#1e2a35",
            background: selected === key ? "#0c2340" : "#0f1419",
            color: selected === key ? "#60a5fa" : "#94a3b8",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{key}</button>
        ))}
      </div>

      <div style={{ background: "#0a0e13", border: "1px solid #1e2a35", borderRadius: 8, padding: 20 }}>
        <h3 style={{ fontSize: 15, color: "#e2e8f0", marginBottom: 16, fontWeight: 700 }}>{p.label}</h3>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Product Selector</div>
            <code style={{ fontSize: 13, color: "#4ade80", background: "#0d1117", padding: "4px 8px", borderRadius: 4 }}>{p.selector}</code>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Navigation</div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>{p.navigation}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>iframe Detection</div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>{p.iframe_detection}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Age Gate</div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>{p.age_gate}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#fbbf24", lineHeight: 1.6 }}>{p.notes}</div>
          </div>
        </div>
      </div>

      {selected === "jane" && (
        <Section title="Jane Selector Fallback Chain">
          <CodeBlock>{JANE_SELECTORS.map((s, i) => `${i + 1}. ${s}`).join("\n")}</CodeBlock>
        </Section>
      )}

      {selected === "curaleaf" && (
        <Section title="Curaleaf Entry Sequence">
          <CodeBlock>{`1. page.goto(url, timeout=60000)
2. await sleep(2s)
3. dropdown = wait_for_selector('select', timeout=8000)
4. dropdown.select_option(value='Nevada')   // fallback: 'California'
5. await sleep(1s)
6. click: button:has-text("I'm over 21")
7. await sleep(5s)
8. click: button:has-text("Shop this Store")
9. await sleep(10s)  // extra_wait_after_age
10. Begin pagination with 10s timeout per page`}</CodeBlock>
        </Section>
      )}

      <Section title="Common Age Gate Selectors">
        <CodeBlock>{AGE_GATE_SELECTORS.join("\n")}</CodeBlock>
      </Section>

      <Section title="Smart Stop Logic">
        <CodeBlock>{`// Applies to TD and Curaleaf sites with smart_stop: true
if (page_num >= ${SMART_STOP_CONFIG.min_pages_before_stop}
    && config.smart_stop
    && products.length >= ${SMART_STOP_CONFIG.min_products_before_stop}) {
  if (products.some(p => WYLD_NAMES.includes(p.brand))) {
    // Wyld brand detected → end of real deals, stop scraping
    break;
  }
}`}</CodeBlock>
      </Section>
    </div>
  );
}

function BusinessLogicTab() {
  return (
    <div>
      <Section title="Deal Qualification Pipeline">
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, lineHeight: 1.7 }}>
          Every scraped product passes through these filters in order. If any filter fails, the product is rejected with a specific reason code for debugging.
        </div>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><TableRow header cells={["#", "Rule", "Reject Code"]} /></thead>
            <tbody>
              {QUALIFICATION_RULES.map((r, i) => (
                <TableRow key={i} cells={[
                  <span style={{ color: "#4ade80", fontWeight: 700 }}>{i + 1}</span>,
                  r.rule,
                  <code style={{ color: "#f87171", fontSize: 11 }}>{r.reject_reason}</code>,
                ]} />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Category-Specific Price Caps">
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><TableRow header cells={["Category", "Min $", "Max $", "Weight Req"]} /></thead>
            <tbody>
              {Object.entries(PRICE_CAPS).map(([key, cap]) => (
                <TableRow key={key} cells={[
                  cap.label,
                  <span style={{ color: "#4ade80" }}>${cap.min}</span>,
                  <span style={{ color: "#f87171" }}>${cap.max}</span>,
                  key.includes("flower") ? key.replace("flower_", "").replace("_", ".") + "g" :
                  key.includes("concentrate") ? "1g" :
                  key === "preroll" ? "1g only" :
                  key === "edible" ? "100mg or 200mg" :
                  key === "vape" ? "0.5g–1g" : "—",
                ]} />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Category Detection (keyword priority order)">
        {Object.entries(CATEGORY_KEYWORDS).map(([cat, keywords]) => (
          <div key={cat} style={{ marginBottom: 10 }}>
            <Badge color={cat === "flower" ? "green" : cat === "vape" ? "blue" : cat === "edible" ? "amber" : cat === "concentrate" ? "purple" : "red"}>
              {cat}
            </Badge>
            <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
              {keywords.join(", ")}
            </span>
          </div>
        ))}
        <CodeBlock title="Fallback logic (if no keyword match)">{`if weight_unit == 'mg':       → edible
elif weight_unit == 'g':
  if weight_value >= 3.5:    → flower
  else:                      → concentrate
else:                        → vape`}</CodeBlock>
      </Section>

      <Section title="Weight Extraction Patterns">
        <CodeBlock>{WEIGHT_PATTERNS.map(p => `${p.regex}  →  unit: "${p.unit}"`).join("\n")}</CodeBlock>
      </Section>

      <Section title="Brand Detection Logic">
        <CodeBlock>{`1. Extract first line of raw_text as potential brand
2. Check against BRANDS set (case-insensitive)
3. If no match, try fuzzy matching (first 2 words)
4. Filter against NOT_BRANDS set
5. If still no match → reject (no_brand)

Unique ID for dedup:
  unique_id = f"{brand}_{product_name}_{weight_value}".lower()`}</CodeBlock>
      </Section>

      <Section title="Jane Platform Special Rules">
        <div style={{
          background: "#3d2e00", border: "1px solid #7a5c00", borderRadius: 8,
          padding: 16, fontSize: 13, color: "#fbbf24", lineHeight: 1.7,
        }}>
          <strong>Jane sites do NOT display original prices.</strong> Most show the discounted price as the only price. This means:<br /><br />
          - Cannot calculate discount_percent for Jane products<br />
          - Qualification uses <strong>loose rules</strong>: price cap + brand only<br />
          - Frontend should show &quot;Deal&quot; badge instead of &quot;X% off&quot;<br />
          - Deep Roots sites use <strong>hybrid_strategy</strong> (different DOM structure)
        </div>
      </Section>
    </div>
  );
}

function BrandsTab() {
  const [search, setSearch] = useState("");
  const filtered = BRANDS.filter(b => b.toLowerCase().includes(search.toLowerCase()));
  const letters = Array.from(new Set(filtered.map(b => b[0].toUpperCase()))).sort();

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search brands..."
          style={{
            padding: "8px 14px", borderRadius: 6, border: "1px solid #1e2a35",
            background: "#0a0e13", color: "#e2e8f0", fontSize: 13, flex: 1,
            outline: "none",
          }}
        />
        <Badge color="slate">{filtered.length} brands</Badge>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {letters.map(l => (
          <a key={l} href={`#brand-${l}`} style={{
            padding: "2px 8px", borderRadius: 4, background: "#0f1419",
            border: "1px solid #1e2a35", color: "#4ade80", fontSize: 11,
            fontWeight: 700, textDecoration: "none", cursor: "pointer",
          }}>{l}</a>
        ))}
      </div>

      {letters.map(letter => {
        const group = filtered.filter(b => b[0].toUpperCase() === letter);
        return (
          <div key={letter} id={`brand-${letter}`} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>{letter}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {group.map(b => (
                <span key={b} style={{
                  padding: "3px 10px", borderRadius: 4, background: "#0a0e13",
                  border: "1px solid #1e2a35", color: "#cbd5e1", fontSize: 12,
                }}>{b}</span>
              ))}
            </div>
          </div>
        );
      })}

      <Section title="NOT_BRANDS (excluded words)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {NOT_BRANDS.map(b => (
            <span key={b} style={{
              padding: "3px 10px", borderRadius: 4, background: "#3d0a0a",
              border: "1px solid #7a1a1a", color: "#f87171", fontSize: 12,
            }}>{b}</span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ScoringTab() {
  return (
    <div>
      <Section title="Deal Scoring Algorithm">
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>
          Each qualifying deal gets a composite score (0–100+). This replaces tweet selection logic — the frontend sorts and displays deals by score.
        </div>

        <CodeBlock title="Scoring Breakdown">{`score = 0

// 1. Discount percentage (up to 60 points)
score += min(discount_percent, 60)

// 2. Price tier bonus (up to 20 points)
if deal_price <= 10:  score += 20
elif deal_price <= 20: score += 10

// 3. Category bonus (up to 5 points)
category_bonus = { flower: 5, preroll: 5, concentrate: 3, edible: 4, vape: 2 }
score += category_bonus[category]

// 4. Mega deal bonus (+15 points)
if discount >= 60% AND savings >= $30:
  score += 15

// Total possible: 100+ points`}</CodeBlock>
      </Section>

      <Section title="Score Tier Mapping (for frontend UI)">
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><TableRow header cells={["Score Range", "Tier", "UI Treatment"]} /></thead>
            <tbody>
              <TableRow cells={["80+",  <Badge color="red">HOT DEAL</Badge>,      "Red highlight, top of list, animated badge"]} />
              <TableRow cells={["60–79", <Badge color="amber">GREAT DEAL</Badge>,  "Amber accent, featured section"]} />
              <TableRow cells={["40–59", <Badge color="green">GOOD DEAL</Badge>,    "Standard card with green price"]} />
              <TableRow cells={["20–39", <Badge color="blue">DEAL</Badge>,          "Subtle card, lower priority"]} />
              <TableRow cells={["<20",   <Badge color="slate">—</Badge>,               "Filtered out or bottom of list"]} />
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Price Per Unit Calculation">
        <CodeBlock>{`// For frontend "value comparison" feature
function price_per_unit(deal):
  if category in [flower, preroll, concentrate, vape]:
    extract grams from weight string
    return deal_price / grams   // $/g
  elif category == edible:
    extract mg from weight string
    return deal_price / mg * 10  // $/10mg`}</CodeBlock>
      </Section>

      <Section title="Dispensary Diversity Logic">
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>For the frontend feed, prevent any single dispensary from dominating results:</p>
          <CodeBlock>{`// Frontend should implement:
1. Group deals by dispensary
2. Round-robin selection: pick top deal from each dispensary
3. Then fill remaining slots by score
4. Cap: max 5 deals per dispensary in any view
5. Prioritize strip dispensaries for tourist-facing views`}</CodeBlock>
        </div>
      </Section>
    </div>
  );
}

function FrontendAPITab() {
  return (
    <div>
      <Section title="Scraper Output Schema (JSON)">
        <CodeBlock title="Each deal object">{`{
  "brand":            "Stiiizy",
  "product_name":     "Purple Punch CDT Pod",
  "category":         "vape",          // flower|vape|edible|concentrate|preroll
  "weight":           "1g",
  "weight_value":     1.0,
  "weight_unit":      "g",
  "deal_price":       18.00,
  "original_price":   30.00,           // null for Jane sites
  "discount_percent": 40,              // null for Jane sites
  "dispensary":       "TD-Gibson",
  "dispensary_key":   "gibson",
  "dispensary_link":  "https://bit.ly/3JN2i5g",
  "platform":         "td_iframe",
  "strip_area":       false,
  "score":            65,
  "thc_percent":      89.2,            // null if not available
  "unique_id":        "stiiizy_purple punch cdt pod_1.0",
  "scraped_at":       "2025-02-06T09:00:00Z"
}`}</CodeBlock>
      </Section>

      <Section title="Frontend Filter Dimensions">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { name: "Category", values: "flower, vape, edible, concentrate, preroll", color: "green" },
            { name: "Price Range", values: "Slider: $0–$30", color: "blue" },
            { name: "Dispensary", values: "Multi-select (27 options)", color: "purple" },
            { name: "Brand", values: "Searchable multi-select (200+)", color: "amber" },
            { name: "Location", values: "Strip vs. All Las Vegas", color: "red" },
            { name: "Sort By", values: "Score, Price asc/desc, Discount %, Brand A-Z", color: "slate" },
          ].map(f => (
            <div key={f.name} style={{
              background: "#0a0e13", border: "1px solid #1e2a35", borderRadius: 8, padding: 14,
            }}>
              <Badge color={f.color}>{f.name}</Badge>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>{f.values}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recommended Frontend Views">
        <div style={{ display: "grid", gap: 12 }}>
          {[
            { view: "Hot Deals Feed", desc: "Default homepage. Score-sorted, dispensary-diverse. Auto-refreshes from latest scrape. Shows score badge, brand, price, dispensary with link." },
            { view: "Strip Deals", desc: "Filter to strip_area: true dispensaries only. Tourist-oriented. Shows walking distance or dispensary name prominently." },
            { view: "Category Browser", desc: "Tabbed by category (Flower / Vape / Edible / Concentrate / Preroll). Each tab sorted by price_per_unit for value comparison." },
            { view: "Brand Lookup", desc: "Search by brand → see all current deals for that brand across all dispensaries. Great for loyalists." },
            { view: "Price Comparison", desc: "Same product at multiple dispensaries. Group by product_name + weight, show price differences. Core value prop." },
            { view: "Just Dropped", desc: "Deals that appeared in latest scrape but not previous. Sorted by scraped_at desc. Creates urgency." },
          ].map(v => (
            <div key={v.view} style={{
              background: "#0a0e13", border: "1px solid #1e2a35", borderRadius: 8, padding: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>{v.view}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Data Files">
        <CodeBlock>{`Production Outputs:
  /root/clouded_all_products_today.json   → All 6,600+ scraped products
  /root/clouded_tweets_today.json         → (Legacy) Tweet queue

For Frontend Webapp:
  POST scraped data → Supabase / your DB
  Frontend queries API for qualified deals
  Refresh cycle: Daily scrape at ~9am PT

Fallback Versions: v102, v142, v159, v163
Current Production: v177+`}</CodeBlock>
      </Section>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────

export default function ScraperHandoff() {
  const [activeTab, setActiveTab] = useState("overview");

  const content: Record<string, React.ReactNode> = {
    overview: <OverviewTab />,
    dispensaries: <DispensariesTab />,
    platforms: <PlatformsTab />,
    logic: <BusinessLogicTab />,
    brands: <BrandsTab />,
    scoring: <ScoringTab />,
    frontend: <FrontendAPITab />,
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#090d12", color: "#cbd5e1",
      fontFamily: "'IBM Plex Sans', 'SF Pro Text', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 24px 0", borderBottom: "1px solid #1e2a35",
        background: "linear-gradient(180deg, #0f1a24 0%, #090d12 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#4ade80", textTransform: "uppercase" }}>
            CLOUDED DEALS
          </span>
          <span style={{ fontSize: 11, color: "#334155" }}>x</span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            Scraper Handoff v1.0
          </span>
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 16,
          letterSpacing: -0.5,
        }}>
          Complete Scraper Architecture &amp; Business Logic
        </h1>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 0, overflow: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "10px 18px", border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
              background: activeTab === t.id ? "#0f1419" : "transparent",
              color: activeTab === t.id ? "#4ade80" : "#64748b",
              borderBottom: activeTab === t.id ? "2px solid #4ade80" : "2px solid transparent",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1100 }}>
        {content[activeTab]}
      </div>

      {/* Footer */}
      <div style={{
        padding: "16px 24px", borderTop: "1px solid #1e2a35",
        fontSize: 11, color: "#334155", textAlign: "center",
      }}>
        Clouded Deals Scraper Handoff — Built for frontend webapp integration — Production v177+
      </div>
    </div>
  );
}
