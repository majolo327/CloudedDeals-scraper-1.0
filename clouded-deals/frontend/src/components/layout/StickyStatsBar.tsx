'use client';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface StickyStatsBarProps {
  activeCategory?: DealCategory;
  onCategoryChange?: (category: DealCategory) => void;
  children?: React.ReactNode;
}

export function StickyStatsBar({
  activeCategory = 'all',
  onCategoryChange,
  children,
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
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-1.5">
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
                className={`px-3 py-1.5 min-h-[36px] flex items-center rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === category.id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
