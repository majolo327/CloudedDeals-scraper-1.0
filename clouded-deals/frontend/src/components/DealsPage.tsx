'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Deal } from '@/types';
import type { ToastData } from './Toast';
import { DealCard } from './cards';
import { FilterSheet, FilterState, DEFAULT_FILTERS, getPriceRangeBounds } from './FilterSheet';
import { StickyStatsBar } from './layout';
import { DealCardSkeleton } from './Skeleton';
import { filterDeals, formatUpdateTime, getTimeUntilMidnight } from '@/utils';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface DealsPageProps {
  deals: Deal[];
  savedDeals: Set<string>;
  usedDeals: Map<string, number>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  savedCount: number;
  streak: number;
  addToast: (message: string, type: ToastData['type']) => void;
}

export function DealsPage({
  deals,
  savedDeals,
  usedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  savedCount,
  streak,
  addToast,
}: DealsPageProps) {
  const [activeCategory, setActiveCategory] = useState<DealCategory>('all');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnight());

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
    filters.priceRange !== 'all' || filters.minDiscount > 0;

  const sortedDeals = useMemo(() => {
    let result = deals.filter(
      (d) => activeCategory === 'all' || d.category.toLowerCase() === activeCategory
    );

    if (hasActiveFilters) {
      const priceBounds = getPriceRangeBounds(filters.priceRange);
      result = filterDeals(result, {
        categories: filters.categories.length > 0 ? filters.categories : undefined,
        dispensaryIds: filters.dispensaryIds.length > 0 ? filters.dispensaryIds : undefined,
        minPrice: priceBounds.min > 0 ? priceBounds.min : undefined,
        maxPrice: priceBounds.max < Infinity ? priceBounds.max : undefined,
        minDiscount: filters.minDiscount > 0 ? filters.minDiscount : undefined,
      });
    }

    if (filters.sortBy === 'price_asc') {
      return [...result].sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      return [...result].sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'discount') {
      return [...result].sort((a, b) => {
        const discA = a.original_price ? ((a.original_price - a.deal_price) / a.original_price) * 100 : 0;
        const discB = b.original_price ? ((b.original_price - b.deal_price) / b.original_price) * 100 : 0;
        return discB - discA;
      });
    }
    return [...result].sort((a, b) => b.deal_score - a.deal_score);
  }, [deals, activeCategory, filters, hasActiveFilters]);

  return (
    <>
      <StickyStatsBar
        savedCount={savedCount}
        streak={streak}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      >
        <FilterSheet deals={deals} filters={filters} onFiltersChange={setFilters} filteredCount={sortedDeals.length} totalCount={deals.length} />
      </StickyStatsBar>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-300">
              Today&apos;s deals{deals.length > 0 && (
                <span className="text-slate-500 font-normal"> &middot; {formatUpdateTime(deals)}</span>
              )}
            </h2>
            <span className="text-xs text-slate-600">
              Refreshes in {countdown}
            </span>
          </div>

          {/* Active filter indicator */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs text-slate-400 font-medium">
                {sortedDeals.length} deal{sortedDeals.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
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
          ) : sortedDeals.length === 0 && hasActiveFilters ? (
            <div className="text-center py-16">
              <p className="text-slate-400 text-sm mb-2">
                Nothing matches right now
              </p>
              <p className="text-slate-600 text-xs mb-4">
                Deals refresh every morning &mdash; or try loosening your filters.
              </p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : sortedDeals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-300 text-xl font-medium mb-2">
                No deals yet today
              </p>
              <p className="text-slate-500">Deals refresh every morning. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {sortedDeals.map((deal, index) => (
                <div
                  key={deal.id}
                  className="animate-in fade-in"
                  style={{
                    animationDelay: `${Math.min(index, 11) * 30}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <DealCard
                    deal={deal}
                    isSaved={savedDeals.has(deal.id)}
                    isUsed={usedDeals.has(deal.id)}
                    onSave={() => toggleSavedDeal(deal.id)}
                    onClick={() => setSelectedDeal(deal)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
