# ML/LLM Integration Plan — CloudedDeals

> **Created:** Mar 6, 2026 | **Status:** Planning → Phase 0 Ready
> **Data Asset:** ~295k unique products, 11 states, daily scraping
> **Goal:** Use data-driven intelligence to replace hardcoded rules, improve scraper accuracy, and build competitive moat

---

## Executive Summary

CloudedDeals has 295k+ unique products across 11 states — enough data to replace
hand-tuned rules with data-driven systems. This plan has 4 phases, starting
with zero-cost improvements using data we already collect, progressing to
LLM-powered parsing that makes the scraper dramatically more accurate.

**The big picture:** Every dispensary we scrape makes our system smarter. More
data → better price caps → better deal detection → better user experience →
more users → competitive moat. This is the "data flywheel" in the investor
pitch, and this plan makes it real.

---

## Phase 0: Data-Driven Price Caps (Week 1 — Zero New Infra)

### What & Why

Right now, price caps for each state are **hardcoded guesses** in
`deal_detector.py` (lines 161–310). Michigan flower cap is $15/eighth because
someone estimated it. But we already have `enrichment_snapshots` computing
actual p25/p50/p75 price percentiles per state/category/weight every week.

**The fix:** Replace hardcoded `STATE_PRICE_CAP_OVERRIDES` with a function that
reads actual price distributions from the database and sets caps at
approximately the 30th percentile (deals should be cheaper than 70% of
products in that market).

### Impact

- **Immediate:** Every state gets accurate, market-calibrated price caps
- **Self-healing:** As markets shift (MI prices dropping, NJ prices rising),
  caps auto-adjust weekly
- **New states:** Any new state we add automatically gets correct caps from day 1
- **No more manual tuning:** Eliminates a maintenance burden

### Implementation

**Files changed:**
| File | Change |
|------|--------|
| `deal_detector.py` | New `load_dynamic_caps(db)` function; `_get_caps_for_region()` checks dynamic caps first, falls back to hardcoded |
| `main.py` | Pass `db` client to `detect_deals()` so it can query enrichment_snapshots |
| `enrichment_snapshots.py` | Add `compute_price_cap_recommendations()` — returns suggested caps per state at p30 |

**New migration:**
| Migration | Purpose |
|-----------|---------|
| `045_ml_price_cap_cache.sql` | `ml_price_caps` table — caches recommended caps per (region, category, weight_tier), refreshed weekly |

**Logic:**
```python
def compute_recommended_caps(enrichment_data):
    """For each (region, category, weight_tier), set cap = p30 * 1.1

    Why p30 * 1.1: A "deal" should be in the bottom 30% of prices for
    that market. The 1.1x buffer avoids being too aggressive on edge cases.
    Minimum sample size: 20 products (below that, fall back to hardcoded).
    """
```

**Verification:**
- Run enrichment_snapshots, inspect recommended caps vs current hardcoded
- Diff should show: MI caps dropping (ultra-competitive), NJ/IL caps rising
  (high-tax markets)
- Run deal_detector with dynamic caps, compare top-200 deal quality

### Risk: Low
- Hardcoded caps remain as fallback for states with <20 products
- Can toggle off with env var `USE_DYNAMIC_CAPS=false`

---

## Phase 1: Smart Brand Detection (Week 2–3 — Lightweight ML)

### What & Why

Brand detection currently uses a **hardcoded list of 264 brands** plus regex
matching in `clouded_logic.py`. The `daily_metrics` table already tracks
`brand_null_count` and `top_unmatched_brands` — every day we see which brands
the system is missing.

**The fix:**
1. Auto-expand the brand database from daily unmatched brand logs
2. Add fuzzy matching (Levenshtein distance) for brand name variants
3. Use TF-IDF on product names to discover brand patterns

### Impact

- Brand detection rate: ~85% → 95%+ (means better scoring for 10% more products)
- Automatic brand discovery across all 11 states
- Better brand tier scoring → better deals surfaced

### Implementation

**Files changed:**
| File | Change |
|------|--------|
| `clouded_logic.py` | Add `fuzzy_brand_match()` using `difflib.SequenceMatcher` (stdlib, no new deps) |
| `metrics_collector.py` | Promote `top_unmatched_brands` to a learning signal — feed into brand candidates table |
| `deal_detector.py` | Use expanded brand DB for tier scoring |

**New migration:**
| Migration | Purpose |
|-----------|---------|
| `046_brand_candidates.sql` | `brand_candidates` table — auto-discovered brands with observation count, first/last seen, status (pending/approved/rejected) |

**New file:**
| File | Purpose |
|------|---------|
| `scraper/brand_learner.py` | Offline script: reads `top_unmatched_brands` from daily_metrics, clusters similar names, proposes new brands with confidence scores |

**Logic:**
```python
# After each scrape run, brand_learner checks:
# 1. Any unmatched brand appearing 50+ times across 3+ dispensaries = high confidence
# 2. Fuzzy match against existing brands (>85% similarity = variant, not new)
# 3. Human review queue: brands between 20-50 occurrences
```

**No new dependencies** — uses Python stdlib `difflib` for fuzzy matching.

### Risk: Low
- New brands are "candidates" until approved (no auto-injection into scoring)
- Admin dashboard can show brand candidates for manual approval

---

## Phase 2: LLM Product Normalization (Week 4–6 — Claude Haiku API)

### What & Why

The parser (`parser.py`) uses **300+ lines of regex** to extract brand, weight,
and price from raw product text. It handles ~85% of cases but fails on:
- Non-standard formats: `"2 for $60"`, `"Mix & Match BOGO"`
- Ambiguous weights: `"1g" could be concentrate or preroll`
- Brand embedded in product name: `"STIIIZY OG Kush Pod"` → brand=STIIIZY

**The fix:** Run Claude Haiku (cheapest model: ~$0.25/1M input tokens) as a
**batch post-processor** on products where the regex parser has low confidence.
Not real-time — runs after scraping, before scoring.

### Cost Estimate

| Metric | Value |
|--------|-------|
| Products needing LLM help | ~15% of daily scrape = ~7,500 products |
| Avg tokens per product | ~200 input + ~100 output |
| Daily cost | ~$0.40 (7,500 × 200 / 1M × $0.25 input + output) |
| Monthly cost | ~$12 |

### Implementation

**New files:**
| File | Purpose |
|------|---------|
| `scraper/llm_normalizer.py` | Batch LLM normalization — sends low-confidence products to Claude Haiku for structured extraction |
| `.github/workflows/llm-normalize.yml` | Daily GH Action that runs after scraping |

**Files changed:**
| File | Change |
|------|--------|
| `parser.py` | Add `confidence_score` field (0-1) to parse results — low confidence flags product for LLM pass |
| `main.py` | After scrape, collect low-confidence products, batch to LLM normalizer |
| `requirements.txt` | Add `anthropic>=0.40.0` |

**New migration:**
| Migration | Purpose |
|-----------|---------|
| `047_llm_corrections.sql` | `llm_corrections` table — stores LLM-parsed fields alongside original regex fields, with correction_type and confidence |

**Prompt design:**
```
You are a cannabis product data extractor. Given this raw product listing,
extract: brand, category (flower/vape/edible/concentrate/preroll), weight
(value + unit), original_price, sale_price.

Raw text: "{raw_text}"
Product name: "{name}"

Return JSON only. If uncertain about a field, set it to null.
```

**Batching strategy:**
- Group products by category (similar formats cluster together)
- 20 products per API call (fits in context window)
- Retry with exponential backoff on rate limits
- Cache corrections in `llm_corrections` table (don't re-parse same product)

### Verification
- Run on 1,000 products with known-good regex results
- Compare LLM output vs regex output — LLM should match on 95%+ of fields
- Measure improvement on the 15% low-confidence set

### Risk: Medium
- API cost is fixed (~$12/mo) but grows linearly with product volume
- LLM hallucination → always validate output against price bounds
- Fallback: if LLM fails, keep regex result

---

## Phase 3: ML-Scored Deal Ranking (Month 2–3 — scikit-learn)

### What & Why

Deal scoring is currently a **hand-tuned formula** in `calculate_deal_score()`:
```
score = discount_depth (30pts) + unit_value (10pts) + brand_tier (20pts)
      + category_boost (8pts) + disposable_boost (12pts)
```

With 45 users saving deals and 295k products with historical data, we can
train a model that learns what makes a "good deal" from actual behavior.

### Implementation

**Training data source:**
- `user_saved_deals` → positive signal (user explicitly saved this deal)
- `deal_history.times_seen` → persistence signal (deals that keep appearing are real)
- `price_history` → price drop velocity (sudden drops = flash sales = high value)
- `enrichment_snapshots` → market-relative pricing (p30 in MI ≠ p30 in NJ)

**Model:**
- **Algorithm:** Gradient boosted trees (LightGBM or sklearn GradientBoostingClassifier)
- **Features:**
  - `discount_percent` — how deep is the discount
  - `price_vs_market_median` — sale_price / p50 for this (region, category, weight)
  - `brand_observation_frequency` — how often this brand appears (popular = trustworthy)
  - `deal_recurrence_rate` — times_seen / days_since_first_seen
  - `dispensary_reliability` — site success rate from scrape_runs
  - `category`, `region`, `weight_tier` — categorical features
- **Target:** Binary — was this deal saved by a user? (1/0)
- **Caveat:** Only 45 users, ~500 saves — need to augment with heuristic labels

**New files:**
| File | Purpose |
|------|---------|
| `scraper/ml/train_scorer.py` | Training script — reads features from DB, trains model, saves to file |
| `scraper/ml/predict.py` | Inference — loads model, scores products |
| `scraper/ml/features.py` | Feature engineering — builds feature vectors from product + enrichment data |
| `.github/workflows/ml-train.yml` | Weekly retraining GH Action |

**New migration:**
| Migration | Purpose |
|-----------|---------|
| `048_ml_features.sql` | `ml_product_features` materialized view — precomputed feature vectors updated daily |
| `049_ml_predictions.sql` | `ml_deal_scores` table — stores model predictions alongside rule-based scores for A/B comparison |

**A/B Testing:**
- Store both rule-based score and ML score on every deal
- Dashboard shows side-by-side: which top-200 would each system pick?
- After validation, gradually shift weight from rules → ML

### Risk: High (but contained)
- Small user base means model may overfit — mitigate with cross-validation
- Never fully replace rule-based scoring — ML score is an **additional signal**
- Rule-based remains the fallback; ML is a scoring boost

---

## Phase 4: Future Vision (Month 4–6)

These are not planned for immediate implementation but represent the roadmap:

### 4a. Adaptive Scraper Recovery
- LLM analyzes failed scrape screenshots to diagnose why (new age gate design,
  layout change, Cloudflare challenge)
- Auto-generates selector fixes for common failure patterns

### 4b. Deal Recurrence Prediction
- Train model on deal_history to predict: "this deal will reappear next week"
- Notify users: "A deal you saved is likely coming back soon"
- Feature: deal_history.times_seen, days_between_appearances, brand, dispensary

### 4c. Natural Language Deal Search
- Embed product descriptions using sentence transformers
- User searches: "cheap live resin in Las Vegas" → semantic search over products
- Requires: pgvector extension in Supabase, embedding generation pipeline

### 4d. Automated Brand Intelligence Reports
- LLM generates weekly brand pricing reports from enrichment_snapshots
- "STIIIZY pods are $25 in MI, $40 in NV, $55 in NJ — opportunity in NV"
- Powers B2B sales pitch for dispensary clients

---

## New Subagents

### database-engineer (Created)

Defined in `.claude/agents/database-engineer.md`. Expert in Supabase/PostgreSQL
schema design, migrations, ML feature tables, and data pipeline optimization.
Use when you need new tables, indexes, RPC functions, migration files, or
query optimization.

### deal-curation-engineer (Existing)

Already defined. Expert in deal scoring, filtering, and curation logic. Will
work alongside database-engineer for Phase 0 (dynamic price caps integration
into deal_detector.py) and Phase 3 (ML scoring integration).

---

## Implementation Priority & Dependencies

```
Phase 0: Dynamic Price Caps ──────────── Week 1
  ├── database-engineer: migration 045
  ├── deal-curation-engineer: deal_detector.py changes
  └── Verify: compare dynamic vs hardcoded caps
         │
Phase 1: Smart Brand Detection ────────── Week 2-3
  ├── database-engineer: migration 046
  ├── New: brand_learner.py
  └── Verify: brand detection rate improvement
         │
Phase 2: LLM Normalization ───────────── Week 4-6
  ├── database-engineer: migration 047
  ├── New: llm_normalizer.py
  ├── Dependency: Anthropic API key in GH secrets
  └── Verify: parser accuracy on low-confidence products
         │
Phase 3: ML Deal Scoring ─────────────── Month 2-3
  ├── database-engineer: migrations 048-049
  ├── New: ml/ directory (train, predict, features)
  ├── Dependency: enough user saves for training (target: 100+ users)
  └── Verify: A/B comparison of rule-based vs ML scores
```

---

## Cost Summary

| Phase | Compute | API Cost | New Deps |
|-------|---------|----------|----------|
| 0 | GitHub Actions (existing) | $0 | None |
| 1 | GitHub Actions (existing) | $0 | None (stdlib only) |
| 2 | GitHub Actions (+5 min/day) | ~$12/mo | `anthropic` SDK |
| 3 | GitHub Actions (+10 min/week) | $0 | `scikit-learn` or `lightgbm` |

**Total incremental cost: ~$12/month** for Phases 0–3.

---

## Success Metrics

| Metric | Current | Phase 0 Target | Phase 3 Target |
|--------|---------|----------------|----------------|
| Brand detection rate | ~85% | ~88% | 95%+ |
| Price cap accuracy | Hand-tuned guesses | Data-driven (±5% of p30) | ML-calibrated |
| Deal scoring | Rule-based formula | Rule-based + dynamic caps | ML + rules hybrid |
| Parser accuracy | ~85% | ~85% | ~95% (LLM fallback) |
| User save rate | 13.3% | 15%+ | 20%+ |

---

## How This Builds the Moat

Every day we scrape 2,122 dispensaries, we get smarter:
1. **More price data** → better market calibration → better price caps
2. **More brand observations** → auto-discovery → richer brand DB
3. **More user saves** → better training signal → better deal ranking
4. **More states** → cross-state intelligence → "STIIIZY is $25 in MI, why
   are you charging $55 in NV?"

Competitors would need to scrape for months to match our data depth. The ML
layer compounds this advantage — it gets better as the data grows. This is the
flywheel that makes CloudedDeals defensible.
