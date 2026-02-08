'use client';

import { useState, useMemo } from 'react';
import { Heart, MapPin, Share2, ExternalLink } from 'lucide-react';
import type { Deal } from '@/types';
import { getBadge, getDistanceMiles, getDisplayName } from '@/utils';
import { getUserCoords } from './ftue';
import { DealBadge } from './badges/DealBadge';
import { ShareModal } from './modals/ShareModal';

interface DealCardProps {
  deal: Deal;
  isSaved: boolean;
  isUsed?: boolean;
  onSave: () => void;
  onClick: () => void;
}

export function DealCard({ deal, isSaved, isUsed = false, onSave, onClick }: DealCardProps) {
  const [showShare, setShowShare] = useState(false);

  const badge = getBadge(deal);
  const discountPercent = deal.original_price && deal.original_price > deal.deal_price
    ? Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)
    : 0;

  const distance = useMemo(() => {
    const userCoords = getUserCoords();
    if (!userCoords) return null;
    return getDistanceMiles(
      userCoords.lat,
      userCoords.lng,
      deal.dispensary.latitude,
      deal.dispensary.longitude,
    );
  }, [deal.dispensary.latitude, deal.dispensary.longitude]);

  return (
    <div
      onClick={onClick}
      className={`group glass frost rounded-xl p-4 cursor-pointer transition-gentle ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(99,115,171,0.22)] hover:bg-[rgba(28,35,56,0.8)]'
      }`}
    >
      {/* Top row: badge + actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {badge && <DealBadge type={badge} />}
          {isUsed && (
            <span className="text-[10px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">
              Used
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShare(true);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-slate-500 hover:text-purple-400 hover:bg-purple-500/10"
            aria-label="Share deal"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isSaved
                ? 'bg-purple-500/10 text-purple-400'
                : 'text-slate-500 hover:text-purple-400 hover:bg-purple-500/10'
            }`}
            aria-label={isSaved ? 'Remove from saved' : 'Save deal'}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Brand */}
      <p className="text-[11px] sm:text-xs text-purple-400 uppercase tracking-wide font-bold mb-1">
        {deal.brand?.name || 'Unknown'}
      </p>

      {/* Product name */}
      <h3 className="text-[13px] sm:text-sm font-medium text-slate-100 mb-1 line-clamp-2">
        {getDisplayName(deal.product_name, deal.brand?.name || '')}
      </h3>

      {/* Weight + Category */}
      <p className="text-[10px] text-slate-500 mb-3">
        {deal.weight && <>{deal.weight} &bull; </>}
        {deal.product_subtype === 'infused_preroll' ? 'Infused Pre-Roll'
          : deal.product_subtype === 'preroll_pack' ? 'Pre-Roll Pack'
          : deal.category.charAt(0).toUpperCase() + deal.category.slice(1)}
      </p>

      {/* Price */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg sm:text-xl font-mono font-bold text-white">${deal.deal_price}</span>
          {deal.original_price && deal.original_price > deal.deal_price && (
            <span className="text-[10px] text-slate-500 line-through">${deal.original_price}</span>
          )}
          {discountPercent > 0 && (
            <span className="text-[10px] font-semibold text-emerald-400">
              -{discountPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Footer: Dispensary + Distance + Get Deal */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0">
          <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
          <span className="truncate">{deal.dispensary?.name || 'Unknown'}</span>
          {distance != null && (
            <span className="text-slate-600 shrink-0">{distance.toFixed(1)} mi</span>
          )}
        </div>
        <a
          href={deal.product_url || deal.dispensary?.menu_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
        >
          Get Deal
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* Watermark for screenshots */}
      <p className="text-[8px] text-slate-700 text-right mt-2 select-none">found on cloudeddeals.com</p>

      {showShare && (
        <ShareModal deal={deal} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
