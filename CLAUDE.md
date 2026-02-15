# CLAUDE.md — Expansion State Scraper Playbook

Context file for Claude Code. Reference this when adding new states/regions to the scraper.

## Architecture Overview

```
clouded-deals/scraper/
  config/dispensaries.py    — DISPENSARIES list, PLATFORM_DEFAULTS, SITE_TIMEOUT_SEC
  main.py                   — Orchestrator: concurrency, retries, circuit breaker, DB writes
  platforms/
    dutchie.py              — Dutchie scraper (iframe, js_embed, or direct SPA)
    curaleaf.py             — Curaleaf scraper (redirect-based age gate)
    jane.py                 — Jane scraper
    aiq.py                  — Alpine IQ / Dispense scraper
    base.py                 — BaseScraper (Cloudflare detection, age gate, goto)
  handlers/
    iframe.py               — find_dutchie_content(), embed type detection cascade
    age_verification.py     — Generic age gate dismissal
    pagination.py           — Dutchie + Curaleaf pagination
  tests/
    test_michigan_diagnostic.py — Pattern for state-specific diagnostic tests
```

## Key Config Values

| Setting | Value | Location | Notes |
|---------|-------|----------|-------|
| `SITE_TIMEOUT_SEC` | 600 | config/dispensaries.py | Per-site first attempt |
| `_RETRY_TIMEOUT_SEC` | 300 | main.py | Reduced for retries |
| `_MAX_RETRIES` | 2 | main.py | Total attempts per site |
| `_JOB_BUDGET_SEC` | 6900 (115 min) | main.py (env: `JOB_BUDGET_SEC`) | Override via env var |
| `SCRAPE_CONCURRENCY` | 6 | main.py (env) | Total browser contexts |
| `_PLATFORM_CONCURRENCY` | dutchie:3, jane:4, curaleaf:4 | main.py | Per-platform caps |
| `_DOMAIN_MIN_INTERVAL` | 2.0s | main.py | Inter-request delay per domain |
| `_CHAIN_FAIL_THRESHOLD` | 3 | main.py | Consecutive fails before circuit break |

## Expansion State Checklist

When adding a new state, check each item:

### 1. Dispensary Config (`config/dispensaries.py`)

- Add entries to `DISPENSARIES` list with correct `region`, `platform`, `url`, `slug`
- Every site needs: `name`, `slug` (unique), `platform`, `url`, `is_active`, `region`
- Use `region` field consistently (e.g. "michigan", "illinois", "arizona")
- Slugs must be globally unique across all states

### 2. Curaleaf Age Gate — State Must Be in `_REGION_TO_STATE`

**File:** `platforms/curaleaf.py`

The Curaleaf age gate requires selecting the correct state from a dropdown. The `_infer_state()` function resolves state from:
1. URL path: `/shop/{state}/...` (e.g. `/shop/michigan/`)
2. Dispensary config `region` field
3. Fallback: Nevada

**Action for new states:** Add the state to `_REGION_TO_STATE`:
```python
_REGION_TO_STATE = {
    "michigan": ("Michigan", "MI"),
    "illinois": ("Illinois", "IL"),
    "nevada": ("Nevada", "NV"),
    "southern-nv": ("Nevada", "NV"),
    "arizona": ("Arizona", "AZ"),
    # ADD NEW STATES HERE
}
```

Also note: Curaleaf uses two URL patterns:
- `/shop/{state}/...` — MI, IL (state extractable from URL)
- `/stores/...` — NV, AZ (no state in URL, falls back to region config)

### 3. Dutchie embed_type Auto-Detection

**File:** `platforms/dutchie.py`

Three embed types exist:
- `"iframe"` — dispensary's own site embeds Dutchie in an iframe (NV pattern)
- `"js_embed"` — Dutchie JS injects menu into `#dutchie--embed` container
- `"direct"` — `dutchie.com/dispensary/*` React SPA (expansion state pattern)

**Auto-detect rule:** If URL host is `dutchie.com` or `www.dutchie.com`, `embed_hint` is automatically set to `"direct"`. No config needed.

**When to override:** If an expansion state uses dispensary-hosted URLs (not dutchie.com), set `embed_type` per-site or rely on the platform default (`"iframe"`).

### 4. Dutchie.com Direct Page Timeouts

For `dutchie.com/dispensary/*` URLs (direct React SPAs):
- Smart-wait: **30s** (not 60s) — these render fast or not at all
- Probe timeout: **15s** (not 60s)
- **No reload+retry** — if content doesn't render, reloading won't help

For iframe-embed sites (dispensary's own domain):
- Smart-wait: **60s** — iframes load slower
- Probe timeout: **60s**
- Reload+retry is enabled

### 5. Single-Domain Saturation Problem

**Critical for any state where most sites share one domain (e.g. all on dutchie.com).**

Michigan: 111/114 sites are `dutchie.com/dispensary/*` URLs. This means:
- All requests hit one Cloudflare instance
- Rate limiting / bot detection triggers after ~30-40 requests
- Later sites get intermittently blocked

**Mitigations already in place:**
- Domain-level throttle: 2s minimum between requests to same domain
- Chain circuit breaker: 3 consecutive fails → skip remaining chain sites
- Shuffled scrape order: interleaves chains to avoid clustering
- Reduced timeouts for direct pages: cuts failure cost from ~216s to ~50s

**If a new state has 100+ sites on one domain, also consider:**
- Increase `JOB_BUDGET_SEC` via env var (180+ min instead of 115)
- Increase `_PLATFORM_CONCURRENCY["dutchie"]` to 5 for direct pages
- Investigate proxy rotation if Cloudflare blocks persist

### 6. Zen Leaf / Non-Standard Domains on Curaleaf Platform

Some sites tagged `platform="curaleaf"` are NOT on `curaleaf.com`:
- Zen Leaf → `zenleafdispensaries.com` (Verano's platform)

The Curaleaf scraper detects non-curaleaf.com domains and falls back to the generic overlay-based age gate handler. No special config needed — just ensure `platform="curaleaf"` is correct.

### 7. Budget Math for Large States

Formula for minimum wall-time:
```
sites × avg_time_per_site / platform_concurrency = wall_time

# Fast path (success): ~30s per site
# Slow path (failure): ~50s per site (direct) or ~200s (iframe)
# With retries: multiply by _MAX_RETRIES for failures
```

For 114 Michigan sites at 3 concurrent:
- Best case: 114 × 30 / 3 = 19 min
- Realistic (30% failure): ~60-80 min
- With circuit breaker savings: ~50-70 min
- Budget: 115 min (default) — sufficient with fixes

### 8. Testing Pattern

Create `tests/test_{state}_diagnostic.py` following the Michigan pattern:
1. Config quality tests (slugs unique, URLs valid, platform distribution)
2. Platform-specific regression tests (age gate state, embed type detection)
3. Domain concentration tests (throttling, circuit breaker verification)
4. Fix verification tests (positive assertions that fixes are in place)
5. Scrape yield baselines (mark xfail until first successful scrape)

### 9. GitHub Actions Pipeline

- Set `REGION={state}` env var to scrape only that state
- Set `JOB_BUDGET_SEC` appropriately for the state's site count
- Stagger scrape schedules so states don't overlap

## Lessons Learned from Michigan Launch

1. **Don't assume NV patterns work everywhere.** The Nevada scraper was optimized for iframe embeds on custom domains. Michigan is 100% direct dutchie.com SPAs — completely different detection path.

2. **Hardcoded state values are time bombs.** The Curaleaf "Nevada" hardcode was invisible in NV testing but broke all expansion states. Always parameterize geographic values.

3. **Budget math matters at scale.** 114 sites × 900s worst-case failure × 2 attempts / 3 concurrent = 228 min. Always model the worst case and set budgets accordingly.

4. **Same-domain saturation is the #1 risk for expansion states.** NV disperses load across 30+ custom domains. Most expansion states funnel through dutchie.com. The circuit breaker + shuffle + reduced timeouts are essential.

5. **Chain-level failures are correlated.** If one Jars location fails, they all will. The circuit breaker saves massive amounts of time by recognizing this pattern early.
