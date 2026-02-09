'use client';

type DealsTab = 'today' | 'swipe' | 'verified';
type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface StickyStatsBarProps {
  savedCount: number;
  streak: number;
  activeTab?: DealsTab;
  onTabChange?: (tab: DealsTab) => void;
  activeCategory?: DealCategory;
  onCategoryChange?: (category: DealCategory) => void;
  children?: React.ReactNode;
}

export function StickyStatsBar({
  activeTab,
  onTabChange,
  activeCategory = 'all',
  onCategoryChange,
  children,
}: StickyStatsBarProps) {
  const tabs: { id: DealsTab; label: string }[] = [
    { id: 'today', label: "Today's Picks" },
    { id: 'verified', label: 'Top Picks' },
  ];

  const categories: { id: DealCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'flower', label: 'Flower' },
    { id: 'concentrate', label: 'Concentrate' },
    { id: 'vape', label: 'Vape' },
    { id: 'edible', label: 'Edible' },
    { id: 'preroll', label: 'Preroll' },
  ];

  return (
    <div
      data-coach="filter-bar"
      className="sticky top-14 sm:top-16 z-40 backdrop-blur-xl border-b"
      style={{ backgroundColor: 'rgba(10, 14, 26, 0.92)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-4 overflow-x-auto scrollbar-hide">
        {activeTab && onTabChange && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {onCategoryChange && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
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
        {children && <div className="flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}
