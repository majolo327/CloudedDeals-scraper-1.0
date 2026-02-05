'use client';

import { useState, useMemo } from 'react';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import type { Deal, Category } from '@/types';
import { trackEvent } from '@/lib/analytics';

export interface FilterState {
  category: Category | 'all';
  dispensaryId: string;
  minPrice: number;
  maxPrice: number;
  minDiscount: number;
  sortBy: 'price_asc' | 'price_desc' | 'discount' | 'newest';
}

const DEFAULT_FILTERS: FilterState = {
  category: 'all',
  dispensaryId: 'all',
  minPrice: 0,
  maxPrice: 200,
  minDiscount: 0,
  sortBy: 'discount',
};

const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'flower', label: 'Flower' },
  { id: 'concentrate', label: 'Concentrates' },
  { id: 'vape', label: 'Vapes' },
  { id: 'edible', label: 'Edibles' },
  { id: 'preroll', label: 'Pre-Rolls' },
];

const SORT_OPTIONS: { id: FilterState['sortBy']; label: string }[] = [
  { id: 'discount', label: 'Best Discount' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest First' },
];

interface FilterSheetProps {
  deals: Deal[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function FilterSheet({ deals, filters, onFiltersChange }: FilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const dispensaries = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deals) {
      if (!map.has(d.dispensary.id)) {
        map.set(d.dispensary.id, d.dispensary.name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deals]);

  const activeFilterCount = [
    filters.category !== 'all',
    filters.dispensaryId !== 'all',
    filters.minPrice > 0,
    filters.maxPrice < 200,
    filters.minDiscount > 0,
    filters.sortBy !== 'discount',
  ].filter(Boolean).length;

  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS);
    trackEvent('filter_change', undefined, { action: 'reset' });
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const next = { ...filters, [key]: value };
    onFiltersChange(next);
    trackEvent('filter_change', undefined, { [key]: value });
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Sheet overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="absolute bottom-0 sm:right-0 sm:top-0 sm:bottom-0 w-full sm:w-80 bg-slate-900 border-t sm:border-l border-slate-800 rounded-t-2xl sm:rounded-none overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-6">
              {/* Category */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => updateFilter('category', cat.id)}
                      className={`px-3 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all ${
                        filters.category === cat.id
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Dispensary */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Dispensary</h3>
                <select
                  value={filters.dispensaryId}
                  onChange={(e) => updateFilter('dispensaryId', e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Dispensaries</option>
                  {dispensaries.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </section>

              {/* Price range */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Price Range: ${filters.minPrice} – ${filters.maxPrice}
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={filters.minPrice}
                    onChange={(e) => updateFilter('minPrice', Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={filters.maxPrice}
                    onChange={(e) => updateFilter('maxPrice', Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                </div>
              </section>

              {/* Min discount */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Min Discount: {filters.minDiscount}%+
                </h3>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={filters.minDiscount}
                  onChange={(e) => updateFilter('minDiscount', Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>Any</span>
                  <span>70%+</span>
                </div>
              </section>

              {/* Sort by */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sort By</h3>
                <div className="space-y-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateFilter('sortBy', opt.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                        filters.sortBy === opt.id
                          ? 'bg-purple-500/15 text-purple-400'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            {/* Apply button (mobile) */}
            <div className="sticky bottom-0 sm:hidden p-4 bg-slate-900/95 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { DEFAULT_FILTERS };
