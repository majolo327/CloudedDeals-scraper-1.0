'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

export function useBrandAffinity() {
  const [brandAffinities, setBrandAffinities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('clouded_brand_affinities');
    if (stored) {
      try {
        setBrandAffinities(JSON.parse(stored));
      } catch {
        localStorage.removeItem('clouded_brand_affinities');
      }
    }
  }, []);

  const trackBrand = useCallback((brandName: string) => {
    setBrandAffinities(prev => {
      const updated = {
        ...prev,
        [brandName]: (prev[brandName] || 0) + 1
      };
      localStorage.setItem('clouded_brand_affinities', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const topBrands = useMemo(() => {
    return Object.entries(brandAffinities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [brandAffinities]);

  const totalSaves = useMemo(() => {
    return Object.values(brandAffinities).reduce((a, b) => a + b, 0);
  }, [brandAffinities]);

  return { brandAffinities, trackBrand, topBrands, totalSaves };
}
