import type { Deal, Category } from '@/types';
import { getChainId } from '@/utils/dealFilters';

/**
 * Curated Shuffle — hero slots + tier-based weighted shuffle.
 *
 * Hero Slots (positions 0-6):
 *   Each slot pins the cheapest qualifying deal from a priority category,
 *   ensuring the user's first impression is the absolute best deal in
 *   each product type consumers care most about.
 *
 *   0: Cheapest 100mg edible
 *   1: Cheapest full-gram disposable vape (0.8-1g)
 *   2: Cheapest preroll
 *   3: Cheapest 3.5g flower (eighth)
 *   4: Cheapest 7g flower (quarter)
 *   5: Cheapest half-gram disposable vape (0.3-0.5g)
 *   6: Cheapest 14g flower (half oz)
 *
 * Tiers (for remaining deals):
 *   Tier 1 (top ~20%): deal_score >= 75 — "Steals" — 40% of output
 *   Tier 2 (mid ~50%): deal_score 40–74 — "Solid picks" — 45% of output
 *   Tier 3 (bottom ~30%): deal_score < 40 — "Discovery" — 15% of output
 *
 * Diversity constraints (applied during interleaving):
 *   - Max 3 consecutive same-category deals
 *   - Max 2 consecutive same-dispensary deals
 *   - No back-to-back same brand
 *
 * Seeded shuffle: deterministic within a session (date + anonId) so the
 * user sees a consistent order on re-render, but a fresh order each day.
 */

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────

function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Fisher-Yates with seeded RNG ────────────────────────────────────

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Weight parsing ──────────────────────────────────────────────────

/** Parse the weight string ("3.5g", "100mg", "1g") into grams. */
function parseWeightGrams(weight: string): number | null {
  if (!weight) return null;
  const mg = weight.match(/^([\d.]+)\s*mg$/i);
  if (mg) return parseFloat(mg[1]) / 1000;
  const g = weight.match(/^([\d.]+)\s*g$/i);
  if (g) return parseFloat(g[1]);
  return null;
}

/** Parse weight string into mg (for edibles). */
function parseWeightMg(weight: string): number | null {
  if (!weight) return null;
  const mg = weight.match(/^([\d.]+)\s*mg$/i);
  if (mg) return parseFloat(mg[1]);
  return null;
}

// ── Hero slot extraction ────────────────────────────────────────────

/**
 * Hero slot definitions — each defines a product niche and how to
 * identify the best (cheapest) qualifying deal for that slot.
 *
 * Order reflects consumer priority:
 *   Edibles (mass market) → Disposable vapes (trending) → Prerolls
 *   (impulse) → Flower eighths/quarters (core) → Half-gram vapes →
 *   Half-oz flower (value seekers)
 */
interface HeroSlotDef {
  label: string;
  match: (deal: Deal) => boolean;
}

const HERO_SLOTS: HeroSlotDef[] = [
  {
    label: 'cheapest_100mg_edible',
    match: (d) => {
      if (d.category !== 'edible') return false;
      const mg = parseWeightMg(d.weight);
      return mg !== null && mg >= 80 && mg <= 120;
    },
  },
  {
    label: 'cheapest_1g_disposable_vape',
    match: (d) => {
      if (d.category !== 'vape') return false;
      if (d.product_subtype !== 'disposable') return false;
      const g = parseWeightGrams(d.weight);
      return g !== null && g >= 0.7 && g <= 1.1;
    },
  },
  {
    label: 'cheapest_preroll',
    match: (d) => {
      if (d.category !== 'preroll') return false;
      // Exclude infused prerolls and packs — keep it simple/affordable
      if (d.product_subtype === 'infused_preroll') return false;
      if (d.product_subtype === 'preroll_pack') return false;
      return true;
    },
  },
  {
    label: 'cheapest_3.5g_flower',
    match: (d) => {
      if (d.category !== 'flower') return false;
      const g = parseWeightGrams(d.weight);
      return g !== null && g >= 3.0 && g <= 4.0;
    },
  },
  {
    label: 'cheapest_7g_flower',
    match: (d) => {
      if (d.category !== 'flower') return false;
      const g = parseWeightGrams(d.weight);
      return g !== null && g >= 6.5 && g <= 8.0;
    },
  },
  {
    label: 'cheapest_halfg_disposable_vape',
    match: (d) => {
      if (d.category !== 'vape') return false;
      if (d.product_subtype !== 'disposable') return false;
      const g = parseWeightGrams(d.weight);
      return g !== null && g >= 0.25 && g <= 0.6;
    },
  },
  {
    label: 'cheapest_14g_flower',
    match: (d) => {
      if (d.category !== 'flower') return false;
      const g = parseWeightGrams(d.weight);
      return g !== null && g >= 13.0 && g <= 15.0;
    },
  },
];

/**
 * Extract hero deals — the cheapest qualifying deal for each hero slot,
 * with a dispensary-spread constraint so the first 7 cards aren't all
 * from the same store.
 *
 * Rule: each dispensary may appear at most once in hero slots.  If the
 * cheapest qualifying deal for a slot comes from a dispensary that
 * already has a hero, pick the next-cheapest from a *different* store.
 * This ensures the user's first impression shows variety across stores.
 */
function extractHeroDeals(deals: Deal[]): {
  heroes: Deal[];
  remaining: Deal[];
} {
  const usedIds = new Set<string>();
  const usedDispensaries = new Set<string>();
  const heroes: Deal[] = [];

  for (const slot of HERO_SLOTS) {
    // Collect all qualifying candidates sorted by price (cheapest first)
    const candidates: Deal[] = [];
    for (const deal of deals) {
      if (usedIds.has(deal.id)) continue;
      if (!slot.match(deal)) continue;
      candidates.push(deal);
    }
    candidates.sort((a, b) => a.deal_price - b.deal_price);

    // Pick the cheapest from a dispensary we haven't used yet;
    // fall back to the cheapest overall if every candidate's
    // dispensary is already represented (variety > nothing).
    let picked: Deal | null = null;
    for (const deal of candidates) {
      const dispId = deal.dispensary?.id ?? '';
      if (!usedDispensaries.has(dispId)) {
        picked = deal;
        break;
      }
    }
    // Fallback: if every candidate dispensary is taken, use the cheapest
    if (!picked && candidates.length > 0) {
      picked = candidates[0];
    }

    if (picked) {
      heroes.push(picked);
      usedIds.add(picked.id);
      usedDispensaries.add(picked.dispensary?.id ?? '');
    }
  }

  const remaining = deals.filter((d) => !usedIds.has(d.id));
  return { heroes, remaining };
}

// ── Tier classification ─────────────────────────────────────────────

interface TieredDeals {
  tier1: Deal[]; // score >= 75
  tier2: Deal[]; // score 40–74
  tier3: Deal[]; // score < 40
}

function classifyTiers(deals: Deal[]): TieredDeals {
  const tier1: Deal[] = [];
  const tier2: Deal[] = [];
  const tier3: Deal[] = [];

  for (const deal of deals) {
    if (deal.deal_score >= 75) tier1.push(deal);
    else if (deal.deal_score >= 40) tier2.push(deal);
    else tier3.push(deal);
  }

  return { tier1, tier2, tier3 };
}

// ── Diversity-constrained interleave ────────────────────────────────

interface DiversityState {
  lastCategories: Category[];
  lastDispensaries: string[];
  lastChains: string[];
  lastBrand: string | null;
}

function passesDiversity(deal: Deal, state: DiversityState): boolean {
  // No back-to-back same brand
  if (state.lastBrand && deal.brand?.id === state.lastBrand) {
    return false;
  }

  // Max 3 consecutive same category
  if (
    state.lastCategories.length >= 3 &&
    state.lastCategories.every((c) => c === deal.category)
  ) {
    return false;
  }

  // Max 2 consecutive same dispensary
  if (
    state.lastDispensaries.length >= 2 &&
    state.lastDispensaries.every((d) => d === deal.dispensary?.id)
  ) {
    return false;
  }

  // Max 2 consecutive same chain (Rise-Tropicana → Rise-Rainbow = same chain)
  const chain = getChainId(deal.dispensary?.id ?? '');
  if (
    state.lastChains.length >= 2 &&
    state.lastChains.every((c) => c === chain)
  ) {
    return false;
  }

  return true;
}

function updateDiversityState(state: DiversityState, deal: Deal): void {
  state.lastCategories = [...state.lastCategories.slice(-2), deal.category];
  state.lastDispensaries = [
    ...state.lastDispensaries.slice(-1),
    deal.dispensary?.id ?? '',
  ];
  state.lastChains = [
    ...state.lastChains.slice(-1),
    getChainId(deal.dispensary?.id ?? ''),
  ];
  state.lastBrand = deal.brand?.id ?? null;
}

/**
 * Interleave tiers with target ratios while enforcing diversity.
 * Uses a round-robin draw from tier queues weighted by target ratios.
 */
function interleaveWithDiversity(
  tiers: TieredDeals,
  rng: () => number
): Deal[] {
  // Shuffle each tier independently
  const queues = {
    tier1: seededShuffle(tiers.tier1, rng),
    tier2: seededShuffle(tiers.tier2, rng),
    tier3: seededShuffle(tiers.tier3, rng),
  };

  const total =
    queues.tier1.length + queues.tier2.length + queues.tier3.length;
  const result: Deal[] = [];
  const diversity: DiversityState = {
    lastCategories: [],
    lastDispensaries: [],
    lastChains: [],
    lastBrand: null,
  };

  // Target ratios: 40% tier1, 45% tier2, 15% tier3
  const weights = [
    { key: 'tier1' as const, weight: 0.4 },
    { key: 'tier2' as const, weight: 0.45 },
    { key: 'tier3' as const, weight: 0.15 },
  ];

  // Counters for how many we've drawn from each tier
  const drawn = { tier1: 0, tier2: 0, tier3: 0 };

  for (let i = 0; i < total; i++) {
    // Calculate which tier is most "behind" its target ratio
    let bestTier: 'tier1' | 'tier2' | 'tier3' | null = null;
    let bestDeficit = -Infinity;

    for (const { key, weight } of weights) {
      if (queues[key].length === 0) continue;
      const targetDrawn = weight * (i + 1);
      const deficit = targetDrawn - drawn[key];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestTier = key;
      }
    }

    if (!bestTier) break;

    // Try to pick a deal from the best tier that passes diversity
    let placed = false;
    const tierOrder: ('tier1' | 'tier2' | 'tier3')[] = [bestTier];
    for (const { key } of weights) {
      if (key !== bestTier && queues[key].length > 0) tierOrder.push(key);
    }

    for (const tier of tierOrder) {
      const queue = queues[tier];
      for (let j = 0; j < queue.length; j++) {
        if (passesDiversity(queue[j], diversity)) {
          const [deal] = queue.splice(j, 1);
          result.push(deal);
          drawn[tier]++;
          updateDiversityState(diversity, deal);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // If nothing passes diversity, just take the first available from best tier
    if (!placed) {
      for (const tier of tierOrder) {
        if (queues[tier].length > 0) {
          const deal = queues[tier].shift()!;
          result.push(deal);
          drawn[tier]++;
          updateDiversityState(diversity, deal);
          break;
        }
      }
    }
  }

  return result;
}

// ── First-12 dispensary rebalance ────────────────────────────────────

/** Max deals from the same dispensary allowed in the first 12 visible cards. */
const MAX_SAME_DISP_IN_FIRST_12 = 2;

/**
 * Rebalance the first 12 positions so no single dispensary dominates.
 *
 * When the morning scraper finishes Greenlight/Curaleaf first, those
 * stores can flood the top of the deck.  This post-processing pass
 * swaps excess same-dispensary deals in positions 0-11 with diverse
 * deals from deeper in the deck (positions 12+).
 *
 * Only positions 7-11 are eligible for swapping — hero slots (0-6)
 * are preserved because they represent specific product-category
 * anchors the user expects.
 */
function rebalanceFirst12(deck: Deal[]): Deal[] {
  if (deck.length <= 12) return deck;

  const result = [...deck];
  const WINDOW = 12;
  const HERO_COUNT = Math.min(HERO_SLOTS.length, WINDOW);

  // Count dispensary occurrences in the first 12
  function countDisps(): Map<string, number> {
    const counts = new Map<string, number>();
    for (let i = 0; i < WINDOW && i < result.length; i++) {
      const dispId = result[i].dispensary?.id ?? '';
      counts.set(dispId, (counts.get(dispId) ?? 0) + 1);
    }
    return counts;
  }

  // Iteratively fix over-represented dispensaries
  // (max 3 passes to avoid infinite loops)
  for (let pass = 0; pass < 3; pass++) {
    const counts = countDisps();
    let swapped = false;

    for (let i = HERO_COUNT; i < WINDOW && i < result.length; i++) {
      const dispId = result[i].dispensary?.id ?? '';
      if ((counts.get(dispId) ?? 0) <= MAX_SAME_DISP_IN_FIRST_12) continue;

      // This card's dispensary is over-represented — find a swap from 12+
      for (let j = WINDOW; j < result.length; j++) {
        const swapDispId = result[j].dispensary?.id ?? '';
        // Don't swap in another over-represented dispensary
        if ((counts.get(swapDispId) ?? 0) >= MAX_SAME_DISP_IN_FIRST_12) continue;
        // Swap
        [result[i], result[j]] = [result[j], result[i]];
        counts.set(dispId, (counts.get(dispId) ?? 0) - 1);
        counts.set(swapDispId, (counts.get(swapDispId) ?? 0) + 1);
        swapped = true;
        break;
      }
    }

    if (!swapped) break;
  }

  return result;
}

// ── Public API ──────────────────────────────────────────────────────

export interface CuratedShuffleOptions {
  /** Anonymous user ID for session-stable seeding */
  anonId?: string;
  /** Override the date seed (useful for testing) */
  dateSeed?: string;
}

/**
 * Produces a curated, shuffled deal order that:
 * 1. Extracts hero deals (cheapest per priority category) for top slots
 * 2. Groups remaining deals into score tiers
 * 3. Shuffles within each tier (seeded for session stability)
 * 4. Interleaves tiers at target ratios (40/45/15)
 * 5. Enforces diversity constraints (category, dispensary, brand)
 *
 * The result is deterministic for the same day + user, ensuring a
 * consistent order across re-renders within a single session.
 */
export function curatedShuffle(
  deals: Deal[],
  options: CuratedShuffleOptions = {}
): Deal[] {
  if (deals.length === 0) return [];

  const dateSeed = options.dateSeed ?? new Date().toISOString().slice(0, 10);
  const anonId = options.anonId ?? '';
  const seed = seedFromString(`${dateSeed}:${anonId}`);
  const rng = mulberry32(seed);

  // Step 1: Extract hero deals (cheapest per priority category)
  // Hero extraction now enforces dispensary-spread (no 2 heroes from same store).
  const { heroes, remaining } = extractHeroDeals(deals);

  // Step 2: Shuffle remaining deals with existing tier-based logic
  const tiers = classifyTiers(remaining);
  const shuffled = interleaveWithDiversity(tiers, rng);

  // Step 3: Pin heroes at the front, then append shuffled remainder
  const combined = [...heroes, ...shuffled];

  // Step 4: Rebalance the first 12 cards so no single dispensary dominates.
  // Swaps excess same-dispensary deals (positions 7-11) with diverse deals
  // from deeper in the deck.  Hero slots (0-6) are preserved.
  return rebalanceFirst12(combined);
}
