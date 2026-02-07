import type { Deal } from '@/types';

/**
 * Determine if a deal is "just dropped" — first seen within the last 24 hours.
 * Uses `first_seen_at` (the DB insertion time) to distinguish genuinely new
 * products from ones that have been re-scraped across multiple runs.
 */
export function isJustDropped(deal: Deal): boolean {
  const firstSeen = deal.first_seen_at;
  if (!firstSeen) return false;

  const date = typeof firstSeen === 'string' ? new Date(firstSeen) : firstSeen;
  const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return hoursAgo <= 24;
}
