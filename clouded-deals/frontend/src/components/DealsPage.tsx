'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LayoutGrid, Layers } from 'lucide-react';
import type { Deal } from '@/types';
import { DealCard } from './cards';
import { SwipeOverlay } from './SwipeOverlay';
import { InlineFeedbackPrompt } from './FeedbackWidget';
import { ExpiredDealsBanner } from './ExpiredDealsBanner';
import { FilterSheet } from './FilterSheet';
import { StickyStatsBar } from './layout';
import { DealCardSkeleton } from './Skeleton';
import { formatUpdateTime, getTimeUntilMidnight } from '@/utils';
import { useDeck } from '@/hooks/useDeck';
import { useUniversalFilters, formatDistance } from '@/hooks/useUniversalFilters';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface DealsPageProps {
  deals: Deal[];
  savedDeals: Set<string>;
  usedDeals: Map<string, number>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  savedCount: number;
  streak: number;
  isExpired?: boolean;
  onDismissDeal?: () => void;
  onShareSaves?: () => void;
}

export function DealsPage({
  deals,
  savedDeals,
  usedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  savedCount,
  streak,
  isExpired = false,
  onDismissDeal,
  onShareSaves,
}: DealsPageProps) {
  const [activeCategory, setActiveCategory] = useState<DealCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnight());
  const [swipeOpen, setSwipeOpen] = useState(false);

  const {
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
    userCoords,
    getDistance,
    filterAndSortDeals,
  } = useUniversalFilters();

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (deals.length > 0) {
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [deals]);

  const hasActiveFilters = filters.categories.length > 0 || filters.dispensaryIds.length > 0 ||
    filters.priceRange !== 'all' || filters.minDiscount > 0 || filters.distanceRange !== 'all' ||
    filters.weightFilter !== 'all';

  // Apply category tab first, then universal filters
  const filteredDeals = useMemo(() => {
    let result = deals.filter(
      (d) => activeCategory === 'all' || d.category.toLowerCase() === activeCategory
    );
    result = filterAndSortDeals(result);
    return result;
  }, [deals, activeCategory, filterAndSortDeals]);

  // Deck is always active — users interact with 12 cards at a time, never infinite scroll.
  const isDefaultSort = !filters.sortBy || filters.sortBy === 'deal_score';
  const deck = useDeck(filteredDeals, { shuffle: isDefaultSort });

  // Swipe mode: save = heart + advance, dismiss = advance
  const handleSwipeSave = useCallback((dealId: string) => {
    toggleSavedDeal(dealId);
    deck.dismissImmediate(dealId);
  }, [toggleSavedDeal, deck]);

  const handleSwipeDismiss = useCallback((dealId: string) => {
    deck.dismissImmediate(dealId);
    onDismissDeal?.();
  }, [deck, onDismissDeal]);

  return (
    <>
      <StickyStatsBar
        savedCount={savedCount}
        streak={streak}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      >
        <FilterSheet
          filters={filters}
          onFiltersChange={setFilters}
          filteredCount={filteredDeals.length}
          hasLocation={!!userCoords}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
        />
      </StickyStatsBar>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="animate-in fade-in">
          {/* Expired deals banner */}
          {isExpired && <ExpiredDealsBanner expiredCount={deals.length} />}

          {/* Header row */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-medium text-slate-300 shrink-0">
                {isExpired ? "Yesterday's deals" : "Today's deals"}{deals.length > 0 ? ` (${deals.length})` : ''}
              </h2>
              {deals.length > 0 && !isExpired && (
                <span className="text-xs text-slate-500 font-normal truncate">{formatUpdateTime(deals)}</span>
              )}
              {isExpired && (
                <span className="text-xs text-amber-500/70 font-normal truncate">prices may have changed</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* View mode toggle — swipe button opens fullscreen overlay */}
              <div
                data-coach="view-toggle"
                className="flex items-center bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/50"
                role="group"
                aria-label="View mode"
              >
                <button
                  aria-label="Grid view"
                  className="p-1.5 rounded-md transition-all bg-purple-500/20 text-purple-400"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label="Open swipe mode"
                  onClick={() => setSwipeOpen(true)}
                  className="p-1.5 rounded-md transition-all text-slate-500 hover:text-slate-300"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[11px] text-slate-600">
                {countdown}
              </span>
            </div>
          </div>

          {/* Deck progress bar — after first dismiss */}
          {deck.totalDeals > 0 && deck.dismissedCount > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-slate-500">
                  {deck.seenCount} of {deck.totalDeals} deals seen
                </span>
                <span className="text-[11px] text-slate-600">
                  {deck.totalDeals - deck.seenCount} remaining
                </span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(deck.seenCount / deck.totalDeals) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Active filter indicator */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs text-slate-400 font-medium">
                {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={resetFilters}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Deal content — always grid mode */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : deck.isComplete ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">&#127881;</div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                You&apos;ve seen all {deck.totalDeals} deals today
              </h3>
              <p className="text-sm text-slate-500 mb-1">
                New deals drop every morning at 8 AM.
              </p>
              <p className="text-xs text-slate-600">
                Refreshes in {countdown}
              </p>
            </div>
          ) : filteredDeals.length === 0 && hasActiveFilters ? (
            <div className="text-center py-16">
              <p className="text-slate-400 text-sm mb-2">
                Nothing matches right now
              </p>
              <p className="text-slate-600 text-xs mb-4">
                Deals refresh every morning &mdash; or try loosening your filters.
              </p>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors"
              >
                Reset Filters
              </button>
              <InlineFeedbackPrompt context="filter_no_results" />
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-300 text-xl font-medium mb-2">
                {isExpired ? "All yesterday's deals have been browsed" : 'No deals yet today'}
              </p>
              <p className="text-slate-500">
                {isExpired ? 'New deals drop every morning around 8 AM PT.' : 'Deals refresh every morning. Check back soon.'}
              </p>
            </div>
          ) : (
            /* Grid mode — position-stable: replacements appear in-place */
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {deck.visible.map((deal, index) => {
                const isDismissing = deck.dismissingId === deal.id;
                const isAppearing = deck.appearingId === deal.id;
                const distance = getDistance(deal.dispensary.latitude, deal.dispensary.longitude);

                const isJackpotReveal =
                  isAppearing &&
                  deck.replacementDealScore !== null &&
                  deck.replacementDealScore >= 80;

                const animationClass = isDismissing
                  ? 'animate-card-dismiss'
                  : isJackpotReveal
                  ? 'animate-card-reveal-jackpot'
                  : isAppearing
                  ? 'animate-card-reveal'
                  : 'animate-in fade-in';

                return (
                  <div
                    key={deal.id}
                    className={animationClass}
                    style={
                      !isDismissing && !isAppearing
                        ? {
                            animationDelay: `${Math.min(index, 11) * 30}ms`,
                            animationFillMode: 'both',
                          }
                        : undefined
                    }
                  >
                    <DealCard
                      deal={deal}
                      isSaved={savedDeals.has(deal.id)}
                      isUsed={usedDeals.has(deal.id)}
                      isExpired={isExpired}
                      onSave={() => toggleSavedDeal(deal.id)}
                      onDismiss={() => { deck.dismissDeal(deal.id); onDismissDeal?.(); }}
                      onClick={() => setSelectedDeal(deal)}
                      distanceLabel={distance !== null ? formatDistance(distance) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen swipe overlay — portal-based, covers everything */}
      {swipeOpen && (
        <SwipeOverlay
          deals={deck.remaining}
          savedDeals={savedDeals}
          onSave={handleSwipeSave}
          onDismiss={handleSwipeDismiss}
          onSelectDeal={(deal) => setSelectedDeal(deal)}
          onClose={() => setSwipeOpen(false)}
          totalDeals={deck.totalDeals}
          seenCount={deck.seenCount}
          savedCount={savedCount}
          onShareSaves={onShareSaves}
        />
      )}
    </>
  );
}
