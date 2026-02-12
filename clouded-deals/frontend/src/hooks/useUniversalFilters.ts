'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Deal, Category } from '@/types';
import { getStoredZip, getZipCoordinates, type ZipCoords } from '@/lib/zipCodes';
import { getDistanceMiles } from '@/utils';
import { weightsMatch } from '@/utils/weightNormalizer';
import { trackEvent } from '@/lib/analytics';

// ---- Types ----

export type SortOption = 'deal_score' | 'price_asc' | 'price_desc' | 'discount' | 'distance';
export type DistanceRange = 'all' | 'near' | 'nearby' | 'across_town';
export type QuickFilter = 'none' | 'near_me' | 'big_discount';

export interface UniversalFilterState {
  categories: Category[];
  dispensaryIds: string[];
  priceRange: string;
  minDiscount: number;
  sortBy: SortOption;
  distanceRange: DistanceRange;
  quickFilter: QuickFilter;
  weightFilter: string;
}

export const DEFAULT_UNIVERSAL_FILTERS: UniversalFilterState = {
  categories: [],
  dispensaryIds: [],
  priceRange: 'all',
  minDiscount: 0,
  sortBy: 'deal_score',
  distanceRange: 'all',
  quickFilter: 'none',
  weightFilter: 'all',
};

const FILTERS_STORAGE_KEY = 'clouded_filters_v1';

// ---- Distance helpers ----

const DISTANCE_THRESHOLDS = {
  near: 5,       // < 5 miles
  nearby: 10,    // 5-10 miles
  across_town: 15, // 10-15 miles
} as const;

export function getDistanceLabel(miles: number | null): string {
  if (miles === null) return '';
  if (miles < DISTANCE_THRESHOLDS.near) return 'Near You';
  if (miles < DISTANCE_THRESHOLDS.nearby) return 'Nearby';
  if (miles < DISTANCE_THRESHOLDS.across_town) return 'Across Town';
  return 'Far';
}

export function formatDistance(miles: number | null): string {
  if (miles === null) return '';
  if (miles < 0.5) return '<0.5 mi';
  return `${miles.toFixed(1)} mi`;
}

// ---- Hook ----

export function useUniversalFilters() {
  const [filters, setFiltersRaw] = useState<UniversalFilterState>(() => {
    if (typeof window === 'undefined') return DEFAULT_UNIVERSAL_FILTERS;
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_UNIVERSAL_FILTERS, ...parsed };
      }
    } catch { /* ignore */ }
    return DEFAULT_UNIVERSAL_FILTERS;
  });

  const [userCoords, setUserCoords] = useState<ZipCoords | null>(null);

  // Load user coordinates — prefer geolocation coords (more accurate), fall back to zip
  useEffect(() => {
    try {
      const coordsRaw = typeof window !== 'undefined' ? localStorage.getItem('clouded_user_coords') : null;
      if (coordsRaw) {
        const { lat, lng } = JSON.parse(coordsRaw);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setUserCoords({ lat, lng });
          return;
        }
      }
    } catch { /* ignore */ }
    const zip = getStoredZip();
    if (zip) {
      const coords = getZipCoordinates(zip);
      setUserCoords(coords);
    }
  }, []);

  // Listen for location changes (zip or geolocation coords)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'clouded_user_coords' && e.newValue) {
        try {
          const { lat, lng } = JSON.parse(e.newValue);
          if (typeof lat === 'number' && typeof lng === 'number') {
            setUserCoords({ lat, lng });
            return;
          }
        } catch { /* ignore */ }
      }
      if (e.key === 'clouded_zip' && e.newValue) {
        const coords = getZipCoordinates(e.newValue);
        setUserCoords(coords);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Persist filters
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch { /* storage full */ }
  }, [filters]);

  const setFilters = useCallback((next: UniversalFilterState) => {
    setFiltersRaw(next);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersRaw({ ...DEFAULT_UNIVERSAL_FILTERS });
    trackEvent('filter_change', undefined, { action: 'reset' });
  }, []);

  const activeFilterCount = useMemo(() => {
    return [
      filters.categories.length > 0,
      filters.dispensaryIds.length > 0,
      filters.priceRange !== 'all',
      filters.minDiscount > 0,
      filters.distanceRange !== 'all',
      filters.quickFilter !== 'none',
      filters.weightFilter !== 'all',
    ].filter(Boolean).length;
  }, [filters]);

  // Calculate distance from user to a dispensary
  const getDistance = useCallback((
    dispLat: number | null | undefined,
    dispLng: number | null | undefined,
  ): number | null => {
    if (!userCoords) return null;
    return getDistanceMiles(userCoords.lat, userCoords.lng, dispLat, dispLng);
  }, [userCoords]);

  // Apply quick filter presets
  // Re-read coordinates from localStorage (called after FilterSheet sets location)
  const refreshLocation = useCallback(() => {
    try {
      const coordsRaw = typeof window !== 'undefined' ? localStorage.getItem('clouded_user_coords') : null;
      if (coordsRaw) {
        const { lat, lng } = JSON.parse(coordsRaw);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setUserCoords({ lat, lng });
          return;
        }
      }
    } catch { /* ignore */ }
    const zip = getStoredZip();
    if (zip) {
      const coords = getZipCoordinates(zip);
      setUserCoords(coords);
    }
  }, []);

  const applyQuickFilter = useCallback((qf: QuickFilter) => {
    if (qf === filters.quickFilter) {
      // Toggle off
      setFiltersRaw(prev => ({ ...prev, quickFilter: 'none', distanceRange: 'all', minDiscount: 0 }));
    } else if (qf === 'near_me') {
      setFiltersRaw(prev => ({
        ...prev,
        quickFilter: 'near_me',
        distanceRange: 'near',
        sortBy: 'distance',
      }));
      trackEvent('filter_change', undefined, { quick_filter: 'near_me' });
    } else if (qf === 'big_discount') {
      setFiltersRaw(prev => ({
        ...prev,
        quickFilter: 'big_discount',
        minDiscount: 20,
        distanceRange: 'all',
      }));
      trackEvent('filter_change', undefined, { quick_filter: 'big_discount' });
    }
  }, [filters.quickFilter]);

  // Filter and sort deals — pre-computes distances once per call to avoid
  // redundant getDistance() calls during both filtering and sorting.
  const filterAndSortDeals = useCallback((deals: Deal[]): { filtered: Deal[]; distanceMap: Map<string, number | null> } => {
    // Pre-compute distances once for all deals
    const distanceMap = new Map<string, number | null>();
    for (const d of deals) {
      if (!distanceMap.has(d.id)) {
        distanceMap.set(d.id, getDistance(d.dispensary.latitude, d.dispensary.longitude));
      }
    }

    let result = [...deals];

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter(d => filters.categories.includes(d.category));
    }

    // Dispensary filter
    if (filters.dispensaryIds.length > 0) {
      result = result.filter(d => filters.dispensaryIds.includes(d.dispensary.id));
    }

    // Price range
    if (filters.priceRange !== 'all') {
      const bounds = getPriceRangeBounds(filters.priceRange);
      if (bounds.min > 0) result = result.filter(d => d.deal_price >= bounds.min);
      if (bounds.max < Infinity) result = result.filter(d => d.deal_price <= bounds.max);
    }

    // Min discount
    if (filters.minDiscount > 0) {
      result = result.filter(d => {
        if (!d.original_price) return false;
        const discount = ((d.original_price - d.deal_price) / d.original_price) * 100;
        return discount >= filters.minDiscount;
      });
    }

    // Weight filter (fuzzy: 850mg matches 0.85g, 1/8 matches 3.5g, etc.)
    if (filters.weightFilter !== 'all') {
      result = result.filter(d => weightsMatch(d.weight, filters.weightFilter));
    }

    // Distance range — cumulative (within X miles, not exclusive bands)
    if (filters.distanceRange !== 'all' && userCoords) {
      const maxMiles = filters.distanceRange === 'near' ? DISTANCE_THRESHOLDS.near
        : filters.distanceRange === 'nearby' ? DISTANCE_THRESHOLDS.nearby
        : DISTANCE_THRESHOLDS.across_town;

      result = result.filter(d => {
        const dist = distanceMap.get(d.id) ?? null;
        if (dist === null) return true; // Keep deals without coordinates
        return dist < maxMiles;
      });
    }

    // Sort
    if (filters.sortBy === 'distance' && userCoords) {
      result.sort((a, b) => {
        const distA = distanceMap.get(a.id) ?? 999;
        const distB = distanceMap.get(b.id) ?? 999;
        return distA - distB;
      });
    } else if (filters.sortBy === 'price_asc') {
      result.sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      result.sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'discount') {
      result.sort((a, b) => {
        const discA = a.original_price ? ((a.original_price - a.deal_price) / a.original_price) * 100 : 0;
        const discB = b.original_price ? ((b.original_price - b.deal_price) / b.original_price) * 100 : 0;
        return discB - discA;
      });
    }
    // 'deal_score' keeps the original order (already sorted by score from API)

    return { filtered: result, distanceMap };
  }, [filters, userCoords, getDistance]);

  return {
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
    userCoords,
    getDistance,
    getDistanceLabel,
    formatDistance,
    applyQuickFilter,
    refreshLocation,
    filterAndSortDeals,
  };
}

// ---- Price range helper (shared with FilterSheet) ----

const PRICE_RANGES: { id: string; min: number; max: number }[] = [
  { id: 'all', min: 0, max: Infinity },
  { id: 'under10', min: 0, max: 10 },
  { id: '10-20', min: 10, max: 20 },
  { id: '20-30', min: 20, max: 30 },
  { id: '30-50', min: 30, max: 50 },
  { id: '50+', min: 50, max: Infinity },
];

function getPriceRangeBounds(rangeId: string): { min: number; max: number } {
  const range = PRICE_RANGES.find((r) => r.id === rangeId);
  return range ? { min: range.min, max: range.max } : { min: 0, max: Infinity };
}
