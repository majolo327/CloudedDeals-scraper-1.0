import type { Deal, Category } from '@/types';

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const getDailySeed = (dayOffset: number = 0): number => {
  const today = new Date();
  const date = new Date(today);
  date.setDate(date.getDate() + dayOffset);
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
};

const shuffleWithSeed = <T>(array: T[], seed: number): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const BRAND_SPACING_WINDOW = 4;
const CATEGORY_SPACING_WINDOW = 3;

const getBrandName = (deal: Deal): string => deal.brand?.name || 'Unknown';

const hasBrandConflict = (sorted: Deal[], index: number, brandName: string): boolean => {
  const start = Math.max(0, index - BRAND_SPACING_WINDOW + 1);
  for (let i = start; i < index; i++) {
    if (getBrandName(sorted[i]) === brandName) return true;
  }
  return false;
};

const hasCategoryConflict = (sorted: Deal[], index: number, category: Category): boolean => {
  const start = Math.max(0, index - CATEGORY_SPACING_WINDOW + 1);
  for (let i = start; i < index; i++) {
    if (sorted[i].category === category) return true;
  }
  return false;
};

const pickWithBrandDiversity = (
  pool: Deal[],
  count: number,
  usedIds: Set<string>,
  usedBrands: Set<string>
): Deal[] => {
  const picks: Deal[] = [];
  const localUsedBrands = new Set<string>();

  for (const deal of pool) {
    if (picks.length >= count) break;
    if (usedIds.has(deal.id)) continue;
    const brandName = getBrandName(deal);
    if (!localUsedBrands.has(brandName) && !usedBrands.has(brandName)) {
      picks.push(deal);
      localUsedBrands.add(brandName);
      usedIds.add(deal.id);
    }
  }

  if (picks.length < count) {
    for (const deal of pool) {
      if (picks.length >= count) break;
      if (usedIds.has(deal.id)) continue;
      const brandName = getBrandName(deal);
      if (!localUsedBrands.has(brandName)) {
        picks.push(deal);
        localUsedBrands.add(brandName);
        usedIds.add(deal.id);
      }
    }
  }

  if (picks.length < count) {
    for (const deal of pool) {
      if (picks.length >= count) break;
      if (!usedIds.has(deal.id)) {
        picks.push(deal);
        usedIds.add(deal.id);
      }
    }
  }

  return picks;
};

const interleaveByCategory = (pools: Map<Category, Deal[]>): Deal[] => {
  const result: Deal[] = [];
  const categoryOrder: Category[] = ['flower', 'vape', 'concentrate', 'preroll', 'edible'];
  const indices = new Map<Category, number>();
  categoryOrder.forEach((cat) => indices.set(cat, 0));

  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const cat of categoryOrder) {
      const pool = pools.get(cat) || [];
      const idx = indices.get(cat) || 0;
      if (idx < pool.length) {
        result.push(pool[idx]);
        indices.set(cat, idx + 1);
        hasMore = true;
      }
    }
  }

  return result;
};

const applySpacingConstraints = (deals: Deal[]): Deal[] => {
  const sorted = [...deals];
  const maxPasses = 10;

  for (let pass = 0; pass < maxPasses; pass++) {
    let swapsMade = false;

    for (let i = 1; i < sorted.length; i++) {
      const currentBrand = getBrandName(sorted[i]);
      const currentCategory = sorted[i].category;

      const brandConflict = hasBrandConflict(sorted, i, currentBrand);
      const categoryConflict = hasCategoryConflict(sorted, i, currentCategory);

      if (brandConflict || categoryConflict) {
        let bestSwap = -1;
        let bestScore = -1;

        for (let j = i + 1; j < sorted.length; j++) {
          const candidateBrand = getBrandName(sorted[j]);
          const candidateCategory = sorted[j].category;

          const wouldFixBrand = !brandConflict || !hasBrandConflict(sorted, i, candidateBrand);
          const wouldFixCategory =
            !categoryConflict || !hasCategoryConflict(sorted, i, candidateCategory);

          const wouldCreateBrandConflict = hasBrandConflict(sorted, j, currentBrand);
          const wouldCreateCategoryConflict = hasCategoryConflict(sorted, j, currentCategory);

          let score = 0;
          if (wouldFixBrand) score += 2;
          if (wouldFixCategory) score += 1;
          if (!wouldCreateBrandConflict) score += 1;
          if (!wouldCreateCategoryConflict) score += 0.5;

          if (score > bestScore && (wouldFixBrand || wouldFixCategory)) {
            bestScore = score;
            bestSwap = j;
          }
        }

        if (bestSwap !== -1) {
          [sorted[i], sorted[bestSwap]] = [sorted[bestSwap], sorted[i]];
          swapsMade = true;
        }
      }
    }

    if (!swapsMade) break;
  }

  return sorted;
};

export const sortDealsForDisplay = (deals: Deal[]): Deal[] => {
  if (deals.length === 0) return deals;

  const byCategory = (cat: Category) => deals.filter((d) => d.category === cat);

  const categoryPools = new Map<Category, Deal[]>([
    ['flower', byCategory('flower')],
    ['vape', byCategory('vape')],
    ['preroll', byCategory('preroll')],
    ['edible', byCategory('edible')],
    ['concentrate', byCategory('concentrate')],
  ]);

  const topSeven: Deal[] = [];
  const usedIds = new Set<string>();
  const usedBrands = new Set<string>();

  const categoryQuotas: [Category, number][] = [
    ['flower', 2],
    ['vape', 2],
    ['preroll', 1],
    ['edible', 1],
    ['concentrate', 1],
  ];

  for (const [category, count] of categoryQuotas) {
    const pool = categoryPools.get(category) || [];
    const picks = pickWithBrandDiversity(pool, count, usedIds, usedBrands);
    picks.forEach((p) => usedBrands.add(getBrandName(p)));
    topSeven.push(...picks);
  }

  const remainingPools = new Map<Category, Deal[]>();
  Array.from(categoryPools.entries()).forEach(([cat, pool]) => {
    remainingPools.set(
      cat,
      pool.filter((d) => !usedIds.has(d.id))
    );
  });

  const interleavedRemaining = interleaveByCategory(remainingPools);
  const combined = [...topSeven, ...interleavedRemaining];

  return applySpacingConstraints(combined);
};

export const sortDealsWithPinnedPriority = (
  deals: Deal[],
  maxResults: number = 9
): Deal[] => {
  if (deals.length === 0) return deals;

  const sorted = sortDealsForDisplay(deals);
  return sorted.slice(0, maxResults);
};

export const getDailyDeals = (
  allDeals: Deal[],
  _count = 30,
  dayOffset: number = 0
): Deal[] => {
  void _count;
  const seed = getDailySeed(dayOffset);
  return shuffleWithSeed(allDeals, seed);
};
