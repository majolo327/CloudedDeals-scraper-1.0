'use client';

import { useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const PREFS_KEY = 'clouded_category_prefs';

export function getCategoryPreferences(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveCategoryPreferences(prefs: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

interface Category {
  id: string;
  label: string;
  emoji: string;
}

const CATEGORIES: Category[] = [
  { id: 'flower', label: 'Flower', emoji: '\uD83C\uDF3F' },
  { id: 'edible', label: 'Edibles', emoji: '\uD83C\uDF6C' },
  { id: 'vape', label: 'Vapes', emoji: '\uD83D\uDCA8' },
  { id: 'concentrate', label: 'Concentrates', emoji: '\uD83E\uDDCA' },
  { id: 'preroll', label: 'Pre-Rolls', emoji: '\uD83D\uDEAC' },
  { id: 'all', label: 'All Deals', emoji: '\u2B50' },
];

interface PreferenceSelectorProps {
  onContinue: (prefs: string[]) => void;
  onSkip: () => void;
}

export function PreferenceSelector({ onContinue, onSkip }: PreferenceSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (id === 'all') {
        // "All Deals" clears specific selections
        return next.has('all') ? new Set() : new Set(['all']);
      }
      // Selecting a specific category removes "all"
      next.delete('all');
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleContinue = () => {
    const prefs = Array.from(selected);
    saveCategoryPreferences(prefs);
    trackEvent('onboarding_screen_viewed', undefined, {
      screen: 'preferences',
      categories: prefs.join(','),
    });
    onContinue(prefs);
  };

  const handleSkip = () => {
    trackEvent('onboarding_skipped', undefined, { screen: 'preferences' });
    onSkip();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header area */}
      <div className="relative z-10 flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-slate-600 hover:text-slate-400 transition-colors py-2 px-3"
        >
          Skip for now
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          What are you into?
        </h2>
        <p className="text-base text-slate-400 max-w-sm mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          Pick your favorites and we&apos;ll put the best deals first.
        </p>

        {/* Category pills */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          {CATEGORIES.map((cat) => {
            const isActive = selected.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-purple-500/15 border-purple-500/40 shadow-lg shadow-purple-500/10'
                    : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className={`text-sm font-medium ${isActive ? 'text-purple-300' : 'text-slate-300'}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 px-6 pb-10 sm:pb-14 pt-6">
        <button
          onClick={handleContinue}
          className="w-full py-4 min-h-[56px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold text-base rounded-2xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
        >
          {selected.size > 0 ? "Let's Go" : 'Show All Deals'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
