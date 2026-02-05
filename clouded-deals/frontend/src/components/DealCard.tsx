'use client';

import { useState } from 'react';
import { Heart, BadgeCheck, Star, MapPin, CheckCircle, Clock, Share2 } from 'lucide-react';
import type { Deal } from '@/types';
import { isFreshDeal } from '@/lib/socialProof';
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
          {deal.is_staff_pick && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-400">
              <Star className="w-2.5 h-2.5 fill-current" />
              Staff Pick
            </span>
          )}
          {deal.is_featured && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400">
              <Star className="w-2.5 h-2.5 fill-current" />
              Featured
            </span>
          )}
          {/* Hot deal - many saves */}
          {(deal.save_count ?? 0) >= 10 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-orange-500/10 text-orange-400">
              🔥 {deal.save_count} grabbed
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
        {deal.original_price && (
          <span className="text-[10px] text-slate-500 line-through">${deal.original_price}</span>
        )}
      </div>

      {/* Footer: Dispensary */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
        <span className="truncate">{deal.dispensary?.name || 'Unknown Dispensary'}</span>
      </div>

      {showShare && (
        <ShareModal deal={deal} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
