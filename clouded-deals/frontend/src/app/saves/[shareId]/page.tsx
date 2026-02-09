'use client';

import { useState, useEffect, useMemo } from 'react';
import { Heart, Clock, ExternalLink, MapPin, Sun, ArrowRight } from 'lucide-react';
import { fetchSharedSaves } from '@/lib/share';
import { fetchDealsByIds } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { getDisplayName } from '@/utils';
import type { Deal } from '@/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const categoryLabels: Record<string, string> = {
  flower: 'Flower',
  vape: 'Vape',
  edible: 'Edible',
  concentrate: 'Concentrate',
  preroll: 'Pre-Roll',
};

export default function SharedSavesPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!shareId) return;

    trackEvent('shared_page_view', undefined, { share_id: shareId });

    (async () => {
      const shared = await fetchSharedSaves(shareId);
      if (!shared) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const expiryDate = new Date(shared.expires_at);
      setExpiresAt(expiryDate);

      if (expiryDate < new Date()) {
        setExpired(true);
        setLoading(false);
        return;
      }

      const dealData = await fetchDealsByIds(shared.deal_ids);
      setDeals(dealData);
      setLoading(false);
    })();
  }, [shareId]);

  const countdown = useMemo(() => {
    if (!expiresAt) return null;
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
  }, [expiresAt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading shared deals...</p>
        </div>
      </div>
    );
  }

  // Expired state — drive traffic back to app
  if (expired || notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-200 mb-3">
            {notFound ? 'Link not found' : 'These deals have expired'}
          </h1>
          <p className="text-slate-400 mb-8 max-w-sm mx-auto">
            {notFound
              ? "This share link doesn't exist or has been removed."
              : "Deals refresh every morning at 8 AM Pacific. Today's fresh deals are waiting for you."}
          </p>

          {/* Return hooks */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-500/8 border border-purple-500/15 text-left">
              <Sun className="w-4 h-4 text-purple-400/70 shrink-0" />
              <p className="text-sm text-purple-400/80">
                New deals drop every morning at 8 AM.
              </p>
            </div>
          </div>

          <Link
            href="/"
            onClick={() => trackEvent('shared_page_cta', undefined, { share_id: shareId, state: expired ? 'expired' : 'not_found' })}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25"
          >
            See Today&apos;s Deals
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-purple-500/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Clouded<span className="text-purple-400">Deals</span>
          </Link>
          <Link
            href="/"
            onClick={() => trackEvent('shared_page_cta', undefined, { share_id: shareId, state: 'active' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
          >
            See All Deals
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-purple-400 fill-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-200">
              {deals.length} Saved Deal{deals.length !== 1 ? 's' : ''}
            </h1>
            <p className="text-xs text-slate-500">Shared from CloudedDeals</p>
          </div>
        </div>

        {/* Expiry countdown */}
        {countdown && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
            <Clock className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
            <p className="text-xs text-amber-400/80">
              These deals expire in {countdown.hours}h {countdown.minutes}m &mdash; grab them before they&apos;re gone.
            </p>
          </div>
        )}

        {/* Deal cards */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <SharedDealCard
              key={deal.id}
              deal={deal}
              shareId={shareId}
            />
          ))}
        </div>

        {deals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No active deals found for this share link.</p>
          </div>
        )}

        {/* Return hook */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/8 border border-purple-500/15">
          <Sun className="w-3.5 h-3.5 text-purple-400/70 shrink-0" />
          <p className="text-xs text-purple-400/80">
            New deals drop every morning at 8 AM.{' '}
            <Link href="/" className="underline text-purple-300/90 hover:text-purple-200">
              Browse all deals
            </Link>
          </p>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-slate-800/50">
          <p className="text-xs text-slate-600 mb-3">
            Clouded Deals is not a licensed cannabis retailer. All deals are subject to dispensary verification.
            Prices shown do not include tax. For adults 21+ only. This is not medical advice.
          </p>
          <Link
            href="/"
            onClick={() => trackEvent('shared_page_cta', undefined, { share_id: shareId, state: 'footer' })}
            className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 font-medium"
          >
            Visit CloudedDeals
            <ArrowRight className="w-3 h-3" />
          </Link>
        </footer>
      </main>
    </div>
  );
}

function SharedDealCard({ deal, shareId }: { deal: Deal; shareId: string }) {
  const handleGetDeal = () => {
    trackEvent('shared_get_deal_click', deal.id, {
      share_id: shareId,
      dispensary: deal.dispensary.name,
      brand: deal.brand.name,
      category: deal.category,
    });
    if (deal.product_url) {
      window.open(deal.product_url, '_blank', 'noopener,noreferrer');
    }
  };

  const categoryLabel = categoryLabels[deal.category] || deal.category;

  return (
    <div className="glass frost rounded-xl p-4">
      {/* Brand */}
      <span className="text-[11px] text-purple-400 uppercase tracking-wide font-bold">
        {deal.brand?.name || 'Unknown'}
      </span>

      {/* Product name */}
      <h3 className="text-[13px] sm:text-sm font-medium text-slate-100 mt-1 mb-1 line-clamp-2">
        {getDisplayName(deal.product_name, deal.brand?.name || '')}
      </h3>

      {/* Category + Weight */}
      <p className="text-[10px] text-slate-500 mb-3">
        {categoryLabel}
        {deal.weight && <> &middot; {deal.weight}</>}
      </p>

      {/* Price */}
      <div className="mb-3">
        <span className="text-lg font-mono font-bold text-white">${deal.deal_price}</span>
        {deal.original_price && deal.original_price > deal.deal_price && (
          <span className="ml-2 text-sm text-slate-500 line-through">${deal.original_price}</span>
        )}
      </div>

      {/* Footer: Dispensary + Get Deal */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0">
          <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
          <span className="truncate">{deal.dispensary?.name || 'Unknown'}</span>
        </div>
        {deal.product_url && (
          <button
            onClick={handleGetDeal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors shrink-0"
          >
            Get Deal
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
