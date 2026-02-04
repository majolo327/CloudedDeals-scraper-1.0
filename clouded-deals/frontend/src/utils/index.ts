export function getTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

export function getDiscountPercent(original: number | null, deal: number): number {
  if (!original || original <= deal) return 0;
  return Math.round(((original - deal) / original) * 100);
}

export { getDailyDeals, sortDealsForDisplay, sortDealsWithPinnedPriority } from './dailyDeals';
export * from './constants';
export * from './brandUtils';
export * from './dealFilters';
