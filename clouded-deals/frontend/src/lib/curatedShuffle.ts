import type { Deal, Category } from '@/types';

/**
 * Curated Shuffle — tier-based weighted shuffle with diversity constraints.
 *
 * Tiers:
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

  return true;
}

function updateDiversityState(state: DiversityState, deal: Deal): void {
  state.lastCategories = [...state.lastCategories.slice(-2), deal.category];
  state.lastDispensaries = [
    ...state.lastDispensaries.slice(-1),
    deal.dispensary?.id ?? '',
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

// ── Public API ──────────────────────────────────────────────────────

export interface CuratedShuffleOptions {
  /** Anonymous user ID for session-stable seeding */
  anonId?: string;
  /** Override the date seed (useful for testing) */
  dateSeed?: string;
}

/**
 * Produces a curated, shuffled deal order that:
 * 1. Groups deals into score tiers
 * 2. Shuffles within each tier (seeded for session stability)
 * 3. Interleaves tiers at target ratios (40/45/15)
 * 4. Enforces diversity constraints (category, dispensary, brand)
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

  const tiers = classifyTiers(deals);
  return interleaveWithDiversity(tiers, rng);
}
