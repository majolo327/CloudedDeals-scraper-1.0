'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Package, MapPin, ChevronRight, X, Clock, Store, ExternalLink, Tag } from 'lucide-react';
import type { Deal, Brand } from '@/types';
import { InlineFeedbackPrompt } from './FeedbackWidget';
import { ExpiredDealsBanner } from './ExpiredDealsBanner';
import { weightsMatch } from '@/utils/weightNormalizer';
import { DealCard } from './DealCard';
import { DealCardSkeleton } from './Skeleton';
import { FilterSheet } from './FilterSheet';
import { CATEGORY_FILTERS, countDealsByBrand, filterDeals, getMapsUrl } from '@/utils';
import { searchExtendedDeals } from '@/lib/api';
import { DISPENSARIES } from '@/data/dispensaries';
import { trackEvent } from '@/lib/analytics';
import { useUniversalFilters, formatDistance } from '@/hooks/useUniversalFilters';

type FilterCategory = 'all' | 'flower' | 'vape' | 'edible' | 'concentrate' | 'preroll';

const RECENT_SEARCHES_KEY = 'clouded_recent_searches';
const MAX_RECENT = 5;

function loadRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) return arr.slice(0, MAX_RECENT);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveRecentSearch(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return loadRecentSearches();
  const prev = loadRecentSearches().filter((s) => s !== trimmed);
  const updated = [trimmed, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  return updated;
}

/** Count deals per dispensary id */
function countDealsByDispensary(deals: Deal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of deals) {
    counts[d.dispensary.id] = (counts[d.dispensary.id] || 0) + 1;
  }
  return counts;
}

interface SearchPageProps {
  deals: Deal[];
  brands: Brand[];
  savedDeals: Set<string>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  initialQuery?: string;
  onQueryConsumed?: () => void;
  isExpired?: boolean;
}

export function SearchPage({
  deals,
  brands,
  savedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  initialQuery,
  onQueryConsumed,
  isExpired = false,
}: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || '');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [activeDispensary, setActiveDispensary] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [extendedDeals, setExtendedDeals] = useState<Deal[]>([]);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const {
    filters: universalFilters,
    setFilters: setUniversalFilters,
    resetFilters: resetUniversalFilters,
    activeFilterCount,
    userCoords,
    getDistance,
  } = useUniversalFilters();

  // Set of curated deal IDs for deduplication
  const curatedDealIds = useMemo(() => new Set(deals.map((d) => d.id)), [deals]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  // Consume initialQuery from parent (e.g. Browse → brand click)
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
      onQueryConsumed?.();
    }
  }, [initialQuery, onQueryConsumed]);

  // Debounce search input (300ms)
  useEffect(() => {
    if (!searchQuery) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
      if (searchQuery.trim().length >= 2) {
        const updated = saveRecentSearch(searchQuery);
        setRecentSearches(updated);
        trackEvent('search_performed', undefined, { query: searchQuery.trim() });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Extended search — query all scraped products from Supabase
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setExtendedDeals([]);
      return;
    }

    let cancelled = false;
    setExtendedLoading(true);

    searchExtendedDeals(debouncedQuery, curatedDealIds).then((result) => {
      if (cancelled) return;
      setExtendedDeals(result.deals);
      setExtendedLoading(false);
    });

    return () => { cancelled = true; };
  }, [debouncedQuery, curatedDealIds]);

  // Reset dispensary filter when search changes
  useEffect(() => {
    setActiveDispensary('all');
  }, [debouncedQuery]);

  const handleCategoryFilter = useCallback((cat: FilterCategory) => {
    setActiveCategory(cat);
    setActiveDispensary('all');
    if (cat !== 'all') {
      trackEvent('category_filtered', undefined, { category: cat });
    }
  }, []);

  const brandDealCounts = useMemo(() => countDealsByBrand(deals), [deals]);
  const dispensaryDealCounts = useMemo(() => countDealsByDispensary(deals), [deals]);

  // ---- Matching brands ----
  const matchingBrands = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 6);
  }, [brands, debouncedQuery]);

  // ---- Matching dispensaries (word-boundary matching to prevent "rove" → "The Grove") ----
  // Alias map: common abbreviations & former names used by r/vegastrees community
  const matchingDispensaries = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase().trim();
    const qEscaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRe = new RegExp(`\\b${qEscaped}`, 'i');

    // Local nicknames / abbreviations → dispensary IDs
    const DISPENSARY_ALIASES: Record<string, string[]> = {
      'p13':           ['planet13'],
      'planet13':      ['planet13'],
      'drh':           ['deep-roots-cheyenne', 'deep-roots-craig', 'deep-roots-blue-diamond', 'deep-roots-parkson', 'deep-roots-willis'],
      'td':            ['td-gibson', 'td-decatur', 'td-eastern'],
      'bh':            ['beyond-hello-sahara', 'beyond-hello-twain'],
      'b/h':           ['beyond-hello-sahara', 'beyond-hello-twain'],
      'gl':            ['greenlight-downtown', 'greenlight-paradise'],
      'nuleaf':        ['beyond-hello-twain'],
      'nu leaf':       ['beyond-hello-twain'],
      'apothecarium':  ['beyond-hello-sahara'],
    };
    const aliasIds = new Set(DISPENSARY_ALIASES[q] ?? []);

    return DISPENSARIES.filter(
      (d) =>
        aliasIds.has(d.id) ||
        wordBoundaryRe.test(d.name) ||
        wordBoundaryRe.test(d.address)
    ).slice(0, 8);
  }, [debouncedQuery]);

  // ---- Matching deals (curated, before dispensary filter) ----
  const baseFilteredDeals = useMemo(
    () =>
      filterDeals(deals, {
        categories: activeCategory === 'all' ? undefined : [activeCategory],
        searchQuery: debouncedQuery || undefined,
      }),
    [deals, activeCategory, debouncedQuery]
  );

  // ---- Extended results filtered by category (before dispensary filter) ----
  const baseCategoryExtendedDeals = useMemo(() => {
    if (activeCategory === 'all') return extendedDeals;
    return extendedDeals.filter((d) => d.category === activeCategory);
  }, [extendedDeals, activeCategory]);

  // ---- Dispensaries present in results (for filter chips) ----
  const resultDispensaries = useMemo(() => {
    const allResults = [...baseFilteredDeals, ...baseCategoryExtendedDeals];
    const map = new Map<string, string>();
    for (const d of allResults) {
      if (!map.has(d.dispensary.id)) {
        map.set(d.dispensary.id, d.dispensary.name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [baseFilteredDeals, baseCategoryExtendedDeals]);

  // ---- Final results with dispensary filter + universal price/discount/distance filters ----
  const filteredDeals = useMemo(() => {
    let result = activeDispensary === 'all' ? baseFilteredDeals : baseFilteredDeals.filter((d) => d.dispensary.id === activeDispensary);
    // Apply universal price filter
    if (universalFilters.priceRange !== 'all') {
      const bounds = { under10: { min: 0, max: 10 }, '10-20': { min: 10, max: 20 }, '20-30': { min: 20, max: 30 }, '30-50': { min: 30, max: 50 }, '50+': { min: 50, max: Infinity } }[universalFilters.priceRange] ?? { min: 0, max: Infinity };
      if (bounds.min > 0) result = result.filter(d => d.deal_price >= bounds.min);
      if (bounds.max < Infinity) result = result.filter(d => d.deal_price <= bounds.max);
    }
    // Apply universal min discount
    if (universalFilters.minDiscount > 0) {
      result = result.filter(d => d.original_price ? ((d.original_price - d.deal_price) / d.original_price) * 100 >= universalFilters.minDiscount : false);
    }
    // Apply weight filter
    if (universalFilters.weightFilters.length > 0) {
      const expanded: string[] = [];
      for (const w of universalFilters.weightFilters) {
        if (w === 'disposable') expanded.push('0.3g', '0.35g', '0.5g');
        else expanded.push(w);
      }
      result = result.filter(d => d.weight && expanded.some(w => weightsMatch(d.weight, w)));
    }
    // Apply sort
    if (universalFilters.sortBy === 'distance' && userCoords) {
      result = [...result].sort((a, b) => (getDistance(a.dispensary.latitude, a.dispensary.longitude) ?? 999) - (getDistance(b.dispensary.latitude, b.dispensary.longitude) ?? 999));
    } else if (universalFilters.sortBy === 'price_asc') {
      result = [...result].sort((a, b) => a.deal_price - b.deal_price);
    } else if (universalFilters.sortBy === 'price_desc') {
      result = [...result].sort((a, b) => b.deal_price - a.deal_price);
    } else if (universalFilters.sortBy === 'discount') {
      result = [...result].sort((a, b) => {
        const discA = a.original_price ? ((a.original_price - a.deal_price) / a.original_price) * 100 : 0;
        const discB = b.original_price ? ((b.original_price - b.deal_price) / b.original_price) * 100 : 0;
        return discB - discA;
      });
    }
    return result;
  }, [baseFilteredDeals, activeDispensary, universalFilters, userCoords, getDistance]);

  const filteredExtendedDeals = useMemo(() => {
    let result = activeDispensary === 'all' ? baseCategoryExtendedDeals : baseCategoryExtendedDeals.filter((d) => d.dispensary.id === activeDispensary);
    // Apply same universal filters
    if (universalFilters.priceRange !== 'all') {
      const bounds = { under10: { min: 0, max: 10 }, '10-20': { min: 10, max: 20 }, '20-30': { min: 20, max: 30 }, '30-50': { min: 30, max: 50 }, '50+': { min: 50, max: Infinity } }[universalFilters.priceRange] ?? { min: 0, max: Infinity };
      if (bounds.min > 0) result = result.filter(d => d.deal_price >= bounds.min);
      if (bounds.max < Infinity) result = result.filter(d => d.deal_price <= bounds.max);
    }
    if (universalFilters.minDiscount > 0) {
      result = result.filter(d => d.original_price ? ((d.original_price - d.deal_price) / d.original_price) * 100 >= universalFilters.minDiscount : false);
    }
    if (universalFilters.weightFilters.length > 0) {
      const expanded: string[] = [];
      for (const w of universalFilters.weightFilters) {
        if (w === 'disposable') expanded.push('0.3g', '0.35g', '0.5g');
        else expanded.push(w);
      }
      result = result.filter(d => d.weight && expanded.some(w => weightsMatch(d.weight, w)));
    }
    return result;
  }, [baseCategoryExtendedDeals, activeDispensary, universalFilters]);

  const totalResults = matchingBrands.length + matchingDispensaries.length + filteredDeals.length;

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  };

  const handleRecentClick = (query: string) => {
    setSearchQuery(query);
    setDebouncedQuery(query);
  };

  const clearRecentSearches = () => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Expired deals notice */}
      {isExpired && !debouncedQuery && (
        <ExpiredDealsBanner expiredCount={deals.length} />
      )}

      {/* Search Input */}
      <div className="mb-5 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isExpired ? "Search yesterday's deals..." : "Search deals, brands, stores..."}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 sm:pl-12 pr-10 py-3 sm:py-4 min-h-[48px] text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all text-base sm:text-lg"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filters + Advanced Filter Button */}
      <div className="mb-5 sm:mb-6 -mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pb-2">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => handleCategoryFilter(filter.id as FilterCategory)}
              className={`shrink-0 px-3.5 sm:px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === filter.id
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
          <div className="shrink-0">
            <FilterSheet
              filters={universalFilters}
              onFiltersChange={setUniversalFilters}
              filteredCount={filteredDeals.length + filteredExtendedDeals.length}
              hasLocation={!!userCoords}
              onReset={resetUniversalFilters}
              activeFilterCount={activeFilterCount}
            />
          </div>
        </div>
      </div>

      {debouncedQuery ? (
        <>
          {/* Loading state — skeleton cards instead of spinner */}
          {isSearching && (
            <div className="py-4">
              <p className="text-xs text-slate-500 mb-4">Checking every dispensary in Vegas...</p>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
                {[...Array(3)].map((_, i) => (
                  <DealCardSkeleton key={i} />
                ))}
              </div>
            </div>
          )}

          {!isSearching && (
            <>
              {/* Summary */}
              {totalResults > 0 && (
                <p className="text-sm text-slate-500 mb-4">
                  {totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
                </p>
              )}

              {/* Dispensary filter chips — narrow results by store */}
              {resultDispensaries.length > 1 && (
                <div className="mb-5 -mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto scrollbar-hide">
                  <div className="flex items-center gap-2 pb-2">
                    <button
                      onClick={() => setActiveDispensary('all')}
                      className={`shrink-0 px-3.5 py-2 min-h-[44px] rounded-full text-xs font-medium transition-all ${
                        activeDispensary === 'all'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
                      }`}
                    >
                      All Stores
                    </button>
                    {resultDispensaries.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setActiveDispensary(d.id)}
                        className={`shrink-0 px-3.5 py-2 min-h-[44px] rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                          activeDispensary === d.id
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- Dispensary Results ---- */}
              {matchingDispensaries.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Store className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-slate-300">Dispensaries</span>
                  </div>
                  <div className="space-y-2">
                    {matchingDispensaries.map((disp) => {
                      const dealCount = dispensaryDealCounts[disp.id] || 0;
                      return (
                        <div
                          key={disp.id}
                          className="glass frost rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.06] transition-colors"
                          onClick={() => setActiveDispensary(disp.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveDispensary(disp.id); }}
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">{disp.name}</p>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{disp.address}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {dealCount > 0 && (
                                <span className="text-[10px] text-purple-400 font-medium">
                                  {dealCount} deal{dealCount !== 1 ? 's' : ''} {isExpired ? 'yesterday' : 'today'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={getMapsUrl(disp.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                              aria-label="Get directions"
                              title="Directions"
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                            <a
                              href={disp.menu_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                              aria-label="View menu"
                              title="Menu"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---- Brand Results ---- */}
              {matchingBrands.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-slate-300">Brands</span>
                  </div>
                  <div className="space-y-2">
                    {matchingBrands.map((brand) => {
                      const dealCount = brandDealCounts[brand.name] || 0;
                      return (
                        <button
                          key={brand.id}
                          onClick={() => setSearchQuery(brand.name)}
                          className="w-full glass frost rounded-xl p-3 flex items-center gap-3 text-left hover:bg-slate-800/70 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-slate-400">
                              {brand.name[0]}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">{brand.name}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500 capitalize">
                                {brand.categories.join(', ')}
                              </span>
                              {dealCount > 0 && (
                                <>
                                  <span className="text-slate-700">·</span>
                                  <span className="text-[10px] text-purple-400 font-medium">
                                    {dealCount} deal{dealCount !== 1 ? 's' : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---- Featured Deal Results (curated top 100) ---- */}
              {filteredDeals.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-slate-300">
                      {isExpired ? 'Yesterday\'s' : 'Featured'} Deals ({filteredDeals.length})
                    </span>
                    {isExpired && (
                      <span className="text-[10px] text-amber-500/70">prices may have changed</span>
                    )}
                  </div>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
                    {filteredDeals.map((deal, index) => {
                      const dist = getDistance(deal.dispensary.latitude, deal.dispensary.longitude);
                      return (
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
                            isExpired={isExpired}
                            onSave={() => toggleSavedDeal(deal.id)}
                            onClick={() => {
                              trackEvent('deal_viewed', deal.id, {
                                category: deal.category,
                                brand: deal.brand.name,
                                source: isExpired ? 'search_expired' : 'search',
                              });
                              setSelectedDeal(deal);
                            }}
                            distanceLabel={dist !== null ? formatDistance(dist) : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---- Extended Results (all scraped products on sale) ---- */}
              {extendedLoading && filteredDeals.length === 0 && (
                <div className="py-4">
                  <p className="text-xs text-slate-500 mb-4">Searching all products...</p>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
                    {[...Array(3)].map((_, i) => (
                      <DealCardSkeleton key={i} />
                    ))}
                  </div>
                </div>
              )}

              {filteredExtendedDeals.length > 0 && (
                <div className="mb-6">
                  <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-slate-300">
                        Also Found on Sale ({filteredExtendedDeals.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Not in today&apos;s top picks, but we found {filteredExtendedDeals.length === 1 ? 'this' : 'these'} on sale for you
                    </p>
                  </div>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
                    {filteredExtendedDeals.map((deal, index) => (
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
                          onSave={() => toggleSavedDeal(deal.id)}
                          onClick={() => {
                            trackEvent('deal_viewed', deal.id, {
                              category: deal.category,
                              brand: deal.brand.name,
                              source: 'extended_search',
                            });
                            setSelectedDeal(deal);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results at all */}
              {totalResults === 0 && filteredExtendedDeals.length === 0 && !extendedLoading && (
                <div className="text-center py-12">
                  <Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                  <p className="text-slate-400 text-base mb-2">
                    No matches for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Try a different brand, strain, or product type.
                  </p>
                  <InlineFeedbackPrompt context="search_no_results" query={debouncedQuery} />
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="py-8">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-400">Recent</span>
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="px-3 py-1.5 min-h-[44px] flex items-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label="Clear recent searches"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((query) => (
                  <button
                    key={query}
                    onClick={() => handleRecentClick(query)}
                    className="px-4 py-2.5 min-h-[44px] rounded-full bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-slate-700" />
            <p className="text-slate-400 text-base mb-1.5">
              {isExpired
                ? "Search yesterday's deals while we prepare today's"
                : "Find exactly what you're looking for"}
            </p>
            <p className="text-slate-500 text-sm">
              Search by brand, dispensary, category, or weight
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
