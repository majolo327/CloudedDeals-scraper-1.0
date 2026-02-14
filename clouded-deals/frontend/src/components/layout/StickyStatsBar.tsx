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
    { id: 'concentrate', label: 'Conc.' },
    { id: 'vape', label: 'Vape' },
    { id: 'edible', label: 'Edible' },
    { id: 'preroll', label: 'Preroll' },
  ];

  return (
    <div
      className="sticky top-14 sm:top-16 z-40 backdrop-blur-xl border-b"
      style={{ backgroundColor: 'rgba(10, 14, 26, 0.92)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-11 flex items-center gap-1.5">
        {children && <div className="flex-shrink-0">{children}</div>}
        {onCategoryChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === category.id
                    ? 'bg-white/10 text-white border border-white/20'
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
