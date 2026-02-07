import type { Deal, BadgeType } from '@/types';

/**
 * Determine the score-tier badge for a deal based on deal_score.
 *   80+  → hot   (HOT DEAL)
 *   60-79 → great (GREAT DEAL)
 *   40-59 → good  (GOOD DEAL)
 *   20-39 → deal  (DEAL)
 *   <20   → null  (no badge)
 */
export function getBadge(deal: Deal): BadgeType | null {
  if (deal.deal_score >= 80) return 'hot';
  if (deal.deal_score >= 60) return 'great';
  if (deal.deal_score >= 40) return 'good';
  if (deal.deal_score >= 20) return 'deal';
  return null;
}
