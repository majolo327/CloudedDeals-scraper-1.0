'use client';

import { useMemo } from 'react';
import { Heart, X } from 'lucide-react';
import type { Deal } from '@/types';
import { SwipeableCard } from './SwipeableCard';

interface DealStackProps {
  /** Remaining undismissed deals in deck order */
  deals: Deal[];
  savedDeals: Set<string>;
  onSave: (dealId: string) => void;
  onDismiss: (dealId: string) => void;
  onSelectDeal: (deal: Deal) => void;
  totalDeals: number;
  seenCount: number;
}

const VISIBLE_CARDS = 3;

export function DealStack({
  deals,
  savedDeals,
  onSave,
  onDismiss,
  onSelectDeal,
  totalDeals,
  seenCount,
}: DealStackProps) {
  const visibleDeals = useMemo(() => {
    return deals.slice(0, VISIBLE_CARDS);
  }, [deals]);

  const progress = totalDeals > 0
    ? Math.round((seenCount / totalDeals) * 100)
    : 0;

  // All deals reviewed
  if (deals.length === 0 && totalDeals > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="text-4xl mb-4">&#127881;</div>
        <h2 className="text-lg font-semibold text-white mb-2">
          You&apos;ve seen all {totalDeals} deals today
        </h2>
        <p className="text-sm text-slate-400 mb-2 max-w-xs">
          New deals drop every morning at 8 AM.
        </p>
        <p className="text-xs text-slate-600">
          Check your saved deals or come back tomorrow.
        </p>
      </div>
    );
  }

  if (deals.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Progress bar */}
      <div className="w-full max-w-sm px-4 mb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{seenCount} of {totalDeals} deals seen</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card stack */}
      <div className="relative w-full max-w-sm aspect-[3/4] mx-auto">
        {visibleDeals.map((deal, i) => {
          const isTop = i === 0;
          return (
            <div
              key={deal.id}
              className="absolute inset-0 transition-transform duration-200"
              style={{
                transform: `scale(${1 - i * 0.04}) translateY(${i * 8}px)`,
                zIndex: VISIBLE_CARDS - i,
              }}
            >
              <SwipeableCard
                deal={deal}
                isSaved={savedDeals.has(deal.id)}
                onSwipeRight={() => onSave(deal.id)}
                onSwipeLeft={() => onDismiss(deal.id)}
                onSwipeUp={() => {
                  if (deal.product_url) {
                    window.open(deal.product_url, '_blank', 'noopener');
                  }
                  onDismiss(deal.id);
                }}
                onClick={() => onSelectDeal(deal)}
                isTop={isTop}
              />
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 mt-6">
        {/* Dismiss */}
        <button
          onClick={() => visibleDeals[0] && onDismiss(visibleDeals[0].id)}
          className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all active:scale-95"
          aria-label="Pass on this deal"
        >
          <X className="w-7 h-7" />
        </button>

        {/* Save */}
        <button
          onClick={() => visibleDeals[0] && onSave(visibleDeals[0].id)}
          className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-green-400 hover:bg-green-500/10 hover:border-green-500/30 transition-all active:scale-95"
          aria-label="Save this deal"
        >
          <Heart className="w-7 h-7" />
        </button>
      </div>

      {/* Hint text */}
      <p className="text-[10px] text-slate-600 mt-4 text-center">
        Swipe right to save &bull; Swipe left to pass &bull; Tap for details
      </p>
    </div>
  );
}
