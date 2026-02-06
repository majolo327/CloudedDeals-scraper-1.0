import type { Deal, BadgeType } from '@/types';
import { getDiscountPercent } from './index';

/**
 * Determine the algorithmic badge for a deal.
 * Priority: fire > trending > steal.
 * Returns null if the deal doesn't qualify for any badge.
 */
export function getBadge(deal: Deal): BadgeType | null {
  if (deal.deal_score >= 80) return 'fire';
  if ((deal.save_count ?? 0) >= 20) return 'trending';
  const discount = getDiscountPercent(deal.original_price, deal.deal_price);
  if (discount >= 40) return 'steal';
  return null;
}
