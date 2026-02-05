'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Deal } from '@/types';
import {
  UserPreferences,
  ScoredDeal,
  analyzeUserPreferences,
  scoreDeals,
  sortByPersonalization,
  isRecommendedDeal,
  getCachedPreferences,
  setCachedPreferences,
  clearCachedPreferences,
} from '@/lib/personalization';

interface UsePersonalizationResult {
  // Scored and sorted deals
  personalizedDeals: ScoredDeal[];
  // User preferences (null while loading)
  preferences: UserPreferences | null;
  // Loading state
  isLoading: boolean;
  // Check if a specific deal is in top 10%
  isRecommended: (dealId: string) => boolean;
  // Force refresh preferences (e.g., after saving a deal)
  refreshPreferences: () => void;
}

/**
 * Hook to apply personalization scoring to deals.
 *
 * Usage:
 * ```tsx
 * const { personalizedDeals, isRecommended } = usePersonalization(deals);
 * ```
 */
export function usePersonalization(deals: Deal[]): UsePersonalizationResult {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      // Try cache first
      const cached = getCachedPreferences();
      if (cached) {
        setPreferences(cached);
        setIsLoading(false);
        return;
      }

      // Load from Supabase
      try {
        const prefs = await analyzeUserPreferences(deals);
        if (!cancelled) {
          setPreferences(prefs);
          setCachedPreferences(prefs);
        }
      } catch {
        // Use default preferences on error
        if (!cancelled) {
          setPreferences(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [deals]);

  // Score and sort deals
  const personalizedDeals = useMemo(() => {
    if (!preferences || deals.length === 0) {
      // Return deals with default scores
      return deals.map((deal) => ({
        ...deal,
        personalizationScore: 50,
        recommendationReason: null,
      })) as ScoredDeal[];
    }

    const scored = scoreDeals(deals, preferences);
    return sortByPersonalization(scored, { shuffle: false });
  }, [deals, preferences]);

  // Helper to check if deal is recommended
  const isRecommended = useCallback(
    (dealId: string): boolean => {
      const deal = personalizedDeals.find((d) => d.id === dealId);
      if (!deal) return false;
      return isRecommendedDeal(deal, personalizedDeals);
    },
    [personalizedDeals]
  );

  // Force refresh preferences
  const refreshPreferences = useCallback(() => {
    clearCachedPreferences();
    setIsLoading(true);
    analyzeUserPreferences(deals).then((prefs) => {
      setPreferences(prefs);
      setCachedPreferences(prefs);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [deals]);

  return {
    personalizedDeals,
    preferences,
    isLoading,
    isRecommended,
    refreshPreferences,
  };
}

/**
 * Get personalization info for a specific deal.
 */
export function getDealPersonalizationInfo(
  deal: ScoredDeal,
  allDeals: ScoredDeal[]
): {
  score: number;
  reason: string | null;
  isTopRecommended: boolean;
} {
  return {
    score: deal.personalizationScore,
    reason: deal.recommendationReason,
    isTopRecommended: isRecommendedDeal(deal, allDeals),
  };
}
