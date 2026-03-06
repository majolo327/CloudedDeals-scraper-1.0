'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Clock, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import type { Deal } from '@/types';
import { DealCard } from './cards';
import { SwipeOverlay } from './SwipeOverlay';
import { InlineFeedbackPrompt } from './FeedbackWidget';
import { ExpiredDealsBanner } from './ExpiredDealsBanner';
import { FilterSheet } from './FilterSheet';
import { StickyStatsBar } from './layout';
import { DealCardSkeleton } from './Skeleton';
import { getTimeUntilMidnight, isDealsFromYesterday, formatUpdateTime } from '@/utils';
import { useDeck } from '@/hooks/useDeck';
import { useUniversalFilters, formatDistance } from '@/hooks/useUniversalFilters';
import { trackEvent } from '@/lib/analytics';
import { hapticSpecial } from '@/lib/haptics';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface DealsPageProps {
  deals: Deal[];
  expiredDeals?: Deal[];
  savedDeals: Set<string>;
  usedDeals: Map<string, number>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  savedCount: number;
  isExpired?: boolean;
  onDismissDeal?: () => void;
  onShareSaves?: () => void;
  swipeOpen?: boolean;
  onSwipeOpenChange?: (open: boolean) => void;
  onRefresh?: () => Promise<void>;
}

export function DealsPage({
  deals,
  expiredDeals = [],
  savedDeals,
  usedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  savedCount,
  isExpired = false,
  onDismissDeal,
  onShareSaves,
  swipeOpen: swipeOpenProp = false,
  onSwipeOpenChange,
  onRefresh,
}: DealsPageProps) {
  const [activeCategory, setActiveCategory] = useState<DealCategory>('all');
  const handleCategoryChange = useCallback((cat: DealCategory) => {
    setActiveCategory(cat);
    if (cat !== 'all') {
      trackEvent('category_viewed', undefined, { category: cat });
    }
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnight());
  const [swipeOpenLocal, setSwipeOpenLocal] = useState(false);

  // Support both controlled (from parent) and local swipe state
  const swipeOpen = swipeOpenProp || swipeOpenLocal;
  const setSwipeOpen = useCallback((open: boolean) => {
    setSwipeOpenLocal(open);
    onSwipeOpenChange?.(open);
  }, [onSwipeOpenChange]);
  const [pastDealsExpanded, setPastDealsExpanded] = useState(false);

  const {
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
    userCoords,
    refreshLocation,
    filterAndSortDeals,
  } = useUniversalFilters();

  // Auto-refresh once if deals are stale and the user is still on the page after 30s.
  // This is a final fallback after the page-level retries at 5s and 10s.
  const autoRefreshDone = useRef(false);
  useEffect(() => {
    if (autoRefreshDone.current || isExpired || deals.length === 0 || !onRefresh) return;
    if (!isDealsFromYesterday(deals)) {
      autoRefreshDone.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (autoRefreshDone.current) return;
      autoRefreshDone.current = true;
      onRefresh();
    }, 30_000);

    return () => clearTimeout(timer);
  }, [deals, isExpired, onRefresh]);

  // Location-needed flow: when sort dropdown selects "Nearest First" without location,
  // open the FilterSheet with the location prompt.
  const [needsLocation, setNeedsLocation] = useState(false);

  const handleLocationNeeded = useCallback(() => {
    setNeedsLocation(true);
  }, []);

  const handleLocationNeededHandled = useCallback(() => {
    setNeedsLocation(false);
  }, []);

  const handleSortChange = useCallback((sort: typeof filters.sortBy) => {
    setFilters({ ...filters, sortBy: sort });
  }, [setFilters, filters]);

  const handleLocationSet = useCallback(() => {
    refreshLocation();
    setFilters({ ...filters, sortBy: 'distance' });
  }, [refreshLocation, setFilters, filters]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (deals.length > 0) {
      const t = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(t);
    }
  }, [deals]);

  const hasActiveFilters = filters.categories.length > 0 || filters.dispensaryIds.length > 0 ||
    filters.distanceRange !== 'all' || filters.weightFilters.length > 0;

  // Apply category tab first, then universal filters.
  // distanceMap is pre-computed once inside filterAndSortDeals so we
  // don't recalculate getDistance() per-deal on every render.
  const { filteredDeals, distanceMap } = useMemo(() => {
    const catResult = deals.filter(
      (d) => activeCategory === 'all' || d.category.toLowerCase() === activeCategory
    );
    const { filtered, distanceMap } = filterAndSortDeals(catResult);
    return { filteredDeals: filtered, distanceMap };
  }, [deals, activeCategory, filterAndSortDeals]);

  // Deck is always active — users interact with 12 cards at a time, never infinite scroll.
  const isDefaultSort = !filters.sortBy || filters.sortBy === 'deal_score';
  const deck = useDeck(filteredDeals, { shuffle: isDefaultSort });

  // Haptic feedback on jackpot reveal (STEAL deal)
  useEffect(() => {
    if (deck.replacementDealScore !== null && deck.replacementDealScore >= 80) {
      hapticSpecial();
    }
  }, [deck.replacementDealScore]);

  // Swipe mode: save = heart + advance, dismiss = advance
  const handleSwipeSave = useCallback((dealId: string) => {
    toggleSavedDeal(dealId);
    deck.dismissImmediate(dealId);
  }, [toggleSavedDeal, deck]);

  const handleSwipeDismiss = useCallback((dealId: string) => {
    deck.dismissImmediate(dealId);
    onDismissDeal?.();
  }, [deck, onDismissDeal]);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const lastRefreshTime = useRef(0);
  const PULL_THRESHOLD = 70;

  const handlePullStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, [refreshing]);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      // Rubber-band: diminishing returns past threshold
      setPullDistance(Math.min(delta * 0.4, 100));
    } else {
      pullStartY.current = null;
      setPullDistance(0);
    }
  }, []);

  const handlePullEnd = useCallback(async () => {
    if (pullStartY.current === null) return;
    pullStartY.current = null;
    if (pullDistance >= PULL_THRESHOLD && onRefresh) {
      const now = Date.now();
      if (now - lastRefreshTime.current < 60_000) {
        setPullDistance(0);
        return; // Rate limit: 1 refresh per 60s
      }
      lastRefreshTime.current = now;
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return (
    <>
      <StickyStatsBar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={filters.sortBy}
        onSortChange={handleSortChange}
        hasLocation={!!userCoords}
        onLocationNeeded={handleLocationNeeded}
      >
        <FilterSheet
          filters={filters}
          onFiltersChange={setFilters}
          filteredCount={filteredDeals.length}
          hasLocation={!!userCoords}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          onLocationSet={handleLocationSet}
          openForLocation={needsLocation}
          onOpenForLocationHandled={handleLocationNeededHandled}
        />
      </StickyStatsBar>

      <div
        className="max-w-6xl mx-auto px-4 py-4"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="flex items-center justify-center transition-opacity duration-200"
            style={{
              height: refreshing ? 40 : pullDistance,
              opacity: refreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <Loader2 className={`w-5 h-5 text-purple-400 ${refreshing ? 'animate-spin' : ''}`}
              style={!refreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined}
            />
            {!refreshing && pullDistance >= PULL_THRESHOLD && (
              <span className="ml-2 text-xs text-purple-400">Release to refresh</span>
            )}
            {refreshing && (
              <span className="ml-2 text-xs text-purple-400">Refreshing...</span>
            )}
          </div>
        )}
        <div className="animate-in fade-in">
          {/* Expired deals banner */}
          {isExpired && <ExpiredDealsBanner expiredCount={deals.length} />}

          {/* Overnight banner — active deals that are from yesterday.
              Time-aware: before 10am PT shows ETA, after 10am shows "hang tight" with spinner. */}
          {!isExpired && deals.length > 0 && isDealsFromYesterday(deals) && (() => {
            const ptHour = parseInt(
              new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }),
              10,
            );
            const message = !isNaN(ptHour) && ptHour < 10
              ? "Today's deals are on the way \u2014 they typically land around 8\u20139 AM PT."
              : "Hang tight \u2014 we're gathering today's deals for you.";
            return (
              <div className="flex items-center gap-2.5 rounded-xl border border-purple-500/15 bg-purple-950/20 px-4 py-3 mb-4">
                <Loader2 className="w-4 h-4 text-purple-400/70 flex-shrink-0 animate-spin" />
                <p className="text-xs text-slate-400">{message}</p>
              </div>
            );
          })()}

          {/* Header row — clean and minimal */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-medium text-slate-300">
                Today&apos;s deals{deals.length > 0 ? ` (${deals.length})` : ''}
              </h2>
              {!isExpired && deals.length > 0 && (() => {
                const updateText = formatUpdateTime(deals);
                const fromYesterday = isDealsFromYesterday(deals);
                const latestMs = deals.reduce((max, d) => {
                  const t = typeof d.created_at === 'string' ? new Date(d.created_at).getTime() : d.created_at.getTime();
                  return t > max ? t : max;
                }, 0);
                const hoursOld = (Date.now() - latestMs) / (1000 * 60 * 60);
                const isStale = fromYesterday || hoursOld > 14;
                return isStale ? (
                  <span className="flex items-center gap-1 text-[10px] text-purple-400/80">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Refreshing
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-500/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
                    {updateText || 'Live'}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isExpired && filteredDeals.length > 0 && (
                <button
                  onClick={() => setSwipeOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Swipe Mode
                </button>
              )}
              {isExpired && (
                <span className="text-xs text-amber-400/80">prices may have changed</span>
              )}
              {hasActiveFilters && (
                <button
                  onClick={() => { resetFilters(); window.dispatchEvent(new CustomEvent('clouded:toast', { detail: { message: 'Filters cleared', type: 'success' } })); }}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Deal content — always grid mode */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : deck.isComplete ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">&#127881;</div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                You&apos;ve reviewed all {deck.totalDeals} deals today
              </h3>
              <p className="text-sm text-slate-400 mb-1">
                {savedCount > 0
                  ? `You saved ${savedCount} deal${savedCount !== 1 ? 's' : ''} — nice finds.`
                  : 'Nothing caught your eye? New deals drop at 8 AM PT.'}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Fresh deals in {countdown}
              </p>
              <button
                onClick={() => { deck.resetDismissed(); }}
                className="px-4 py-2 bg-white/5 text-slate-400 rounded-lg text-xs font-medium hover:bg-white/10 hover:text-white transition-colors"
              >
                Browse again
              </button>
            </div>
          ) : filteredDeals.length === 0 && hasActiveFilters ? (
            <div className="text-center py-16">
              <p className="text-slate-300 text-sm font-medium mb-2">
                No {filters.categories.length === 1 ? filters.categories[0] : ''} deals match{filters.dispensaryIds.length > 0 ? ' at those stores' : ''}
              </p>
              <p className="text-slate-500 text-xs mb-4">
                {filters.categories.length > 0 && filters.dispensaryIds.length > 0
                  ? 'Try removing the dispensary filter to see more options.'
                  : filters.dispensaryIds.length > 0
                  ? 'Try checking other stores or remove the dispensary filter.'
                  : filters.categories.length > 1
                  ? 'Try selecting just one category to see what\'s available.'
                  : 'Deals refresh every morning — or try loosening your filters.'}
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
                {isExpired ? 'New deals drop every morning around 8 AM PT.' : 'Deals refresh every morning — typically by 8–9 AM PT.'}
              </p>
            </div>
          ) : (
            /* Grid mode — position-stable: replacements appear in-place */
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {deck.visible.map((deal, index) => {
                const isDismissing = deck.dismissingId === deal.id;
                const isAppearing = deck.appearingId === deal.id;
                const distance = distanceMap.get(deal.id) ?? null;

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
                      seenBefore={deck.previouslySeenIds.has(deal.id)}
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

        {/* Past Deals section — shown below active deals */}
        {expiredDeals.length > 0 && !isExpired && (
          <div className="mt-8 border-t border-slate-800/60 pt-6">
            <button
              onClick={() => setPastDealsExpanded(!pastDealsExpanded)}
              className="w-full flex items-center justify-between mb-4 group"
              aria-expanded={pastDealsExpanded}
              aria-label="Toggle past deals"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-800/60 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium text-slate-400">
                    Past Deals
                    <span className="text-slate-500 font-normal ml-1.5">({expiredDeals.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">Yesterday&apos;s deals — prices may have changed</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                  pastDealsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {pastDealsExpanded && (
              <div className="grid grid-cols-2 gap-4 sm:gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
                {expiredDeals.map((deal) => (
                  <div key={deal.id}>
                    <DealCard
                      deal={deal}
                      isSaved={savedDeals.has(deal.id)}
                      isUsed={usedDeals.has(deal.id)}
                      isExpired={true}
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
