import type { Deal, BadgeType } from '@/types';

/**
 * Determine the score-tier badge for a deal based on deal_score.
 *   85+  → steal  (STEAL)
 *   70-84 → fire   (Fire Deal)
 *   50-69 → solid  (Solid Deal)
 *   <50   → null   (no badge, but still shown if it passed hard filters)
 */
export function getBadge(deal: Deal): BadgeType | null {
  if (deal.deal_score >= 85) return 'steal';
  if (deal.deal_score >= 70) return 'fire';
  if (deal.deal_score >= 50) return 'solid';
  return null;
}

/**
 * Get deal badge info directly from a numeric score (for contexts
 * where a full Deal object isn't available).
 */
export function getDealBadge(score: number): { label: string; color: string } | null {
  if (score >= 85) return { label: '\u{1F525} STEAL', color: 'red' };
  if (score >= 70) return { label: '\u{1F525} Fire Deal', color: 'orange' };
  if (score >= 50) return { label: '\u{1F44D} Solid Deal', color: 'green' };
  return null;
}
