import type { Deal, Category } from '@/types';

interface FilterOptions {
  categories?: Category[];
  dispensaryIds?: string[];
  brandName?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  searchQuery?: string;
}

export function filterDeals(deals: Deal[], options: FilterOptions): Deal[] {
  return deals.filter((deal) => {
    if (options.categories && options.categories.length > 0 && !options.categories.includes(deal.category)) {
      return false;
    }
    if (
      options.dispensaryIds &&
      options.dispensaryIds.length > 0 &&
      !options.dispensaryIds.includes(deal.dispensary.id)
    ) {
      return false;
    }
    if (options.brandName && deal.brand.name !== options.brandName) {
      return false;
    }
    if (options.minPrice !== undefined && deal.deal_price < options.minPrice) {
      return false;
    }
    if (options.maxPrice !== undefined && deal.deal_price > options.maxPrice) {
      return false;
    }
    if (options.minDiscount !== undefined && deal.original_price) {
      const discount =
        ((deal.original_price - deal.deal_price) / deal.original_price) * 100;
      if (discount < options.minDiscount) return false;
    }
    if (options.searchQuery) {
      const q = options.searchQuery.toLowerCase();
      const qEscaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRe = new RegExp(`\\b${qEscaped}\\b`, 'i');
      const matchesProduct = wordBoundaryRe.test(deal.product_name);
      const matchesBrand = wordBoundaryRe.test(deal.brand.name);
      const matchesDispensary = wordBoundaryRe.test(deal.dispensary.name);
      const matchesCategory = deal.category.toLowerCase().includes(q);
      const matchesWeight = (deal.weight || '').toLowerCase().includes(q);
      if (!matchesProduct && !matchesBrand && !matchesDispensary && !matchesCategory && !matchesWeight) return false;
    }
    return true;
  });
}

export function calculateSavings(deal: Deal): number {
  if (!deal.original_price || deal.original_price <= deal.deal_price) return 0;
  return deal.original_price - deal.deal_price;
}

export function calculateTotalSavings(deals: Deal[]): number {
  return deals.reduce((total, deal) => total + calculateSavings(deal), 0);
}

/**
 * Cap deals to a maximum per dispensary while preserving sort order.
 * Walks through the pre-sorted list and keeps only the first N deals
 * from each dispensary. This naturally keeps the highest-scored ones
 * when the input is sorted by deal_score DESC.
 */
export function applyDispensaryDiversityCap(
  deals: Deal[],
  maxPerDispensary: number = 5,
): Deal[] {
  const counts = new Map<string, number>();
  return deals.filter((deal) => {
    const key = deal.dispensary.id;
    const current = counts.get(key) ?? 0;
    if (current >= maxPerDispensary) return false;
    counts.set(key, current + 1);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Chain mapping — multi-location dispensaries that share inventory/brands.
// Prevents any single chain (e.g. Rise with 7 locations) from dominating.
// ---------------------------------------------------------------------------

const DISPENSARY_CHAINS: Record<string, string> = {
  // The Dispensary NV (3 locations)
  'td-gibson': 'the-dispensary', 'td-eastern': 'the-dispensary', 'td-decatur': 'the-dispensary',
  // Planet 13 / Medizin (same owner)
  'planet13': 'planet13', 'medizin': 'planet13',
  // Greenlight (2 locations)
  'greenlight-downtown': 'greenlight', 'greenlight-paradise': 'greenlight',
  // The Grove (2 locations)
  'the-grove': 'the-grove', 'grove-pahrump': 'the-grove',
  // Mint (2 locations)
  'mint-paradise': 'mint', 'mint-rainbow': 'mint',
  // Jade Cannabis (2 locations)
  'jade-desert-inn': 'jade', 'jade-sky-pointe': 'jade',
  // Curaleaf (4 locations)
  'curaleaf-western': 'curaleaf', 'curaleaf-north-lv': 'curaleaf',
  'curaleaf-strip': 'curaleaf', 'curaleaf-the-reef': 'curaleaf',
  // Zen Leaf (2 locations)
  'zen-leaf-flamingo': 'zen-leaf', 'zen-leaf-north-lv': 'zen-leaf',
  // Deep Roots (4 locations)
  'deep-roots-cheyenne': 'deep-roots', 'deep-roots-craig': 'deep-roots',
  'deep-roots-blue-diamond': 'deep-roots', 'deep-roots-parkson': 'deep-roots',
  // Cultivate (2 locations)
  'cultivate-spring': 'cultivate', 'cultivate-durango': 'cultivate',
  // Thrive (5 locations)
  'thrive-sahara': 'thrive', 'thrive-cheyenne': 'thrive',
  'thrive-strip': 'thrive', 'thrive-main': 'thrive',
  'thrive-southern-highlands': 'thrive',
  // Beyond/Hello (2 locations)
  'beyond-hello-sahara': 'beyond-hello', 'beyond-hello-twain': 'beyond-hello',
  // Tree of Life (2 locations)
  'tree-of-life-jones': 'tree-of-life', 'tree-of-life-centennial': 'tree-of-life',
  // Rise / GTI (7 locations)
  'rise-tropicana': 'rise', 'rise-rainbow': 'rise', 'rise-nellis': 'rise',
  'rise-durango': 'rise', 'rise-craig': 'rise', 'rise-boulder': 'rise',
  'rise-henderson': 'rise',
  // Cookies (Rise-operated, 2 locations)
  'cookies-strip-rise': 'cookies-rise', 'cookies-flamingo': 'cookies-rise',
  // Nevada Made (4 locations)
  'nevada-made-casino-dr': 'nevada-made', 'nevada-made-charleston': 'nevada-made',
  'nevada-made-henderson': 'nevada-made', 'nevada-made-warm-springs': 'nevada-made',
};

/** Get chain ID for a dispensary. Standalone stores return their own ID. */
export function getChainId(dispensaryId: string): string {
  return DISPENSARY_CHAINS[dispensaryId] ?? dispensaryId;
}

/**
 * Cap deals per chain while guaranteeing at least 1 deal per dispensary.
 * Input should be sorted by deal_score DESC so highest-scored deals survive.
 */
export function applyChainDiversityCap(
  deals: Deal[],
  maxPerChain: number = 15,
): Deal[] {
  // First pass: guarantee 1 per dispensary (best-scored since input is sorted)
  const guaranteed = new Set<string>();
  const guaranteedDeals: Deal[] = [];
  const remainder: Deal[] = [];

  for (const deal of deals) {
    const dispId = deal.dispensary.id;
    if (!guaranteed.has(dispId)) {
      guaranteed.add(dispId);
      guaranteedDeals.push(deal);
    } else {
      remainder.push(deal);
    }
  }

  // Second pass: fill up to chain cap from remainder
  const chainCounts = new Map<string, number>();
  // Count guaranteed deals per chain
  for (const deal of guaranteedDeals) {
    const chain = getChainId(deal.dispensary.id);
    chainCounts.set(chain, (chainCounts.get(chain) ?? 0) + 1);
  }

  const result = [...guaranteedDeals];
  for (const deal of remainder) {
    const chain = getChainId(deal.dispensary.id);
    const count = chainCounts.get(chain) ?? 0;
    if (count >= maxPerChain) continue;
    chainCounts.set(chain, count + 1);
    result.push(deal);
  }

  return result;
}

/**
 * Two-tier brand cap to prevent any single brand from dominating the feed.
 *
 * Tier 1 — Per brand per category (default 4): ensures concentrates aren't
 *   crowded out by flower/vape from the same brand.
 * Tier 2 — Total brand ceiling (default 12): prevents a brand with deals
 *   across many categories (e.g. 4 flower + 4 vape + 4 concentrate + 4
 *   preroll) from taking too many slots overall.
 *
 * Input should be sorted by deal_score DESC so highest-scored deals survive.
 */
export function applyGlobalBrandCap(
  deals: Deal[],
  maxPerBrandPerCategory: number = 4,
  maxPerBrandTotal: number = 12,
): Deal[] {
  const brandTotalCounts = new Map<string, number>();
  const brandCategoryCounts = new Map<string, number>();
  return deals.filter((deal) => {
    const brand = deal.brand?.name ?? '';
    if (!brand) return true; // keep unbranded deals
    const total = brandTotalCounts.get(brand) ?? 0;
    if (total >= maxPerBrandTotal) return false;
    const catKey = `${brand}::${deal.category}`;
    const catCount = brandCategoryCounts.get(catKey) ?? 0;
    if (catCount >= maxPerBrandPerCategory) return false;
    brandTotalCounts.set(brand, total + 1);
    brandCategoryCounts.set(catKey, catCount + 1);
    return true;
  });
}

/**
 * Calculate price per unit for display on deal cards.
 * - Flower, vape, concentrate, preroll: $/g
 * - Edible: $/10mg
 * Returns null if weight data is missing or zero.
 */
export function getPricePerUnit(deal: Deal): string | null {
  const price = deal.deal_price;
  if (!price || price <= 0) return null;

  const weight = deal.weight;
  if (!weight) return null;

  // Try grams (flower, vape, concentrate, preroll)
  const gMatch = weight.match(/(\d+\.?\d*)\s*g\b/i);
  if (gMatch) {
    const grams = parseFloat(gMatch[1]);
    if (grams > 0 && ['flower', 'vape', 'concentrate', 'preroll'].includes(deal.category)) {
      return `$${(price / grams).toFixed(2)}/g`;
    }
  }

  // Try mg (edibles)
  const mgMatch = weight.match(/(\d+)\s*mg\b/i);
  if (mgMatch && deal.category === 'edible') {
    const mg = parseInt(mgMatch[1], 10);
    if (mg > 0) {
      return `$${((price / mg) * 10).toFixed(2)}/10mg`;
    }
  }

  return null;
}
