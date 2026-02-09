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
      const wordBoundaryRe = new RegExp(`\\b${qEscaped}`, 'i');
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
