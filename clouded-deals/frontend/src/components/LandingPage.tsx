'use client';

import { useMemo } from 'react';
import { ArrowRight, ShieldCheck, Search, TrendingUp } from 'lucide-react';
import type { Deal } from '@/types';
import { DealCard } from './DealCard';
import { getTopDealsByDiscount } from '@/utils/brandUtils';

interface LandingPageProps {
  deals: Deal[];
  dealCount: number;
  onBrowseDeals: () => void;
  savedDeals: Set<string>;
  toggleSavedDeal: (id: string) => void;
  setSelectedDeal: (deal: Deal | null) => void;
}

export function LandingPage({
  deals,
  dealCount,
  onBrowseDeals,
  savedDeals,
  toggleSavedDeal,
  setSelectedDeal,
}: LandingPageProps) {
  const featuredDeals = useMemo(() => getTopDealsByDiscount(deals, 3), [deals]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-6xl mx-auto px-4 pt-6 pb-2">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
          Clouded<span className="text-purple-400">Deals</span>
        </h1>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pt-8 sm:pt-16 pb-10 sm:pb-16 text-center">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
          Vegas Cannabis Deals.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            Updated Daily.
          </span>
        </h2>
        <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-md mx-auto">
          Never overpay for weed again.
        </p>

        <button
          onClick={onBrowseDeals}
          className="inline-flex items-center gap-2 px-8 py-4 min-h-[56px] bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] transition-all"
        >
          Browse Today&apos;s Deals
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-400">
          {dealCount > 0 && (
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              {dealCount} deals found today
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            Trusted by Vegas locals
          </span>
        </div>
      </section>

      {/* Featured Deals */}
      {featuredDeals.length > 0 && (
        <section className="relative z-10 max-w-6xl mx-auto px-4 pb-12 sm:pb-16">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 text-center">
            Top Deals Right Now
          </h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 max-w-3xl mx-auto">
            {featuredDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                isSaved={savedDeals.has(deal.id)}
                onSave={() => toggleSavedDeal(deal.id)}
                onClick={() => setSelectedDeal(deal)}
              />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pb-12 sm:pb-16">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6 text-center">
            How It Works
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                icon: Search,
                title: 'We scan 27+ dispensaries daily',
                color: 'text-emerald-400 bg-emerald-500/10',
              },
              {
                step: '2',
                icon: TrendingUp,
                title: 'Find deals 20%+ off',
                color: 'text-purple-400 bg-purple-500/10',
              },
              {
                step: '3',
                icon: ShieldCheck,
                title: 'You save money',
                color: 'text-amber-400 bg-amber-500/10',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="glass rounded-xl p-4 text-center"
              >
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-3`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-300 font-medium">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pb-16 sm:pb-24 text-center">
        <button
          onClick={onBrowseDeals}
          className="inline-flex items-center gap-2 px-8 py-4 min-h-[56px] bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all"
        >
          See All {dealCount > 0 ? dealCount : ''} Deals Today
          <ArrowRight className="w-5 h-5" />
        </button>
      </section>
    </div>
  );
}
