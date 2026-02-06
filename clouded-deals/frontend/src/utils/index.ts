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

export function formatUpdateTime(deals: { created_at: Date | string }[]): string {
  if (deals.length === 0) return '';
  const latest = deals.reduce((max, d) => {
    const t = typeof d.created_at === 'string' ? new Date(d.created_at).getTime() : d.created_at.getTime();
    return t > max ? t : max;
  }, 0);
  const date = new Date(latest);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `Updated at ${h}:${m}${ampm}`;
}

export function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getMapsUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  // iOS Safari will intercept google.com/maps and open Apple Maps, or the user
  // gets the Google Maps web page — works universally across all platforms.
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

export function getDiscountPercent(original: number | null, deal: number): number {
  if (!original || original <= deal) return 0;
  return Math.round(((original - deal) / original) * 100);
}

export { getDailyDeals, sortDealsForDisplay, sortDealsWithPinnedPriority } from './dailyDeals';
export { getBadge } from './dealBadge';
export * from './constants';
export * from './brandUtils';
export * from './dealFilters';
