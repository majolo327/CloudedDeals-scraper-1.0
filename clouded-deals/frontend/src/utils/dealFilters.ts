import type { Deal, Category } from '@/types';

interface FilterOptions {
  category?: Category | 'all';
  dispensaryId?: string | 'all';
  brandName?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
}

export function filterDeals(deals: Deal[], options: FilterOptions): Deal[] {
  return deals.filter((deal) => {
    if (options.category && options.category !== 'all' && deal.category !== options.category) {
      return false;
    }
    if (options.dispensaryId && options.dispensaryId !== 'all' && deal.dispensary.id !== options.dispensaryId) {
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
      const discount = ((deal.original_price - deal.deal_price) / deal.original_price) * 100;
      if (discount < options.minDiscount) return false;
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
