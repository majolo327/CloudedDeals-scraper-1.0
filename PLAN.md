# Plan: Fix Bundle Text Brand Contamination

## The Problem

When Dutchie (and sometimes other platforms) product cards are scraped, the
`raw_text` from `.inner_text()` captures EVERYTHING in the DOM element:

```
HAZE Fruit Gelly (H) Live Resin Badder 1g     ← product zone
$30.00                                          ← price zone
Special Offers (1)                              ← OFFER ZONE starts here
2/$40 Power Pack || KYND 3.5g Flower & HAZE    ← mentions OTHER brands
1g Live Resin ||
```

In `main.py:577`, all text gets smashed together:
```python
text = f"{raw_name} {raw_text} {price_text}"
```

Then `CloudedLogic.parse_product()` runs brand detection on the full blob.
Result: KYND (from the bundle text) can outrank HAZE (from the product name)
because of position scoring, length, or just being found first.

Same issue with &Shine products getting tagged as Grassroots when the bundle
says "3/60 1g wax grassroots, &shine, ..."

## Why It's Hard

- `raw_text` is a flat string from `.inner_text()` — no DOM structure
- "Special Offers" text lives INSIDE the same card container in Dutchie's DOM
- Bundle text can mention 2-3 brands, any of which could be picked up
- The PRODUCT name reliably contains the correct brand at the START
- But sometimes the `name` field extraction misses the brand
  (e.g., if the heading element only has the strain name)

## The Solution: Name-First Brand Detection

### Architecture: 3-zone text model

Instead of one combined blob, treat scraped text as 3 zones with
descending brand-detection priority:

1. **Product name** (`name` field) — HIGHEST confidence for brand
2. **Product metadata** (`raw_text` with offer text stripped) — fallback
3. **Offer/bundle text** (stripped section) — NEVER used for brand detection
   (future: preserved separately for expanded deal card display)

### Implementation (3 changes, all backwards-compatible)

#### Change 1: main.py — name-first brand detection (lines 572-598)

**Before:**
```python
text = f"{raw_name} {raw_text} {price_text}"
product = logic.parse_product(text, dispensary["name"])
brand = product.get("brand")
```

**After:**
```python
# 1. Try brand detection on product NAME only (highest confidence)
brand = logic.detect_brand(raw_name)

# 2. If no brand in name, try raw_text with offer sections stripped
if not brand:
    stripped_text = _strip_offer_text(raw_text)
    brand = logic.detect_brand(f"{raw_name} {stripped_text}")

# 3. Parse the full text for everything ELSE (category, weight, price, THC)
text = f"{raw_name} {raw_text} {price_text}"
product = logic.parse_product(text, dispensary["name"])

# 4. Override parse_product's brand with our name-first result
if brand:
    product["brand"] = brand
```

This is non-breaking: parse_product still works the same for category/weight/
price, but brand comes from our higher-confidence name-first detection.

#### Change 2: main.py — new `_strip_offer_text()` function

Strip known offer/bundle sections from raw_text before brand fallback:

```python
_RE_OFFER_SECTION = re.compile(
    r"(?:Special Offers?\s*\(\s*\d+\s*\).*$)"   # "Special Offers (1) …"
    r"|(?:\d+/\$\d+\s+.*(?:Power Pack|Bundle).*$)"  # "2/$40 Power Pack || …"
    r"|(?:\d+\s+[Ff]or\s+\$\d+\s+.*$)"           # "3 For $60 …"
    r"|(?:\bBuy\s+\d+\s+Get\s.*$)"                # "Buy 2 Get 1 …"
    r"|(?:\bShop Offer\b.*$)",                     # "Shop Offer" link text
    re.IGNORECASE | re.MULTILINE,
)

def _strip_offer_text(raw_text: str) -> str:
    """Remove Special Offers / bundle deal sections from raw_text.

    This prevents brand names mentioned in offer text (e.g. "KYND 3.5g
    Flower & HAZE 1g Live Resin") from contaminating brand detection.
    The offer text is stripped ONLY for brand detection — the full
    raw_text is still passed to parse_product for price/weight extraction.
    """
    return _RE_OFFER_SECTION.sub("", raw_text).strip()
```

#### Change 3: Dutchie scraper — optional DOM-level separation (bonus)

If we can detect the "Special Offers" boundary in the DOM, extract it
separately at scrape time:

```python
# In dutchie.py _extract_products(), after getting text_block:
offer_text = ""
if "Special Offer" in text_block:
    parts = re.split(r"Special Offers?\s*\(\s*\d+\s*\)", text_block, maxsplit=1)
    product_text = parts[0].strip()
    offer_text = parts[1].strip() if len(parts) > 1 else ""
    raw_text = _JUNK_PATTERNS.sub("", product_text).strip()

product = {
    "name": name,
    "raw_text": raw_text,          # product text ONLY
    "offer_text": offer_text,       # bundle/promo text ONLY (for future use)
    "product_url": self.url,
}
```

This is the cleanest approach — it separates at the source. The
`offer_text` field is preserved for future expanded-deal-card display.

## Order of Implementation

1. **Change 2** first — add `_strip_offer_text()` to main.py (no behavior change yet)
2. **Change 1** — rewire brand detection to name-first in main.py
3. **Change 3** — Dutchie DOM-level split (optional bonus, reduces reliance on regex)
4. **Tests** — add test cases for the new brand detection priority
5. **Verify** with real examples: HAZE/KYND, &Shine/Grassroots

## Edge Cases Handled

| Scenario | Before | After |
|----------|--------|-------|
| HAZE Fruit Gelly + "KYND 3.5g" in offer | Might detect KYND | Detects HAZE (from name) |
| &Shine budder + "grassroots, &shine" in offer | Detects Grassroots | Detects &Shine (from name) |
| Product with brand only in raw_text (not name) | Works | Still works (fallback to stripped raw_text) |
| Product with no brand anywhere | Returns None | Returns None (quality gate rejects) |
| Bundle price text ($40, $60) in offers | May confuse price parser | price parser still sees full text (unaffected) |

## Risk Assessment

- **Low risk**: Changes 1 & 2 only affect brand detection ordering. Category,
  weight, price, THC parsing all continue to use the full combined text.
- **No regressions**: parse_product API unchanged. We just override the brand
  field after the fact when we have higher-confidence data.
- **Backwards compatible**: If name-first detection returns None, we fall back
  to the current behavior (detect from full text, minus offer sections).
