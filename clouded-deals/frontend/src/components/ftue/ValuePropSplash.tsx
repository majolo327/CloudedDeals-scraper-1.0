'use client';

import { Search, MapPin, DollarSign, ArrowRight } from 'lucide-react';
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
          Every Deal. Every Dispensary.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            One Place.
          </span>
        </h2>

        {/* Subtext */}
        <p className="text-base text-slate-400 max-w-sm leading-relaxed mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          No more opening 10 menus. No more guessing who has the best price. We already checked &mdash; every morning.
        </p>

        {/* Feature callouts */}
        <div className="w-full max-w-sm space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          {[
            {
              icon: Search,
              title: 'Search & Filter',
              desc: 'Find your favorite brands, strains, and product types instantly',
              color: 'text-purple-400 bg-purple-500/10',
            },
            {
              icon: MapPin,
              title: 'Map View',
              desc: 'See every deal near you and get directions in one tap',
              color: 'text-emerald-400 bg-emerald-500/10',
            },
            {
              icon: DollarSign,
              title: 'Curated Daily',
              desc: dealCount > 0
                ? `Today's best ${dealCount} deals in Vegas, all under $40`
                : "Today's best deals in Vegas, all under $40",
              color: 'text-amber-400 bg-amber-500/10',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]"
            >
              <div className={`w-9 h-9 rounded-lg ${feature.color} flex items-center justify-center shrink-0 mt-0.5`}>
                <feature.icon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{feature.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
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
          Show Me Deals
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
