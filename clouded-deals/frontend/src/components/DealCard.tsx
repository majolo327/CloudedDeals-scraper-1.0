'use client';

import { useState } from 'react';
import { Heart, BadgeCheck, MapPin, CheckCircle, Clock, Share2, Users, ExternalLink } from 'lucide-react';
import type { Deal } from '@/types';
import { isFreshDeal } from '@/lib/socialProof';
import { getBadge } from '@/utils';
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
  return (
    <div
      onClick={onClick}
      className={`group glass frost rounded-xl p-4 cursor-pointer transition-all duration-300 ${
        isSaved
          ? 'card-saved'
          : 'hover:bg-slate-800/70 hover:border-white/10'
      }`}
    >
      {/* Badges row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isUsed && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400">
              <CheckCircle className="w-2.5 h-2.5" />
              Used
            </span>
          )}
          {deal.is_verified && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-400">
              <BadgeCheck className="w-2.5 h-2.5" />
              Verified
            </span>
          )}
          {(() => { const badge = getBadge(deal); return badge ? <DealBadge type={badge} /> : null; })()}
          {/* Save count */}
          {(deal.save_count ?? 0) > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-500/10 text-slate-400">
              <Users className="w-2.5 h-2.5" />
              {deal.save_count} saved
            </span>
          )}
          {/* Fresh deal */}
          {isFreshDeal(deal.created_at, 4) && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400">
              <Clock className="w-2.5 h-2.5" />
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShare(true);
            }}
            className="w-10 h-10 min-w-[44px] min-h-[44px] sm:w-8 sm:h-8 sm:min-w-0 sm:min-h-0 rounded-lg flex items-center justify-center transition-all text-slate-500 hover:text-purple-400 hover:bg-purple-500/10"
            aria-label="Share deal"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className={`w-10 h-10 min-w-[44px] min-h-[44px] sm:w-8 sm:h-8 sm:min-w-0 sm:min-h-0 rounded-lg flex items-center justify-center transition-all ${
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
        {deal.brand?.name || 'Unknown Brand'}
      </p>

      {/* Product name */}
      <h3 className="text-[13px] sm:text-sm font-medium text-slate-100 mb-1 line-clamp-1">
        {deal.product_name}
      </h3>

      {/* Weight + Category */}
      <p className="text-[10px] text-slate-500 mb-3">
        {deal.weight} &bull; {deal.category.charAt(0).toUpperCase() + deal.category.slice(1)}
      </p>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-base sm:text-lg font-mono font-bold text-purple-400">${deal.deal_price}</span>
        {deal.original_price && deal.original_price > deal.deal_price && (
          <>
            <span className="text-[10px] text-slate-500 line-through">${deal.original_price}</span>
            <span className="text-[10px] font-semibold text-emerald-400">
              -{Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)}%
            </span>
          </>
        )}
      </div>

      {/* Footer: Dispensary + Get Deal */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0">
          <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
          <span className="truncate">{deal.dispensary?.name || 'Unknown Dispensary'}</span>
        </div>
        <a
          href={deal.product_url || deal.dispensary?.menu_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center gap-1 px-2 py-1 min-h-[28px] rounded-md text-[10px] font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
        >
          Get Deal
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {showShare && (
        <ShareModal deal={deal} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
