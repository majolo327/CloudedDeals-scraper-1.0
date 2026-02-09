'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BadgeCheck } from 'lucide-react';
import type { Deal } from '@/types';
import type { ToastData } from './Toast';
import { CompactDealCard, DealCard } from './cards';
import { DealStack } from './DealStack';
import { FilterSheet, FilterState, DEFAULT_FILTERS, getPriceRangeBounds } from './FilterSheet';
import { StickyStatsBar } from './layout';
import { DailyCompleteModal, NineClearModal } from './modals';
import { DealCardSkeleton } from './Skeleton';
import { getDailyDeals, sortDealsWithPinnedPriority, filterDeals, DISCOVERY_MILESTONES, formatUpdateTime, getTimeUntilMidnight } from '@/utils';
import { usePersonalization } from '@/hooks';
import type { ScoredDeal } from '@/lib/personalization';

type DealsTab = 'today' | 'swipe' | 'verified';
type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface DealsPageProps {
  deals: Deal[];
  verifiedDeals: Deal[];
  savedDeals: Set<string>;
  usedDeals: Map<string, number>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  savedCount: number;
  streak: number;
  topBrands: [string, number][];
  totalBrandSaves: number;
  addToast: (message: string, type: ToastData['type']) => void;
  onHighlightSavedIcon: () => void;
  initialTab?: DealsTab;
  onDealDismiss?: (deal: Deal) => void;
}

export function DealsPage({
  deals,
  verifiedDeals,
  savedDeals,
  usedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  savedCount,
  streak,
  topBrands,
  totalBrandSaves,
  addToast,
  onHighlightSavedIcon,
  initialTab = 'today',
  onDealDismiss,
}: DealsPageProps) {
  const [activeTab, setActiveTab] = useState<DealsTab>(initialTab);
  const [activeCategory, setActiveCategory] = useState<DealCategory>('all');
  const [gridDeals, setGridDeals] = useState<Deal[]>([]);
  const [dismissedDeals, setDismissedDeals] = useState<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [appearingId, setAppearingId] = useState<string | null>(null);
  const [, setPoolCount] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [currentBoardSaves, setCurrentBoardSaves] = useState<Set<string>>(new Set());
  const [showNineClearModal, setShowNineClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [hasSeenNineClearFTUE] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('clouded_nine_clear_ftue') === 'true';
  });
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnight());

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const discoveryToastShownRef = useRef(false);
  const initializedRef = useRef(false);
  const dealPoolRef = useRef<Deal[]>([]);
  const milestonesShownRef = useRef<Set<number>>(new Set());

  const dailyRotatedDeals = useMemo(() => {
    const rotated = getDailyDeals(deals, 90, dayOffset);
    if (activeCategory === 'all') return rotated;
    return rotated.filter((deal) => deal.category.toLowerCase() === activeCategory);
  }, [deals, dayOffset, activeCategory]);

  const hasActiveFilters = filters.categories.length > 0 || filters.dispensaryIds.length > 0 ||
    filters.priceRange !== 'all' || filters.minDiscount > 0;

  const filteredDailyDeals = useMemo(() => {
    if (!hasActiveFilters && filters.sortBy === 'deal_score') return dailyRotatedDeals;
    const priceBounds = getPriceRangeBounds(filters.priceRange);
    let result = filterDeals(dailyRotatedDeals, {
      categories: filters.categories.length > 0 ? filters.categories : undefined,
      dispensaryIds: filters.dispensaryIds.length > 0 ? filters.dispensaryIds : undefined,
      minPrice: priceBounds.min > 0 ? priceBounds.min : undefined,
      maxPrice: priceBounds.max < Infinity ? priceBounds.max : undefined,
      minDiscount: filters.minDiscount > 0 ? filters.minDiscount : undefined,
    });
    if (filters.sortBy === 'price_asc') {
      result = [...result].sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      result = [...result].sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'discount') {
      result = [...result].sort((a, b) => {
        const discA = a.original_price ? ((a.original_price - a.deal_price) / a.original_price) * 100 : 0;
        const discB = b.original_price ? ((b.original_price - b.deal_price) / b.original_price) * 100 : 0;
        return discB - discA;
      });
    }
    // deal_score sort is the default from dailyRotatedDeals
    return result;
  }, [dailyRotatedDeals, filters, hasActiveFilters]);

  // Apply filters to the 3x3 grid for display
  const displayedGridDeals = useMemo(() => {
    if (!hasActiveFilters && filters.sortBy === 'deal_score') return gridDeals;
    const priceBounds = getPriceRangeBounds(filters.priceRange);
    let result = filterDeals(gridDeals, {
      categories: filters.categories.length > 0 ? filters.categories : undefined,
      dispensaryIds: filters.dispensaryIds.length > 0 ? filters.dispensaryIds : undefined,
      minPrice: priceBounds.min > 0 ? priceBounds.min : undefined,
      maxPrice: priceBounds.max < Infinity ? priceBounds.max : undefined,
      minDiscount: filters.minDiscount > 0 ? filters.minDiscount : undefined,
    });
    if (filters.sortBy === 'price_asc') {
      result = [...result].sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      result = [...result].sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'discount') {
      result = [...result].sort((a, b) => {
        const discA = a.original_price ? ((a.original_price - a.deal_price) / a.original_price) * 100 : 0;
        const discB = b.original_price ? ((b.original_price - b.deal_price) / b.original_price) * 100 : 0;
        return discB - discA;
      });
    }
    return result;
  }, [gridDeals, filters, hasActiveFilters]);

  // Personalization: score and rank deals based on user behavior
  const { personalizedDeals, isRecommended } = usePersonalization(deals);

  // Create a lookup map for personalization scores
  const personalizationMap = useMemo(() => {
    const map = new Map<string, ScoredDeal>();
    for (const deal of personalizedDeals) {
      map.set(deal.id, deal);
    }
    return map;
  }, [personalizedDeals]);

  // Initialize grid
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const isDemoMode = urlParams.get('demo') === '1' || urlParams.get('reset') === '1';

    if (isDemoMode && !initializedRef.current) {
      sessionStorage.removeItem('clouded_dismissed');
    }

    initializedRef.current = true;

    const eligible = dailyRotatedDeals;

    let storedDismissed = new Set<string>();
    if (!isDemoMode) {
      const stored = sessionStorage.getItem('clouded_dismissed');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const today = new Date().toDateString();
          if (data.date === today) {
            storedDismissed = new Set(data.ids);
            if (data.milestones) {
              milestonesShownRef.current = new Set(data.milestones);
            }
          }
        } catch {
          sessionStorage.removeItem('clouded_dismissed');
        }
      }
    }

    const available = eligible.filter((d) => !storedDismissed.has(d.id));
    const sorted = sortDealsWithPinnedPriority(available, 9);

    dealPoolRef.current = available.filter(
      (d) => !sorted.some((s) => s.id === d.id)
    );

    setGridDeals(sorted);
    setPoolCount(dealPoolRef.current.length);
    setDismissedDeals(storedDismissed);
    setTimeout(() => setIsLoading(false), 300);
  }, [dailyRotatedDeals]);

  // Persist dismissed deals
  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(
      'clouded_dismissed',
      JSON.stringify({
        date: new Date().toDateString(),
        ids: Array.from(dismissedDeals),
        milestones: Array.from(milestonesShownRef.current),
      })
    );
  }, [dismissedDeals]);

  // Nine clear FTUE
  useEffect(() => {
    if (
      currentBoardSaves.size >= 9 &&
      !hasSeenNineClearFTUE &&
      !showNineClearModal
    ) {
      setShowNineClearModal(true);
    }
  }, [currentBoardSaves.size, hasSeenNineClearFTUE, showNineClearModal]);

  const totalDeals = dailyRotatedDeals.length;
  const discoveredCount = dismissedDeals.size;

  // Discovery milestones
  useEffect(() => {
    for (const milestone of DISCOVERY_MILESTONES) {
      if (
        discoveredCount >= milestone.count &&
        !milestonesShownRef.current.has(milestone.count)
      ) {
        milestonesShownRef.current.add(milestone.count);
        addToast(milestone.message, 'milestone');
      }
    }
  }, [discoveredCount, addToast]);

  const progressPercent =
    totalDeals > 0 ? Math.min((discoveredCount / totalDeals) * 100, 100) : 0;

  // Complete modal
  useEffect(() => {
    if (
      discoveredCount > 0 &&
      discoveredCount >= totalDeals &&
      totalDeals > 0 &&
      !discoveryToastShownRef.current
    ) {
      setShowCompleteModal(true);
      discoveryToastShownRef.current = true;
    }
  }, [discoveredCount, totalDeals]);

  const handleDismiss = useCallback((dealId: string) => {
    // Notify parent for challenge tracking
    const deal = gridDeals.find((d) => d.id === dealId) || deals.find((d) => d.id === dealId);
    if (deal) onDealDismiss?.(deal);

    setDismissingId(dealId);
    setDismissedDeals((prev) => new Set([...Array.from(prev), dealId]));

    setTimeout(() => {
      const currentPool = dealPoolRef.current;

      setGridDeals((prev) => {
        const filtered = prev.filter((d) => d.id !== dealId);

        if (currentPool.length > 0) {
          const [replacement, ...remainingPool] = currentPool;
          dealPoolRef.current = remainingPool;
          setPoolCount(remainingPool.length);
          setAppearingId(replacement.id);
          setTimeout(() => setAppearingId(null), 2000);
          return [...filtered, replacement];
        }

        return filtered;
      });

      setDismissingId(null);
    }, 200);
  }, [gridDeals, deals, onDealDismiss]);

  const handleSave = useCallback(
    (dealId: string) => {
      const isCurrentlySaved = savedDeals.has(dealId);
      toggleSavedDeal(dealId);

      if (!isCurrentlySaved) {
        setCurrentBoardSaves((prev) => new Set([...Array.from(prev), dealId]));
        setDismissedDeals((prev) => new Set([...Array.from(prev), dealId]));
      }
    },
    [toggleSavedDeal, savedDeals]
  );

  const handleNineClearContinue = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clouded_nine_clear_ftue', 'true');
    }
    setShowNineClearModal(false);
    setIsClearing(true);

    setTimeout(() => {
      const savedIds = Array.from(currentBoardSaves);

      setGridDeals((prev) => {
        const filtered = prev.filter((d) => !savedIds.includes(d.id));
        const needed = 9 - filtered.length;

        if (needed > 0 && dealPoolRef.current.length > 0) {
          const newCards = dealPoolRef.current.slice(0, needed);
          dealPoolRef.current = dealPoolRef.current.slice(needed);
          setPoolCount(dealPoolRef.current.length);
          return [...filtered, ...newCards];
        }

        return filtered;
      });

      setCurrentBoardSaves(new Set());
      setIsClearing(false);
      onHighlightSavedIcon();
    }, 300);
  }, [currentBoardSaves, onHighlightSavedIcon]);

  const handleNextDay = useCallback(() => {
    setDayOffset((prev) => prev + 1);
    setDismissedDeals(new Set());
    setGridDeals([]);
    setPoolCount(0);
    setShowCompleteModal(false);
    setCurrentBoardSaves(new Set());
    discoveryToastShownRef.current = false;
    initializedRef.current = false;
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCompleteModal(false);
  }, []);

  const modalStats = useMemo(() => {
    const todayDeals = dailyRotatedDeals.filter((d) => dismissedDeals.has(d.id));
    const savedToday = todayDeals.filter((d) => savedDeals.has(d.id));
    const savings = savedToday.reduce((sum, d) => {
      const original = d.original_price || d.deal_price;
      return sum + (original - d.deal_price);
    }, 0);

    return {
      saved: savedToday.length,
      viewed: dismissedDeals.size,
      potentialSavings: Math.round(savings),
    };
  }, [dailyRotatedDeals, dismissedDeals, savedDeals]);

  const sortedVerifiedDeals = useMemo(() => {
    let result = verifiedDeals
      .filter((d) => d.is_verified)
      .filter(
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
      return result.sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      return result.sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'discount') {
      return [...result].sort((a, b) => {
        const discA = a.original_price ? ((a.original_price - a.deal_price) / a.original_price) * 100 : 0;
        const discB = b.original_price ? ((b.original_price - b.deal_price) / b.original_price) * 100 : 0;
        return discB - discA;
      });
    }
    return result.sort((a, b) => b.deal_score - a.deal_score);
  }, [verifiedDeals, activeCategory, filters, hasActiveFilters]);

  return (
    <>
      <StickyStatsBar
        savedCount={savedCount}
        streak={streak}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      >
        <FilterSheet deals={deals} filters={filters} onFiltersChange={setFilters} filteredCount={filteredDailyDeals.length} totalCount={dailyRotatedDeals.length} />
      </StickyStatsBar>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === 'today' && (
          <div className="animate-in fade-in">
            {/* Active filter indicator */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs text-slate-400 font-medium">
                  {filteredDailyDeals.length} deal{filteredDailyDeals.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Today's Deals Header — freshness indicator */}
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

            {/* Progress Bar */}
            <div>
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {discoveredCount} of {totalDeals}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(99, 115, 171, 0.1)' }}>
                  <div
                    className="h-full rounded-full bg-emerald-500/70"
                    style={{
                      width: `${progressPercent}%`,
                      transition:
                        'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>

              {/* 3x3 Grid */}
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[...Array(9)].map((_, i) => (
                    <DealCardSkeleton key={i} />
                  ))}
                </div>
              ) : gridDeals.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-400 text-sm mb-1">
                    You&apos;ve seen every deal today
                  </p>
                  <p className="text-slate-600 text-xs">
                    Deals refresh at midnight. These are today&apos;s.
                  </p>
                </div>
              ) : hasActiveFilters && displayedGridDeals.length === 0 ? (
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
              ) : (
                <div
                  className={`grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 transition-opacity duration-300 ${
                    isClearing ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {displayedGridDeals.map((deal, i) => {
                    const scoredDeal = personalizationMap.get(deal.id);
                    return (
                      <div
                        key={deal.id}
                        className="animate-in"
                        style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}
                      >
                      <CompactDealCard
                        deal={deal}
                        isSaved={savedDeals.has(deal.id)}
                        isDismissing={dismissingId === deal.id}
                        isAppearing={appearingId === deal.id}
                        showSparkle={appearingId === deal.id}
                        onSave={() => handleSave(deal.id)}
                        onDismiss={() => handleDismiss(deal.id)}
                        onClick={() => setSelectedDeal(deal)}
                        onShare={() =>
                          addToast('Copied! Paste in a text to share', 'info')
                        }
                        isRecommended={isRecommended(deal.id)}
                        recommendationReason={scoredDeal?.recommendationReason}
                        personalizationScore={scoredDeal?.personalizationScore}
                      />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Brands */}
            {totalBrandSaves >= 5 && topBrands.length > 0 && (
              <section className="mt-6 p-4 rounded-xl glass-subtle frost">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Your Top Brands
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {topBrands.map(([brand, count]) => (
                    <span
                      key={brand}
                      className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium"
                    >
                      {brand} ({count})
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Swipe Tab */}
        {activeTab === 'swipe' && (
          <div className="animate-in fade-in py-2">
            <DealStack
              deals={filteredDailyDeals}
              savedDeals={savedDeals}
              onSave={(id) => handleSave(id)}
              onDismiss={(id) => handleDismiss(id)}
              onSelectDeal={(deal) => setSelectedDeal(deal)}
            />
          </div>
        )}

        {/* Top Picks Tab */}
        {activeTab === 'verified' && (
          <div className="animate-in fade-in">
            {sortedVerifiedDeals.length === 0 ? (
              <div className="text-center py-20">
                <BadgeCheck className="w-20 h-20 mx-auto mb-6 text-slate-700" />
                <p className="text-slate-300 text-xl font-medium mb-2">
                  No top picks yet today
                </p>
                <p className="text-slate-500">We score every deal each morning. Check back soon.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedVerifiedDeals.map((deal, index) => (
                  <div
                    key={deal.id}
                    className="animate-in fade-in"
                    style={{
                      animationDelay: `${index * 30}ms`,
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
        )}
      </div>

      <DailyCompleteModal
        isOpen={showCompleteModal}
        onClose={handleCloseModal}
        onNextDay={handleNextDay}
        stats={modalStats}
      />

      <NineClearModal
        isOpen={showNineClearModal}
        onContinue={handleNineClearContinue}
        savedCount={savedDeals.size}
      />
    </>
  );
}
