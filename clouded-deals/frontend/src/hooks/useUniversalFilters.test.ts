import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUniversalFilters, DEFAULT_UNIVERSAL_FILTERS } from './useUniversalFilters';

const FILTERS_STORAGE_KEY = 'clouded_filters_v1';

// Mock dependencies
vi.mock('@/lib/zipCodes', () => ({
  getStoredZip: vi.fn(() => null),
  getZipCoordinates: vi.fn(() => null),
}));

vi.mock('@/utils', () => ({
  getDistanceMiles: vi.fn(() => null),
}));

vi.mock('@/utils/weightNormalizer', () => ({
  weightsMatch: vi.fn(() => false),
}));

beforeEach(() => {
  localStorage.clear();
});

describe('useUniversalFilters — Remember What I Like (Phase 1 #1)', () => {
  it('loads saved filters from localStorage on init', () => {
    const saved = { ...DEFAULT_UNIVERSAL_FILTERS, categories: ['flower'] };
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useUniversalFilters());
    expect(result.current.filters.categories).toEqual(['flower']);
  });

  it('persists filter changes to localStorage', () => {
    const { result } = renderHook(() => useUniversalFilters());

    act(() => {
      result.current.setFilters({
        ...DEFAULT_UNIVERSAL_FILTERS,
        categories: ['vape'],
      });
    });

    const stored = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || '{}');
    expect(stored.categories).toEqual(['vape']);
  });

  it('resetFilters returns to defaults', () => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
      ...DEFAULT_UNIVERSAL_FILTERS,
      categories: ['edible'],
      sortBy: 'price_asc',
    }));

    const { result } = renderHook(() => useUniversalFilters());
    expect(result.current.filters.categories).toEqual(['edible']);

    act(() => { result.current.resetFilters(); });
    expect(result.current.filters.categories).toEqual([]);
    expect(result.current.filters.sortBy).toBe('deal_score');
  });

  it('activeFilterCount counts correctly', () => {
    const { result } = renderHook(() => useUniversalFilters());

    act(() => {
      result.current.setFilters({
        ...DEFAULT_UNIVERSAL_FILTERS,
        categories: ['flower'],
        dispensaryIds: ['disp-1'],
      });
    });

    expect(result.current.activeFilterCount).toBe(2);
  });

  it('starts with defaults when localStorage is empty', () => {
    const { result } = renderHook(() => useUniversalFilters());
    expect(result.current.filters).toEqual(DEFAULT_UNIVERSAL_FILTERS);
  });
});
