import type { Brand, Deal } from '@/types';

export function countDealsByBrand(deals: Deal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const deal of deals) {
    const name = deal.brand.name;
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

export function groupBrandsByLetter(brands: Brand[]): Record<string, Brand[]> {
  const grouped: Record<string, Brand[]> = {};
  for (const brand of brands) {
    const letter = brand.name[0]?.toUpperCase() || '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(brand);
  }
  return grouped;
}

export function getTopDealsByDiscount(deals: Deal[], limit = 5): Deal[] {
  return [...deals]
    .filter((d) => d.original_price && d.original_price > d.deal_price)
    .sort((a, b) => {
      const discA = ((a.original_price! - a.deal_price) / a.original_price!) * 100;
      const discB = ((b.original_price! - b.deal_price) / b.original_price!) * 100;
      return discB - discA;
    })
    .slice(0, limit);
}

export function filterBrandsByQuery(brands: Brand[], query: string): Brand[] {
  const q = query.toLowerCase().trim();
  if (!q) return brands;
  return brands.filter((b) => b.name.toLowerCase().includes(q));
}

export function sortBrandsByName(brands: Brand[]): Brand[] {
  return [...brands].sort((a, b) => a.name.localeCompare(b.name));
}
