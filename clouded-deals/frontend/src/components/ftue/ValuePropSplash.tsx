'use client';

import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

interface ValuePropSplashProps {
  dealCount: number;
  onContinue: () => void;
  onSkip: () => void;
}

export function ValuePropSplash({ dealCount, onContinue, onSkip }: ValuePropSplashProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-y-auto">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/25 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Skip */}
      <div className="relative z-10 flex justify-end p-4">
        <button
          onClick={() => {
            trackEvent('onboarding_skipped', undefined, { screen: 'splash' });
            onSkip();
          }}
          className="text-sm text-slate-600 hover:text-slate-400 transition-colors py-2 px-3"
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo */}
        <div className="mb-6 animate-in fade-in duration-500">
          <h1 className="text-xl font-bold tracking-tight">
            Clouded<span className="text-purple-400">Deals</span>
          </h1>
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 max-w-md leading-tight animate-in fade-in slide-in-from-bottom-2 duration-500">
          Stop overpaying{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            for weed.
          </span>
        </h2>

        {/* Subtext — dynamic deal count baked in, single line */}
        <p className="text-lg text-slate-300 max-w-sm leading-relaxed mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          {dealCount > 0
            ? `${dealCount} deals updated today. Every dispensary in Vegas.`
            : 'Every deal from every dispensary in Vegas. Updated daily.'}
        </p>

        {/* Scannable value props — replaces 3 tiny feature cards */}
        <div className="w-full max-w-sm space-y-2 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <p className="text-base text-slate-400">
            Search any strain, brand, or dispensary.
          </p>
          <p className="text-base text-slate-400">
            Sort by distance. Tap for directions.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 px-6 pb-10 sm:pb-14 pt-6">
        <button
          onClick={() => {
            trackEvent('onboarding_screen_viewed', undefined, { screen: 'splash' });
            onContinue();
          }}
          className="w-full py-4 min-h-[56px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold text-base rounded-2xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
        >
          See Today&apos;s Deals
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
