'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Deal } from '@/types';

// ---- Types ----

export interface DealSnapshot {
  id: string;
  product_name: string;
  brand_name: string;
  dispensary_name: string;
  dispensary_id: string;
  category: string;
  weight: string;
  deal_price: number;
  original_price: number | null;
  deal_score: number;
}

export type HistoryStatus = 'expired' | 'purchased';

export interface HistoryEntry {
  deal: DealSnapshot;
  saved_at: number;
  expired_at: number;
  status: HistoryStatus;
  rating?: number;    // groundwork: 1-5 star rating
  review?: string;    // groundwork: short text review
}

// ---- Storage keys ----

const SNAPSHOTS_KEY = 'clouded_deal_snapshots_v1';
const HISTORY_KEY = 'clouded_deal_history_v1';

// ---- Loaders ----

function loadSnapshots(): Record<string, DealSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(SNAPSHOTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    localStorage.removeItem(SNAPSHOTS_KEY);
  }
  return {};
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (Array.isArray(data)) return data;
    }
  } catch {
    localStorage.removeItem(HISTORY_KEY);
  }
  return [];
}

// ---- Snapshot factory ----

function createSnapshot(deal: Deal): DealSnapshot {
  return {
    id: deal.id,
    product_name: deal.product_name,
    brand_name: deal.brand?.name || 'Unknown',
    dispensary_name: deal.dispensary?.name || 'Unknown',
    dispensary_id: deal.dispensary?.id || '',
    category: deal.category,
    weight: deal.weight,
    deal_price: deal.deal_price,
    original_price: deal.original_price,
    deal_score: deal.deal_score,
  };
}

// ---- Hook ----

export function useDealHistory() {
  const [snapshots, setSnapshots] = useState<Record<string, DealSnapshot>>(() => loadSnapshots());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  // Persist snapshots
  useEffect(() => {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
    } catch { /* storage full */ }
  }, [snapshots]);

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { /* storage full */ }
  }, [history]);

  // Save a snapshot when a deal is saved
  const snapshotDeal = useCallback((deal: Deal) => {
    setSnapshots(prev => {
      if (prev[deal.id]) return prev; // already have it
      return { ...prev, [deal.id]: createSnapshot(deal) };
    });
  }, []);

  // Remove snapshot when deal is unsaved (and not expired)
  const removeSnapshot = useCallback((dealId: string) => {
    setSnapshots(prev => {
      if (!prev[dealId]) return prev;
      const next = { ...prev };
      delete next[dealId];
      return next;
    });
  }, []);

  // Archive expired deals: compare saved IDs against current deal IDs.
  // Moves expired saves to history and returns the IDs that were archived.
  const archiveExpired = useCallback((
    savedDealIds: Set<string>,
    currentDealIds: Set<string>,
  ): string[] => {
    const expired: string[] = [];

    savedDealIds.forEach(id => {
      if (!currentDealIds.has(id)) {
        expired.push(id);
      }
    });

    if (expired.length === 0) return [];

    const now = Date.now();
    const newEntries: HistoryEntry[] = [];

    for (const id of expired) {
      // Check if already in history
      const alreadyArchived = history.some(h => h.deal.id === id);
      if (alreadyArchived) continue;

      const snapshot = snapshots[id];
      if (!snapshot) continue; // No snapshot data, can't archive

      newEntries.push({
        deal: snapshot,
        saved_at: now - 86400000, // approximate: saved ~yesterday
        expired_at: now,
        status: 'expired',
      });
    }

    if (newEntries.length > 0) {
      setHistory(prev => [...newEntries, ...prev]);
      // Clean up snapshots for archived deals
      setSnapshots(prev => {
        const next = { ...prev };
        for (const entry of newEntries) {
          delete next[entry.deal.id];
        }
        return next;
      });
    }

    return expired;
  }, [snapshots, history]);

  // Mark a history entry as purchased (groundwork)
  const markPurchased = useCallback((dealId: string) => {
    setHistory(prev => prev.map(entry =>
      entry.deal.id === dealId ? { ...entry, status: 'purchased' as HistoryStatus } : entry
    ));
  }, []);

  // Add rating to a history entry (groundwork)
  const addRating = useCallback((dealId: string, rating: number) => {
    setHistory(prev => prev.map(entry =>
      entry.deal.id === dealId ? { ...entry, rating } : entry
    ));
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    snapshots,
    history,
    snapshotDeal,
    removeSnapshot,
    archiveExpired,
    markPurchased,
    addRating,
    clearHistory,
    historyCount: history.length,
  };
}
