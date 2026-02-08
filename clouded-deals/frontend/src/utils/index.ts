/**
 * Strip the brand name from the start of a product name when the brand is
 * already displayed separately on the card. Also cleans up embedded metadata
 * (weight, THC%, CBD%) and removes duplicate name fragments.
 *
 * Examples:
 *   "DOGWALKERS Big Dogs Casino Kush Preroll" → "Big Dogs Casino Kush Preroll"
 *   "8 Inch Bagel Whole Flower 3.5g 8 Inch Bagel Whole" → "8 Inch Bagel Whole Flower"
 *   "Purple Punch (3.5G) THC 28.94%" → "Purple Punch"
 */
export function getDisplayName(productName: string, brandName: string): string {
  if (!productName) return productName;

  let name = productName;

  // 1. Strip brand prefix (case-insensitive)
  if (brandName) {
    const nameLC = name.toLowerCase();
    const brandLC = brandName.toLowerCase();
    if (nameLC.startsWith(brandLC)) {
      const stripped = name.slice(brandName.length).replace(/^[\s\-|:]+/, '').trim();
      if (stripped.length > 0) name = stripped;
    }
  }

  // 2. Strip embedded metadata: weight "(3.5G)", "(1G)", standalone "3.5g" at word boundaries
  name = name.replace(/\s*\(\s*\d+\.?\d*\s*[gG]\s*\)/g, '');

  // 3. Strip THC/CBD percentages: "THC 28.94%", "THC: 28.94%", "CBD 1.2%"
  name = name.replace(/\s*(THC|CBD)\s*:?\s*\d+\.?\d*\s*%?/gi, '');

  // 4. Strip trailing weight like " 3.5g", " 1g", " 100mg" (already shown as weight badge)
  name = name.replace(/\s+\d+\.?\d*\s*(mg|g)\b\s*$/i, '');

  // 5. Detect and remove duplicate name fragments
  // Handles: "8 Inch Bagel Whole Flower 3.5g 8 Inch Bagel Whole"
  // After steps 2-4: "8 Inch Bagel Whole Flower 8 Inch Bagel Whole"
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 4) {
    // Try to find if the second half repeats the first half (or part of it)
    for (let splitPoint = Math.floor(words.length / 2); splitPoint >= 2; splitPoint--) {
      const firstHalf = words.slice(0, splitPoint).join(' ').toLowerCase();
      const rest = words.slice(splitPoint).join(' ').toLowerCase();
      if (rest.startsWith(firstHalf) || rest.endsWith(firstHalf)) {
        // Keep the longer portion (usually the first half which has more context)
        name = words.slice(0, splitPoint).join(' ');
        // But also keep any unique words between the split and the repeat
        const middleWords = words.slice(splitPoint);
        const firstHalfWords = words.slice(0, splitPoint).map(w => w.toLowerCase());
        const uniqueMiddle = middleWords.filter(w => !firstHalfWords.includes(w.toLowerCase()));
        if (uniqueMiddle.length > 0 && uniqueMiddle.length <= 3) {
          name = words.slice(0, splitPoint).join(' ') + ' ' + uniqueMiddle.join(' ');
        }
        break;
      }
    }
  }

  // 6. Clean up leftover punctuation and whitespace
  name = name.replace(/[\s\-|:]+$/, '').replace(/\s{2,}/g, ' ').trim();

  return name.length > 0 ? name : productName;
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
