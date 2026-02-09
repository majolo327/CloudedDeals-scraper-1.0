'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, DollarSign, Trash2, Clock, Share2, Check, Sun } from 'lucide-react';
import { useSavedDeals } from '@/hooks/useSavedDeals';
import { getDiscountPercent, getDisplayName } from '@/utils';
import { createShareLink } from '@/lib/share';
import { trackEvent } from '@/lib/analytics';
import type { Deal } from '@/types';

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
}

export function SavedPage({ deals, onSelectDeal }: SavedPageProps) {
  const { savedDeals, toggleSavedDeal, isDealUsed, markDealUsed } = useSavedDeals();
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle');

  const savedDealsList = deals.filter((d) => savedDeals.has(d.id));
  const usedDeals = savedDealsList.filter((d) => isDealUsed(d.id));
  const activeDeals = savedDealsList.filter((d) => !isDealUsed(d.id));

  const potentialSavings = activeDeals.reduce((sum, deal) => {
    if (!deal.original_price || deal.original_price <= deal.deal_price) return sum;
    return sum + (deal.original_price - deal.deal_price);
  }, 0);

  const handleShare = useCallback(async () => {
    if (activeDeals.length === 0) return;
    setShareState('sharing');

    const dealIds = activeDeals.map((d) => d.id);
    const result = await createShareLink(dealIds);

    if (result.error || !result.shareUrl) {
      setShareState('idle');
      return;
    }

    trackEvent('share_saves', undefined, {
      deal_count: dealIds.length,
      share_id: result.shareId,
    });

    const shareData = {
      title: `${activeDeals.length} deals I found on CloudedDeals`,
      text: `Check out these ${activeDeals.length} cannabis deals in Las Vegas — they expire tonight!`,
      url: result.shareUrl,
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
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        setShareState('copied');
      } catch {
        setShareState('idle');
        return;
      }
    }

    setTimeout(() => setShareState('idle'), 2500);
  }, [activeDeals]);

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
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Expiry urgency with hours + minutes */}
        {activeDeals.length > 0 && <ExpiryBanner />}

        {/* Active saved deals */}
        {activeDeals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Active Deals</h2>
            <div className="space-y-2">
              {activeDeals.map((deal) => (
                <SavedDealCard
                  key={deal.id}
                  deal={deal}
                  onRemove={() => toggleSavedDeal(deal.id)}
                  onMarkUsed={() => markDealUsed(deal.id)}
                  onClick={onSelectDeal ? () => onSelectDeal(deal) : undefined}
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

        {/* Return hook — tomorrow's deals */}
        {savedDealsList.length > 0 && <ReturnHook dealCount={deals.length} />}

        {/* Empty state */}
        {savedDealsList.length === 0 && (
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
}: {
  deal: Deal;
  isUsed?: boolean;
  onRemove: () => void;
  onMarkUsed?: () => void;
  onClick?: () => void;
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
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">{deal.weight}</span>
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
