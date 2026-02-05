'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Package, ChevronRight, X, Clock } from 'lucide-react';
import type { Deal, Brand } from '@/types';
import { DealCard } from './DealCard';
import { CATEGORY_FILTERS, countDealsByBrand, filterDeals } from '@/utils';
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

interface SearchPageProps {
  deals: Deal[];
  brands: Brand[];
  savedDeals: Set<string>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
  onNavigateToBrands: () => void;
}

export function SearchPage({
  deals,
  brands,
  savedDeals,
  toggleSavedDeal,
  setSelectedDeal,
  onNavigateToBrands,
}: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

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

  const handleCategoryFilter = useCallback((cat: FilterCategory) => {
    setActiveCategory(cat);
    if (cat !== 'all') {
      trackEvent('category_filtered', undefined, { category: cat });
    }
  }, []);

  const brandDealCounts = useMemo(() => countDealsByBrand(deals), [deals]);

  const matchingBrands = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const query = debouncedQuery.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(query)).slice(0, 5);
  }, [brands, debouncedQuery]);

  const filteredDeals = useMemo(
    () =>
      filterDeals(deals, {
        category: activeCategory === 'all' ? undefined : activeCategory,
        searchQuery: debouncedQuery || undefined,
      }),
    [deals, activeCategory, debouncedQuery]
  );

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
      {/* Search Input */}
      <div className="mb-5 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands, dispensaries..."
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
              <span className="ml-2 text-sm text-slate-400">Searching...</span>
            </div>
          )}

          {!isSearching && (
            <>
              {/* Matching Brands */}
              {matchingBrands.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-slate-300">Brands</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {matchingBrands.map((brand) => {
                      const dealCount = brandDealCounts[brand.name] || 0;
                      return (
                        <button
                          key={brand.id}
                          onClick={onNavigateToBrands}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg hover:bg-slate-800 hover:border-purple-500/30 transition-all group"
                        >
                          <span className="text-sm font-medium text-white">
                            {brand.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {dealCount > 0
                              ? `${dealCount} deal${dealCount !== 1 ? 's' : ''}`
                              : 'No deals'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search Results */}
              {filteredDeals.length > 0 ? (
                <div>
                  <p className="text-sm text-slate-500 mb-4">
                    {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}{' '}
                    for &ldquo;{debouncedQuery}&rdquo;
                  </p>
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
              ) : (
                <div className="text-center py-16">
                  <Search className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                  <p className="text-slate-400 text-lg mb-2">
                    No deals for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p className="text-slate-500 text-sm">
                    Try a different search term, check spelling, or browse by category
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
              Search for products, brands, or dispensaries
            </p>
            <p className="text-slate-500 text-sm">
              Find the best deals across Las Vegas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
