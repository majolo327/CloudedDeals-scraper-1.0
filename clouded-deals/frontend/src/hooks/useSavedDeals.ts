'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { trackEvent, trackSavedDeal, trackUnsavedDeal } from '@/lib/analytics';

const SAVED_KEY = 'clouded_saved_v1';
const USED_KEY = 'clouded_used_v1';

interface UsedDeal {
  dealId: string;
  timestamp: number;
}

function loadSavedDeals(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(SAVED_KEY);
    if (stored) {
      const ids = JSON.parse(stored);
      if (Array.isArray(ids)) {
        return new Set(ids);
      }
    }
  } catch {
    localStorage.removeItem(SAVED_KEY);
  }
  return new Set();
}

function loadUsedDeals(): Map<string, number> {
  if (typeof window === 'undefined') return new Map();
  try {
    const stored = localStorage.getItem(USED_KEY);
    if (stored) {
      const data: UsedDeal[] = JSON.parse(stored);
      if (Array.isArray(data)) {
        return new Map(data.map(d => [d.dealId, d.timestamp]));
      }
    }
  } catch {
    localStorage.removeItem(USED_KEY);
  }
  return new Map();
}

export function useSavedDeals() {
  const [savedDeals, setSavedDeals] = useState<Set<string>>(() => loadSavedDeals());
  const [usedDeals, setUsedDeals] = useState<Map<string, number>>(() => loadUsedDeals());
  const savedTimeoutRef = useRef<NodeJS.Timeout>();
  const usedTimeoutRef = useRef<NodeJS.Timeout>();

  // Persist saved deals
  useEffect(() => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      const ids = Array.from(savedDeals);
      localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
    }, 300);

    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, [savedDeals]);

  // Persist used deals
  useEffect(() => {
    if (usedTimeoutRef.current) clearTimeout(usedTimeoutRef.current);
    usedTimeoutRef.current = setTimeout(() => {
      const data: UsedDeal[] = Array.from(usedDeals.entries()).map(([dealId, timestamp]) => ({
        dealId,
        timestamp,
      }));
      localStorage.setItem(USED_KEY, JSON.stringify(data));
    }, 300);

    return () => {
      if (usedTimeoutRef.current) clearTimeout(usedTimeoutRef.current);
    };
  }, [usedDeals]);

  const toggleSavedDeal = useCallback((dealId: string) => {
    setSavedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
        trackEvent('deal_saved', dealId, { action: 'unsave' });
        trackUnsavedDeal(dealId);
      } else {
        newSet.add(dealId);
        trackEvent('deal_saved', dealId, { action: 'save' });
        trackSavedDeal(dealId);
      }
      return newSet;
    });
  }, []);

  const markDealUsed = useCallback((dealId: string) => {
    setUsedDeals(prev => {
      if (prev.has(dealId)) return prev;
      const newMap = new Map(prev);
      newMap.set(dealId, Date.now());
      return newMap;
    });
  }, []);

  const isDealUsed = useCallback((dealId: string) => {
    return usedDeals.has(dealId);
  }, [usedDeals]);

  return {
    savedDeals,
    usedDeals,
    toggleSavedDeal,
    markDealUsed,
    isDealUsed,
    savedCount: savedDeals.size,
    usedCount: usedDeals.size,
  };
}
