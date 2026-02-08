'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Package, MapPin, ChevronRight, X, Clock, Store, ExternalLink, Tag } from 'lucide-react';
import type { Deal, Brand } from '@/types';
import { DealCard } from './DealCard';
import { CATEGORY_FILTERS, countDealsByBrand, filterDeals, getMapsUrl } from '@/utils';
import { searchExtendedDeals } from '@/lib/api';
import { DISPENSARIES } from '@/data/dispensaries';
import { trackEvent } from '@/lib/analytics';

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
  onNavigateToBrands: () => void;
  initialQuery?: string;
  onQueryConsumed?: () => void;
}

export function SearchPage({
  deals,
  brands,
  savedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  onNavigateToBrands,
  initialQuery,
  onQueryConsumed,
}: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || '');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [extendedDeals, setExtendedDeals] = useState<Deal[]>([]);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

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

  const handleCategoryFilter = useCallback((cat: FilterCategory) => {
    setActiveCategory(cat);
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

  // ---- Matching dispensaries ----
  const matchingDispensaries = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return DISPENSARIES.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [debouncedQuery]);

  // ---- Matching deals (curated top 100) ----
  const filteredDeals = useMemo(
    () =>
      filterDeals(deals, {
        categories: activeCategory === 'all' ? undefined : [activeCategory],
        searchQuery: debouncedQuery || undefined,
      }),
    [deals, activeCategory, debouncedQuery]
  );

  // ---- Extended results filtered by category ----
  const filteredExtendedDeals = useMemo(() => {
    if (activeCategory === 'all') return extendedDeals;
    return extendedDeals.filter((d) => d.category === activeCategory);
  }, [extendedDeals, activeCategory]);

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

  const tierLabel: Record<string, string> = {
    premium: 'Premium',
    established: 'Established',
    local: 'Local',
    value: 'Value',
    verified: 'Verified',
    standard: '',
  };

  const tierColor: Record<string, string> = {
    premium: 'text-amber-400 bg-amber-500/10',
    established: 'text-emerald-400 bg-emerald-500/10',
    local: 'text-blue-400 bg-blue-500/10',
    value: 'text-slate-400 bg-slate-500/10',
    verified: 'text-purple-400 bg-purple-500/10',
    standard: 'text-slate-500 bg-slate-500/10',
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Search Input */}
      <div className="mb-5 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals, brands, stores..."
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 sm:pl-12 pr-10 py-3 sm:py-4 min-h-[48px] text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all text-base sm:text-lg"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filters */}
      <div className="mb-5 sm:mb-6 -mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pb-2">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => handleCategoryFilter(filter.id as FilterCategory)}
              className={`shrink-0 px-3 sm:px-4 py-2 min-h-[40px] rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === filter.id
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {debouncedQuery ? (
        <>
          {/* Loading state */}
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-slate-400">Checking every dispensary...</span>
            </div>
          )}

          {!isSearching && (
            <>
              {/* Summary */}
              {totalResults > 0 && (
                <p className="text-sm text-slate-500 mb-5">
                  {totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
                </p>
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
                          className="glass frost rounded-xl p-3 flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">{disp.name}</p>
                              {tierLabel[disp.tier] && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${tierColor[disp.tier]}`}>
                                  {tierLabel[disp.tier]}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{disp.address}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {dealCount > 0 && (
                                <span className="text-[10px] text-purple-400 font-medium">
                                  {dealCount} deal{dealCount !== 1 ? 's' : ''} today
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
                          onClick={onNavigateToBrands}
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
                              {tierLabel[brand.tier] && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${tierColor[brand.tier]}`}>
                                  {tierLabel[brand.tier]}
                                </span>
                              )}
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
                      Featured Deals ({filteredDeals.length})
                    </span>
                  </div>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDeals.map((deal, index) => (
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
                              source: 'search',
                            });
                            setSelectedDeal(deal);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- Extended Results (all scraped products on sale) ---- */}
              {extendedLoading && filteredDeals.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-slate-500">Pulling the freshest deals...</span>
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
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                <div className="text-center py-16">
                  <Search className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                  <p className="text-slate-400 text-lg mb-2">
                    No matches for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Try a different brand, strain, or product type.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="py-12">
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
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((query) => (
                  <button
                    key={query}
                    onClick={() => handleRecentClick(query)}
                    className="px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Search className="w-20 h-20 mx-auto mb-4 text-slate-700" />
            <p className="text-slate-400 text-lg mb-2">
              Find exactly what you&apos;re looking for
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
