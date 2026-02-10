'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Deal } from '@/types';
import { DealCard } from './cards';
import { InlineFeedbackPrompt } from './FeedbackWidget';
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
  onDismissDeal?: () => void;
}

export function DealsPage({
  deals,
  savedDeals,
  usedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  savedCount,
  streak,
  onDismissDeal,
}: DealsPageProps) {
  const [activeCategory, setActiveCategory] = useState<DealCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnight());

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
  // When using default sort (deal_score), we apply the curated shuffle for diversity.
  // When using a custom sort (price, discount, etc.), deck preserves that order.
  const isDefaultSort = !filters.sortBy || filters.sortBy === 'deal_score';
  const deck = useDeck(filteredDeals, { shuffle: isDefaultSort });

  const visibleDeals = deck.visible;
  const showDeckUI = true;

  return (
    <>
      <StickyStatsBar
        savedCount={savedCount}
        streak={streak}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      >
        {/* Only the filter button in the stats bar — no quick chips */}
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
          {/* Header row */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-medium text-slate-300 shrink-0">
                Today&apos;s deals{deals.length > 0 ? ` (${deals.length})` : ''}
              </h2>
              {deals.length > 0 && (
                <span className="text-xs text-slate-500 font-normal truncate">{formatUpdateTime(deals)}</span>
              )}
            </div>
            <span className="text-[11px] text-slate-600 shrink-0">
              {countdown}
            </span>
          </div>

          {/* Deck progress bar — only in deck mode after first dismiss */}
          {showDeckUI && deck.totalDeals > 0 && deck.dismissedCount > 0 && (
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

          {/* Deal grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : deck.isComplete && showDeckUI ? (
            /* End-of-deck message */
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
          ) : visibleDeals.length === 0 && hasActiveFilters ? (
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
          ) : visibleDeals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-300 text-xl font-medium mb-2">
                No deals yet today
              </p>
              <p className="text-slate-500">Deals refresh every morning. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {visibleDeals.map((deal, index) => {
                const isDismissing = deck.dismissingId === deal.id;
                const isAppearing = deck.appearingId === deal.id;
                const distance = getDistance(deal.dispensary.latitude, deal.dispensary.longitude);

                return (
                  <div
                    key={deal.id}
                    className={
                      isDismissing
                        ? 'animate-card-dismiss'
                        : isAppearing
                        ? 'animate-card-replace'
                        : 'animate-in fade-in'
                    }
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
                      onSave={() => toggleSavedDeal(deal.id)}
                      onDismiss={showDeckUI ? () => { deck.dismissDeal(deal.id); onDismissDeal?.(); } : undefined}
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
    </>
  );
}
