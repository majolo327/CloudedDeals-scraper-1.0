export { countDealsByBrand, groupBrandsByLetter, getTopDealsByDiscount, filterBrandsByQuery, sortBrandsByName } from './brandUtils';
export { filterDeals, calculateSavings, calculateTotalSavings } from './dealFilters';
export { DISCOVERY_MILESTONES, FINDS_MILESTONES, ALPHABET, CATEGORY_FILTERS, TOAST_DURATIONS } from './constants';

export function getTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString();
}

export function getDiscountPercent(original: number | null, sale: number): number {
  if (!original || original <= sale) return 0;
  return Math.round(((original - sale) / original) * 100);
}
