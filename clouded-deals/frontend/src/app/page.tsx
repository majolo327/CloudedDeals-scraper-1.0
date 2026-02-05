'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, Heart, Search, Bookmark, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchDeals } from '@/lib/api';
import type { Deal } from '@/types';
import { AgeGate, Footer } from '@/components/layout';
import { DealsPage } from '@/components/DealsPage';
import { SearchPage } from '@/components/SearchPage';
import { BrowsePage } from '@/components/BrowsePage';
import { SavedPage } from '@/components/SavedPage';
import { LocationSelector } from '@/components/LocationSelector';
import { DealModal } from '@/components/modals';
import { DealCardSkeleton, TopPickSkeleton } from '@/components/Skeleton';
import { ToastContainer } from '@/components/Toast';
import type { ToastData } from '@/components/Toast';
import { useSavedDeals } from '@/hooks/useSavedDeals';
import { useStreak } from '@/hooks/useStreak';
import { useBrandAffinity } from '@/hooks/useBrandAffinity';
import { touchSession, trackEvent, trackSavedDeal, trackUnsavedDeal } from '@/lib/analytics';

type AppPage = 'home' | 'search' | 'browse' | 'saved';

export default function Home() {
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>('home');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [highlightSaved, setHighlightSaved] = useState(false);

  const { savedDeals, usedDeals, toggleSavedDeal, markDealUsed, isDealUsed, savedCount } =
    useSavedDeals();
  const { streak, isNewMilestone, clearMilestone } = useStreak();
  const { trackBrand, topBrands, totalSaves } = useBrandAffinity();

  // Age verification
  useEffect(() => {
    const verified = localStorage.getItem('clouded_age_verified');
    if (verified === 'true') {
      setIsAgeVerified(true);
      touchSession();
    }
  }, []);

  const handleAgeVerify = () => {
    localStorage.setItem('clouded_age_verified', 'true');
    setIsAgeVerified(true);
  };

  // Toast helpers
  const addToast = useCallback((message: string, type: ToastData['type']) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Streak milestone toast
  useEffect(() => {
    if (isNewMilestone) {
      addToast(`${isNewMilestone}-day streak! Keep it up.`, 'streak');
      clearMilestone();
    }
  }, [isNewMilestone, clearMilestone, addToast]);

  // Fetch deals
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchDeals();
      if (cancelled) return;
      setDeals(result.deals);
      setError(result.error);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived deal lists
  const verifiedDeals = useMemo(
    () => deals.filter((d) => d.is_verified),
    [deals]
  );
  const featuredDeals = useMemo(
    () => deals.filter((d) => d.is_featured),
    [deals]
  );
  const brands = useMemo(() => {
    const seen = new Map<string, Deal['brand']>();
    for (const d of deals) {
      if (!seen.has(d.brand.id)) seen.set(d.brand.id, d.brand);
    }
    return Array.from(seen.values());
  }, [deals]);

  // Save handler with brand tracking
  const handleToggleSave = useCallback(
    (dealId: string) => {
      const wasSaved = savedDeals.has(dealId);
      toggleSavedDeal(dealId);
      if (!wasSaved) {
        const deal = deals.find((d) => d.id === dealId);
        if (deal) trackBrand(deal.brand.name);
        addToast('Deal saved!', 'saved');
        trackEvent('deal_save', dealId);
        trackSavedDeal(dealId);
      } else {
        addToast('Removed from saved', 'removed');
        trackUnsavedDeal(dealId);
      }
    },
    [savedDeals, toggleSavedDeal, deals, trackBrand, addToast]
  );

  const handleHighlightSaved = useCallback(() => {
    setHighlightSaved(true);
    setTimeout(() => setHighlightSaved(false), 1500);
  }, []);

  // AgeGate
  if (!isAgeVerified) {
    return <AgeGate onVerify={handleAgeVerify} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-purple-500/10">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <button onClick={() => setActivePage('home')} className="focus:outline-none">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Clouded<span className="text-purple-400">Deals</span>
            </h1>
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <LocationSelector />
            <span className="h-3 w-px bg-slate-800" />
            {savedCount > 0 && (
              <>
                <button
                  onClick={() => setActivePage('saved')}
                  className={`flex items-center gap-1 transition-all ${
                    highlightSaved ? 'text-purple-300 scale-110' : 'text-purple-400'
                  }`}
                >
                  <Heart className="w-3 h-3 fill-current" />
                  {savedCount}
                </button>
                <span className="h-3 w-px bg-slate-800" />
              </>
            )}
            {streak > 1 && (
              <>
                <span className="text-orange-400">{streak}d streak</span>
                <span className="h-3 w-px bg-slate-800" />
              </>
            )}
            <span>{deals.length} deals</span>
          </div>
        </div>
      </header>

      {/* Desktop navigation tabs (hidden on mobile — bottom nav used instead) */}
      <nav className="hidden sm:block sticky top-16 z-40 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1">
          {[
            { id: 'home' as const, label: 'Deals', icon: Star },
            { id: 'search' as const, label: 'Search', icon: Search },
            { id: 'browse' as const, label: 'Browse', icon: Star },
            { id: 'saved' as const, label: 'Saved', icon: Bookmark },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium transition-all border-b-2 ${
                activePage === tab.id
                  ? 'text-purple-400 border-purple-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content — bottom padding on mobile for bottom nav */}
      <main className="relative pb-20 sm:pb-0">
        {loading ? (
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
            <TopPickSkeleton />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-6xl mx-auto px-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : deals.length === 0 && !isSupabaseConfigured ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-6xl mx-auto px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">No deals yet</h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Database not connected. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY to see live deals.
            </p>
          </div>
        ) : (
          <>
            {activePage === 'home' && (
              <DealsPage
                deals={deals}
                verifiedDeals={verifiedDeals}
                featuredDeals={featuredDeals}
                savedDeals={savedDeals}
                usedDeals={usedDeals}
                toggleSavedDeal={handleToggleSave}
                setSelectedDeal={setSelectedDeal}
                savedCount={savedCount}
                streak={streak}
                topBrands={topBrands}
                totalBrandSaves={totalSaves}
                addToast={addToast}
                onHighlightSavedIcon={handleHighlightSaved}
              />
            )}
            {activePage === 'search' && (
              <SearchPage
                deals={deals}
                brands={brands}
                savedDeals={savedDeals}
                toggleSavedDeal={handleToggleSave}
                setSelectedDeal={setSelectedDeal}
                onNavigateToBrands={() => setActivePage('browse')}
              />
            )}
            {activePage === 'browse' && <BrowsePage />}
            {activePage === 'saved' && <SavedPage deals={deals} />}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Deal Modal */}
      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          isSaved={savedDeals.has(selectedDeal.id)}
          onToggleSave={() => handleToggleSave(selectedDeal.id)}
          isUsed={isDealUsed(selectedDeal.id)}
          onMarkUsed={() => {
            markDealUsed(selectedDeal.id);
            addToast('Marked as used', 'success');
          }}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Mobile bottom nav bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/50">
        <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {[
            { id: 'home' as const, label: 'Deals', icon: Star },
            { id: 'search' as const, label: 'Search', icon: Search },
            { id: 'browse' as const, label: 'Browse', icon: Star },
            { id: 'saved' as const, label: 'Saved', icon: Bookmark },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] min-h-[48px] text-[10px] font-medium transition-colors ${
                activePage === tab.id
                  ? 'text-purple-400'
                  : 'text-slate-500 active:text-slate-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
