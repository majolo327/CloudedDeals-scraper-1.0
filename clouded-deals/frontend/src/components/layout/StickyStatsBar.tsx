'use client';

import { Sparkles } from 'lucide-react';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface StickyStatsBarProps {
  activeCategory?: DealCategory;
  onCategoryChange?: (category: DealCategory) => void;
  children?: React.ReactNode;
  showSwipeMode?: boolean;
  onSwipeModeClick?: () => void;
}

export function StickyStatsBar({
  activeCategory = 'all',
  onCategoryChange,
  children,
  showSwipeMode,
  onSwipeModeClick,
}: StickyStatsBarProps) {
  const categories: { id: DealCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'flower', label: 'Flower' },
    { id: 'vape', label: 'Vapes' },
    { id: 'edible', label: 'Edibles' },
    { id: 'preroll', label: 'Pre-Rolls' },
    { id: 'concentrate', label: 'Concentrates' },
  ];

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
