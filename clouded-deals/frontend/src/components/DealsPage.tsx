'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Star, BadgeCheck } from 'lucide-react';
import type { Deal } from '@/types';
import type { ToastData } from './Toast';
import { CompactDealCard, CompactTopPick, StaffPickMiniCard, DealCard } from './cards';
import { DealStack } from './DealStack';
import { FilterSheet, FilterState, DEFAULT_FILTERS } from './FilterSheet';
import { StickyStatsBar } from './layout';
import { DailyCompleteModal, NineClearModal } from './modals';
import { DealCardSkeleton } from './Skeleton';
import { getDailyDeals, sortDealsWithPinnedPriority, filterDeals, DISCOVERY_MILESTONES } from '@/utils';
import { usePersonalization } from '@/hooks';
import type { ScoredDeal } from '@/lib/personalization';

type DealsTab = 'today' | 'swipe' | 'verified';
type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface DealsPageProps {
  deals: Deal[];
  verifiedDeals: Deal[];
  featuredDeals: Deal[];
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

  const discoveryToastShownRef = useRef(false);
  const initializedRef = useRef(false);
  const dealPoolRef = useRef<Deal[]>([]);
  const milestonesShownRef = useRef<Set<number>>(new Set());

  const dailyRotatedDeals = useMemo(() => {
    const rotated = getDailyDeals(deals, 90, dayOffset);
    if (activeCategory === 'all') return rotated;
    return rotated.filter((deal) => deal.category.toLowerCase() === activeCategory);
  }, [deals, dayOffset, activeCategory]);

  const hasActiveFilters = filters.category !== 'all' || filters.dispensaryId !== 'all' ||
    filters.minPrice > 0 || filters.maxPrice < 200 || filters.minDiscount > 0;

  const filteredDailyDeals = useMemo(() => {
    if (!hasActiveFilters && filters.sortBy === 'discount') return dailyRotatedDeals;
    let result = filterDeals(dailyRotatedDeals, {
      category: filters.category === 'all' ? undefined : filters.category,
      dispensaryId: filters.dispensaryId === 'all' ? undefined : filters.dispensaryId,
      minPrice: filters.minPrice > 0 ? filters.minPrice : undefined,
      maxPrice: filters.maxPrice < 200 ? filters.maxPrice : undefined,
      minDiscount: filters.minDiscount > 0 ? filters.minDiscount : undefined,
    });
    if (filters.sortBy === 'price_asc') {
      result = [...result].sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      result = [...result].sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'newest') {
      result = [...result].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return result;
  }, [dailyRotatedDeals, filters, hasActiveFilters]);

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

    const eligible = dailyRotatedDeals.filter(
      (d) => !d.is_top_pick && !d.is_staff_pick
    );

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

  const allDailyDeals = dailyRotatedDeals.filter(
    (d) => !d.is_top_pick && !d.is_staff_pick
  );
  const totalDeals = allDailyDeals.length;
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
  }, []);

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

  const topPick = dailyRotatedDeals.find(
    (d) => d.is_top_pick && !dismissedDeals.has(d.id)
  );
  const staffPicks = dailyRotatedDeals.filter(
    (d) => d.is_staff_pick && !dismissedDeals.has(d.id)
  );

  const sortedVerifiedDeals = useMemo(() => {
    let result = verifiedDeals
      .filter((d) => d.is_verified)
      .filter(
        (d) => activeCategory === 'all' || d.category.toLowerCase() === activeCategory
      );
    if (hasActiveFilters) {
      result = filterDeals(result, {
        category: filters.category === 'all' ? undefined : filters.category,
        dispensaryId: filters.dispensaryId === 'all' ? undefined : filters.dispensaryId,
        minPrice: filters.minPrice > 0 ? filters.minPrice : undefined,
        maxPrice: filters.maxPrice < 200 ? filters.maxPrice : undefined,
        minDiscount: filters.minDiscount > 0 ? filters.minDiscount : undefined,
      });
    }
    if (filters.sortBy === 'price_asc') {
      return result.sort((a, b) => a.deal_price - b.deal_price);
    } else if (filters.sortBy === 'price_desc') {
      return result.sort((a, b) => b.deal_price - a.deal_price);
    } else if (filters.sortBy === 'newest') {
      return result.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return result.sort((a, b) => a.deal_price - b.deal_price);
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
        <FilterSheet deals={deals} filters={filters} onFiltersChange={setFilters} />
      </StickyStatsBar>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === 'today' && (
          <div className="animate-in fade-in">
            {topPick && (
              <div className="mb-4">
                <CompactTopPick
                  deal={topPick}
                  isSaved={savedDeals.has(topPick.id)}
                  onSave={() => handleSave(topPick.id)}
                  onDismiss={() => handleDismiss(topPick.id)}
                  onClick={() => setSelectedDeal(topPick)}
                />
              </div>
            )}

            {staffPicks.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                  <span className="text-sm font-medium text-slate-300">
                    Staff Picks
                  </span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                  {staffPicks.map((deal) => (
                    <StaffPickMiniCard
                      key={deal.id}
                      deal={deal}
                      isSaved={savedDeals.has(deal.id)}
                      onSave={() => handleSave(deal.id)}
                      onClick={() => setSelectedDeal(deal)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Today's Deals Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-300">
                Today&apos;s Deals
              </h2>
              <span className="text-xs text-slate-500">
                Updated at 8:30am
              </span>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 tabular-nums">
                    {discoveredCount} of {totalDeals}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500/70"
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
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[...Array(9)].map((_, i) => (
                    <DealCardSkeleton key={i} />
                  ))}
                </div>
              ) : gridDeals.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-400 text-sm">
                    You&apos;ve seen all today&apos;s deals!
                  </p>
                </div>
              ) : (
                <div
                  className={`grid grid-cols-3 gap-2 sm:gap-3 transition-opacity duration-300 ${
                    isClearing ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {gridDeals.map((deal) => {
                    const scoredDeal = personalizationMap.get(deal.id);
                    return (
                      <CompactDealCard
                        key={deal.id}
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

        {/* Verified Tab */}
        {activeTab === 'verified' && (
          <div className="animate-in fade-in">
            {sortedVerifiedDeals.length === 0 ? (
              <div className="text-center py-20">
                <BadgeCheck className="w-20 h-20 mx-auto mb-6 text-slate-700" />
                <p className="text-slate-300 text-xl font-medium mb-2">
                  No verified deals
                </p>
                <p className="text-slate-500">Check back soon</p>
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
