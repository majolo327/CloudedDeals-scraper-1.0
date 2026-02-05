'use client';

import type { Deal, Category } from '@/types';

// ---------------------------------------------------------------------------
// Badge Types
// ---------------------------------------------------------------------------

export type BadgeId =
  // Getting Started
  | 'first_timer'
  | 'savvy_shopper'
  | 'deal_connoisseur'
  // Time-based
  | 'early_riser'
  | 'night_owl'
  | 'weekend_warrior'
  // Loyalty
  | 'brand_loyal'
  | 'dispensary_regular'
  // Streaks
  | 'streak_3'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  // Category specialists
  | 'flower_fan'
  | 'edible_enthusiast'
  | 'concentrate_connoisseur'
  | 'vape_veteran'
  | 'preroll_pro'
  // Price tiers
  | 'budget_hunter'
  | 'premium_picker';

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // emoji
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category: 'starter' | 'time' | 'loyalty' | 'streak' | 'specialist' | 'shopper';
}

export interface EarnedBadge extends Badge {
  earnedAt: Date;
  isNew: boolean;
}

// ---------------------------------------------------------------------------
// Badge Definitions
// ---------------------------------------------------------------------------

export const BADGES: Record<BadgeId, Badge> = {
  // Getting Started
  first_timer: {
    id: 'first_timer',
    name: 'First Timer',
    description: 'Saved your first deal',
    icon: '🌱',
    tier: 'bronze',
    category: 'starter',
  },
  savvy_shopper: {
    id: 'savvy_shopper',
    name: 'Savvy Shopper',
    description: 'Saved 10 deals',
    icon: '🛒',
    tier: 'silver',
    category: 'starter',
  },
  deal_connoisseur: {
    id: 'deal_connoisseur',
    name: 'Deal Connoisseur',
    description: 'Saved 50 deals',
    icon: '🏆',
    tier: 'gold',
    category: 'starter',
  },

  // Time-based
  early_riser: {
    id: 'early_riser',
    name: 'Early Riser',
    description: 'Saved 5 deals before 9am',
    icon: '🌅',
    tier: 'bronze',
    category: 'time',
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Saved 5 deals after 10pm',
    icon: '🦉',
    tier: 'bronze',
    category: 'time',
  },
  weekend_warrior: {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Saved 10 deals on weekends',
    icon: '🎉',
    tier: 'silver',
    category: 'time',
  },

  // Loyalty
  brand_loyal: {
    id: 'brand_loyal',
    name: 'Brand Loyal',
    description: 'Saved 5+ deals from the same brand',
    icon: '💜',
    tier: 'silver',
    category: 'loyalty',
  },
  dispensary_regular: {
    id: 'dispensary_regular',
    name: 'Dispensary Regular',
    description: 'Saved 10+ deals from the same dispensary',
    icon: '🏪',
    tier: 'silver',
    category: 'loyalty',
  },

  // Streaks
  streak_3: {
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Saved deals 3 days in a row',
    icon: '🔥',
    tier: 'bronze',
    category: 'streak',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Saved deals 7 days in a row',
    icon: '⚡',
    tier: 'silver',
    category: 'streak',
  },
  streak_14: {
    id: 'streak_14',
    name: 'Two Week Titan',
    description: 'Saved deals 14 days in a row',
    icon: '💎',
    tier: 'gold',
    category: 'streak',
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Saved deals 30 days in a row',
    icon: '👑',
    tier: 'platinum',
    category: 'streak',
  },

  // Category Specialists
  flower_fan: {
    id: 'flower_fan',
    name: 'Flower Fan',
    description: 'Saved 10+ flower deals',
    icon: '🌸',
    tier: 'silver',
    category: 'specialist',
  },
  edible_enthusiast: {
    id: 'edible_enthusiast',
    name: 'Edible Enthusiast',
    description: 'Saved 10+ edible deals',
    icon: '🍪',
    tier: 'silver',
    category: 'specialist',
  },
  concentrate_connoisseur: {
    id: 'concentrate_connoisseur',
    name: 'Concentrate Connoisseur',
    description: 'Saved 10+ concentrate deals',
    icon: '💧',
    tier: 'silver',
    category: 'specialist',
  },
  vape_veteran: {
    id: 'vape_veteran',
    name: 'Vape Veteran',
    description: 'Saved 10+ vape deals',
    icon: '💨',
    tier: 'silver',
    category: 'specialist',
  },
  preroll_pro: {
    id: 'preroll_pro',
    name: 'Preroll Pro',
    description: 'Saved 10+ preroll deals',
    icon: '🚬',
    tier: 'silver',
    category: 'specialist',
  },

  // Price Tiers
  budget_hunter: {
    id: 'budget_hunter',
    name: 'Budget Hunter',
    description: 'Saved 10 deals under $20',
    icon: '💰',
    tier: 'silver',
    category: 'shopper',
  },
  premium_picker: {
    id: 'premium_picker',
    name: 'Premium Picker',
    description: 'Saved 5 deals over $75',
    icon: '✨',
    tier: 'gold',
    category: 'shopper',
  },
};

// ---------------------------------------------------------------------------
// Badge Progress Tracking
// ---------------------------------------------------------------------------

export interface BadgeProgress {
  badgeId: BadgeId;
  current: number;
  required: number;
  isComplete: boolean;
}

export interface UserBadgeStats {
  totalSaves: number;
  streak: number;
  maxStreak: number;
  categoryCounts: Record<Category, number>;
  brandCounts: Record<string, number>;
  dispensaryCounts: Record<string, number>;
  timeSlots: {
    earlyMorning: number; // 5-9am
    lateNight: number; // 10pm-2am
    weekend: number;
  };
  priceTiers: {
    budget: number; // < $20
    mid: number; // $20-75
    premium: number; // > $75
  };
  earnedBadges: Set<BadgeId>;
}

// ---------------------------------------------------------------------------
// Badge Calculation
// ---------------------------------------------------------------------------

const BADGE_THRESHOLDS: Record<BadgeId, (stats: UserBadgeStats) => boolean> = {
  // Starter badges
  first_timer: (s) => s.totalSaves >= 1,
  savvy_shopper: (s) => s.totalSaves >= 10,
  deal_connoisseur: (s) => s.totalSaves >= 50,

  // Time-based
  early_riser: (s) => s.timeSlots.earlyMorning >= 5,
  night_owl: (s) => s.timeSlots.lateNight >= 5,
  weekend_warrior: (s) => s.timeSlots.weekend >= 10,

  // Loyalty
  brand_loyal: (s) => Math.max(...Object.values(s.brandCounts), 0) >= 5,
  dispensary_regular: (s) => Math.max(...Object.values(s.dispensaryCounts), 0) >= 10,

  // Streaks
  streak_3: (s) => s.maxStreak >= 3,
  streak_7: (s) => s.maxStreak >= 7,
  streak_14: (s) => s.maxStreak >= 14,
  streak_30: (s) => s.maxStreak >= 30,

  // Category specialists
  flower_fan: (s) => s.categoryCounts.flower >= 10,
  edible_enthusiast: (s) => s.categoryCounts.edible >= 10,
  concentrate_connoisseur: (s) => s.categoryCounts.concentrate >= 10,
  vape_veteran: (s) => s.categoryCounts.vape >= 10,
  preroll_pro: (s) => s.categoryCounts.preroll >= 10,

  // Price tiers
  budget_hunter: (s) => s.priceTiers.budget >= 10,
  premium_picker: (s) => s.priceTiers.premium >= 5,
};

/**
 * Calculate which badges a user has earned based on their stats.
 */
export function calculateEarnedBadges(stats: UserBadgeStats): BadgeId[] {
  const earned: BadgeId[] = [];

  for (const [badgeId, checkFn] of Object.entries(BADGE_THRESHOLDS)) {
    if (checkFn(stats)) {
      earned.push(badgeId as BadgeId);
    }
  }

  return earned;
}

/**
 * Get progress towards each badge.
 */
export function getBadgeProgress(stats: UserBadgeStats): BadgeProgress[] {
  return [
    // Starter
    { badgeId: 'first_timer', current: Math.min(stats.totalSaves, 1), required: 1, isComplete: stats.totalSaves >= 1 },
    { badgeId: 'savvy_shopper', current: Math.min(stats.totalSaves, 10), required: 10, isComplete: stats.totalSaves >= 10 },
    { badgeId: 'deal_connoisseur', current: Math.min(stats.totalSaves, 50), required: 50, isComplete: stats.totalSaves >= 50 },

    // Streaks
    { badgeId: 'streak_3', current: Math.min(stats.maxStreak, 3), required: 3, isComplete: stats.maxStreak >= 3 },
    { badgeId: 'streak_7', current: Math.min(stats.maxStreak, 7), required: 7, isComplete: stats.maxStreak >= 7 },
    { badgeId: 'streak_14', current: Math.min(stats.maxStreak, 14), required: 14, isComplete: stats.maxStreak >= 14 },
    { badgeId: 'streak_30', current: Math.min(stats.maxStreak, 30), required: 30, isComplete: stats.maxStreak >= 30 },

    // Loyalty
    { badgeId: 'brand_loyal', current: Math.min(Math.max(...Object.values(stats.brandCounts), 0), 5), required: 5, isComplete: Math.max(...Object.values(stats.brandCounts), 0) >= 5 },

    // Categories
    { badgeId: 'flower_fan', current: Math.min(stats.categoryCounts.flower, 10), required: 10, isComplete: stats.categoryCounts.flower >= 10 },
    { badgeId: 'edible_enthusiast', current: Math.min(stats.categoryCounts.edible, 10), required: 10, isComplete: stats.categoryCounts.edible >= 10 },
  ];
}

/**
 * Check for newly earned badges by comparing old and new stats.
 */
export function getNewlyEarnedBadges(
  previousBadges: BadgeId[],
  currentStats: UserBadgeStats
): BadgeId[] {
  const currentBadges = calculateEarnedBadges(currentStats);
  const previousSet = new Set(previousBadges);
  return currentBadges.filter((id) => !previousSet.has(id));
}

// ---------------------------------------------------------------------------
// User Segment Detection
// ---------------------------------------------------------------------------

export type UserSegment =
  | 'first_timer'
  | 'budget_shopper'
  | 'premium_shopper'
  | 'flower_lover'
  | 'edible_fan'
  | 'vape_user'
  | 'deal_hunter'
  | 'brand_loyalist'
  | 'regular';

/**
 * Determine user segment based on their behavior.
 */
export function detectUserSegment(stats: UserBadgeStats): UserSegment {
  if (stats.totalSaves < 3) return 'first_timer';

  // Check price tier preference
  const totalPriced = stats.priceTiers.budget + stats.priceTiers.mid + stats.priceTiers.premium;
  if (totalPriced > 5) {
    if (stats.priceTiers.budget / totalPriced > 0.6) return 'budget_shopper';
    if (stats.priceTiers.premium / totalPriced > 0.4) return 'premium_shopper';
  }

  // Check category preference
  const maxCategory = Math.max(...Object.values(stats.categoryCounts));
  const totalCategories = Object.values(stats.categoryCounts).reduce((a, b) => a + b, 0);
  if (totalCategories > 5 && maxCategory / totalCategories > 0.5) {
    if (stats.categoryCounts.flower === maxCategory) return 'flower_lover';
    if (stats.categoryCounts.edible === maxCategory) return 'edible_fan';
    if (stats.categoryCounts.vape === maxCategory) return 'vape_user';
  }

  // Check brand loyalty
  const maxBrand = Math.max(...Object.values(stats.brandCounts), 0);
  if (maxBrand >= 5) return 'brand_loyalist';

  // High engagement = deal hunter
  if (stats.totalSaves >= 20) return 'deal_hunter';

  return 'regular';
}

/**
 * Get segment-appropriate social proof text.
 */
export function getSegmentSocialProof(segment: UserSegment): string {
  switch (segment) {
    case 'first_timer':
      return 'Popular with first-timers';
    case 'budget_shopper':
      return 'Popular with budget shoppers';
    case 'premium_shopper':
      return 'Popular with premium shoppers';
    case 'flower_lover':
      return 'Popular with flower lovers';
    case 'edible_fan':
      return 'Popular with edible fans';
    case 'vape_user':
      return 'Popular with vape users';
    case 'deal_hunter':
      return 'Popular with deal hunters';
    case 'brand_loyalist':
      return 'Popular with brand loyalists';
    default:
      return 'Popular with Vegas shoppers';
  }
}

// ---------------------------------------------------------------------------
// Local Storage for Badge State
// ---------------------------------------------------------------------------

const BADGES_STORAGE_KEY = 'clouded_badges';
const BADGE_STATS_KEY = 'clouded_badge_stats';

interface StoredBadgeState {
  earnedBadges: BadgeId[];
  lastChecked: string;
  newBadgesSeen: BadgeId[];
}

export function loadBadgeState(): StoredBadgeState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BADGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBadgeState(state: StoredBadgeState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

export function loadBadgeStats(): UserBadgeStats | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BADGE_STATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      earnedBadges: new Set(parsed.earnedBadges || []),
    };
  } catch {
    return null;
  }
}

export function saveBadgeStats(stats: UserBadgeStats): void {
  if (typeof window === 'undefined') return;
  try {
    const toStore = {
      ...stats,
      earnedBadges: Array.from(stats.earnedBadges),
    };
    localStorage.setItem(BADGE_STATS_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Build Stats from Saved Deals
// ---------------------------------------------------------------------------

export function buildBadgeStatsFromDeals(
  savedDeals: Deal[],
  savedDates: Date[],
  currentStreak: number,
  maxStreak: number
): UserBadgeStats {
  const stats: UserBadgeStats = {
    totalSaves: savedDeals.length,
    streak: currentStreak,
    maxStreak: Math.max(currentStreak, maxStreak),
    categoryCounts: {
      flower: 0,
      concentrate: 0,
      vape: 0,
      edible: 0,
      preroll: 0,
    },
    brandCounts: {},
    dispensaryCounts: {},
    timeSlots: {
      earlyMorning: 0,
      lateNight: 0,
      weekend: 0,
    },
    priceTiers: {
      budget: 0,
      mid: 0,
      premium: 0,
    },
    earnedBadges: new Set(),
  };

  for (const deal of savedDeals) {
    // Category counts
    stats.categoryCounts[deal.category]++;

    // Brand counts
    const brandName = deal.brand.name;
    stats.brandCounts[brandName] = (stats.brandCounts[brandName] || 0) + 1;

    // Dispensary counts
    const dispName = deal.dispensary.name;
    stats.dispensaryCounts[dispName] = (stats.dispensaryCounts[dispName] || 0) + 1;

    // Price tiers
    if (deal.deal_price < 20) {
      stats.priceTiers.budget++;
    } else if (deal.deal_price <= 75) {
      stats.priceTiers.mid++;
    } else {
      stats.priceTiers.premium++;
    }
  }

  // Time slot analysis from save dates
  for (const date of savedDates) {
    const hour = date.getHours();
    const day = date.getDay();

    if (hour >= 5 && hour < 9) {
      stats.timeSlots.earlyMorning++;
    }
    if (hour >= 22 || hour < 2) {
      stats.timeSlots.lateNight++;
    }
    if (day === 0 || day === 6) {
      stats.timeSlots.weekend++;
    }
  }

  // Calculate earned badges
  const earned = calculateEarnedBadges(stats);
  stats.earnedBadges = new Set(earned);

  return stats;
}
