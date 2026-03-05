'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import type { SortOption } from '@/hooks/useUniversalFilters';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

const SORT_OPTIONS: { id: SortOption; label: string; short: string }[] = [
  { id: 'deal_score', label: 'Best Deal (Curated)', short: 'Best Deal' },
  { id: 'price_asc', label: 'Price: Low to High', short: 'Price \u2191' },
  { id: 'price_desc', label: 'Price: High to Low', short: 'Price \u2193' },
  { id: 'discount', label: 'Biggest Discount', short: 'Discount' },
  { id: 'distance', label: 'Nearest First', short: 'Nearest' },
];

interface StickyStatsBarProps {
  activeCategory?: DealCategory;
  onCategoryChange?: (category: DealCategory) => void;
  children?: React.ReactNode;
  showSwipeMode?: boolean;
  onSwipeModeClick?: () => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  hasLocation?: boolean;
  onLocationNeeded?: () => void;
}

export function StickyStatsBar({
  activeCategory = 'all',
  onCategoryChange,
  children,
  showSwipeMode,
  onSwipeModeClick,
  sortBy = 'deal_score',
  onSortChange,
  hasLocation = false,
  onLocationNeeded,
}: StickyStatsBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const categories: { id: DealCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'flower', label: 'Flower' },
    { id: 'vape', label: 'Vapes' },
    { id: 'edible', label: 'Edibles' },
    { id: 'preroll', label: 'Pre-Rolls' },
    { id: 'concentrate', label: 'Concentrates' },
  ];

  const currentSort = SORT_OPTIONS.find(o => o.id === sortBy) ?? SORT_OPTIONS[0];
  const isNonDefault = sortBy !== 'deal_score';

  // Close dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  const handleSortSelect = useCallback((optId: SortOption) => {
    if (optId === 'distance' && !hasLocation) {
      setSortOpen(false);
      onLocationNeeded?.();
      return;
    }
    onSortChange?.(optId);
    setSortOpen(false);
  }, [hasLocation, onLocationNeeded, onSortChange]);

  return (
    <div
      className="sticky z-40 border-b safe-top-sticky"
      style={{ backgroundColor: 'rgba(10, 12, 28, 0.92)', borderColor: 'rgba(120, 100, 200, 0.06)', WebkitBackdropFilter: 'blur(40px) saturate(1.3)', backdropFilter: 'blur(40px) saturate(1.3)' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-10 flex items-center gap-1.5">
        {children && (
          <>
            <div className="flex-shrink-0">{children}</div>
            <div className="w-px h-5 bg-slate-700/60 flex-shrink-0" />
          </>
        )}
        {onCategoryChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`px-2.5 py-1 min-h-[32px] flex items-center rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  activeCategory === category.id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 scale-105 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10 scale-100'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}
        {/* Sort dropdown */}
        {onSortChange && (
          <>
            <div className="w-px h-5 bg-slate-700/60 flex-shrink-0" />
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  isNonDefault
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10'
                }`}
                aria-label="Sort deals"
                aria-expanded={sortOpen}
              >
                {currentSort.short}
                <ChevronDown className={`w-3 h-3 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border overflow-hidden shadow-xl z-50"
                  style={{ backgroundColor: 'rgba(12, 14, 28, 0.98)', borderColor: 'rgba(120, 100, 200, 0.15)' }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleSortSelect(opt.id)}
                      className={`w-full text-left px-3.5 py-2.5 text-xs transition-all ${
                        sortBy === opt.id
                          ? 'bg-purple-500/15 text-purple-400 font-medium'
                          : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                      {opt.id === 'distance' && !hasLocation && (
                        <span className="ml-1.5 text-[10px] text-slate-600">(set location)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {showSwipeMode && onSwipeModeClick && (
          <>
            <div className="w-px h-5 bg-slate-700/60 flex-shrink-0" />
            <button
              onClick={onSwipeModeClick}
              className="flex-shrink-0 p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors"
              aria-label="Swipe Mode"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
