'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Star, Heart, Search, Compass, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchDeals, fetchExpiredDeals, fetchDispensaries } from '@/lib/api';
import type { BrowseDispensary, FetchDealsResult, FetchDispensariesResult } from '@/lib/api';
import type { Deal } from '@/types';
import { AgeGate, Footer } from '@/components/layout';
import { DealsPage } from '@/components/DealsPage';
import { SearchPage } from '@/components/SearchPage';
import { BrowsePage } from '@/components/BrowsePage';
import { SavedPage } from '@/components/SavedPage';
import { AboutPage } from '@/components/AboutPage';
import { TermsPage } from '@/components/TermsPage';
import { PrivacyPage } from '@/components/PrivacyPage';
import { SmsWaitlist } from '@/components/SmsWaitlist';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { LocationSelector } from '@/components/LocationSelector';
import { DealModal } from '@/components/modals';
import { DealCardSkeleton, TopPickSkeleton } from '@/components/Skeleton';
import { ToastContainer } from '@/components/Toast';
import type { ToastData } from '@/components/Toast';
import { useSavedDeals } from '@/hooks/useSavedDeals';
import { useDealHistory } from '@/hooks/useDealHistory';
import { initializeAnonUser, trackEvent, trackPageView, trackDealModalOpen } from '@/lib/analytics';
import { FTUEFlow, isFTUECompleted } from '@/components/ftue';
import type { UserCoords } from '@/components/ftue';
import { CookieConsent } from '@/components/CookieConsent';
import { createShareLink } from '@/lib/share';
import { formatUpdateTime } from '@/utils';

type AppPage = 'home' | 'search' | 'browse' | 'saved' | 'about' | 'terms' | 'privacy';

export default function Home() {
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [expiredDeals, setExpiredDeals] = useState<Deal[]>([]);
  const [isShowingExpired, setIsShowingExpired] = useState(false);
  const [browseDispensaries, setBrowseDispensaries] = useState<BrowseDispensary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>('home');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [highlightSaved] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [swipeOpen, setSwipeOpen] = useState(false);
  const [showFTUE, setShowFTUE] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !isFTUECompleted();
  });
  const { savedDeals, usedDeals, toggleSavedDeal, removeSavedDeals, markDealUsed, isDealUsed, savedCount } =
    useSavedDeals();
  const dealHistory = useDealHistory();

  // Age verification & anonymous tracking
  useEffect(() => {
    const verified = localStorage.getItem('clouded_age_verified');
    if (verified === 'true') {
      setIsAgeVerified(true);
      initializeAnonUser();
      trackEvent('app_loaded', undefined, { referrer: document.referrer });
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

  // Handle ?auth=success redirect from magic link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      addToast('Logged in! Your saves are synced.', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [addToast]);

  // Track page views when navigating between tabs
  const prevPageRef = useRef(activePage);
  useEffect(() => {
    if (isAgeVerified && activePage !== prevPageRef.current) {
      trackPageView(activePage);
      prevPageRef.current = activePage;
    }
  }, [activePage, isAgeVerified]);

  // Listen for navigation events from CookieConsent (privacy link)
  useEffect(() => {
    function handleNav(e: Event) {
      const page = (e as CustomEvent).detail;
      if (page === 'privacy' || page === 'terms' || page === 'about') {
        setActivePage(page);
        window.scrollTo(0, 0);
      }
    }
    window.addEventListener('navigate', handleNav);
    return () => window.removeEventListener('navigate', handleNav);
  }, []);

  // Track referral clicks from share links
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const referrer = params.get('ref');
    if (referrer) {
      trackEvent('referral_click', undefined, {
        referrer,
        deal_id: params.get('utm_content') || undefined,
      });
      sessionStorage.setItem('clouded_referrer', referrer);
    }
  }, []);

  // Auto-open DealModal from shared link (?deal=<id>)
  const pendingDealId = useRef<string | null>(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('deal')
      : null
  );
  useEffect(() => {
    if (!pendingDealId.current || loading || deals.length === 0) return;
    const match = deals.find((d) => d.id === pendingDealId.current);
    if (match) {
      setSelectedDeal(match);
      // Skip FTUE for shared links
      if (showFTUE) {
        setShowFTUE(false);
      }
    }
    pendingDealId.current = null;
    // Clean up URL params
    window.history.replaceState({}, '', window.location.pathname);
  }, [deals, loading, activePage, showFTUE]);

  // Track deal modal opens
  useEffect(() => {
    if (selectedDeal) {
      trackDealModalOpen(selectedDeal.id, activePage);
    }
  }, [selectedDeal, activePage]);

  // Fetch deals, expired deals, and dispensaries in parallel.
  // Expired deals always load so they can be shown in a "Past Deals" section.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const fetches: [Promise<FetchDealsResult>, Promise<FetchDispensariesResult>] = [
        fetchDeals(),
        fetchDispensaries(),
      ];
      const [dealsResult, dispResult] = await Promise.all(fetches);
      if (cancelled) return;
      setDeals(dealsResult.deals);
      setError(dealsResult.error);
      setBrowseDispensaries(dispResult.dispensaries);

      // Always fetch expired deals — shown as "Past Deals" section below active deals,
      // or as the main feed when no active deals exist (early morning fallback).
      if (isSupabaseConfigured) {
        const expiredResult = await fetchExpiredDeals();
        if (cancelled) return;
        if (expiredResult.deals.length > 0) {
          // Deduplicate: exclude deals that are already in the active set
          const activeIds = new Set(dealsResult.deals.map(d => d.id));
          const uniqueExpired = expiredResult.deals.filter(d => !activeIds.has(d.id));
          setExpiredDeals(uniqueExpired);
          // Only flag as "showing expired" when there are NO active deals
          if (dealsResult.deals.length === 0) {
            setIsShowingExpired(true);
          }
        }
      }

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Archive expired saved deals to history when fresh deals load
  const archiveRunRef = useRef(false);
  useEffect(() => {
    if (archiveRunRef.current || loading || deals.length === 0) return;
    archiveRunRef.current = true;

    const currentIds = new Set(deals.map(d => d.id));
    const archived = dealHistory.archiveExpired(savedDeals, currentIds);
    if (archived.length > 0) {
      // Silently remove archived IDs — no analytics for automated expiry
      removeSavedDeals(archived);
    }
  }, [deals, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show all active deals — the server-side is_active=true filter already
  // ensures we only get the latest scrape run's products. A client-side
  // midnight filter would incorrectly hide deals due to UTC/PST offsets.
  // When no active deals exist, fall back to expired deals for browsing.
  const todaysDeals = deals.length > 0 ? deals : expiredDeals;

  const brands = useMemo(() => {
    const seen = new Map<string, Deal['brand']>();
    for (const d of deals) {
      const brandId = d.brand?.id;
      if (brandId && !seen.has(brandId)) seen.set(brandId, d.brand);
    }
    return Array.from(seen.values());
  }, [deals]);

  // Save handler with brand tracking, haptic feedback, and smart tip engine
  const lastSaveRef = useRef(0);
  const handleToggleSave = useCallback(
    (dealId: string) => {
      // Rate limit: 500ms between saves
      const now = Date.now();
      if (now - lastSaveRef.current < 500) return;
      lastSaveRef.current = now;

      const wasSaved = savedDeals.has(dealId);
      toggleSavedDeal(dealId);

      // Haptic feedback on mobile
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(wasSaved ? 10 : 30);
      }

      if (!wasSaved) {
        const deal = deals.find((d) => d.id === dealId);
        if (deal) {
          dealHistory.snapshotDeal(deal);
        }
      } else {
        dealHistory.removeSnapshot(dealId);
      }
    },
    [savedDeals, toggleSavedDeal, deals, dealHistory]
  );

  // Share saves handler — used by swipe overlay's "Share today's favorites" CTA
  const handleShareSaves = useCallback(async () => {
    const activeSavedDeals = deals.filter((d) => savedDeals.has(d.id));
    if (activeSavedDeals.length === 0) return;

    const dealIds = activeSavedDeals.map((d) => d.id);
    const result = await createShareLink(dealIds);

    if (result.error || !result.shareUrl) {
      addToast('Could not create share link.', 'info');
      return;
    }

    trackEvent('share_saves', undefined, {
      deal_count: dealIds.length,
      share_id: result.shareId,
      source: 'swipe_overlay',
    });

    const shareData = {
      title: `${activeSavedDeals.length} deals I found on CloudedDeals`,
      text: `Check out these ${activeSavedDeals.length} cannabis deals in Las Vegas — they expire tonight!`,
      url: result.shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        addToast('Link copied! Share it with friends.', 'success');
      } catch {
        addToast('Could not copy link.', 'info');
      }
    }
  }, [deals, savedDeals, addToast]);

  const handleFTUEComplete = useCallback((_prefs: string[], coords: UserCoords | null) => {
    setShowFTUE(false);
    // If geolocation was granted during FTUE, coords are already persisted
    // in localStorage by LocationPrompt — no extra work needed here.
    void coords;
  }, []);

  // AgeGate
  if (!isAgeVerified) {
    return <AgeGate onVerify={handleAgeVerify} />;
  }

  // FTUE flow for brand-new users
  if (showFTUE) {
    return (
      <FTUEFlow
        dealCount={todaysDeals.length}
        onComplete={handleFTUEComplete}
      />
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Ambient gradient — Roku-style light source from above.
           Desktop: tighter ellipse + secondary accent for depth on wide viewports. */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(88, 28, 135, 0.18) 0%, rgba(88, 28, 135, 0.06) 40%, transparent 70%)' }} />
      <div className="fixed inset-0 pointer-events-none hidden sm:block" style={{ background: 'radial-gradient(ellipse 50% 35% at 50% -2%, rgba(139, 92, 246, 0.08) 0%, transparent 60%), radial-gradient(ellipse 30% 20% at 50% 0%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)' }} />

      {/* Header */}
      <header className="sticky top-0 z-50 header-border-glow" style={{ backgroundColor: 'rgba(10, 12, 28, 0.92)', borderBottom: '1px solid rgba(120, 100, 200, 0.08)', WebkitBackdropFilter: 'blur(40px) saturate(1.3)', backdropFilter: 'blur(40px) saturate(1.3)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setActivePage('home')} className="focus:outline-none">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Clouded<span className="text-purple-400">Deals</span>
              </h1>
            </button>
            <LocationSelector />
          </div>

          {/* Desktop inline nav */}
          <div className="hidden sm:flex items-center gap-1">
            {[
              { id: 'home' as const, label: 'Deals' },
              { id: 'browse' as const, label: 'Browse' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                  activePage === tab.id
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => setActivePage('search')}
              className={`p-2.5 rounded-lg transition-colors ${
                activePage === 'search' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActivePage('saved')}
              className={`relative p-2.5 rounded-lg transition-colors ${
                activePage === 'saved' || highlightSaved ? 'text-purple-400' : 'text-slate-400 hover:text-white'
              }`}
              aria-label="Saved deals"
            >
              <Heart className={`w-5 h-5 ${savedCount > 0 ? 'fill-current' : ''}`} />
              {savedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: deal count + last update time */}
          <div className="sm:hidden flex items-center gap-2 text-xs text-slate-500">
            <span>{todaysDeals.length} {isShowingExpired ? "yesterday's" : ''} deals</span>
            {!isShowingExpired && todaysDeals.length > 0 && (
              <span className="text-slate-600">{formatUpdateTime(todaysDeals)}</span>
            )}
          </div>
        </div>
      </header>

      {/* Main content — bottom padding on mobile for bottom nav */}
      <main className="relative pb-20 sm:pb-0">
        {/* Deals tab: shows loading/error/expired states */}
        {activePage === 'home' && (
          loading ? (
            <>
              {/* Category bar skeleton */}
              <div className="sticky top-14 sm:top-16 z-40 border-b" style={{ backgroundColor: 'rgba(10, 12, 28, 0.92)', borderColor: 'rgba(120, 100, 200, 0.06)' }}>
                <div className="max-w-6xl mx-auto px-4 h-11 flex items-center gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-6 rounded-full animate-pulse" style={{ width: `${40 + i * 5}px`, background: 'rgba(45,50,80,0.3)' }} />
                  ))}
                </div>
              </div>
              <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
                <TopPickSkeleton />
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 xl:gap-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <DealCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </>
          ) : error && !isShowingExpired ? (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-6xl mx-auto px-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">
                Can&apos;t reach the deals right now
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mb-4">Check your connection and try again.</p>
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
            <DealsPage
              deals={todaysDeals}
              expiredDeals={isShowingExpired ? [] : expiredDeals}
              savedDeals={savedDeals}
              usedDeals={usedDeals}
              toggleSavedDeal={handleToggleSave}
              setSelectedDeal={setSelectedDeal}
              savedCount={savedCount}
              isExpired={isShowingExpired}
              onShareSaves={handleShareSaves}
              swipeOpen={swipeOpen}
              onSwipeOpenChange={setSwipeOpen}
            />
          )
        )}

        {/* Search tab: always renders (works with empty deals + expired deals) */}
        {activePage === 'search' && (
          <SearchPage
            deals={todaysDeals}
            brands={brands}
            savedDeals={savedDeals}
            toggleSavedDeal={handleToggleSave}
            setSelectedDeal={setSelectedDeal}
            initialQuery={searchInitialQuery}
            onQueryConsumed={() => setSearchInitialQuery('')}
            isExpired={isShowingExpired}
          />
        )}

        {/* Browse tab: always renders (uses static brand/dispensary data) */}
        {activePage === 'browse' && (
          <BrowsePage
            deals={deals}
            dispensaries={browseDispensaries}
            onSelectBrand={(brandName) => {
              setSearchInitialQuery(brandName);
              setActivePage('search');
            }}
            onSelectDispensary={(dispensaryName) => {
              setSearchInitialQuery(dispensaryName);
              setActivePage('search');
            }}
          />
        )}

        {/* Saved tab: always renders */}
        {activePage === 'saved' && (
          <SavedPage
            deals={deals}
            onSelectDeal={setSelectedDeal}
            addToast={addToast}
            history={dealHistory.history}
            onClearHistory={dealHistory.clearHistory}
            onOpenSwipeMode={() => {
              setActivePage('home');
              setSwipeOpen(true);
            }}
          />
        )}

        {/* About page */}
        {activePage === 'about' && <AboutPage />}

        {/* Terms of Service */}
        {activePage === 'terms' && <TermsPage onBack={() => setActivePage('home')} />}

        {/* Privacy Policy */}
        {activePage === 'privacy' && <PrivacyPage onBack={() => setActivePage('home')} />}
      </main>

      {/* Footer */}
      <Footer
        onNavigateToAbout={() => { setActivePage('about'); window.scrollTo(0, 0); }}
        onNavigate={(page) => { setActivePage(page); window.scrollTo(0, 0); }}
        onReplayTour={() => {
          setActivePage('home');
          setShowFTUE(true);
          window.scrollTo(0, 0);
        }}
      />

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
          onAccuracyFeedback={(accurate) => {
            trackEvent('deal_viewed', selectedDeal.id, {
              action: 'accuracy_feedback',
              accurate,
              dispensary: selectedDeal.dispensary?.name,
            });
          }}
          onDealReported={() => {
            addToast('Thanks for flagging — we\'ll review it.', 'info');
          }}
        />
      )}

      {/* SMS deal alerts waitlist CTA */}
      <SmsWaitlist addToast={addToast} />

      {/* Feedback widget — subtle floating icon, bottom-right */}
      <FeedbackWidget />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Cookie / localStorage consent banner */}
      <CookieConsent />

      {/* Mobile bottom nav bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t" style={{ backgroundColor: 'rgba(10, 12, 26, 0.95)', borderColor: 'rgba(120, 100, 200, 0.08)', WebkitBackdropFilter: 'blur(40px) saturate(1.3)', backdropFilter: 'blur(40px) saturate(1.3)' }} aria-label="Main navigation">
        <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]" role="tablist">
          {[
            { id: 'home' as const, label: 'Deals', icon: Star },
            { id: 'search' as const, label: 'Search', icon: Search },
            { id: 'browse' as const, label: 'Browse', icon: Compass },
            { id: 'saved' as const, label: 'Saved', icon: Heart },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activePage === tab.id}
              aria-label={tab.label}
              onClick={() => setActivePage(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] min-h-[48px] text-[11px] font-medium transition-all duration-200 ${
                activePage === tab.id
                  ? 'text-purple-400 nav-glow-active scale-105'
                  : 'text-slate-500 active:text-slate-300'
              }`}
            >
              <tab.icon className={`w-5 h-5 transition-transform duration-200 ${activePage === tab.id ? 'drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
