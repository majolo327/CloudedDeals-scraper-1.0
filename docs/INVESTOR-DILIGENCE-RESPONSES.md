# Investor Diligence Responses — CloudedDeals

*Prepared: Feb 26, 2026 | In response to advisory feedback*

---

## IMPORTANT: PRODUCT CLARIFICATION UP FRONT

Before diving into the questions, there's a foundational misunderstanding that
runs through several sections of the feedback that needs to be corrected.

**CloudedDeals is NOT a review/ranking platform.** It is a **deal aggregation
engine** — closer to Honey, Slickdeals, or GasBuddy than to Untappd or Vivino.

| What the feedback assumes | What CloudedDeals actually is |
|---------------------------|-------------------------------|
| Users write reviews and rate products | No user reviews exist. No rating system. |
| Rankings are crowd-sourced from user votes | Deal scores are **algorithmically computed** from price data (discount %, brand tier, category, price sweet-spot) |
| "Plus Membership" gives weighted votes | No vote system exists. Premium features TBD but would not involve review weighting. |
| Competes with WeedMaps/Leafly on strain info | Does not have strain databases, dispensary reviews, or educational content |
| Two-sided marketplace with ad placements | Dispensary-side revenue will be **featured placement** (pay to surface your deals first), not traditional advertising |
| Users track/journal their consumption | No consumption tracking, no journals, no personal history |

**What users actually do:** Open the app → see today's best cannabis deals near
them (algorithmically scored from 2,078 dispensary menus scraped daily) → tap a
deal → get directed to the dispensary to purchase.

**The real analogue is GasBuddy for weed deals**, not Untappd for weed reviews.

This distinction matters for every section below. Where the feedback assumes
review/ranking mechanics, the responses below redirect to what's actually built.

---

## SECTION 1: HIGH-LEVEL DILIGENCE QUESTIONS

### Does the company fit your thesis?

| Question | Answer |
|----------|--------|
| **Product / technology category** | Cannabis deal aggregation platform — automated deal detection across dispensary menus using web scraping + algorithmic scoring |
| **Customer-focus** | B2C (consumers finding deals) + B2B (dispensaries paying for deal visibility). Consumer-first launch, dispensary revenue follows. |
| **Sales channel / model** | Consumer: free app (web, mobile-responsive). Dispensary: subscription/featured placement (not yet launched). |
| **Fundraising round and size** | Pre-seed. Amount TBD. |

### Is the company compelling?

#### Product / Technology

**How does the product function?**

1. **Data collection:** 33 automated cron jobs run daily across 11 US states.
   Headless Chrome browsers (with anti-bot stealth stack) visit 2,078
   dispensary websites, extract every product's name, brand, price, original
   price, weight, THC%, and category.

2. **Deal detection:** An algorithmic scoring engine (0-100) evaluates every
   product. Filters: minimum 15% discount, state-aware price caps, brand
   recognition, category classification. Quality gates reject incomplete or
   suspicious data.

3. **Curation:** Top 200 deals selected daily, stratified by category (flower,
   vape, edible, concentrate, pre-roll) with deduplication rules (max 2 same
   brand per category per store, max 5 same brand total).

4. **Consumer delivery:** Next.js web app shows deals in a browsable grid or
   Tinder-style swipe mode. Users can search, filter by price/discount/distance,
   save deals, and report inaccuracies.

**How does it fit into existing workflows?**

For consumers: Replaces the current workflow of checking 5-10 dispensary
websites individually before a purchase. Opens app → sees best deals → goes to
dispensary. Zero onboarding friction — no account required.

For dispensaries (future): Integrates with their existing online menus (Dutchie,
Jane, Curaleaf, etc.) — we scrape what they already publish. No integration
work required from the dispensary. Featured placement is an opt-in paid add-on.

**Resources needed to deliver the product:**

- GitHub Actions runners (free tier covers current 33 cron jobs)
- Supabase (PostgreSQL + auth + storage) — currently on free/hobby tier
- Netlify hosting for frontend — free tier
- **Total infrastructure cost: $0-150/month**
- No servers, no DevOps, no cloud VMs

**Impact on cost structure and capital requirements:**

Near-zero marginal cost per additional dispensary or market. Adding a new
dispensary = adding one config entry to a Python dict. The scraper
infrastructure is already built and running at scale. Capital requirements are
minimal until user acquisition spending begins.

---

#### Market

**Total addressable market:**

US legal cannabis retail was ~$30B in 2025, projected $40B+ by 2028. There are
~15,000+ licensed dispensaries across 24 recreational + 38 medical states.

CloudedDeals' TAM has two layers:

| Layer | Description | Size |
|-------|-------------|------|
| **Consumer TAM** | Cannabis consumers who check prices before buying | ~50M Americans used cannabis in 2025; subset who price-shop is estimated 15-25M |
| **Dispensary TAM** | Dispensaries willing to pay for deal visibility | ~15,000 licensed dispensaries × avg. $200-500/mo featured placement = $36-90M annual revenue opportunity |

**What portion is attainable?**

Currently operating in 11 states covering ~4,158 licensed dispensaries. Our
scraping infrastructure covers 2,078 of those (50% penetration of addressable
states). Expansion roadmap targets 3,000+ dispensaries by mid-2026 through
config additions alone (no new scraper code required).

Near-term serviceable market: Nevada consumer launch (103 dispensaries, ~3M
annual tourists + ~600K residents in Clark County). Second market (likely
Michigan) planned for Q2-Q3 2026.

---

#### Product-Market Fit

**What problem is the company solving?**

Cannabis consumers have no efficient way to find deals. Unlike every other
consumer product category (groceries, gas, electronics, travel), there is no
aggregated deal comparison tool for cannabis. Consumers must:

1. Visit each dispensary's website individually
2. Scroll through menus of 300-700+ products per store
3. Mentally compare prices across stores
4. Hope they don't miss a deal that expires that day

CloudedDeals eliminates this by algorithmically surfacing the best 200 deals
from thousands of products across all nearby dispensaries, every day.

**Pain point severity:** Cannabis is expensive ($30-60/eighth in most markets),
deals are ephemeral (daily/weekly), and the number of options is overwhelming.
A 30% discount on a $50 eighth saves $15 per purchase — meaningful to regular
consumers.

**Do we have data showing value creation?**

Honest answer: **Not yet at statistical significance.** We have:
- ~30-50 beta testers in Las Vegas
- Target: 20 daily active users by March 31, 2026
- Deal engagement signals (saves, get-deal clicks) being tracked
- Deal reporting system live (users flag wrong prices, expired deals)

This is the #1 priority — proving Vegas retention before expanding.

**Customer engagement metrics:**

Too early for meaningful NPS. Current focus is reaching 20 DAU with measurable
save/click actions. The product has been live for consumer use since Jan 2026.

---

#### Go-to-Market

**How does the company generate revenue?**

Currently: **$0.** Pre-monetization. Focus is on consumer retention.

Planned revenue model — three tiers (from OPERATIONS.md Phase E roadmap):

| Tier | Customer | Offering | Price Range | Activation Criteria |
|------|----------|---------|-------------|---------------------|
| **Tier 1: Dispensary Leads** | Individual dispensaries | Featured deal placement, priority in shuffle, branded dispensary card, referral traffic reporting | $200-500/mo | 50+ referral clicks/week to a dispensary | *(See Section 7A for detailed inventory model, product tiers, and revenue projections)* |
| **Tier 2: Brand Intelligence** | Brand marketing teams, sales reps, category managers | SaaS dashboard: per-brand pricing analytics, competitive benchmarking, deal performance, market share estimates across dispensaries | $500-2,000/mo | Multi-state data + engagement signals |
| **Tier 3: MSO Market Intelligence** | Multi-state operator strategy teams (Curaleaf, GTI, Cresco, Verano) | Cross-market pricing reports, competitive positioning, discount landscape analysis | $5,000-20,000/mo | 90+ days of multi-state data |

**Revenue activation criteria (from roadmap):** 5,000+ MAU across 2+ states,
90+ days of multi-state data, brand dashboard operational.

**The feedback correctly identifies that dispensaries (not consumers) are the
likely primary revenue source.** But the bigger revenue opportunity may
actually be Tier 2/3 — selling **data intelligence** to brands and MSOs.
Cannabis brands have zero cross-dispensary visibility into how their products
are priced, discounted, or performing at retail vs competitors. We're
collecting this data passively across 2,078 dispensaries already.

**Pricing model comparison:** WeedMaps charges dispensaries $1,000-5,000+/month
for listing and advertising. CloudedDeals' Tier 1 would position significantly
below that ($200-500/month) as a deal-specific channel. But Tiers 2-3 target
a different buyer (brands/MSOs) that WeedMaps doesn't serve well.

**Customer acquisition costs:** Unknown. No paid acquisition yet. Current
testers are organic (word of mouth, cannabis community). A guerrilla QR flyer
campaign for the Vegas Strip is planned (target: <$0.20 CAC per visitor).

**Unit economics:** Too early. Infrastructure costs are near-zero ($0-150/mo),
so the contribution margin on any subscription revenue would be very high.
The data collection infrastructure that would cost a competitor months and
significant capital to replicate is already running.

---

#### Team

[To be completed by founder — team bios, backgrounds, domain expertise,
relevant experience. This section needs the human touch, not auto-generated.]

---

#### Traction

**Honest assessment:**

| Metric | Current | Target (Q1 2026) | Target (Q2 2026) |
|--------|---------|-------------------|-------------------|
| **Paying customers** | 0 | 0 | First 5-10 dispensary pilots |
| **Revenue** | $0 | $0 | $1,000-5,000/mo (pilot revenue) |
| **DAU (consumers)** | ~5-10 | 20 | 100+ |
| **Markets live** | 1 (Las Vegas) | 1 | 2 (+ Michigan) |
| **Dispensaries scraped** | 2,078 | 2,500+ | 3,000+ |
| **Deals curated/day** | ~200 | ~200 | ~400 (multi-market) |

**What we DO have that's atypical for pre-revenue:**
- Fully operational data infrastructure (not a prototype)
- 2,078 dispensaries being scraped daily across 11 states
- Months of price history data accumulating (competitive moat)
- 33 automated cron jobs running without manual intervention
- Functioning consumer product (not a mockup)

---

#### Differentiation and Right-to-Win

**Who are the competitors?**

The feedback lists many names. Here's the actual competitive landscape:

| Competitor | What they do | Revenue model | Relevant to us? |
|-----------|-------------|---------------|-----------------|
| **Weedmaps** | Dispensary directory + advertising platform | Dispensary subscriptions ($1-5K+/mo), ad auctions | **Partially.** They list menus but don't score/curate deals. Different value prop. |
| **Leafly** | Strain database + dispensary listings | Dispensary subscriptions, display ads | **Partially.** Strain-focused, not deal-focused. |
| **Dutchie** | E-commerce/POS platform for dispensaries | SaaS to dispensaries (they power the menus we scrape) | **Not a competitor.** They're infrastructure we depend on. They don't aggregate across stores. |
| **Seedfinder, Lift & Co, MassRoots, Kannatopia, ReLeaf, Strain Print** | Various — most are defunct or niche | Varies | **Not relevant.** Most no longer operate or target different niches. |
| **Google Reviews** | General review platform | Google Ads | **Tangentially.** Consumers check Google ratings but can't find deals there. |
| **Cannasaver** | Cannabis deal/coupon aggregator (primarily Colorado) | Dispensary submissions | **Most direct competitor.** But relies on dispensary-submitted coupons, not automated scraping. Limited to CO primarily. |
| **Individual dispensary websites** | Each store's own menu | Direct sales | **The real "competitor."** We aggregate what they show individually. |

**How is CloudedDeals differentiated from WeedMaps/Leafly?**

| Dimension | WeedMaps | Leafly | CloudedDeals |
|-----------|----------|--------|--------------|
| **Core value** | "Find a dispensary" | "Learn about strains" | "Find the best deal" |
| **Deal discovery** | No deal curation; shows full menu | No deal detection | Algorithmic deal scoring, top 200 curated daily |
| **Price comparison** | No cross-store comparison | No cross-store comparison | Cross-store deal comparison is the product |
| **Dispensary cost** | $1,000-5,000+/mo | $500-2,000+/mo | $200-500/mo target (deal-specific channel) |
| **Data freshness** | Depends on dispensary updating | Depends on dispensary updating | Scraped daily, automated |
| **User action** | Browse menu → order | Read reviews → find dispensary | See deal → go buy |
| **Dispensary sentiment** | "Too expensive," "big budgets win" | "Legacy platform," declining sentiment | Not yet tested (no sales) |

**Critical insight from the feedback:** "Dispensaries seem to think [WeedMaps
is] too expensive and SEO more valuable."

This is our opening. CloudedDeals can position as:
1. **Cheaper** than WeedMaps ($200-500 vs $1,000-5,000)
2. **Performance-based** — your deals surface when they're genuinely good, not
   because you bid highest
3. **Zero integration work** — we scrape your existing menu, you don't change anything
4. **Complementary** — dispensaries can use WeedMaps AND CloudedDeals (multi-homing
   is easy because we don't require exclusivity or integration)

**Are there specific customer segments unhappy with WeedMaps/Leafly?**

Based on the feedback's own observation and industry signals:
- Small/independent dispensaries priced out of WeedMaps ad auctions
- Dispensaries who feel WeedMaps' pay-to-play model favors big chains
- Consumers frustrated by WeedMaps showing every product (no curation)
- Industry skepticism after WeedMaps' inflated user metrics scandal

**WeedMaps financial weakness is real.** They are public (MAPS on Nasdaq),
made major layoffs, got caught inflating MAUs, and have struggled with
profitability. Their IR page (https://ir.weedmaps.com/) shows the challenges.
However, they still have massive market share and brand recognition. We don't
need to "beat" them — we need to capture the deal-discovery niche they don't
serve.

---

## SECTION 2: BUSINESS MODEL — PLATFORM ANALYSIS

### Two-sided marketplace framing

The feedback correctly identifies this as a platform business. However, the
framing needs adjustment:

**CloudedDeals is NOT an advertising platform where "consumers are the product."**

It's a **deal aggregation platform** where:
- **Consumers** get free access to curated deals (the value)
- **Dispensaries** pay for deal visibility/featured placement (the revenue)
- **The algorithm** (not consumer data) is the core product

This is closer to how Google Shopping or Kayak works than how Facebook
Ads works. We don't sell consumer data or attention. We sell deal
distribution.

### Which side is more price-sensitive?

**Consumers — yes, strongly agree with the feedback.** Cannabis consumers are
inherently price-sensitive (that's why a deal app has value). The consumer
side should remain free or very low-cost.

**Dispensaries** are the paying side. Cannabis dispensaries already spend
$1,000-10,000+/month on marketing (WeedMaps, SEO, social media, in-store
signage). A $200-500/month deal visibility channel is within existing budgets.

### Which side needs traction first?

**Consumers, absolutely.** The feedback is correct. No dispensary will pay for
featured placement until there's an audience. This is why the current #1
priority is 20 DAU in Vegas — not monetization.

The strategy:
1. **Now → Q1 2026:** Prove consumer retention in Vegas (20 DAU target)
2. **Q2 2026:** Approach Vegas dispensaries with engagement data ("X users
   viewed your deals last month — want to be featured?")
3. **Q2-Q3 2026:** Launch Michigan consumer product (2nd market)
4. **Q3+ 2026:** Begin dispensary subscription revenue

### Network effects analysis

The feedback's network effects breakdown is largely correct. Here's the
adjusted version for a deal aggregation platform (not a review platform):

**Cross-side positive:** More consumers checking deals → more dispensaries
willing to pay for featured placement → more/better deals surfaced → more
consumers. This is the core flywheel.

**Cross-side negative:** If consumers don't convert (visit the dispensary and
buy), dispensaries won't see ROI on placement. **Mitigation:** Track deal
redemption rates, focus on high-intent users (people who are actively shopping).

**Consumer same-side positive:** More consumers → more deal reports (flagging
wrong prices, expired deals) → better data accuracy → better experience for
all consumers. This is crowd-sourced data quality, not crowd-sourced reviews.

**Consumer same-side negative:** Minimal. Unlike review platforms, there's no
quality degradation from more users because the "content" (deals) is
algorithmically generated, not user-generated.

**Dispensary same-side negative:** Competition for featured placement. But since
featured placement would be a fixed subscription (not an auction), this is
manageable. WeedMaps' auction model is what dispensaries hate — we'd avoid it.

### The CloudedDeals flywheel

```
More dispensary menus scraped
    → More deals detected
    → Better deal curation for consumers
    → More consumers using the app
    → More dispensaries willing to pay for visibility
    → Revenue funds more scrapers / anti-bot tech / expansion
    → More dispensary menus scraped
    (cycle continues)
```

Plus a **data flywheel** running in the background:
```
More daily scrapes across 11 states
    → Deeper price history + brand intelligence
    → Better deal scoring algorithms (state-aware pricing, seasonal patterns)
    → Better deals surfaced
    → More consumer trust
    → More engagement data
    → ML training data for personalized recommendations (future)
```

### "Winner takes all" dynamics

The feedback is right that platform businesses tend toward consolidation.
However, deal aggregation is more fragmented than search or ride-sharing
because:

1. **Cannabis is hyperlocal** — deals only matter within driving distance
2. **Regulatory fragmentation** — each state has different rules, prices,
   brands, and market structures. A national winner needs state-by-state
   calibration.
3. **WeedMaps is vulnerable** — financial struggles, inflated metrics
   scandal, dispensary price complaints. They're not Google-level entrenched.
4. **We don't need to "win" the whole market** — a deal-specific niche can
   coexist with WeedMaps' directory model, just as Slickdeals coexists
   with Amazon.

---

## SECTION 3: VALUE PROPOSITION & CUSTOMER SEGMENTATION

### Core value proposition

**To consumers:** "Find the best cannabis deals near you, every day, without
checking 10 websites."

That's it. Simple. One sentence.

| Pain point | How CloudedDeals solves it |
|-----------|--------------------------|
| Checking multiple dispensary websites is tedious | We aggregate 2,078 menus and show top 200 deals |
| Hard to know if a price is actually good | Algorithmic scoring based on discount %, brand, category, price history |
| Deals change daily and are easy to miss | Fresh data every day via automated scraping |
| Too many products to compare (300-700 per store) | Curated feed — we filter the noise |

**What this is NOT (addressing the brainstorming list from feedback):**
- ❌ Learning — we don't educate about strains or cannabis
- ❌ Personal tracking / journaling — we don't track consumption
- ❌ "Find the best weed" (quality-wise) — we find the best *deals*, not the
  "best" product. A high-quality product at full price won't appear.
- ✅ **Financial savings** — this is the core value
- ❌ Usage management — not our domain

**To dispensaries (future):**
"Get your best deals in front of price-conscious consumers who are ready to
buy — for a fraction of what WeedMaps charges."

| Pain point | How CloudedDeals solves it |
|-----------|--------------------------|
| WeedMaps is expensive ($1-5K/mo) | CloudedDeals targets $200-500/mo |
| Ad auctions favor big budgets | Algorithm-based deal surfacing + optional featured placement at flat rate |
| Consumers price-shop across stores | Be the store that appears when they price-shop |
| No way to know if marketing converts | Future: deal redemption tracking |

### Consumer segmentation

| Segment | Description | Priority | Why |
|---------|-------------|----------|-----|
| **Deal hunters** | Budget-conscious regular buyers who always look for discounts before purchasing | **#1 — Primary** | This is exactly who the product is built for. High frequency, high intent. |
| **Occasional shoppers** | Buy cannabis 1-2x/month, appreciate finding a good deal but don't actively hunt | **#2 — Secondary** | Larger population, lower engagement, but still benefit from deal curation |
| **Cannabis tourists** | Visitors to legal states (especially Las Vegas) who want to buy at fair prices | **#3 — Important for Vegas** | Don't know local prices → highly susceptible to overpaying → deal app is very valuable |
| **Connoisseurs/experts** | Know exactly what they want, less price-sensitive | **Low priority** | CloudedDeals doesn't serve strain discovery or quality evaluation — they'd use Leafly |

**The feedback asks about experts/journal-keepers as priority users.** That
would be correct for a review platform (à la Untappd), but for a deal platform,
the priority user is the person who looks at prices before buying — not the
person who rates products after buying.

---

## SECTION 4: COMPETITIVE LANDSCAPE — DETAILED

### WeedMaps

| Dimension | Detail |
|-----------|--------|
| **Scale** | ~15K+ dispensary listings, presence in all legal states |
| **Revenue model** | Dispensary subscriptions + ad placements (auction-based for premium positions) |
| **Public company** | MAPS on Nasdaq. Major layoffs 2023-2024. Caught inflating MAUs. |
| **Consumer offering** | Dispensary directory, menus, ordering, reviews, deals section (not curated) |
| **Dispensary offering** | Listing, ads, analytics dashboard, ordering integration |
| **Consumer sentiment** | Generally positive for discovery; "useful for finding dispensaries" |
| **Dispensary sentiment** | Mixed to negative — "too expensive," "pay-to-play favors big chains," "SEO more valuable" |
| **Key weakness** | Expensive for dispensaries; no deal curation; trust damaged by metrics scandal |
| **Our angle** | We don't compete on directory/discovery — we compete on deal quality at 1/5th the price |

### Leafly

| Dimension | Detail |
|-----------|--------|
| **Scale** | Large strain database (5,000+ strains), dispensary listings |
| **Revenue model** | Dispensary subscriptions, display advertising |
| **Status** | Private, struggled financially, some negative industry sentiment |
| **Consumer offering** | Strain reviews/info, dispensary finder, educational content |
| **Dispensary offering** | Listing, ads, menu sync |
| **Consumer sentiment** | "Great for strain info," declining engagement, some "legacy platform" sentiment |
| **Dispensary sentiment** | More negative than WeedMaps in recent years |
| **Key weakness** | Strain-focused in a market moving toward brand/deal focus; declining relevance |
| **Our angle** | Completely different product — they do strain education, we do deal discovery |

### Dispensary tech stack (from feedback list)

| Company | Role | Competitor to us? |
|---------|------|-------------------|
| **Dutchie** | E-commerce/POS/online ordering platform | **No — they're infrastructure we depend on.** We scrape 853 Dutchie-powered sites. |
| **Jane (iheartjane)** | E-commerce/online ordering platform | **No — same as Dutchie.** We scrape 182 Jane-powered sites. |
| **FlowHub** | POS system (in-store) | **No.** Back-office tool, no consumer-facing menu. |
| **BioTrackTHC / Metrc** | Seed-to-sale compliance tracking | **No.** Regulatory compliance systems. |
| **POSaBit** | Payment processing | **No.** Payment infrastructure. |
| **GreenBits (now Dutchie POS)** | POS system (acquired by Dutchie) | **No.** |
| **LeafLogix (now Dutchie)** | POS/inventory (acquired by Dutchie) | **No.** |
| **Rank Really High** | Cannabis SEO agency | **No.** Marketing services, not a platform. |
| **Dispense** | Online ordering platform | **Potential scraper target** — we have an AIQ scraper for Dispense-powered sites. |

**Key takeaway:** Most of the "dispensary tech stack" companies are POS,
compliance, or e-commerce platforms. They are **not competitors** — they're the
infrastructure layer that dispensaries use to publish their menus, which we then
scrape. Our relationship to Dutchie/Jane is like Google's relationship to
websites — they create the content, we aggregate and organize it.

**Integration requirements from the feedback:**
- **Table stakes:** None. We don't integrate with dispensary systems — we scrape
  their public-facing menus. This is a feature, not a bug. Zero onboarding
  friction for dispensaries.
- **Differentiating:** Future potential for POS integration (real-time inventory
  accuracy) but not needed for MVP.
- **Nice to have:** Dutchie/Jane API access instead of scraping (faster, more
  reliable, but requires partnerships).

---

## SECTION 5: ANALOGUE BUSINESSES

### Feedback suggests: Untappd (beer), Vivino (wine), Cellartracker (wine)

These are **review platforms** — users rate products and discover based on
community ratings. CloudedDeals is not this.

### Better analogues for a deal aggregation platform:

| Analogue | What they do | Lesson for CloudedDeals |
|----------|-------------|------------------------|
| **GasBuddy** | Crowdsources gas prices, shows cheapest stations nearby | Closest analogue. Deal-focused, location-aware, free to consumers, station advertising revenue. |
| **Slickdeals** | Community-curated deals across retail | Deal aggregation + scoring. Shows that deal-specific platforms can coexist with the retailers themselves. |
| **Honey (acquired by PayPal for $4B)** | Browser extension that finds coupon codes at checkout | Automated deal detection + consumer value = massive exit. Dispensaries are the "e-commerce sites" in our version. |
| **Kayak/Google Flights** | Aggregates flight prices across airlines | Cross-vendor price comparison. Airlines don't love it but consumers do. Similar dynamic with dispensaries. |
| **Flipp** | Aggregates grocery store flyers/deals | Weekly deal aggregation in a category where consumers are price-sensitive. |
| **RetailMeNot** | Coupon/deal aggregation | Deal aggregation with merchant-side revenue (featured deals). |

**If the Untappd/Vivino model were ever pursued** (user reviews + rankings),
that would be a **separate product line**, not the current one. The current
product is pure deal aggregation.

---

## SECTION 6: PROTOTYPE FEEDBACK RESPONSES

### Plus Membership

The feedback assumes a membership that gives "increased weight of votes."
There is no voting system. However, the broader question — "what premium
features could justify a paid tier?" — is valid.

**Possible premium consumer features (if pursued):**

| Feature | Description | Viability |
|---------|-------------|-----------|
| Deal alerts | Push notifications when deals match your preferences (brand, category, price threshold) | Medium — requires knowing preferences, needs engagement data first |
| Advanced filters | Filter by specific brands, weight, THC%, dispensary chain | Medium — some of this is already free |
| Price history | See if today's "deal" is actually a good price historically | High value, unique data asset |
| Early access | See tomorrow's deals before they go live | Low — deals are same-day |
| Ad-free experience | Remove any sponsored/featured deals from feed | Low priority until ads exist |

**Honest assessment:** Consumer premium is unlikely to be a significant revenue
driver. Cannabis consumers are price-sensitive (that's why they want a deal
app). The primary revenue path is dispensary-side.

### "What's the relationship between brands, budtenders, and dispensaries?"

| Entity | Role in our model |
|--------|------------------|
| **Brands** | Detected algorithmically from product names. Same brand appears across multiple dispensaries. Brand tier affects deal score (+20 premium, +12 popular). |
| **Dispensaries** | The "stores" in our aggregation. Each dispensary's menu is scraped independently. A dispensary carries 50-200+ brands. |
| **Budtenders** | Not in our model. We don't involve store staff. The consumer sees the deal online and visits the store. |

Brands are NOT exclusive to dispensaries — STIIIZY, Cookies, Cresco, etc.
appear across many stores. Our deal scoring actually benefits from this: we
can show "STIIIZY pod at 30% off at Store A vs 20% off at Store B."

### Rankings

The feedback asks about ranking types. Since we don't have user-generated
rankings, the relevant equivalent is our **deal scoring algorithm:**

| Scoring dimension | How it works | Analogy to "ranking" |
|------------------|-------------|---------------------|
| **Discount percentage** | Higher discount = higher base score | "Best deal" ranking |
| **Brand tier** | Premium brands get +20, popular +12 | "Best brands on sale" |
| **Category** | Flower/vape get +8, concentrate/preroll +7 | "Best deals by product type" |
| **Price sweet-spot** | Extra points if under $20 | "Best budget deals" |
| **THC bonus** | +10 if >25% THC | "Best high-potency deals" |

The deal score IS the ranking. It's algorithmic, not crowd-sourced. It updates
daily because prices change daily.

### Feature ideas from feedback

| Suggested feature | Assessment |
|------------------|------------|
| **Availability / stock alerts** | Good future feature. Requires real-time inventory data (currently we scrape 1x/day). Would need POS integration or more frequent scraping. |
| **Auto-pull from receipt** | Not applicable — we don't track purchases or consumption. This is for a review platform. |
| **Enable pickup/delivery orders** | Interesting but transforms us from aggregator to e-commerce. Adds massive complexity (POS integration, order management, legal compliance). Not near-term. |
| **Playlist functionality** | If this means "saved collections of deals" — we have basic deal saving (localStorage). Could evolve into themed collections ("weekend deals," "under $20 deals"). |

---

## SECTION 7: INVESTMENT OPPORTUNITY

### Deal economics

| Metric | Current | 12-month projection |
|--------|---------|-------------------|
| **Infrastructure cost** | $0-150/mo | $300-500/mo (scaled Supabase) |
| **Revenue** | $0 | $3,000-5,000/mo Tier 1 pilots → see Section 7A for 24-month scaling model |
| **Gross margin** | N/A | ~95%+ (near-zero COGS) |
| **CAC (consumer)** | $0 (organic only) | TBD (depends on paid channels) |
| **CAC (dispensary)** | $0 | Low — direct outreach to Vegas dispensaries |
| **Burn rate** | Minimal (founder time + near-zero infra) | TBD based on raise |

### What investment funds

| Use of funds | Priority | Why |
|-------------|----------|-----|
| **Consumer acquisition (Vegas)** | #1 | Prove retention → unlock dispensary revenue |
| **Second market launch (Michigan)** | #2 | Prove multi-market model |
| **Dispensary sales (founder time)** | #3 | First revenue milestone |
| **Anti-bot infrastructure** | #4 | Residential proxies to unblock Rise + harden against future blocks |
| **Mobile app** | #5 | Native app for better engagement (currently web-only) |

### Key risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Anti-bot escalation** | High | Rise (GTI) already blocked us. More platforms may follow. Mitigation: residential proxy rotation, API partnerships, legal aggregation arguments. |
| **WeedMaps competing on deals** | Medium | They could add deal curation. But their incentive is to sell ads, not curate deals — those interests conflict. |
| **Consumer adoption** | High | Unproven. 20 DAU target not yet hit. If consumers don't adopt, dispensary revenue never materializes. |
| **Legal/regulatory** | Medium | Web scraping is legally gray. Cannabis advertising regulations vary by state. Need legal counsel. |
| **Single-founder risk** | High | Standard early-stage risk. Investment could fund team expansion. |

---

## SECTION 7A: FEATURED PLACEMENT REVENUE MODEL — HOW TIER 1 SCALES

The diligence doc references "$200-500/mo featured placement" as the primary
near-term revenue stream (Tier 1). An obvious question follows: **with limited
screen real estate per market, how does $200-500/dispensary become a real
business?**

Short answer: screen real estate is not the constraint. Revenue is a function
of **(surfaces × slots × rotation × markets × geo-segments × DAU-driven
pricing)**, not "how many featured cards fit on one screen." This section lays
out the math.

---

### 7A.1 — Placement Inventory Model

Every distinct UI surface is a separate pool of placement inventory. The
current product already has multiple surfaces live, with more planned:

| Surface | Description | Slots per Market | Status |
|---------|-------------|-----------------|--------|
| **Home Feed** | Top positions in the daily deals grid (12-card deck, 2-4 col responsive) | 4-6 featured positions | Live |
| **Category Pages** (×5) | Flower, Vape, Edible, Concentrate, Pre-roll — each a separate feed | 2-3 per category = **10-15 total** | Live |
| **Search Results** | Promoted dispensary/deal at top of search results | 1-2 per search query | Live |
| **Dispensary Browse** | "Featured Dispensary" highlighted card in alphabetical list | 2-3 | Live |
| **Deal Detail Modal** | "More deals from this dispensary" or "Similar deal at [sponsor]" | 1 per modal view | Live |
| **Strip/Tourist Page** | `/strip` — curated tourist-facing dispensary page (15 curated stores) | 2-3 | Live |
| **SEO Category Landings** | `/deals/flower`, `/deals/vapes`, etc. — ISR pages, hourly refresh | 2-3 per page | Live |
| **SEO Market Landing** | `/las-vegas-dispensary-deals` — main SEO entry point | 3-5 | Live |
| **SMS/Push Alerts** | Sponsored deal in daily deal digest ("Today's top deal from [dispensary]") | 1 per notification | Planned (SMS waitlist pipeline built) |
| **Deal Alerts** | Price-drop alert sponsorship ("[Dispensary] just dropped prices on [category]") | 1 per alert | Planned (Phase F) |

**Raw slot count per market: ~25-35 unique placement positions.**

But each slot doesn't serve only one paying dispensary. Time-based rotation
(round-robin or impression-weighted) means 3-4 dispensaries share each slot
across page loads and sessions. This is standard for digital ad inventory —
GasBuddy, Yelp, and Google Maps all rotate promoted listings the same way.

**Effective capacity per market: 75-140 simultaneous paying dispensaries.**

Las Vegas currently has 63 active dispensaries in our system. That means
**the entire Vegas market could be monetized with zero scarcity pressure.**
Every dispensary that wants to pay can pay — there's no bidding war for
limited slots.

---

### 7A.2 — Product Tiers

A tiered product ladder captures different willingness-to-pay and creates
natural upsell paths:

| Tier | Name | What They Get | Price |
|------|------|---------------|-------|
| **Free** | Standard Listing | Deals appear organically based on algorithm score. No cost, no action required — we scrape their existing menu. | $0 |
| **Bronze** | Featured Dispensary | Priority in curated shuffle algorithm (+15 score boost), branded dispensary card in Browse page, monthly referral traffic report | $200/mo |
| **Silver** | Featured Deals | Everything in Bronze + 1 featured slot on Home Feed (rotated), featured position in 1 category page of choice, subtle "Featured" badge on deal cards | $350/mo |
| **Gold** | Premium Placement | Everything in Silver + featured across all relevant category pages, push notification inclusion (1×/week), search result boost, dispensary page cross-promotion | $500/mo |

**Pricing rationale:**

- **WeedMaps charges $1,000-5,000+/mo** for dispensary listings and ad
  placements. CloudedDeals positions at **1/5th to 1/2** that cost.
- A Las Vegas dispensary spending $50K+/month on marketing (common for
  high-traffic Strip stores like Planet 13, Medizin) sees $200-500/mo as a
  rounding error in their marketing budget.
- **Flat-rate, not auction.** This is a deliberate structural choice.
  Dispensaries hate WeedMaps' auction model because big chains outbid
  independents and costs escalate unpredictably. Flat pricing = predictable
  monthly cost, no bidding wars. Small independents (Wallflower, Jenny's,
  Euphoria) compete on the same terms as large operators.

---

### 7A.3 — Revenue Build by Market

**Assumptions (stated up front):**

- **Conservative:** 15% of dispensaries in a live consumer market convert to paid
- **Moderate:** 25% conversion
- **Optimistic:** 40% conversion
- **Blended ARPD:** $300/mo average across tiers (mix of Bronze/Silver/Gold)
- Each new consumer market takes ~3 months from data-collection → consumer
  launch → first dispensary sale

**Market-by-market projections:**

*Conversion rates apply to "Sales-Reachable" count — dispensaries in metro
areas where we'd actively sell in Year 1. This is deliberately smaller than
total scraped count to keep projections honest.*

| Market | Scraped | Sales-Reachable (Yr 1) | Timeline | Conservative (15%) | Moderate (25%) | Optimistic (40%) |
|--------|---------|----------------------|----------|-------------------|----------------|-----------------|
| **Las Vegas** | 63 | 63 | Live now | 9 × $300 = **$2,700/mo** | 16 × $300 = **$4,800/mo** | 25 × $300 = **$7,500/mo** |
| **Michigan** | 446 | 120 | Q3 2026 | 18 × $300 = **$5,400/mo** | 30 × $300 = **$9,000/mo** | 48 × $300 = **$14,400/mo** |
| **Illinois** | 166 | 90 | Q4 2026 | 14 × $300 = **$4,200/mo** | 23 × $300 = **$6,900/mo** | 36 × $300 = **$10,800/mo** |
| **Arizona** | 127 | 70 | Q1 2027 | 11 × $300 = **$3,300/mo** | 18 × $300 = **$5,400/mo** | 28 × $300 = **$8,400/mo** |
| **New Jersey** | 232 | 80 | Q1 2027 | 12 × $300 = **$3,600/mo** | 20 × $300 = **$6,000/mo** | 32 × $300 = **$9,600/mo** |
| **Colorado** | 200 | 100 | Q2 2027 | 15 × $300 = **$4,500/mo** | 25 × $300 = **$7,500/mo** | 40 × $300 = **$12,000/mo** |

**Cumulative MRR milestones (moderate scenario):**

| Milestone | Markets Live | Paying Dispensaries | MRR | ARR |
|-----------|-------------|--------------------|----|-----|
| **Month 6** (Aug 2026) | 1 (Vegas) | 10-16 | $3,000-4,800 | $36K-58K |
| **Month 12** (Feb 2027) | 3 (+ MI, IL) | 50-69 | $15,000-20,700 | $180K-248K |
| **Month 18** (Aug 2027) | 6 (+ AZ, NJ, CO) | 100-132 | $30,000-39,600 | $360K-475K |
| **Month 24** (Feb 2028) | 8-10 states | 150-200 | $45,000-60,000 | $540K-720K |

**Critical context:** These numbers are **Tier 1 only** (featured placements
for dispensaries). Tiers 2 and 3 — Brand Intelligence ($500-2,000/mo per
brand) and MSO Intelligence ($5,000-20,000/mo per MSO) — target entirely
different buyers with different budgets and are additive to Tier 1 revenue.
A single MSO contract at $10K/mo equals 33 dispensary subscriptions. See
Section 7A.6 for the blended revenue stack.

---

### 7A.4 — Five Scaling Levers (Why There Is No Ceiling)

**Lever 1: Market Multiplication**

Each consumer market is an entirely separate inventory pool. Featured slots in
Las Vegas have zero overlap with featured slots in Detroit. Adding a new
consumer market requires zero new scraper code — just enabling the frontend
for that region and beginning sales outreach. The data collection
infrastructure already covers 11 states / 2,078 dispensaries. Even capturing
5% of the ~15,000 US dispensaries at $300/mo = **$2.7M ARR** from Tier 1
alone.

**Lever 2: Time-Based Rotation**

Physical billboards rotate advertisers. Digital placements work the same way.
Each featured slot serves 3-4 paying dispensaries via impression rotation
(round-robin or weighted by tier). With 4 Home Feed slots rotating 4
dispensaries each = 16 payers from just the home feed. Across all surfaces and
rotation, a single market supports **75-140 simultaneous payers** without
degrading user experience.

**Lever 3: Geo-Segmentation Within Market**

Las Vegas is not one market from a user's perspective. A tourist on the Strip
sees different dispensaries than a resident in Henderson or North Las Vegas.
The codebase already has a curated Strip dispensary page (`/strip`) with 15
hand-picked stores and zone filters (Strip, Downtown, Local) in the Browse
page. Geo-targeting splits one metro's inventory into micro-markets. A
"Featured near you" slot for the Strip is different inventory from "Featured
near you" for Henderson. This **2-3× multiplies** inventory within a single
metro area.

**Lever 4: Surface Multiplication**

The current frontend has 8+ distinct placement surfaces (see 7A.1 table). The
product roadmap adds more — push notifications, deal alerts, brand pages,
dispensary comparison pages. Each new surface creates new placement inventory
at zero marginal cost. Category-specific placements are particularly valuable:
a dispensary known for concentrates pays to be featured on the concentrate
category page, not the flower page. This creates natural segmentation that
increases total inventory without slot competition.

**Lever 5: DAU-Driven Price Escalation**

As DAU grows per market, the value of each placement increases. Pricing should
scale with audience:

| Market Maturity | DAU | Tier Range |
|----------------|-----|------------|
| **Launch** | <100 DAU | $200-500/mo |
| **Established** | 500-1,000 DAU | $400-800/mo |
| **Mature** | 5,000+ DAU | $800-1,500/mo |

This is how every advertising-adjacent business scales: same inventory, higher
prices as audience grows. GasBuddy's per-station ad pricing increased 5-10×
as their user base grew from thousands to millions. Even at the launch price
floor ($200-500/mo), infrastructure costs of $0-150/mo mean **~95%+ gross
margin** on every subscription dollar.

---

### 7A.5 — Why Flat-Rate Wins Over WeedMaps' Auction Model

An investor will ask: "won't you just become WeedMaps 2.0?" The pricing model
is structurally different by design:

| Dimension | WeedMaps (Auction) | CloudedDeals (Flat-Rate) |
|-----------|--------------------|--------------------------|
| **Pricing mechanism** | Highest bidder wins premium placement | Fixed monthly subscription by tier |
| **Cost to dispensary** | $1,000-5,000+/mo; escalates as competitors bid | $200-500/mo; fixed, predictable |
| **Who wins placement** | Dispensaries with biggest marketing budgets | Dispensaries with the best actual deals + optional visibility boost |
| **Dispensary sentiment** | "Too expensive," "pay-to-play," "big budgets always win" | Positioned as affordable alternative with zero lock-in |
| **Contract structure** | Annual contracts, integration requirements | Month-to-month, zero integration (we scrape their existing menu) |
| **Revenue quality** | Higher ARPU but higher churn (dispensaries shop for cheaper options) | Lower ARPU but higher retention (affordable, easy to justify keeping) |
| **Consumer trust** | Users know placements are "paid ads" — declining trust | Algorithm still gates deal quality; featured = visibility boost, not quality override |

**The critical distinction:** A featured placement on CloudedDeals means "your
deals get seen by more people" — not "your mediocre deals replace genuinely
good deals." The scoring algorithm still runs. A dispensary with no real
discounts gets zero value from featured placement because there's nothing good
to feature. This alignment between consumer trust and dispensary ROI is what
makes the model sustainable long-term.

Cannabis dispensaries' vocal frustration with WeedMaps' pricing (documented in
industry forums and confirmed by the advisory feedback that prompted this
diligence doc) creates a clear market opening. We don't need to replace
WeedMaps — we need to capture the deal-distribution niche they actively
choose not to serve (because auction ad revenue is more lucrative for them
in the short term).

---

### 7A.6 — The Complete Revenue Stack (All Three Tiers)

Tier 1 (featured placements) is the beachhead — fastest to activate because
it requires only consumer DAU. But the full revenue picture compounds all
three tiers:

**24-Month Revenue Composition (Moderate Scenario):**

| Revenue Stream | Month 6 | Month 12 | Month 18 | Month 24 |
|---------------|---------|----------|----------|----------|
| **Tier 1: Featured Placements** | $4K/mo | $18K/mo | $35K/mo | $50K/mo |
| **Tier 2: Brand Intelligence** | $0 | $2K/mo | $8K/mo | $20K/mo |
| **Tier 3: MSO Intelligence** | $0 | $0 | $5K/mo | $15K/mo |
| **Total MRR** | **$4K** | **$20K** | **$48K** | **$85K** |
| **Total ARR** | **$48K** | **$240K** | **$576K** | **$1.02M** |

**Why Tiers 2-3 compound with Tier 1:**

- **Tier 2 (Brand Intelligence)** requires multi-state data depth. That data
  is already accumulating passively from 2,078 daily scrapes across 11 states.
  By Month 12, we'll have 12+ months of cross-market price history — the kind
  of competitive intelligence that brands literally cannot get anywhere else.
  Different buyer (brand marketing teams), different budget, additive to
  dispensary revenue.

- **Tier 3 (MSO Intelligence)** requires the deepest data. By Month 18, 90+
  days of multi-state data across 6+ markets makes enterprise reports viable.
  A single MSO contract ($10K/mo) equals 33 dispensary subscriptions. Different
  buyer (corporate strategy teams at Curaleaf, GTI, Cresco, Verano), different
  budget cycle (enterprise procurement), and completely additive.

**The diversification matters:** If dispensary budgets tighten in a downturn,
brand intelligence revenue continues because it serves different buyers with
different budgets. The three tiers are naturally hedged against each other.

---

## SECTION 8: QUESTIONS TO DISCUSS FURTHER

These require founder input and can't be answered from the codebase alone:

1. **Team section** — bios, backgrounds, domain expertise, why this team
2. **Fundraise specifics** — round size, valuation expectations, use of funds detail
3. **Consumer acquisition strategy** — what channels, what budget, what messaging
4. **Legal review** — scraping legality, cannabis advertising compliance by state
5. **Dispensary outreach plan** — who are the first 5-10 pilot dispensaries in Vegas?
6. **WeedMaps financial deep dive** — their IR page has detailed financials worth analyzing
7. **Partnership opportunities** — Dutchie/Jane API access instead of scraping?

---

*End of Investor Diligence Responses*
