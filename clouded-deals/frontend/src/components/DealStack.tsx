'use client';

import { useState, useCallback, useMemo } from 'react';
import { Heart, X, RotateCcw } from 'lucide-react';
import type { Deal } from '@/types';
import { SwipeableCard } from './SwipeableCard';

interface DealStackProps {
  deals: Deal[];
  savedDeals: Set<string>;
  onSave: (dealId: string) => void;
  onDismiss: (dealId: string) => void;
  onSelectDeal: (deal: Deal) => void;
}

const VISIBLE_CARDS = 3;

export function DealStack({
  deals,
  savedDeals,
  onSave,
  onDismiss,
  onSelectDeal,
}: DealStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const visibleDeals = useMemo(() => {
    return deals.slice(currentIndex, currentIndex + VISIBLE_CARDS);
  }, [deals, currentIndex]);

  const progress = deals.length > 0
    ? Math.round((currentIndex / deals.length) * 100)
    : 0;

  const advance = useCallback(() => {
    setHistory((prev) => [...prev, currentIndex]);
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex]);

  const handleSwipeRight = useCallback(
    (deal: Deal) => {
      onSave(deal.id);
      advance();
    },
    [onSave, advance]
  );

  const handleSwipeLeft = useCallback(
    (deal: Deal) => {
      onDismiss(deal.id);
      advance();
    },
    [onDismiss, advance]
  );

  const handleSwipeUp = useCallback(
    (deal: Deal) => {
      // Open the dispensary menu URL in a new tab
      const url = deal.dispensary?.menu_url;
      if (url) {
        window.open(url, '_blank', 'noopener');
      }
      advance();
    },
    [advance]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
  }, [history]);

  // All deals swiped
  if (currentIndex >= deals.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">
          You&apos;ve seen every deal today
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-xs">
          Deals refresh at midnight. Check your saved ones or come back tomorrow.
        </p>
        {history.length > 0 && (
          <button
            onClick={() => {
              setCurrentIndex(0);
              setHistory([]);
            }}
            className="px-5 py-3 bg-purple-500/20 text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-500/30 transition-colors"
          >
            Start over
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Progress bar */}
      <div className="w-full max-w-sm px-4 mb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{currentIndex + 1} of {deals.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
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
                onSwipeRight={() => handleSwipeRight(deal)}
                onSwipeLeft={() => handleSwipeLeft(deal)}
                onSwipeUp={() => handleSwipeUp(deal)}
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
          onClick={() => visibleDeals[0] && handleSwipeLeft(visibleDeals[0])}
          className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all active:scale-95"
        >
          <X className="w-7 h-7" />
        </button>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-slate-800"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Save */}
        <button
          onClick={() => visibleDeals[0] && handleSwipeRight(visibleDeals[0])}
          className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-green-400 hover:bg-green-500/10 hover:border-green-500/30 transition-all active:scale-95"
        >
          <Heart className="w-7 h-7" />
        </button>
      </div>

      {/* Hint text */}
      <p className="text-[10px] text-slate-600 mt-4 text-center">
        Swipe right to save &bull; Swipe left to pass &bull; Swipe up to visit dispensary
      </p>
    </div>
  );
}
