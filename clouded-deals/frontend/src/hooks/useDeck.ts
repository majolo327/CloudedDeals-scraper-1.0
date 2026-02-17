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

/** How many cards to show at once in the grid (3×3) */
const VISIBLE_COUNT = 9;

/** Deal score threshold for "jackpot" reveal animation */
const JACKPOT_THRESHOLD = 80;

export interface DeckState {
  /** Currently visible deals in the grid — position-stable (in-place replacement) */
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
  /** Deal score of the replacement card (null when no replacement active) */
  replacementDealScore: number | null;
  /** Dismiss a deal — triggers animation, then replaces it in-place */
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
  const [replacementDealScore, setReplacementDealScore] = useState<number | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout>();
  const appearTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSwipeRef = useRef<number>(0);
  /** Minimum ms between swipes to prevent spam-swiping */
  const SWIPE_COOLDOWN = 300;

  // Build the deck: shuffled for default sort, or preserve order for custom sorts
  const shuffledDeck = useMemo(() => {
    if (!shuffle) return deals;
    const anonId =
      typeof window !== 'undefined' ? getOrCreateAnonId() : '';
    return curatedShuffle(deals, { anonId });
  }, [deals, shuffle]);

  // All undismissed deals in deck order (used for stack mode + stats)
  const remaining = useMemo(() => {
    return shuffledDeck.filter((d) => !dismissedIds.has(d.id));
  }, [shuffledDeck, dismissedIds]);

  // ── Position-stable grid slots ──────────────────────────────────
  // Instead of recomputing visible as remaining.slice(0, 12) (which causes
  // all cards to shift on dismiss), we maintain a state-managed array where
  // replacements are inserted at the EXACT position of the dismissed card.
  const [slots, setSlots] = useState<Deal[]>([]);

  // Rebuild slots when the source deck fundamentally changes
  // (new data load, filter/sort change). NOT on individual dismissals.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const filtered = shuffledDeck.filter((d) => !dismissedIds.has(d.id));
    setSlots(filtered.slice(0, VISIBLE_COUNT));
    // Intentionally only depends on shuffledDeck — dismiss-triggered changes
    // are handled by the in-place replacement in dismissDeal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffledDeck]);

  // Persist dismissed IDs whenever they change
  useEffect(() => {
    persistDismissedIds(dismissedIds);
  }, [dismissedIds]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
      if (appearTimeoutRef.current) clearTimeout(appearTimeoutRef.current);
    };
  }, []);

  const dismissDeal = useCallback(
    (dealId: string) => {
      // Prevent double-dismiss during animation
      if (dismissingId) return;

      // Find the deal for analytics + position in the stable grid
      const deal = shuffledDeck.find((d) => d.id === dealId);
      const position = slots.findIndex((d) => d.id === dealId);

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

      // After dismiss animation completes, swap the card IN-PLACE
      dismissTimeoutRef.current = setTimeout(() => {
        // Add to dismissed set
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.add(dealId);
          return next;
        });
        setDismissingId(null);

        // Find the replacement: next card from deck not currently in grid slots
        const currentSlotIds = new Set(slots.map((d) => d.id));
        const nextCard = shuffledDeck.find(
          (d) =>
            !dismissedIds.has(d.id) &&
            d.id !== dealId &&
            !currentSlotIds.has(d.id)
        );

        if (nextCard && position !== -1) {
          // Replace at the EXACT same grid position — no shifting!
          setSlots((prev) => {
            const next = [...prev];
            next[position] = nextCard;
            return next;
          });

          // Signal which card is appearing + its score for animation selection
          const isJackpot = (nextCard.deal_score ?? 0) >= JACKPOT_THRESHOLD;
          setReplacementDealScore(nextCard.deal_score ?? null);
          setAppearingId(nextCard.id);

          // Clear appearing state after animation completes
          const revealDuration = isJackpot ? 600 : 480;
          appearTimeoutRef.current = setTimeout(() => {
            setAppearingId(null);
            setReplacementDealScore(null);
          }, revealDuration);
        } else {
          // No replacement available — shrink the grid
          setSlots((prev) => prev.filter((d) => d.id !== dealId));
        }
      }, 320); // Match enhanced CSS dismiss animation duration
    },
    [dismissingId, shuffledDeck, slots, dismissedIds]
  );

  // Immediate dismiss (no animation) — used by stack/swipe mode
  // Rate-limited to prevent spam-swiping
  const dismissImmediate = useCallback(
    (dealId: string) => {
      const now = Date.now();
      if (now - lastSwipeRef.current < SWIPE_COOLDOWN) return;
      lastSwipeRef.current = now;

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
    dismissedIds.size + slots.length,
    shuffledDeck.length
  );

  return {
    visible: slots,
    remaining,
    totalDeals: shuffledDeck.length,
    seenCount,
    dismissedCount: dismissedIds.size,
    isComplete: remaining.length === 0 && shuffledDeck.length > 0,
    dismissingId,
    appearingId,
    replacementDealScore,
    dismissDeal,
    dismissImmediate,
  };
}
