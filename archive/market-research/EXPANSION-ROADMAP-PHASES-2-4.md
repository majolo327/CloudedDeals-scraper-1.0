# Expansion Roadmap: Phase 2-4 Gap Analysis

*Generated: Feb 17, 2026 | Post-Jane Sprint planning for March/April execution*

---

## What We Just Did (Jane Sprint — Feb 2026)

| State | Jane Before | Jane After | Net New | Total Active Sites |
|---|---|---|---|---|
| **Colorado** | 33 | 80 | +47 | 185 |
| **Michigan** | 0 | 80 | +80 | 266 |
| **Massachusetts** | 10 | 80 | +70 | 166 |
| **TOTAL** | 43 | 240 | **+197** | — |

**Platform totals after sprint:**
- Dutchie: 846 sites (unchanged)
- Jane: 352 sites (was 181 — **+94% increase**)
- Curaleaf: 109 sites (unchanged)
- **Total active: 1,314** (was 1,143 — **+15% increase**)

---

## Phase 2: Dutchie Expansion Sprint (Target: March 2026)

### Goal
Add ~200 new Dutchie sites across CO, MI, MA — the same 3 states where we just
added Jane. These states have the largest Dutchie gaps relative to TAM.

### State-by-State Dutchie Gaps

| State | Dutchie Now | Estimated TAM | Gap | Research Targets |
|---|---|---|---|---|
| **Colorado** | 100 | ~300-400 | **200-300** | Native Roots (25), Lightshade (8), LivWell (12), Green Dragon (15), Schwazze/Star Buds (10), 100+ independents |
| **Michigan** | 195 | ~350-400 | **155-205** | Puff Cannabis (13), House of Dank (8), Exclusive (7), smaller chains + independents |
| **Massachusetts** | 93 | ~200-250 | **107-157** | NETA (3+ locations), Good Chemistry, AYR (multiple), Harbor House, Trulieve MA, smaller chains |

### Research Tasks
1. Pull state regulator license lists (CO MED, MI CRA, MA CCC)
2. Cross-reference every licensed dispensary against our config
3. Visit each uncovered dispensary website — check for dutchie.com in iframe/script tags
4. Record: name, slug, Dutchie URL, embed type (iframe/js_embed/direct), chain affiliation
5. Add entries to `dispensaries.py` — NO cron changes needed (existing shards handle growth)

### Expected Yield
+200 Dutchie sites -> total Dutchie ~1,046 -> total active ~1,514

---

## Phase 3: Jane + Dutchie for Remaining Gap States (Target: Late March 2026)

### Goal
Bring Missouri, Arizona, Ohio, and Pennsylvania closer to 50% TAM coverage.

### State-by-State Gaps

#### Missouri (42% coverage — 89 sites / ~210 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 89 | ~40 more | HIGH — Dutchie-dominant market |
| Jane | 0 | ~40 | HIGH — zero Jane, same as MI was |
| Curaleaf | 0 | ~3-5 | LOW |
| **Total gap** | | **~80 new sites** | |

**Key chains to research:**
- Jane: C4 Cannabis, Fresh Green, Good Day Farms, The Source MO, Cloud Nine
- Dutchie: additional Greenlight, Swade, N'Bliss, From The Earth, Star Buds MO

#### Arizona (55% coverage — 99 sites / ~180 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 74 | ~46 | MEDIUM |
| Jane | 3 | ~27 | HIGH — only 3 Jane sites |
| Curaleaf | 22 | ~0 | Saturated |
| **Total gap** | | **~73 new sites** | |

**Key chains to research:**
- Jane: Giving Tree, Nirvana Center AZ, Green Pharms, Oasis AZ, various Tucson/Flagstaff independents
- Dutchie: additional Territory, JARS AZ, Debbie's Dispensary, Earth's Healing

#### Ohio (41% coverage — 78 sites / ~190 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 46 | ~24-44 | MEDIUM |
| Jane | 23 | ~17-27 | MEDIUM |
| Curaleaf | 9 | ~0 | Saturated |
| **Total gap** | | **~50-70 new sites** | |

**Key chains to research:**
- Market is shifting rapidly post-rec (Aug 2024) — many new licenses activating
- Bloom (expanding), Sunnyside OH, Verilife OH, Pure Ohio Wellness, Firelands Scientific

#### Pennsylvania (23% coverage — 43 sites / ~191 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 10 | ~30-50 | HIGH |
| Jane | 0 | ~30-40 | HIGH — zero Jane |
| Curaleaf | 33 | ~0 | Saturated |
| **Total gap** | | **~60-90 new sites** | |

**Note:** PA is medical-only. Recreational legalization may happen in 2026. If it does, the TAM will grow dramatically. Worth building the foundation now.

**Key chains to research:**
- Dutchie: Trulieve PA, Vytal Options, Columbia Care PA, Organic Remedies, Maitri
- Jane: Beyond Hello PA (5+ locations), Verilife PA, The Botanist PA, Sunnyside PA

### Expected Yield
Phase 3 total: ~250-300 new sites across 4 states

---

## Phase 4: New York Deep Dive + Remaining Gaps (Target: April 2026)

### Goal
NY has the lowest coverage (13%) but also the most uncertain market. By April,
more CAURD licenses will be operational and platform patterns clearer.

#### New York (13% coverage — 74 sites / ~588 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 49 | ~101-151 | HIGH — most CAURD licensees use Dutchie |
| Jane | 19 | ~31-61 | MEDIUM |
| Curaleaf | 6 | ~0 | Saturated |
| **Total gap** | | **~130-200+ new sites** | |

**Key research:**
- NY OCM licensed retailer list (updated monthly)
- CAURD dispensaries opening rapidly in NYC boroughs
- Platform detection: most new NYC dispensaries land on Dutchie
- Key gaps: Cookies NYC, MedMen expansion, new social equity brands

#### New Jersey (68% coverage — 102 sites / ~150 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 78 | ~7-12 | LOW — near ceiling |
| Jane | 18 | ~7-12 | LOW — near ceiling |
| **Total gap** | | **~15-25 new sites** | |

**Key research:**
- NJ CRC conditional licenses now becoming operational
- Harmony, Breakwater (proprietary platforms — not scrapeable without new scrapers)
- Some new independent operators opening in 2026

#### Illinois (72% coverage — 165 sites / ~230 TAM)
| Platform | Now | Gap | Priority |
|---|---|---|---|
| Dutchie | 98 | ~2-12 | LOW — near ceiling |
| Jane | 54 | ~1-11 | LOW — near ceiling |
| **Total gap** | | **~5-15 new sites** | |

**Note:** IL is nearly maxed on supported platforms. Remaining gap is Sunnyside (Cresco, ~15 locations) which needs a new scraper.

### Expected Yield
Phase 4 total: ~150-240 new sites (mostly NY)

---

## Summary: 4-Phase Expansion Roadmap

| Phase | Timeline | States | New Sites | Cumulative Active |
|---|---|---|---|---|
| **Jane Sprint** (done) | Feb 2026 | CO, MI, MA | +197 Jane | 1,314 |
| **Phase 2** | March 2026 | CO, MI, MA | +200 Dutchie | ~1,514 |
| **Phase 3** | Late March | MO, AZ, OH, PA | +250-300 | ~1,764-1,814 |
| **Phase 4** | April 2026 | NY, NJ, IL | +150-240 | ~1,914-2,054 |
| **TOTAL** | | 11 states | **+797-937** | **~2,054** |

### TAM Coverage Projection

| State | Before Sprint | After Phase 2 | After Phase 3 | After Phase 4 |
|---|---|---|---|---|
| **Colorado** | 17% | **35-40%** | 35-40% | 35-40% |
| **Michigan** | 20% | **35-40%** | 35-40% | 35-40% |
| **Massachusetts** | 27% | **45-50%** | 45-50% | 45-50% |
| **Missouri** | 42% | 42% | **55-65%** | 55-65% |
| **Arizona** | 55% | 55% | **75-85%** | 75-85% |
| **Ohio** | 41% | 41% | **55-65%** | 55-65% |
| **Pennsylvania** | 23% | 23% | **40-50%** | 40-50% |
| **New York** | 13% | 13% | 13% | **30-40%** |
| **New Jersey** | 68% | 68% | 68% | **75-80%** |
| **Illinois** | 72% | 72% | 72% | **72-75%** |
| **S. Nevada** | 51% | 51% | 51% | 51% |
| **OVERALL** | **~27%** | **~32%** | **~40%** | **~48%** |

### New Scraper Priorities (Not in this roadmap — separate engineering sprints)

| Scraper | States | Est. Sites | When |
|---|---|---|---|
| **Sunnyside (Cresco)** | IL, MA, NY, OH | ~25 | After Phase 4 |
| **Weedmaps embed** | MI, CO, AZ, MO | ~165 | Q3 2026 |
| **Leafly embed** | MI, CO, IL | ~50 | Q3 2026 |

Building Sunnyside + Weedmaps scrapers would add ~190 sites and push overall coverage from ~48% to ~53%.

---

## Research Methodology Checklist

For each phase, follow this process per state:

- [ ] Pull official state license list from regulator website
- [ ] Cross-reference every licensed dispensary against `dispensaries.py`
- [ ] For each uncovered dispensary, visit website and identify platform:
  - Dutchie: look for `dutchie.com` in iframes/scripts
  - Jane: look for `iheartjane.com` in iframes/scripts
  - Curaleaf: check if URL is `curaleaf.com/shop/` or `zenleafdispensaries.com`
  - Other: note platform for future scraper development
- [ ] Record: name, slug, URL, embed type, chain, region
- [ ] Add entries to `dispensaries.py` with `is_active: True`
- [ ] Run `python -m pytest tests/` to verify no config errors
- [ ] Commit and push — sites will be picked up by next cron run automatically

---

*End of Expansion Roadmap*
