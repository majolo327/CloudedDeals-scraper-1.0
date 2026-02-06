'use client';

import { supabase } from './supabase';
import { getOrCreateUserId } from './analytics';
import type { Deal, Category } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserPreferences {
  userId: string;
  isNewUser: boolean;
  totalSaves: number;
  totalDismisses: number;
  // Category preferences (0-1 score based on save ratio)
  categoryScores: Record<Category, number>;
  // Price range preference
  preferredPriceMin: number;
  preferredPriceMax: number;
  avgSavedPrice: number;
  // Price tier (budget < $20, mid $20-75, premium > $75)
  priceTier: 'budget' | 'mid' | 'premium';
  // Discount preference (avg discount of saved deals)
  preferredMinDiscount: number;
  // Dispensary preferences (dispensary_id -> score)
  dispensaryScores: Record<string, number>;
  // Brand preferences (brand_id -> score)
  brandScores: Record<string, number>;
  // Top brand (most saved)
  topBrand: string | null;
  // Top category
  topCategory: Category | null;
  // Time-based (hour of day when most active)
  peakHour: number | null;
}

export interface ScoredDeal extends Deal {
  personalizationScore: number;
  recommendationReason: RecommendationReason | null;
}

export type RecommendationReason =
  | 'category_match'
  | 'price_match'
  | 'high_discount'
  | 'favorite_brand'
  | 'favorite_dispensary'
  | 'trending'
  | 'new_user_top_pick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEW_USER_THRESHOLD = 5; // User needs at least 5 saves to have preferences
const SCORE_WEIGHTS = {
  category: 25,
  price: 20,
  discount: 25,
  brand: 15,
  dispensary: 10,
  recency: 5,
};

// Default preferences for new users
const DEFAULT_PREFERENCES: UserPreferences = {
  userId: '',
  isNewUser: true,
  totalSaves: 0,
  totalDismisses: 0,
  categoryScores: {
    flower: 0.2,
    concentrate: 0.2,
    vape: 0.2,
    edible: 0.2,
    preroll: 0.2,
  },
  preferredPriceMin: 0,
  preferredPriceMax: 100,
  avgSavedPrice: 35,
  priceTier: 'mid',
  preferredMinDiscount: 20,
  dispensaryScores: {},
  brandScores: {},
  topBrand: null,
  topCategory: null,
  peakHour: null,
};

// ---------------------------------------------------------------------------
// Analyze User Preferences
// ---------------------------------------------------------------------------

interface SavedDealRow {
  deal_id: string;
  created_at: string;
}

interface DismissedDealRow {
  deal_id: string;
}

interface EventRow {
  event_type: string;
  deal_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Analyze user behavior to build preferences profile.
 * Queries saved/dismissed deals and events from Supabase.
 */
export async function analyzeUserPreferences(
  deals: Deal[]
): Promise<UserPreferences> {
  const userId = getOrCreateUserId();
  if (!userId) return { ...DEFAULT_PREFERENCES };

  try {
    // Query saved deals
    const { data: savedDeals } = await supabase
      ?.from('user_saved_deals')
      ?.select('deal_id, created_at')
      ?.eq('user_id', userId) as { data: SavedDealRow[] | null };

    // Query dismissed deals
    const { data: dismissedDeals } = await supabase
      ?.from('user_dismissed_deals')
      ?.select('deal_id')
      ?.eq('user_id', userId) as { data: DismissedDealRow[] | null };

    // Query events for more context
    const { data: events } = await supabase
      ?.from('user_events')
      ?.select('event_type, deal_id, metadata, created_at')
      ?.eq('user_id', userId)
      ?.order('created_at', { ascending: false })
      ?.limit(500) as { data: EventRow[] | null };

    const savedIds = new Set((savedDeals || []).map((s) => s.deal_id));
    const dismissedIds = new Set((dismissedDeals || []).map((d) => d.deal_id));

    const totalSaves = savedIds.size;
    const totalDismisses = dismissedIds.size;

    // If user is new (not enough saves), return defaults
    if (totalSaves < NEW_USER_THRESHOLD) {
      return {
        ...DEFAULT_PREFERENCES,
        userId,
        totalSaves,
        totalDismisses,
      };
    }

    // Build deal lookup map
    const dealMap = new Map(deals.map((d) => [d.id, d]));

    // Analyze saved deals
    const savedDealObjects = Array.from(savedIds)
      .map((id) => dealMap.get(id))
      .filter((d): d is Deal => d !== undefined);

    // Category analysis
    const categoryCounts: Record<Category, number> = {
      flower: 0,
      concentrate: 0,
      vape: 0,
      edible: 0,
      preroll: 0,
    };
    const categoryTotal = savedDealObjects.length || 1;

    for (const deal of savedDealObjects) {
      categoryCounts[deal.category]++;
    }

    const categoryScores: Record<Category, number> = {
      flower: categoryCounts.flower / categoryTotal,
      concentrate: categoryCounts.concentrate / categoryTotal,
      vape: categoryCounts.vape / categoryTotal,
      edible: categoryCounts.edible / categoryTotal,
      preroll: categoryCounts.preroll / categoryTotal,
    };

    // Price analysis
    const prices = savedDealObjects.map((d) => d.deal_price).sort((a, b) => a - b);
    const avgSavedPrice =
      prices.length > 0
        ? prices.reduce((sum, p) => sum + p, 0) / prices.length
        : 35;
    const preferredPriceMin = prices.length > 2 ? prices[Math.floor(prices.length * 0.1)] : 0;
    const preferredPriceMax = prices.length > 2 ? prices[Math.floor(prices.length * 0.9)] : 100;

    // Discount analysis
    const discounts = savedDealObjects
      .filter((d) => d.original_price && d.original_price > d.deal_price)
      .map((d) => ((d.original_price! - d.deal_price) / d.original_price!) * 100);
    const preferredMinDiscount =
      discounts.length > 0
        ? discounts.reduce((sum, d) => sum + d, 0) / discounts.length - 10
        : 20;

    // Dispensary preference
    const dispensaryCounts: Record<string, number> = {};
    for (const deal of savedDealObjects) {
      dispensaryCounts[deal.dispensary.id] = (dispensaryCounts[deal.dispensary.id] || 0) + 1;
    }
    const maxDispensaryCount = Math.max(...Object.values(dispensaryCounts), 1);
    const dispensaryScores: Record<string, number> = {};
    for (const [id, count] of Object.entries(dispensaryCounts)) {
      dispensaryScores[id] = count / maxDispensaryCount;
    }

    // Brand preference
    const brandCounts: Record<string, number> = {};
    for (const deal of savedDealObjects) {
      brandCounts[deal.brand.id] = (brandCounts[deal.brand.id] || 0) + 1;
    }
    const maxBrandCount = Math.max(...Object.values(brandCounts), 1);
    const brandScores: Record<string, number> = {};
    for (const [id, count] of Object.entries(brandCounts)) {
      brandScores[id] = count / maxBrandCount;
    }

    // Peak hour analysis from events
    let peakHour: number | null = null;
    if (events && events.length > 10) {
      const hourCounts: Record<number, number> = {};
      for (const event of events) {
        const hour = new Date(event.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      peakHour = Number(
        Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      );
    }

    // Price tier detection
    let priceTier: 'budget' | 'mid' | 'premium' = 'mid';
    if (avgSavedPrice < 20) {
      priceTier = 'budget';
    } else if (avgSavedPrice > 60) {
      priceTier = 'premium';
    }

    // Top brand (most saved)
    const topBrandEntry = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0];
    const topBrand = topBrandEntry ? topBrandEntry[0] : null;

    // Top category
    const topCategoryEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCategoryEntry ? (topCategoryEntry[0] as Category) : null;

    return {
      userId,
      isNewUser: false,
      totalSaves,
      totalDismisses,
      categoryScores,
      preferredPriceMin,
      preferredPriceMax,
      avgSavedPrice,
      priceTier,
      preferredMinDiscount: Math.max(0, preferredMinDiscount),
      dispensaryScores,
      brandScores,
      topBrand,
      topCategory,
      peakHour,
    };
  } catch {
    // On any error, return defaults
    return { ...DEFAULT_PREFERENCES, userId };
  }
}

// ---------------------------------------------------------------------------
// Score Deals
// ---------------------------------------------------------------------------

/**
 * Score deals 0-100 based on user preferences.
 * Higher score = better match for this user.
 */
export function scoreDeals(
  deals: Deal[],
  preferences: UserPreferences
): ScoredDeal[] {
  const now = new Date();

  return deals.map((deal) => {
    let score = 50; // Base score
    let topReason: RecommendationReason | null = null;
    let topReasonScore = 0;

    // ------------------------------------
    // Category match (0-25 points)
    // ------------------------------------
    const categoryScore = preferences.categoryScores[deal.category] || 0;
    const categoryPoints = categoryScore * SCORE_WEIGHTS.category;
    score += categoryPoints;
    if (categoryPoints > topReasonScore && categoryScore > 0.3) {
      topReasonScore = categoryPoints;
      topReason = 'category_match';
    }

    // ------------------------------------
    // Price match (0-20 points)
    // ------------------------------------
    const price = deal.deal_price;
    let pricePoints = 0;
    if (price >= preferences.preferredPriceMin && price <= preferences.preferredPriceMax) {
      // Perfect range match
      pricePoints = SCORE_WEIGHTS.price;
    } else {
      // Partial match based on distance from preferred range
      const distanceFromRange = price < preferences.preferredPriceMin
        ? preferences.preferredPriceMin - price
        : price - preferences.preferredPriceMax;
      pricePoints = Math.max(0, SCORE_WEIGHTS.price - distanceFromRange / 5);
    }
    score += pricePoints;
    if (pricePoints > topReasonScore && pricePoints > 15) {
      topReasonScore = pricePoints;
      topReason = 'price_match';
    }

    // ------------------------------------
    // Discount match (0-25 points)
    // ------------------------------------
    let discountPoints = 0;
    if (deal.original_price && deal.original_price > deal.deal_price) {
      const discount = ((deal.original_price - deal.deal_price) / deal.original_price) * 100;
      if (discount >= preferences.preferredMinDiscount) {
        // Bonus for meeting discount threshold
        discountPoints = SCORE_WEIGHTS.discount * Math.min(discount / 50, 1);
      } else {
        discountPoints = (discount / preferences.preferredMinDiscount) * SCORE_WEIGHTS.discount * 0.5;
      }
    }
    score += discountPoints;
    if (discountPoints > topReasonScore && discountPoints > 18) {
      topReasonScore = discountPoints;
      topReason = 'high_discount';
    }

    // ------------------------------------
    // Brand preference (0-15 points)
    // ------------------------------------
    const brandScore = preferences.brandScores[deal.brand.id] || 0;
    const brandPoints = brandScore * SCORE_WEIGHTS.brand;
    score += brandPoints;
    if (brandPoints > topReasonScore && brandScore > 0.5) {
      topReasonScore = brandPoints;
      topReason = 'favorite_brand';
    }

    // ------------------------------------
    // Dispensary preference (0-10 points)
    // ------------------------------------
    const dispensaryScore = preferences.dispensaryScores[deal.dispensary.id] || 0;
    const dispensaryPoints = dispensaryScore * SCORE_WEIGHTS.dispensary;
    score += dispensaryPoints;
    if (dispensaryPoints > topReasonScore && dispensaryScore > 0.5) {
      topReasonScore = dispensaryPoints;
      topReason = 'favorite_dispensary';
    }

    // ------------------------------------
    // Recency bonus (0-5 points)
    // ------------------------------------
    const ageHours = (now.getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60);
    const recencyPoints = Math.max(0, SCORE_WEIGHTS.recency - ageHours / 24);
    score += recencyPoints;

    // ------------------------------------
    // Bonus for trending / popular deals
    // ------------------------------------
    if (deal.save_count && deal.save_count > 10) {
      score += 5;
      if (!topReason) {
        topReason = 'trending';
      }
    }

    // ------------------------------------
    // Bonus for high deal_score
    // ------------------------------------
    if (deal.deal_score >= 80) score += 10;
    else if (deal.deal_score >= 60) score += 5;
    if (deal.is_verified) score += 3;

    // New user special handling
    if (preferences.isNewUser && !topReason) {
      if (deal.deal_score >= 70) {
        topReason = 'new_user_top_pick';
      }
    }

    // Clamp score to 0-100
    const finalScore = Math.max(0, Math.min(100, score));

    return {
      ...deal,
      personalizationScore: Math.round(finalScore),
      recommendationReason: topReason,
    };
  });
}

// ---------------------------------------------------------------------------
// Sort by Personalization Score
// ---------------------------------------------------------------------------

/**
 * Sort deals by personalization score (highest first).
 * Optionally mix in some randomness to avoid filter bubbles.
 */
export function sortByPersonalization(
  deals: ScoredDeal[],
  options: { shuffle?: boolean } = {}
): ScoredDeal[] {
  const sorted = [...deals].sort((a, b) => b.personalizationScore - a.personalizationScore);

  if (!options.shuffle) return sorted;

  // Light shuffle: swap adjacent items occasionally to add variety
  for (let i = 1; i < sorted.length - 1; i++) {
    if (Math.random() < 0.15 && sorted[i].personalizationScore > 60) {
      [sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]];
    }
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Get Recommendation Reason Text
// ---------------------------------------------------------------------------

export function getRecommendationText(reason: RecommendationReason | null): string {
  switch (reason) {
    case 'category_match':
      return 'Matches your saved deals';
    case 'price_match':
      return 'In your price range';
    case 'high_discount':
      return 'Great discount for you';
    case 'favorite_brand':
      return 'From a brand you love';
    case 'favorite_dispensary':
      return 'From your go-to dispensary';
    case 'trending':
      return 'Popular with deal hunters';
    case 'new_user_top_pick':
      return 'Top pick for new users';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Check if Deal is Recommended (top 10%)
// ---------------------------------------------------------------------------

export function isRecommendedDeal(
  deal: ScoredDeal,
  allDeals: ScoredDeal[]
): boolean {
  if (allDeals.length === 0) return false;
  const threshold = allDeals.length * 0.1;
  const sorted = [...allDeals].sort((a, b) => b.personalizationScore - a.personalizationScore);
  const topDeals = sorted.slice(0, Math.max(1, Math.ceil(threshold)));
  return topDeals.some((d) => d.id === deal.id);
}

// ---------------------------------------------------------------------------
// Local Storage Cache for Preferences
// ---------------------------------------------------------------------------

const PREFS_CACHE_KEY = 'clouded_user_prefs';
const PREFS_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

interface CachedPrefs {
  prefs: UserPreferences;
  timestamp: number;
}

export function getCachedPreferences(): UserPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFS_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedPrefs = JSON.parse(raw);
    if (Date.now() - cached.timestamp > PREFS_CACHE_TTL) {
      localStorage.removeItem(PREFS_CACHE_KEY);
      return null;
    }
    return cached.prefs;
  } catch {
    return null;
  }
}

export function setCachedPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    const cached: CachedPrefs = { prefs, timestamp: Date.now() };
    localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

export function clearCachedPreferences(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PREFS_CACHE_KEY);
}
