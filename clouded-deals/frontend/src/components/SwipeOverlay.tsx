'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Share } from 'lucide-react';
import type { Deal } from '@/types';
import { SwipeableCard } from './SwipeableCard';

interface SwipeOverlayProps {
  deals: Deal[];
  savedDeals: Set<string>;
  onSave: (dealId: string) => void;
  onDismiss: (dealId: string) => void;
  onSelectDeal: (deal: Deal) => void;
  onClose: () => void;
  totalDeals: number;
  seenCount: number;
  savedCount: number;
  onShareSaves?: () => void;
}

const VISIBLE_CARDS = 3;

export function SwipeOverlay({
  deals,
  savedDeals,
  onSave,
  onDismiss,
  onSelectDeal,
  onClose,
  totalDeals,
  seenCount,
  savedCount,
  onShareSaves,
}: SwipeOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Allow entrance animation to play
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntering(false));
    });
  }, []);

  // Lock body scroll when overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const visibleDeals = useMemo(() => deals.slice(0, VISIBLE_CARDS), [deals]);

  const progress = totalDeals > 0
    ? Math.round((seenCount / totalDeals) * 100)
    : 0;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const isComplete = deals.length === 0 && totalDeals > 0;

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-opacity duration-300 ${
        entering ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      {/* Ambient gradient — same as main app */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/15 via-transparent to-transparent pointer-events-none" />

      {/* Top bar: close button + progress */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] h-14">
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Close swipe mode"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Thin progress bar */}
        {!isComplete && (
          <div className="flex-1 mx-4">
            <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Saved count badge */}
        {savedCount > 0 && (
          <div className="flex items-center gap-1 text-purple-400">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span className="text-xs font-bold">{savedCount}</span>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 pb-4">
        {isComplete ? (
          /* Session complete */
          <div className="flex flex-col items-center text-center px-4 animate-in fade-in">
            <div className="text-5xl mb-6">&#127881;</div>
            <h2 className="text-xl font-bold text-white mb-2">
              You&apos;ve seen all {totalDeals} deals
            </h2>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">
              New deals drop every morning at 8 AM.
            </p>

            {/* Share CTA — if user has saves */}
            {savedCount > 0 && onShareSaves && (
              <button
                onClick={onShareSaves}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400 text-sm font-medium hover:bg-purple-500/25 transition-colors mb-4"
              >
                <Share className="w-4 h-4" />
                Share today&apos;s favorites ({savedCount})
              </button>
            )}

            <button
              onClick={handleClose}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Back to deals
            </button>
          </div>
        ) : visibleDeals.length > 0 ? (
          <>
            {/* Card stack — takes up most of the screen */}
            <div className="relative w-full max-w-md flex-1 max-h-[70vh] mx-auto">
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
            <div className="relative z-10 flex items-center justify-center gap-8 mt-4 mb-2">
              <button
                onClick={() => visibleDeals[0] && onDismiss(visibleDeals[0].id)}
                className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all active:scale-90"
                aria-label="Pass on this deal"
              >
                <X className="w-8 h-8" />
              </button>

              <button
                onClick={() => visibleDeals[0] && onSave(visibleDeals[0].id)}
                className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-green-400 hover:bg-green-500/10 hover:border-green-500/30 transition-all active:scale-90"
                aria-label="Save this deal"
              >
                <Heart className="w-8 h-8" />
              </button>
            </div>

            {/* Hint text — only shown for first few cards */}
            {seenCount < 3 && (
              <p className="text-[11px] text-slate-500 text-center pb-[env(safe-area-inset-bottom)]">
                Swipe right to save &bull; Left to pass &bull; Tap for details
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
