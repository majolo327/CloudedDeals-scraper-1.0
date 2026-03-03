# Plan: Fix Disposable Vape Sourcing + Dispensary Floor Guarantee

## Problem 1: Disposable Vapes Under-Represented

**Symptom**: 3/30 disposables sourced, none visible on site after filtering.

**Root cause chain**:
1. Disposables are categorized as `vape` (product_subtype="disposable"), not a separate category
2. The vape price cap is **$28** — designed for 0.5g carts at $20-28
3. Disposable vapes typically retail $25-40 → most exceed the $28 cap even on sale
4. No separate price cap for disposables, no sub-allocation within vape
5. Disposables that DO pass compete against carts/pods for 45 vape slots — and lose (carts have steeper %-off discounts)

**Fix**: Add a dedicated price cap for disposable vapes in `passes_hard_filters()`.

In `deal_detector.py`, before the generic price cap check, add a subtype-specific override:

```python
# In passes_hard_filters(), before the final price cap check:
if category == "vape" and subtype == "disposable":
    return sale_price <= 35  # disposables are self-contained devices, higher MSRP
```

This lets disposable vapes through at up to $35 (vs $28 for carts), reflecting
their higher retail price point. Carts/pods stay at $28.

## Problem 2: Deep Roots / Euphoria — All Products Fail Hard Filters, 0 Deals

**Symptom**: 15 products scraped, 0 deals. "all 15 failed hard filters"

**Root cause chain**:
1. These are **Jane** platform dispensaries → loose qualification (price cap only)
2. All 15 products have sale prices **above** their category price caps
3. The dispensary floor backfill (Step 3b) only draws from **quality-gate rejects** — products that passed hard filters but failed quality gate
4. When ALL products fail hard filters, `strict_rejected = []` → floor backfill has NOTHING to draw from
5. Result: dispensary gets 0 deals despite having 15 real products

**The gap**: There is no "last resort" mechanism when everything fails hard filters.

**Fix**: Add a Step 1b "hard-filter floor" in `detect_deals()` after the hard filter pass:

```python
# After Step 1 (hard filter), before Step 2 (scoring):
# Step 1b: Hard-filter floor — guarantee ≥1 product from dispensaries
# with real inventory where nothing passed price caps.
if len(qualifying) == 0 and len(products) >= 10:
    candidates = [
        p for p in products
        if (p.get("sale_price") or 0) >= HARD_FILTERS["min_price"]
        and not _is_non_cannabis(p)
        and passes_relaxed_quality_gate(p)
    ]
    if candidates:
        best = min(candidates, key=lambda p: p.get("sale_price") or 999)
        qualifying.append(best)
        logger.info(
            "Hard-filter floor: forced 1 product (%s @ $%.2f) — "
            "dispensary has %d products but none passed price caps",
            best.get("name", "?"), best.get("sale_price", 0), len(products),
        )
```

This picks the cheapest valid product as minimal dispensary representation.
It scores low (no discount data = low deal_score) so it won't displace real deals.

## Files to Change

1. **`clouded-deals/scraper/deal_detector.py`**:
   - Add disposable vape price cap override in `passes_hard_filters()`
   - Add hard-filter floor backfill in `detect_deals()` between Step 1 and Step 2
