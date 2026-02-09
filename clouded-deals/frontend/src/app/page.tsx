'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Star, Heart, Search, Bookmark, Compass, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchDeals, fetchDispensaries } from '@/lib/api';
import type { BrowseDispensary } from '@/lib/api';
import type { Deal } from '@/types';
import type { User } from '@supabase/supabase-js';
import { AgeGate, Footer } from '@/components/layout';
import { DealsPage } from '@/components/DealsPage';
import { SearchPage } from '@/components/SearchPage';
import { BrowsePage } from '@/components/BrowsePage';
import { SavedPage } from '@/components/SavedPage';
import { AboutPage } from '@/components/AboutPage';
import { AuthPrompt } from '@/components/AuthPrompt';
import { SmsWaitlist } from '@/components/SmsWaitlist';
import { LocationSelector } from '@/components/LocationSelector';
import { DealModal } from '@/components/modals';
import { DealCardSkeleton, TopPickSkeleton } from '@/components/Skeleton';
import { ToastContainer } from '@/components/Toast';
import type { ToastData } from '@/components/Toast';
import { useSavedDeals } from '@/hooks/useSavedDeals';
import { useStreak } from '@/hooks/useStreak';
import { useBrandAffinity } from '@/hooks/useBrandAffinity';
import { useChallenges } from '@/hooks/useChallenges';
import { initializeAnonUser, trackEvent, trackPageView, trackDealModalOpen } from '@/lib/analytics';
import { isAuthPromptDismissed, dismissAuthPrompt } from '@/lib/auth';
import { FTUEFlow, isFTUECompleted, CoachMarks, isCoachMarksSeen } from '@/components/ftue';

type AppPage = 'home' | 'search' | 'browse' | 'saved' | 'about';

export default function Home() {
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [browseDispensaries, setBrowseDispensaries] = useState<BrowseDispensary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>('home');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [highlightSaved] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [showFTUE, setShowFTUE] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !isFTUECompleted();
  });
  const [showCoachMarks, setShowCoachMarks] = useState(false);

  const { savedDeals, usedDeals, toggleSavedDeal, markDealUsed, isDealUsed, savedCount } =
    useSavedDeals();
  const { streak, isNewMilestone, clearMilestone } = useStreak();
  const { trackBrand } = useBrandAffinity();
  const challenges = useChallenges();

  // Age verification & anonymous tracking
  useEffect(() => {
    const verified = localStorage.getItem('clouded_age_verified');
    if (verified === 'true') {
      setIsAgeVerified(true);
      initializeAnonUser();
      trackEvent('app_loaded', undefined, { referrer: document.referrer });
    }
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!supabase?.auth) return;

    // Check for existing session
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setAuthUser(data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
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

  // Saved deals as array (for challenge progress computation)
  const savedDealsList = useMemo(
    () => deals.filter((d) => savedDeals.has(d.id)),
    [deals, savedDeals]
  );

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

  // Show auth prompt after 3+ saves (only if not authenticated and not dismissed)
  useEffect(() => {
    if (savedCount >= 3 && !authUser && !isAuthPromptDismissed()) {
      setShowAuthPrompt(true);
    }
  }, [savedCount, authUser]);

  // Fetch deals and dispensaries
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [dealsResult, dispResult] = await Promise.all([
        fetchDeals(),
        fetchDispensaries(),
      ]);
      if (cancelled) return;
      setDeals(dealsResult.deals);
      setError(dealsResult.error);
      setBrowseDispensaries(dispResult.dispensaries);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Show all active deals — the server-side is_active=true filter already
  // ensures we only get the latest scrape run's products. A client-side
  // midnight filter would incorrectly hide deals due to UTC/PST offsets.
  const todaysDeals = deals;

  const brands = useMemo(() => {
    const seen = new Map<string, Deal['brand']>();
    for (const d of deals) {
      if (!seen.has(d.brand.id)) seen.set(d.brand.id, d.brand);
    }
    return Array.from(seen.values());
  }, [deals]);

  // Save handler with brand tracking, haptic feedback, milestone toasts, and rate limiting
  const lastSaveRef = useRef(0);
  const milestoneShownRef = useRef<Set<string>>(new Set());
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
          trackBrand(deal.brand.name);
          challenges.updateProgress('save', deal, savedDealsList);
        }

        // Milestone toast system
        const newCount = savedCount + 1;
        const shown = milestoneShownRef.current;

        if (newCount === 1 && !shown.has('first')) {
          shown.add('first');
          addToast('First deal saved \uD83D\uDD16', 'milestone');
        } else if (newCount === 3 && !shown.has('taste')) {
          shown.add('taste');
          addToast("You've got taste \uD83D\uDC4C", 'milestone');
        } else if (newCount === 10 && !shown.has('hunter')) {
          shown.add('hunter');
          addToast('Deal hunter \uD83C\uDFAF', 'milestone');
        } else if (deal) {
          // Check dispensary diversity: 3 unique dispensaries
          const dispensaryIds = new Set(savedDealsList.map(d => d.dispensary.id));
          dispensaryIds.add(deal.dispensary.id);
          if (dispensaryIds.size >= 3 && !shown.has('explorer')) {
            shown.add('explorer');
            addToast('Explorer unlocked \uD83D\uDDFA\uFE0F', 'milestone');
          }
          // Check brand loyalty: 3 same brand
          else if (deal.brand?.name) {
            const brandCount = savedDealsList.filter(d => d.brand?.name === deal.brand?.name).length + 1;
            if (brandCount >= 3 && !shown.has(`brand_${deal.brand.name}`)) {
              shown.add(`brand_${deal.brand.name}`);
              addToast(`${deal.brand.name} fan? \uD83D\uDC9C`, 'milestone');
            } else {
              addToast('Saved. Expires at midnight.', 'saved');
            }
          } else {
            addToast('Saved. Expires at midnight.', 'saved');
          }
        } else {
          addToast('Saved. Expires at midnight.', 'saved');
        }
      } else {
        addToast('Removed from saves.', 'removed');
      }
    },
    [savedDeals, toggleSavedDeal, deals, trackBrand, addToast, challenges, savedDealsList, savedCount]
  );

  const handleFTUEComplete = useCallback(() => {
    setShowFTUE(false);
    // Show coach marks on first deals feed view
    if (!isCoachMarksSeen()) {
      // Delay so the deals page renders first and coach mark targets exist
      setTimeout(() => setShowCoachMarks(true), 600);
    }
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
        onComplete={() => handleFTUEComplete()}
      />
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Ambient gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/15 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ backgroundColor: 'rgba(10, 14, 26, 0.92)', borderColor: 'var(--border-subtle)' }}>
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
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-purple-500 text-[9px] font-bold text-white">
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: just show saved count */}
          <div className="sm:hidden flex items-center gap-2 text-xs text-slate-500">
            <span>{todaysDeals.length} deals</span>
          </div>
        </div>
      </header>

      {/* Main content — bottom padding on mobile for bottom nav */}
      <main className="relative pb-20 sm:pb-0">
        {/* Deals tab: shows loading/error states */}
        {activePage === 'home' && (
          loading ? (
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
              savedDeals={savedDeals}
              usedDeals={usedDeals}
              toggleSavedDeal={handleToggleSave}
              setSelectedDeal={setSelectedDeal}
              savedCount={savedCount}
              streak={streak}
              addToast={addToast}
            />
          )
        )}

        {/* Search tab: always renders (works with empty deals) */}
        {activePage === 'search' && (
          <SearchPage
            deals={todaysDeals}
            brands={brands}
            savedDeals={savedDeals}
            toggleSavedDeal={handleToggleSave}
            setSelectedDeal={setSelectedDeal}
            initialQuery={searchInitialQuery}
            onQueryConsumed={() => setSearchInitialQuery('')}
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
          />
        )}

        {/* About page */}
        {activePage === 'about' && <AboutPage />}
      </main>

      {/* Footer */}
      <Footer onNavigateToAbout={() => { setActivePage('about'); window.scrollTo(0, 0); }} />

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

      {/* Auth prompt — triggered after 3+ saves */}
      {showAuthPrompt && (
        <AuthPrompt
          savedCount={savedCount}
          onClose={() => {
            setShowAuthPrompt(false);
            dismissAuthPrompt();
          }}
        />
      )}

      {/* SMS deal alerts waitlist CTA */}
      <SmsWaitlist addToast={addToast} />

      {/* Coach marks overlay — shown once after FTUE on first deals view */}
      {showCoachMarks && (
        <CoachMarks onComplete={() => setShowCoachMarks(false)} />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Mobile bottom nav bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t" style={{ backgroundColor: 'rgba(10, 14, 26, 0.95)', borderColor: 'var(--border-subtle)' }} aria-label="Main navigation">
        <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]" role="tablist">
          {[
            { id: 'home' as const, label: 'Deals', icon: Star },
            { id: 'search' as const, label: 'Search', icon: Search },
            { id: 'browse' as const, label: 'Browse', icon: Compass },
            { id: 'saved' as const, label: 'Saved', icon: Bookmark },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activePage === tab.id}
              aria-label={tab.label}
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
