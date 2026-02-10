'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Deal } from '@/types';
import { curatedShuffle } from '@/lib/curatedShuffle';
import { getOrCreateAnonId } from '@/lib/analytics';
import { trackEvent } from '@/lib/analytics';

// ── localStorage persistence (daily reset) ──────────────────────────

const DISMISSED_KEY = 'clouded_dismissed_v1';

interface DismissedData {
  date: string; // YYYY-MM-DD
  ids: string[];
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      const data: DismissedData = JSON.parse(stored);
      // Auto-reset if date doesn't match today
      if (data.date === getTodayDate()) {
        return new Set(data.ids);
      }
      // Stale — clear it
      localStorage.removeItem(DISMISSED_KEY);
    }
  } catch {
    localStorage.removeItem(DISMISSED_KEY);
  }
  return new Set();
}

function persistDismissedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  const data: DismissedData = {
    date: getTodayDate(),
    ids: Array.from(ids),
  };
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(data));
}

// ── Deck state ──────────────────────────────────────────────────────

/** How many cards to show at once in the grid */
const VISIBLE_COUNT = 12;

export interface DeckState {
  /** Currently visible deals in the grid (first 12 of remaining) */
  visible: Deal[];
  /** All undismissed deals in deck order (for stack/swipe mode) */
  remaining: Deal[];
  /** Total deals in the shuffled deck (before dismissals) */
  totalDeals: number;
  /** Number of deals the user has seen (dismissed + currently visible) */
  seenCount: number;
  /** Number of dismissed deals */
  dismissedCount: number;
  /** Whether the user has seen all deals */
  isComplete: boolean;
  /** ID of a card currently animating out (for CSS transitions) */
  dismissingId: string | null;
  /** ID of a card currently animating in (for CSS transitions) */
  appearingId: string | null;
  /** Dismiss a deal — triggers animation, then replaces it */
  dismissDeal: (dealId: string) => void;
  /** Immediately add to dismissed set (no animation, for stack/swipe mode) */
  dismissImmediate: (dealId: string) => void;
}

export interface DeckOptions {
  /** Whether to apply curated shuffle (true) or preserve input order (false). Default: true */
  shuffle?: boolean;
}

export function useDeck(deals: Deal[], options: DeckOptions = {}): DeckState {
  const { shuffle = true } = options;

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    loadDismissedIds()
  );
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [appearingId, setAppearingId] = useState<string | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout>();

  // Build the deck: shuffled for default sort, or preserve order for custom sorts
  const shuffledDeck = useMemo(() => {
    if (!shuffle) return deals;
    const anonId =
      typeof window !== 'undefined' ? getOrCreateAnonId() : '';
    return curatedShuffle(deals, { anonId });
  }, [deals, shuffle]);

  // All undismissed deals in deck order
  const remaining = useMemo(() => {
    return shuffledDeck.filter((d) => !dismissedIds.has(d.id));
  }, [shuffledDeck, dismissedIds]);

  // Grid view: first 12 of remaining
  const visible = useMemo(() => {
    return remaining.slice(0, VISIBLE_COUNT);
  }, [remaining]);

  // Persist dismissed IDs whenever they change
  useEffect(() => {
    persistDismissedIds(dismissedIds);
  }, [dismissedIds]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    };
  }, []);

  const dismissDeal = useCallback(
    (dealId: string) => {
      // Prevent double-dismiss during animation
      if (dismissingId) return;

      // Find the deal for analytics
      const deal = shuffledDeck.find((d) => d.id === dealId);
      const position = visible.findIndex((d) => d.id === dealId);

      // Start dismiss animation
      setDismissingId(dealId);

      // Track analytics
      trackEvent('deal_dismissed', dealId, {
        position,
        category: deal?.category,
        brand: deal?.brand?.name,
        dispensary: deal?.dispensary?.name,
        deal_score: deal?.deal_score,
        dismissed_count: dismissedIds.size + 1,
      });

      // After animation completes, swap the card
      dismissTimeoutRef.current = setTimeout(() => {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.add(dealId);
          return next;
        });
        setDismissingId(null);

        // Find the replacement deal (first from upcoming queue)
        // The replacement will appear in the dismissed card's position
        // because the visible array recalculates from the shuffled deck
        const remaining = shuffledDeck.filter(
          (d) => !dismissedIds.has(d.id) && d.id !== dealId
        );
        const replacement = remaining[VISIBLE_COUNT - 1]; // the one that slides into view
        if (replacement) {
          setAppearingId(replacement.id);
          setTimeout(() => setAppearingId(null), 400);
        }
      }, 300); // Match CSS animation duration
    },
    [dismissingId, shuffledDeck, visible, dismissedIds]
  );

  // Immediate dismiss (no animation) — used by stack/swipe mode
  const dismissImmediate = useCallback(
    (dealId: string) => {
      const deal = shuffledDeck.find((d) => d.id === dealId);
      trackEvent('deal_dismissed', dealId, {
        category: deal?.category,
        brand: deal?.brand?.name,
        deal_score: deal?.deal_score,
        dismissed_count: dismissedIds.size + 1,
        mode: 'stack',
      });
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(dealId);
        return next;
      });
    },
    [shuffledDeck, dismissedIds]
  );

  const seenCount = Math.min(
    dismissedIds.size + visible.length,
    shuffledDeck.length
  );

  return {
    visible,
    remaining,
    totalDeals: shuffledDeck.length,
    seenCount,
    dismissedCount: dismissedIds.size,
    isComplete: remaining.length === 0 && shuffledDeck.length > 0,
    dismissingId,
    appearingId,
    dismissDeal,
    dismissImmediate,
  };
}
