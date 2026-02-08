'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CHALLENGES, type ChallengeDefinition } from '@/config/challenges';
import { getDealHeat } from '@/utils/dealHeat';
import { trackEvent } from '@/lib/analytics';
import type { Deal } from '@/types';

const STORAGE_KEY = 'clouded_challenges_v1';

interface ChallengeProgress {
  progress: number;
  isCompleted: boolean;
  completedAt?: string;
}

type ChallengeState = Record<string, ChallengeProgress>;

function loadChallenges(): ChallengeState {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveChallenges(state: ChallengeState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export interface CompletedChallenge {
  challenge: ChallengeDefinition;
  justCompleted: boolean;
}

export function useChallenges() {
  const [state, setState] = useState<ChallengeState>(loadChallenges);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  // Persist to localStorage
  useEffect(() => {
    saveChallenges(state);
  }, [state]);

  // Clear justCompleted after 4s (for toast/celebration)
  useEffect(() => {
    if (!justCompleted) return;
    const timer = setTimeout(() => setJustCompleted(null), 4000);
    return () => clearTimeout(timer);
  }, [justCompleted]);

  const getProgress = useCallback((challengeId: string): ChallengeProgress => {
    return state[challengeId] || { progress: 0, isCompleted: false };
  }, [state]);

  /**
   * Called on every save or dismiss action. Updates challenge progress
   * and returns the challenge ID if one was just completed.
   */
  const updateProgress = useCallback((
    action: 'save' | 'dismiss',
    deal: Deal,
    allSavedDeals: Deal[],
  ): string | null => {
    let completedId: string | null = null;

    setState((prev) => {
      const next = { ...prev };

      for (const challenge of CHALLENGES) {
        const current = next[challenge.id] || { progress: 0, isCompleted: false };
        if (current.isCompleted) continue;

        const req = challenge.requirement;
        let shouldIncrement = false;
        let newProgress = current.progress;

        if (req.action === 'interact') {
          // Both saves and dismisses count
          shouldIncrement = true;
        } else if (req.action === 'save' && action === 'save') {
          if ('category' in req && req.category) {
            shouldIncrement = deal.category === req.category;
          } else if ('minHeat' in req) {
            const heat = getDealHeat(deal);
            shouldIncrement = heat !== null && heat >= req.minHeat;
          } else if ('uniqueDispensaries' in req) {
            const dispensarySet = new Set(allSavedDeals.map((d) => d.dispensary.id));
            dispensarySet.add(deal.dispensary.id);
            newProgress = dispensarySet.size;
            shouldIncrement = false; // We set directly
          } else if ('sameBrand' in req) {
            const brandCounts: Record<string, number> = {};
            for (const d of allSavedDeals) {
              const b = d.brand?.name || '';
              brandCounts[b] = (brandCounts[b] || 0) + 1;
            }
            const currentBrand = deal.brand?.name || '';
            brandCounts[currentBrand] = (brandCounts[currentBrand] || 0) + 1;
            newProgress = Math.max(...Object.values(brandCounts), 0);
            shouldIncrement = false; // We set directly
          } else if ('count' in req) {
            shouldIncrement = true;
          }
        }

        if (shouldIncrement) {
          newProgress = current.progress + 1;
        }

        // Check for completion
        const target = 'count' in req ? req.count
          : 'uniqueDispensaries' in req ? req.uniqueDispensaries
          : 'sameBrand' in req ? req.sameBrand
          : 0;

        const wasCompleted = current.isCompleted;
        const isNowCompleted = newProgress >= target;

        next[challenge.id] = {
          progress: newProgress,
          isCompleted: isNowCompleted,
          completedAt: isNowCompleted && !wasCompleted ? new Date().toISOString() : current.completedAt,
        };

        if (isNowCompleted && !wasCompleted) {
          completedId = challenge.id;
          trackEvent('challenge_completed', undefined, {
            challenge_id: challenge.id,
            badge_name: challenge.badge,
          });
        }
      }

      return next;
    });

    if (completedId) {
      setJustCompleted(completedId);
    }

    return completedId;
  }, []);

  // Derived data
  const onboardingComplete = useMemo(() => {
    return getProgress('first_three').isCompleted;
  }, [getProgress]);

  const onboardingProgress = useMemo(() => {
    const p = getProgress('first_three');
    return { current: Math.min(p.progress, 3), total: 3, isCompleted: p.isCompleted };
  }, [getProgress]);

  const earnedBadges = useMemo(() => {
    return CHALLENGES.filter((c) => getProgress(c.id).isCompleted);
  }, [getProgress]);

  const nextChallenge = useMemo((): { challenge: ChallengeDefinition; progress: ChallengeProgress } | null => {
    // Only show category challenges after onboarding
    const candidates = onboardingComplete
      ? CHALLENGES.filter((c) => c.id !== 'first_three')
      : CHALLENGES.filter((c) => c.id === 'first_three');

    for (const c of candidates) {
      const p = getProgress(c.id);
      if (!p.isCompleted) {
        return { challenge: c, progress: p };
      }
    }
    return null;
  }, [getProgress, onboardingComplete]);

  const interactionCount = useMemo(() => {
    return getProgress('first_three').progress;
  }, [getProgress]);

  return {
    state,
    getProgress,
    updateProgress,
    onboardingComplete,
    onboardingProgress,
    earnedBadges,
    nextChallenge,
    justCompleted,
    interactionCount,
  };
}
