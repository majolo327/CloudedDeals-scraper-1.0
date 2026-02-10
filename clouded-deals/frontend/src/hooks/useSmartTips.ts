'use client';

import { useCallback, useRef } from 'react';

// ── Tip pools — varied messages so the user never sees the same one twice in a row ──

const SAVE_TIPS_FIRST: string[] = [
  'First save! Your feed is learning.',
  'Nice pick — we\'ll remember that.',
];

const SAVE_TIPS_EARLY: string[] = [
  'Saved! We\'re dialing in your taste.',
  'Got it — more like this coming.',
  'Saved. Your feed is getting smarter.',
  'Noted. We\'ll surface similar deals.',
];

const SAVE_TIPS_ENGAGED: string[] = [
  'Saved!',
  'Added to your list.',
  'Saved before it\'s gone.',
  '\u2764\uFE0F',
];

const DISMISS_TIPS_FIRST: string[] = [
  'Got it — fewer like this.',
  'Noted. Your feed adapts.',
];

const DISMISS_TIPS_EARLY: string[] = [
  'Passed. Feed updated.',
  'Skipped — we\'ll adjust.',
  'Not your vibe, got it.',
];

const DISMISS_TIPS_ENGAGED: string[] = [
  // Engaged users know the drill — silent or ultra-brief
];

const MILESTONE_MESSAGES: Record<number, string> = {
  1: 'First deal saved \uD83D\uDD16',
  3: 'You\'ve got taste \uD83D\uDC4C',
  5: 'On a roll — 5 saves today.',
  10: 'Deal hunter \uD83C\uDFAF',
  15: '15 saves! You\'re a pro.',
  25: 'Power saver \u2014 25 deals saved.',
};

const DIVERSITY_MESSAGES = {
  dispensary_3: 'Explorer unlocked \uD83D\uDDFA\uFE0F 3 dispensaries!',
  dispensary_5: 'Globe trotter \u2014 5 different shops.',
  brand_3: (brand: string) => `${brand} fan? \uD83D\uDC9C`,
  category_variety: 'Variety pack \u2014 saving across categories.',
};

// ── Tip frequency throttling ──

interface TipState {
  lastSaveTipAt: number;
  lastDismissTipAt: number;
  lastTipMessage: string;
  sessionSaveCount: number;
  sessionDismissCount: number;
  totalInteractions: number;
}

/**
 * Determines how chatty the system should be based on how many interactions
 * the user has had this session. New users get more guidance; engaged users
 * get less noise.
 */
function getTipPhase(interactions: number): 'first' | 'early' | 'engaged' {
  if (interactions <= 1) return 'first';
  if (interactions <= 8) return 'early';
  return 'engaged';
}

function pickRandom(pool: string[], exclude: string): string | null {
  if (pool.length === 0) return null;
  const filtered = pool.filter((m) => m !== exclude);
  const arr = filtered.length > 0 ? filtered : pool;
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface SmartTipResult {
  message: string | null;
  type: 'saved' | 'info' | 'milestone' | 'discovery' | 'removed';
}

export interface SmartTipEngine {
  /** Called when user saves a deal (swipe right or heart tap). Returns tip to show (or null for silence). */
  onSave: (context: SaveContext) => SmartTipResult | null;
  /** Called when user dismisses a deal (swipe left or X). Returns tip to show (or null for silence). */
  onDismiss: () => SmartTipResult | null;
  /** Called when user unsaves a deal. */
  onUnsave: () => SmartTipResult;
}

export interface SaveContext {
  totalSavedCount: number;
  brandName?: string;
  brandSaveCount?: number;
  uniqueDispensaryCount?: number;
  uniqueCategoryCount?: number;
}

/**
 * Smart tip engine that provides varied, context-aware feedback messages.
 * Works identically whether the user is in swipe mode or grid mode.
 *
 * Key behaviors:
 * - First interactions get educational tips
 * - Early interactions get encouraging, varied tips
 * - Engaged users get minimal/silent feedback (they know the drill)
 * - Milestones always fire (1, 3, 5, 10, 15, 25 saves)
 * - Diversity achievements fire once per threshold
 * - Never shows the same message twice in a row
 * - Throttles dismiss tips to max 1 per 3 seconds
 */
export function useSmartTips(): SmartTipEngine {
  const stateRef = useRef<TipState>({
    lastSaveTipAt: 0,
    lastDismissTipAt: 0,
    lastTipMessage: '',
    sessionSaveCount: 0,
    sessionDismissCount: 0,
    totalInteractions: 0,
  });

  const shownMilestonesRef = useRef<Set<number>>(new Set());
  const shownDiversityRef = useRef<Set<string>>(new Set());

  const onSave = useCallback((context: SaveContext): SmartTipResult | null => {
    const s = stateRef.current;
    s.sessionSaveCount++;
    s.totalInteractions++;

    const newTotal = context.totalSavedCount;

    // 1. Check for milestone (always fires, takes priority)
    if (MILESTONE_MESSAGES[newTotal] && !shownMilestonesRef.current.has(newTotal)) {
      shownMilestonesRef.current.add(newTotal);
      const msg = MILESTONE_MESSAGES[newTotal];
      s.lastTipMessage = msg;
      s.lastSaveTipAt = Date.now();
      return { message: msg, type: 'milestone' };
    }

    // 2. Check for diversity achievements
    const diversity = shownDiversityRef.current;

    if (context.uniqueDispensaryCount !== undefined) {
      if (context.uniqueDispensaryCount >= 5 && !diversity.has('dispensary_5')) {
        diversity.add('dispensary_5');
        const msg = DIVERSITY_MESSAGES.dispensary_5;
        s.lastTipMessage = msg;
        s.lastSaveTipAt = Date.now();
        return { message: msg, type: 'discovery' };
      }
      if (context.uniqueDispensaryCount >= 3 && !diversity.has('dispensary_3')) {
        diversity.add('dispensary_3');
        const msg = DIVERSITY_MESSAGES.dispensary_3;
        s.lastTipMessage = msg;
        s.lastSaveTipAt = Date.now();
        return { message: msg, type: 'discovery' };
      }
    }

    if (context.brandName && context.brandSaveCount !== undefined && context.brandSaveCount >= 3) {
      const key = `brand_${context.brandName}`;
      if (!diversity.has(key)) {
        diversity.add(key);
        const msg = DIVERSITY_MESSAGES.brand_3(context.brandName);
        s.lastTipMessage = msg;
        s.lastSaveTipAt = Date.now();
        return { message: msg, type: 'discovery' };
      }
    }

    if (context.uniqueCategoryCount !== undefined && context.uniqueCategoryCount >= 4) {
      if (!diversity.has('category_variety')) {
        diversity.add('category_variety');
        const msg = DIVERSITY_MESSAGES.category_variety;
        s.lastTipMessage = msg;
        s.lastSaveTipAt = Date.now();
        return { message: msg, type: 'discovery' };
      }
    }

    // 3. Phase-based tip
    const phase = getTipPhase(s.totalInteractions);

    if (phase === 'engaged') {
      // Engaged users: only show a brief tip every 5th save
      if (s.sessionSaveCount % 5 !== 0) return null;
      const msg = pickRandom(SAVE_TIPS_ENGAGED, s.lastTipMessage);
      if (!msg) return null;
      s.lastTipMessage = msg;
      s.lastSaveTipAt = Date.now();
      return { message: msg, type: 'saved' };
    }

    if (phase === 'first') {
      const msg = pickRandom(SAVE_TIPS_FIRST, s.lastTipMessage);
      if (!msg) return null;
      s.lastTipMessage = msg;
      s.lastSaveTipAt = Date.now();
      return { message: msg, type: 'saved' };
    }

    // Early phase — throttle to max 1 tip per 2 seconds
    const now = Date.now();
    if (now - s.lastSaveTipAt < 2000) return null;

    const msg = pickRandom(SAVE_TIPS_EARLY, s.lastTipMessage);
    if (!msg) return null;
    s.lastTipMessage = msg;
    s.lastSaveTipAt = now;
    return { message: msg, type: 'saved' };
  }, []);

  const onDismiss = useCallback((): SmartTipResult | null => {
    const s = stateRef.current;
    s.sessionDismissCount++;
    s.totalInteractions++;

    const phase = getTipPhase(s.totalInteractions);

    // Engaged users: never show dismiss tips
    if (phase === 'engaged') return null;

    // Throttle dismiss tips: max 1 per 3 seconds
    const now = Date.now();
    if (now - s.lastDismissTipAt < 3000) return null;

    const pool = phase === 'first' ? DISMISS_TIPS_FIRST : DISMISS_TIPS_EARLY;
    const msg = pickRandom(pool, s.lastTipMessage);
    if (!msg) return null;

    s.lastTipMessage = msg;
    s.lastDismissTipAt = now;
    return { message: msg, type: 'info' };
  }, []);

  const onUnsave = useCallback((): SmartTipResult => {
    return { message: 'Removed from saves.', type: 'removed' };
  }, []);

  return { onSave, onDismiss, onUnsave };
}
