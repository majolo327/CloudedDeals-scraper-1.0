'use client';

import { useState, useMemo } from 'react';
import { Search, Package, ChevronRight } from 'lucide-react';
import type { Deal, Brand } from '@/types';
import { DealCard } from './DealCard';
import { CATEGORY_FILTERS, countDealsByBrand, filterDeals } from '@/utils';

type FilterCategory = 'all' | 'flower' | 'vape' | 'edible' | 'concentrate' | 'preroll';

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
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const brandDealCounts = useMemo(() => countDealsByBrand(deals), [deals]);

  const matchingBrands = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(query)).slice(0, 5);
  }, [brands, searchQuery]);

  const filteredDeals = useMemo(
    () =>
      filterDeals(deals, {
        category: activeCategory === 'all' ? undefined : activeCategory,
        searchQuery: searchQuery || undefined,
      }),
    [deals, activeCategory, searchQuery]
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Search Input */}
      <div className="mb-5 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands..."
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 sm:pl-12 pr-4 py-3 sm:py-4 min-h-[48px] text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all text-base sm:text-lg"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="mb-5 sm:mb-6 -mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pb-2">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveCategory(filter.id as FilterCategory)}
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

      {searchQuery ? (
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
                for &ldquo;{searchQuery}&rdquo;
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      onClick={() => setSelectedDeal(deal)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <Search className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-slate-400 text-lg mb-2">
                No deals for &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-slate-500 text-sm">
                Try a different search term or category
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <Search className="w-20 h-20 mx-auto mb-4 text-slate-700" />
          <p className="text-slate-400 text-lg mb-2">
            Search for products, brands, or dispensaries
          </p>
          <p className="text-slate-500 text-sm">
            Find the best deals across Las Vegas
          </p>
        </div>
      )}
    </div>
  );
}
