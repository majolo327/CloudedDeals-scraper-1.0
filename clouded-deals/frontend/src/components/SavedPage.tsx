'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Heart, DollarSign, Trash2, Clock, Share, Check, Sun, ChevronDown, ArrowUpDown, History, Sparkles } from 'lucide-react';
import { useSavedDeals } from '@/hooks/useSavedDeals';
import { getDiscountPercent, getDisplayName, getDistanceMiles } from '@/utils';
import { createShareLink } from '@/lib/share';
import { trackEvent } from '@/lib/analytics';
import { ContactBanner } from '@/components/ContactBanner';
import { getUserCoords } from '@/components/ftue/LocationPrompt';
import type { Deal } from '@/types';
import type { HistoryEntry } from '@/hooks/useDealHistory';

type SavedSort = 'saved' | 'price_asc' | 'price_desc' | 'nearest';

const SORT_OPTIONS: { id: SavedSort; label: string; needsLocation?: boolean }[] = [
  { id: 'saved', label: 'Saved Order' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'nearest', label: 'Nearest First', needsLocation: true },
];

/** Returns { hours, minutes } until midnight Pacific. */
function useCountdownToMidnight() {
  const [countdown, setCountdown] = useState(() => calcCountdown());
  useEffect(() => {
    const interval = setInterval(() => setCountdown(calcCountdown()), 30_000);
    return () => clearInterval(interval);
  }, []);
  return countdown;
}

function calcCountdown() {
  const now = new Date();
  const ptStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pt = new Date(ptStr);
  const hoursLeft = 23 - pt.getHours();
  const minsLeft = 59 - pt.getMinutes();
  return { hours: hoursLeft, minutes: minsLeft };
}

interface SavedPageProps {
  deals: Deal[];
  onSelectDeal?: (deal: Deal) => void;
  addToast?: (message: string, type: 'success' | 'info') => void;
  history?: HistoryEntry[];
  onClearHistory?: () => void;
  onOpenSwipeMode?: () => void;
}

export function SavedPage({ deals, onSelectDeal, addToast, history = [], onClearHistory, onOpenSwipeMode }: SavedPageProps) {
  const { savedDeals, toggleSavedDeal, isDealUsed, markDealUsed } = useSavedDeals();
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle');
  const [showContactBanner, setShowContactBanner] = useState(false);
  const [sortBy, setSortBy] = useState<SavedSort>('saved');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const userCoords = useMemo(() => getUserCoords(), []);
  const hasLocation = !!userCoords;

  const savedDealsList = deals.filter((d) => savedDeals.has(d.id));
  const hasNoActiveSaves = savedDealsList.length === 0;

  // Auto-expand past saves when user has no active saves — otherwise they'd only
  // see the empty state and miss the collapsed history toggle entirely
  useEffect(() => {
    if (hasNoActiveSaves && history.length > 0) {
      setShowHistory(true);
    }
  }, [hasNoActiveSaves, history.length]);
  const usedDeals = savedDealsList.filter((d) => isDealUsed(d.id));
  const activeDeals = savedDealsList.filter((d) => !isDealUsed(d.id));

  // Sort active deals
  const sortedActiveDeals = useMemo(() => {
    const sorted = [...activeDeals];
    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => a.deal_price - b.deal_price);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.deal_price - a.deal_price);
        break;
      case 'nearest':
        if (userCoords) {
          sorted.sort((a, b) => {
            const distA = getDistanceMiles(userCoords.lat, userCoords.lng, a.dispensary.latitude, a.dispensary.longitude) ?? 999;
            const distB = getDistanceMiles(userCoords.lat, userCoords.lng, b.dispensary.latitude, b.dispensary.longitude) ?? 999;
            return distA - distB;
          });
        }
        break;
      default:
        break; // 'saved' keeps original order
    }
    return sorted;
  }, [activeDeals, sortBy, userCoords]);

  const potentialSavings = activeDeals.reduce((sum, deal) => {
    if (!deal.original_price || deal.original_price <= deal.deal_price) return sum;
    return sum + (deal.original_price - deal.deal_price);
  }, 0);

  // Show contact banner: 10+ saves, no contact captured, not dismissed within 7 days
  useEffect(() => {
    const captured = localStorage.getItem('clouded_contact_captured') === 'true';
    if (captured) return;

    const dismissed = localStorage.getItem('clouded_contact_banner_dismissed');
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (dismissed && parseInt(dismissed) > weekAgo) return;

    if (savedDealsList.length >= 10) {
      const timer = setTimeout(() => setShowContactBanner(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [savedDealsList.length]);

  const handleDismissContactBanner = useCallback(() => {
    setShowContactBanner(false);
    localStorage.setItem('clouded_contact_banner_dismissed', Date.now().toString());
  }, []);

  const handleShare = useCallback(async () => {
    if (activeDeals.length === 0) return;
    setShareState('sharing');

    const dealIds = activeDeals.map((d) => d.id);
    const result = await createShareLink(dealIds);

    // Build fallback text list when Supabase share link fails
    const buildFallbackText = () => {
      const lines = activeDeals.map(
        (d) => `${d.brand?.name ? `${d.brand.name} — ` : ''}${d.product_name}: $${d.deal_price} at ${d.dispensary?.name || 'Unknown'}`,
      );
      return `${activeDeals.length} cannabis deals in Las Vegas — they expire tonight!\n\n${lines.join('\n')}\n\nFound on CloudedDeals.com`;
    };

    let shareUrl: string;
    let shareText: string;

    if (result.error || !result.shareUrl) {
      // Fallback: share as plain text list instead of a link
      shareUrl = 'https://cloudeddeals.com';
      shareText = buildFallbackText();
    } else {
      trackEvent('share_saves', undefined, {
        deal_count: dealIds.length,
        share_id: result.shareId,
      });
      shareUrl = result.shareUrl;
      shareText = `Check out these ${activeDeals.length} cannabis deals in Las Vegas — they expire tonight!`;
    }

    const shareData = {
      title: `${activeDeals.length} deals I found on CloudedDeals`,
      text: shareText,
      url: shareUrl,
    };

    // Try native Web Share API first (mobile), fall back to clipboard
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        setShareState('copied');
      } catch {
        // User cancelled share sheet
        setShareState('idle');
        return;
      }
    } else {
      // Clipboard fallback: copy the share URL (or fallback text if no link)
      const clipboardContent = result.shareUrl || buildFallbackText();
      try {
        await navigator.clipboard.writeText(clipboardContent);
        setShareState('copied');
        addToast?.('Link copied to clipboard!', 'success');
      } catch {
        // Last-resort fallback using execCommand
        try {
          const textArea = document.createElement('textarea');
          textArea.value = clipboardContent;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setShareState('copied');
          addToast?.('Link copied to clipboard!', 'success');
        } catch {
          setShareState('idle');
          addToast?.('Unable to share — try screenshotting your saves instead', 'info');
          return;
        }
      }
    }

    setTimeout(() => setShareState('idle'), 2500);
  }, [activeDeals, addToast]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Saved Order';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats bar */}
        {savedDealsList.length > 0 && (
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {activeDeals.length} saved deal{activeDeals.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {usedDeals.length} used
                  {history.length > 0 && <> &middot; {history.length} past</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {potentialSavings > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      ${potentialSavings.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500">potential savings</p>
                  </div>
                </div>
              )}
              {/* Share My Saves button */}
              {activeDeals.length > 0 && (
                <button
                  onClick={handleShare}
                  disabled={shareState === 'sharing'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                >
                  {shareState === 'copied' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share className="w-3.5 h-3.5" />
                      Share
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contact capture banner — shown to engaged users (10+ saves) */}
        {showContactBanner && addToast && (
          <ContactBanner
            onDismiss={handleDismissContactBanner}
            savedDealsCount={savedDealsList.length}
            addToast={addToast}
          />
        )}

        {/* Expiry urgency with hours + minutes */}
        {activeDeals.length > 0 && <ExpiryBanner />}

        {/* Swipe mode nudge — shown to engaged users (3+ saves) */}
        {activeDeals.length >= 3 && onOpenSwipeMode && (
          <button
            onClick={onOpenSwipeMode}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 hover:border-purple-500/30 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-purple-300 group-hover:text-purple-200 transition-colors">
                Try Swipe Mode
              </p>
              <p className="text-xs text-slate-500">
                Swipe through {deals.length} deals Tinder-style — save or pass
              </p>
            </div>
          </button>
        )}

        {/* Active saved deals */}
        {activeDeals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300">Active Deals</h2>
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {currentSortLabel}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                {showSortMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg bg-slate-800 border border-slate-700/50 shadow-xl overflow-hidden">
                      {SORT_OPTIONS.filter(o => !o.needsLocation || hasLocation).map(option => (
                        <button
                          key={option.id}
                          onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                          className={`w-full px-3 py-2.5 text-left text-xs transition-colors ${
                            sortBy === option.id
                              ? 'text-purple-400 bg-purple-500/10'
                              : 'text-slate-300 hover:bg-slate-700/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {sortedActiveDeals.map((deal) => (
                <SavedDealCard
                  key={deal.id}
                  deal={deal}
                  onRemove={() => toggleSavedDeal(deal.id)}
                  onMarkUsed={() => markDealUsed(deal.id)}
                  onClick={onSelectDeal ? () => onSelectDeal(deal) : undefined}
                  distanceMiles={userCoords ? getDistanceMiles(userCoords.lat, userCoords.lng, deal.dispensary.latitude, deal.dispensary.longitude) : null}
                />
              ))}
            </div>
          </section>
        )}

        {/* Used deals */}
        {usedDeals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 mb-3">Used Deals</h2>
            <div className="space-y-2 opacity-50">
              {usedDeals.map((deal) => (
                <SavedDealCard
                  key={deal.id}
                  deal={deal}
                  isUsed
                  onRemove={() => toggleSavedDeal(deal.id)}
                  onClick={onSelectDeal ? () => onSelectDeal(deal) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* Deal History — past expired saves */}
        {history.length > 0 && (
          <section>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 group"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                Past Saves ({history.length})
              </h2>
              <ChevronDown className={`w-3 h-3 text-slate-400 ml-auto transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            {showHistory && (
              <div className="space-y-2 mt-3">
                {history.map((entry, i) => (
                  <HistoryDealCard key={`${entry.deal.id}-${i}`} entry={entry} />
                ))}
                {onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="w-full py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Clear history
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Return hook — tomorrow's deals */}
        {savedDealsList.length > 0 && <ReturnHook dealCount={deals.length} />}

        {/* Empty state */}
        {savedDealsList.length === 0 && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">Nothing saved yet</h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Tap <span className="text-purple-400">&hearts;</span> on any deal to keep it here.
            </p>
          </div>
        )}

        {/* Empty active state but has history */}
        {savedDealsList.length === 0 && history.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">No active saves</h2>
            <p className="text-sm text-slate-500 max-w-sm mb-6">
              Your previous saves expired. New deals drop every morning at 8 AM.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function SavedDealCard({
  deal,
  isUsed = false,
  onRemove,
  onMarkUsed,
  onClick,
  distanceMiles,
}: {
  deal: Deal;
  isUsed?: boolean;
  onRemove: () => void;
  onMarkUsed?: () => void;
  onClick?: () => void;
  distanceMiles?: number | null;
}) {
  const discount = getDiscountPercent(deal.original_price, deal.deal_price);

  return (
    <div
      className={`glass rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${onClick ? 'cursor-pointer hover:bg-slate-800/30 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{getDisplayName(deal.product_name, deal.brand?.name || '')}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{deal.dispensary.name}</span>
          {deal.weight && (
            <>
              <span className="text-slate-700">&middot;</span>
              <span className="text-xs text-slate-500">{deal.weight}</span>
            </>
          )}
          {distanceMiles != null && (
            <>
              <span className="text-slate-700">&middot;</span>
              <span className="text-xs text-slate-600">
                {distanceMiles < 0.5 ? '<0.5 mi' : `${distanceMiles.toFixed(1)} mi`}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-white">${deal.deal_price.toFixed(2)}</p>
          {discount > 0 && (
            <p className="text-[10px] text-emerald-400 font-medium">-{discount}%</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isUsed && onMarkUsed && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkUsed(); }}
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center justify-center"
              aria-label="Mark deal as used"
              title="Mark as used"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
            aria-label="Remove saved deal"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDealCard({ entry }: { entry: HistoryEntry }) {
  const { deal, expired_at, status } = entry;
  const expiredDate = new Date(expired_at);
  const dateLabel = expiredDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="glass rounded-lg px-4 py-3 flex items-center justify-between gap-3 opacity-60">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-300 truncate">{deal.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{deal.dispensary_name}</span>
          {deal.weight && (
            <>
              <span className="text-slate-700">&middot;</span>
              <span className="text-xs text-slate-500">{deal.weight}</span>
            </>
          )}
          <span className="text-slate-700">&middot;</span>
          <span className="text-xs text-slate-600">{dateLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-400">${deal.deal_price.toFixed(2)}</p>
          <p className="text-[10px] text-slate-600">
            {status === 'purchased' ? 'Purchased' : 'Expired'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpiryBanner() {
  const { hours, minutes } = useCountdownToMidnight();

  let label: string;
  if (hours <= 0 && minutes <= 30) {
    label = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    label = `${hours}h ${minutes}m`;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
      <Clock className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
      <p className="text-xs text-amber-400/80">
        Deals refresh in {label} &mdash; use them or lose them.
      </p>
    </div>
  );
}

function ReturnHook({ dealCount }: { dealCount: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/8 border border-purple-500/15">
      <Sun className="w-3.5 h-3.5 text-purple-400/70 shrink-0" />
      <p className="text-xs text-purple-400/80">
        New deals drop every morning at 8 AM.{' '}
        <span className="text-purple-300/90">{dealCount} live right now.</span>
      </p>
    </div>
  );
}
