'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X, RotateCcw, Check } from 'lucide-react';
import type { Deal, Category } from '@/types';
import { trackEvent } from '@/lib/analytics';

export interface FilterState {
  categories: Category[];
  dispensaryIds: string[];
  priceRange: string;
  minDiscount: number;
  sortBy: 'deal_score' | 'price_asc' | 'price_desc' | 'discount';
}

export const DEFAULT_FILTERS: FilterState = {
  categories: [],
  dispensaryIds: [],
  priceRange: 'all',
  minDiscount: 0,
  sortBy: 'deal_score',
};

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'flower', label: 'Flower' },
  { id: 'concentrate', label: 'Concentrates' },
  { id: 'vape', label: 'Vapes' },
  { id: 'edible', label: 'Edibles' },
  { id: 'preroll', label: 'Pre-Rolls' },
];

const PRICE_RANGES: { id: string; label: string; min: number; max: number }[] = [
  { id: 'all', label: 'Any Price', min: 0, max: Infinity },
  { id: 'under10', label: 'Under $10', min: 0, max: 10 },
  { id: '10-20', label: '$10 – $20', min: 10, max: 20 },
  { id: '20-30', label: '$20 – $30', min: 20, max: 30 },
  { id: '30-50', label: '$30 – $50', min: 30, max: 50 },
  { id: '50+', label: '$50+', min: 50, max: Infinity },
];

const SORT_OPTIONS: { id: FilterState['sortBy']; label: string }[] = [
  { id: 'deal_score', label: 'Best Deal' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'discount', label: 'Biggest Discount' },
];

export function getPriceRangeBounds(rangeId: string): { min: number; max: number } {
  const range = PRICE_RANGES.find((r) => r.id === rangeId);
  return range ? { min: range.min, max: range.max } : { min: 0, max: Infinity };
}

interface FilterSheetProps {
  deals: Deal[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  filteredCount: number;
  totalCount: number;
}

export function FilterSheet({ deals, filters, onFiltersChange, filteredCount }: FilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

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
    filters.categories.length > 0,
    filters.dispensaryIds.length > 0,
    filters.priceRange !== 'all',
    filters.minDiscount > 0,
    filters.sortBy !== 'deal_score',
  ].filter(Boolean).length;

  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS);
    trackEvent('filter_change', undefined, { action: 'reset' });
  };

  const toggleCategory = (cat: Category) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onFiltersChange({ ...filters, categories: next });
    trackEvent('filter_change', undefined, { categories: next.join(',') });
  };

  const toggleDispensary = (id: string) => {
    const next = filters.dispensaryIds.includes(id)
      ? filters.dispensaryIds.filter((d) => d !== id)
      : [...filters.dispensaryIds, id];
    onFiltersChange({ ...filters, dispensaryIds: next });
  };

  const selectAllDispensaries = () => {
    const all = dispensaries.map((d) => d.id);
    onFiltersChange({ ...filters, dispensaryIds: all });
  };

  const clearAllDispensaries = () => {
    onFiltersChange({ ...filters, dispensaryIds: [] });
  };

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Swipe-to-close on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) setIsOpen(false);
    touchStartY.current = null;
  }, []);

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

      {/* Overlay — rendered via portal to escape StickyStatsBar's containing block */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet: bottom sheet on mobile, right sidebar on desktop */}
          <div
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:w-[360px] max-h-[70vh] sm:max-h-none sm:h-full bg-slate-900 border-t sm:border-t-0 sm:border-l border-slate-800 rounded-t-2xl sm:rounded-none flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-800">
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

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6 overscroll-contain">
              {/* Category — multi-select chips */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = filters.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`px-3 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                {filters.categories.length > 0 && (
                  <p className="text-[10px] text-slate-600 mt-2">
                    {filters.categories.length} selected
                  </p>
                )}
              </section>

              {/* Dispensary — multi-select checkboxes */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dispensary</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllDispensaries}
                      className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Select All
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      onClick={clearAllDispensaries}
                      className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg bg-slate-800/50 p-2">
                  {dispensaries.map((d) => {
                    const isChecked = filters.dispensaryIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-purple-500 border-purple-500'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDispensary(d.id)}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-300 truncate">{d.name}</span>
                      </label>
                    );
                  })}
                  {dispensaries.length === 0 && (
                    <p className="text-xs text-slate-600 py-2 text-center">No dispensaries available</p>
                  )}
                </div>
              </section>

              {/* Price Range — preset buttons */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Price Range</h3>
                <div className="flex flex-wrap gap-2">
                  {PRICE_RANGES.map((range) => (
                    <button
                      key={range.id}
                      onClick={() => onFiltersChange({ ...filters, priceRange: range.id })}
                      className={`px-3 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all ${
                        filters.priceRange === range.id
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Min Discount */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Min Discount: {filters.minDiscount > 0 ? `${filters.minDiscount}%+` : 'Any'}
                </h3>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={filters.minDiscount}
                  onChange={(e) => onFiltersChange({ ...filters, minDiscount: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>Any</span>
                  <span>70%+</span>
                </div>
              </section>

              {/* Sort By */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sort By</h3>
                <div className="space-y-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onFiltersChange({ ...filters, sortBy: opt.id })}
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

            {/* Footer — Show Results button */}
            <div className="flex-shrink-0 p-4 bg-slate-900/95 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Show {filteredCount} deal{filteredCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
