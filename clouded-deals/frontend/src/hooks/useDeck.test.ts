import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeck } from './useDeck';
import { makeDeal } from '@/__tests__/helpers/factories';
import type { Deal } from '@/types';

// Mock curatedShuffle to return deals in order (no randomness in tests)
vi.mock('@/lib/curatedShuffle', () => ({
  curatedShuffle: vi.fn((deals: Deal[]) => deals),
}));

const DISMISSED_KEY = 'clouded_dismissed_v1';
const SEEN_KEY = 'clouded_seen_deals_v1';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

function makeDeals(count: number): Deal[] {
  return Array.from({ length: count }, (_, i) =>
    makeDeal({ id: `d-${i}`, product_name: `Product ${i}`, deal_score: 70 + i })
  );
}

describe('useDeck — Seen Before Indicator (Phase 1 #10)', () => {
  it('previouslySeenIds is empty on fresh visit', () => {
    const deals = makeDeals(5);
    const { result } = renderHook(() => useDeck(deals));
    expect(result.current.previouslySeenIds.size).toBe(0);
  });

  it('previouslySeenIds loads from localStorage (cross-session)', () => {
    // Simulate a previous day's seen IDs
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const prevDate = yesterday.toISOString().slice(0, 10);

    localStorage.setItem(SEEN_KEY, JSON.stringify({
      date: prevDate,
      ids: ['old-1', 'old-2'],
    }));

    const deals = makeDeals(3);
    const { result } = renderHook(() => useDeck(deals));
    expect(result.current.previouslySeenIds.has('old-1')).toBe(true);
    expect(result.current.previouslySeenIds.has('old-2')).toBe(true);
  });
});

describe('useDeck — resetDismissed', () => {
  it('clears dismissed set and resets count to zero', () => {
    const deals = makeDeals(15);
    const { result } = renderHook(() => useDeck(deals));

    // Dismiss a deal
    act(() => { result.current.dismissImmediate('d-0'); });
    expect(result.current.dismissedCount).toBe(1);

    // Reset
    act(() => { result.current.resetDismissed(); });
    expect(result.current.dismissedCount).toBe(0);
    // Note: the persistDismissedIds effect re-writes an empty set to localStorage,
    // so we verify the count rather than localStorage being null
    expect(result.current.remaining.length).toBe(deals.length);
  });
});

describe('useDeck — Initial state', () => {
  it('visible has up to 12 deals', () => {
    const deals = makeDeals(20);
    const { result } = renderHook(() => useDeck(deals));
    expect(result.current.visible.length).toBe(12);
  });

  it('totalDeals equals input length', () => {
    const deals = makeDeals(8);
    const { result } = renderHook(() => useDeck(deals));
    expect(result.current.totalDeals).toBe(8);
  });

  it('isComplete is false when deals remain', () => {
    const deals = makeDeals(5);
    const { result } = renderHook(() => useDeck(deals));
    expect(result.current.isComplete).toBe(false);
  });
});

describe('useDeck — localStorage persistence', () => {
  it('loads stale dismissed data from different date as empty', () => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify({
      date: '2020-01-01',
      ids: ['stale-1'],
    }));

    const deals = makeDeals(5);
    const { result } = renderHook(() => useDeck(deals));
    expect(result.current.dismissedCount).toBe(0);
  });
});
