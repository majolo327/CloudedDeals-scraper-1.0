'use client';

import type { Deal } from '@/types';

// ---------------------------------------------------------------------------
// Social Proof Types
// ---------------------------------------------------------------------------

export type SocialProofType =
  | 'hot_deal'
  | 'trending'
  | 'popular_dispensary'
  | 'weekend_special'
  | 'last_day'
  | 'new_arrival';

export interface SocialProofBadge {
  type: SocialProofType;
  text: string;
  icon: string;
  priority: number; // higher = more important
}

// ---------------------------------------------------------------------------
// Deal Age / FOMO Helpers
// ---------------------------------------------------------------------------

/**
 * Get human-readable time since deal was posted.
 */
export function getDealAge(createdAt: Date | string): string {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 5) return 'Just posted';
  if (diffMins < 60) return `Posted ${diffMins}m ago`;
  if (diffHours < 24) return `Posted ${diffHours}h ago`;
  if (diffDays === 1) return 'Posted yesterday';
  if (diffDays < 7) return `Posted ${diffDays}d ago`;
  return `Posted ${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Check if a deal is "fresh" (posted within threshold).
 */
export function isFreshDeal(createdAt: Date | string, thresholdHours = 4): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  return diffHours <= thresholdHours;
}

/**
 * Get FOMO text based on deal timing.
 */
export function getFomoText(deal: Deal): string | null {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  // Weekend special (Fri-Sun)
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    // Check if it's Sunday evening - last day vibes
    if (dayOfWeek === 0 && hour >= 16) {
      return 'Weekend special ends tonight';
    }
    return 'Weekend special';
  }

  // Monday deals often end
  if (dayOfWeek === 1 && hour < 12) {
    return 'Last chance - weekend pricing';
  }

  // Happy hour timing (3-7pm weekdays)
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 15 && hour <= 19) {
    return 'Happy hour pricing';
  }

  // Check deal freshness
  if (isFreshDeal(deal.created_at, 2)) {
    return 'Just dropped';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Social Proof Badge Generation
// ---------------------------------------------------------------------------

/**
 * Generate social proof badges for a deal.
 * Returns badges sorted by priority (highest first).
 */
export function getSocialProofBadges(
  deal: Deal,
  options: {
    totalSaves?: number;
    recentSavesLastHour?: number;
  } = {}
): SocialProofBadge[] {
  const badges: SocialProofBadge[] = [];
  const totalSaves = options.totalSaves ?? deal.save_count ?? 0;
  const recentSaves = options.recentSavesLastHour ?? 0;

  // Hot deal - many saves overall
  if (totalSaves >= 25) {
    badges.push({
      type: 'hot_deal',
      text: `${totalSaves} shoppers grabbed this`,
      icon: '🔥',
      priority: 100,
    });
  } else if (totalSaves >= 10) {
    badges.push({
      type: 'hot_deal',
      text: `${totalSaves} shoppers saved this`,
      icon: '🔥',
      priority: 80,
    });
  }

  // Trending - many saves in last hour
  if (recentSaves >= 10) {
    badges.push({
      type: 'trending',
      text: 'Trending now',
      icon: '📈',
      priority: 90,
    });
  } else if (recentSaves >= 5) {
    badges.push({
      type: 'trending',
      text: `${recentSaves} saves in the last hour`,
      icon: '📈',
      priority: 70,
    });
  }

  // New arrival
  if (isFreshDeal(deal.created_at, 3)) {
    badges.push({
      type: 'new_arrival',
      text: 'New arrival',
      icon: '✨',
      priority: 60,
    });
  }

  // Weekend/timing badges
  const fomoText = getFomoText(deal);
  if (fomoText) {
    if (fomoText.includes('Weekend')) {
      badges.push({
        type: 'weekend_special',
        text: fomoText,
        icon: '🎉',
        priority: 50,
      });
    } else if (fomoText.includes('Last')) {
      badges.push({
        type: 'last_day',
        text: fomoText,
        icon: '⏰',
        priority: 85,
      });
    }
  }

  // Popular at dispensary (high deal score)
  if (deal.deal_score >= 70) {
    badges.push({
      type: 'popular_dispensary',
      text: `Trending at ${deal.dispensary.name}`,
      icon: '📍',
      priority: 40,
    });
  }

  // Sort by priority (highest first)
  return badges.sort((a, b) => b.priority - a.priority);
}

/**
 * Get the primary social proof badge for a deal (highest priority).
 */
export function getPrimarySocialProof(
  deal: Deal,
  options: {
    totalSaves?: number;
    recentSavesLastHour?: number;
  } = {}
): SocialProofBadge | null {
  const badges = getSocialProofBadges(deal, options);
  return badges[0] ?? null;
}

// ---------------------------------------------------------------------------
// Dispensary Trending
// ---------------------------------------------------------------------------

/**
 * Check if a deal is trending at its dispensary.
 * A deal is "trending" if it has more saves than average for that dispensary.
 */
export function isTrendingAtDispensary(
  deal: Deal,
  allDeals: Deal[]
): boolean {
  const dispensaryDeals = allDeals.filter(
    (d) => d.dispensary.id === deal.dispensary.id
  );
  if (dispensaryDeals.length < 3) return false;

  const avgSaves =
    dispensaryDeals.reduce((sum, d) => sum + (d.save_count ?? 0), 0) /
    dispensaryDeals.length;

  return (deal.save_count ?? 0) > avgSaves * 1.5;
}

// ---------------------------------------------------------------------------
// Save Count Formatting
// ---------------------------------------------------------------------------

/**
 * Format save count for display.
 */
export function formatSaveCount(count: number): string {
  if (count < 5) return ''; // Don't show low counts
  if (count < 100) return `${count}`;
  if (count < 1000) return `${count}`;
  return `${(count / 1000).toFixed(1)}k`;
}

/**
 * Get save count display text.
 */
export function getSaveCountText(count: number): string | null {
  if (count < 5) return null;
  if (count < 10) return `${count} saves`;
  if (count < 50) return `${count} shoppers saved this`;
  return `${count} shoppers grabbed this`;
}

// ---------------------------------------------------------------------------
// Price Tier Detection
// ---------------------------------------------------------------------------

export type PriceTier = 'budget' | 'mid' | 'premium';

export function detectPriceTier(price: number): PriceTier {
  if (price < 20) return 'budget';
  if (price <= 75) return 'mid';
  return 'premium';
}

export function getPriceTierText(tier: PriceTier): string {
  switch (tier) {
    case 'budget':
      return 'Budget-friendly';
    case 'mid':
      return 'Great value';
    case 'premium':
      return 'Premium pick';
  }
}
