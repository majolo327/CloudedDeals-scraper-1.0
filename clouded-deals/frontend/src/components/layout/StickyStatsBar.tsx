'use client';

type DealCategory = 'all' | 'flower' | 'concentrate' | 'vape' | 'edible' | 'preroll';

interface StickyStatsBarProps {
  savedCount: number;
  streak: number;
  activeCategory?: DealCategory;
  onCategoryChange?: (category: DealCategory) => void;
  children?: React.ReactNode;
}

/** Returns a short tier label for streaks that makes them feel rewarding. */
function getStreakTier(streak: number): { label: string; color: string } | null {
  if (streak >= 30) return { label: '30d', color: 'text-amber-400' };
  if (streak >= 14) return { label: '14d', color: 'text-purple-400' };
  if (streak >= 7) return { label: '7d', color: 'text-purple-400/80' };
  if (streak >= 3) return { label: `${streak}d`, color: 'text-slate-400' };
  return null;
}

export function StickyStatsBar({
  streak,
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

  const streakTier = getStreakTier(streak);

  return (
    <div
      data-coach="filter-bar"
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
        {/* Streak indicator — visible at 3+ days, rewards consistency */}
        {streakTier && (
          <div className={`ml-auto flex items-center gap-1 text-xs font-medium ${streakTier.color} shrink-0`}>
            <span className="text-[11px]" aria-hidden="true">{streak >= 7 ? '\uD83D\uDD25' : '\u26A1'}</span>
            <span className="tabular-nums">{streakTier.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
