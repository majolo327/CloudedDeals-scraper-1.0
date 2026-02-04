type DealsTab = 'today' | 'verified';
type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface StickyStatsBarProps {
  activeTab?: DealsTab;
  onTabChange?: (tab: DealsTab) => void;
  activeCategory?: DealCategory;
  onCategoryChange?: (category: DealCategory) => void;
}

export function StickyStatsBar({ activeTab, onTabChange, activeCategory = 'all', onCategoryChange }: StickyStatsBarProps) {
  const tabs: { id: DealsTab; label: string }[] = [
    { id: 'today', label: "Today's Picks" },
    { id: 'verified', label: 'Verified' }
  ];

  const categories: { id: DealCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'flower', label: 'Flower' },
    { id: 'concentrate', label: 'Concentrate' },
    { id: 'vape', label: 'Vape' },
    { id: 'edible', label: 'Edible' },
    { id: 'preroll', label: 'Preroll' }
  ];

  return (
    <div className="sticky top-14 sm:top-16 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-4 overflow-x-auto scrollbar-hide">
        {activeTab && onTabChange && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {onCategoryChange && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === category.id
                    ? 'bg-slate-700/80 text-slate-200 border border-slate-600/50'
                    : 'bg-white/5 text-slate-400 hover:text-slate-300 hover:bg-white/10'
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
