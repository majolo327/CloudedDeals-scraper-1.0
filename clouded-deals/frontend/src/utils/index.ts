/**
 * Strip the brand name from the start of a product name when the brand is
 * already displayed separately on the card. Avoids:
 *   DOGWALKERS
 *   DOGWALKERS Big Dogs Casino Kush Preroll
 */
export function getDisplayName(productName: string, brandName: string): string {
  if (!brandName || !productName) return productName;
  const nameLC = productName.toLowerCase();
  const brandLC = brandName.toLowerCase();
  if (nameLC.startsWith(brandLC)) {
    const stripped = productName.slice(brandName.length).replace(/^[\s\-|:]+/, '').trim();
    return stripped.length > 0 ? stripped : productName;
  }
  return productName;
}

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
  return `Updated ${h}:${m} ${ampm.toUpperCase()}`;
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

/**
 * Haversine distance between two GPS coordinates in miles.
 * Returns null if either coordinate is missing.
 */
export function getDistanceMiles(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined,
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDiscountPercent(original: number | null, deal: number): number {
  if (!original || original <= deal) return 0;
  return Math.round(((original - deal) / original) * 100);
}

export { getDailyDeals, sortDealsForDisplay, sortDealsWithPinnedPriority } from './dailyDeals';
export { getBadge } from './dealBadge';
export { isJustDropped } from './justDropped';
export * from './constants';
export * from './brandUtils';
export * from './dealFilters';
export * from './dispensaryUtils';
