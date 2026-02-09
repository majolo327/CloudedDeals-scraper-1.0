'use client';

import { useState, useMemo } from 'react';
import { Heart, MapPin, X } from 'lucide-react';
import type { Deal } from '@/types';
import { getDistanceMiles, getDisplayName } from '@/utils';
import { getUserCoords } from './ftue';
import { ShareModal } from './modals/ShareModal';

interface DealCardProps {
  deal: Deal;
  isSaved: boolean;
  isUsed?: boolean;
  onSave: () => void;
  onDismiss?: () => void;
  onClick: () => void;
  distanceLabel?: string;
}

const categoryLabels: Record<string, string> = {
  flower: 'Flower',
  vape: 'Vape',
  edible: 'Edible',
  concentrate: 'Concentrate',
  preroll: 'Pre-Roll',
};

export function DealCard({ deal, isSaved, isUsed = false, onSave, onDismiss, onClick, distanceLabel }: DealCardProps) {
  const [showShare, setShowShare] = useState(false);

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

  const categoryLabel = deal.product_subtype === 'infused_preroll' ? 'Infused Pre-Roll'
    : deal.product_subtype === 'preroll_pack' ? 'Pre-Roll Pack'
    : categoryLabels[deal.category] || deal.category.charAt(0).toUpperCase() + deal.category.slice(1);

  return (
    <div
      data-coach="deal-card"
      onClick={onClick}
      className={`group glass frost rounded-xl p-4 cursor-pointer transition-gentle card-interactive ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(99,115,171,0.22)] hover:bg-[rgba(28,35,56,0.8)]'
      }`}
    >
      {/* Top row: brand + save */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] sm:text-xs text-purple-400 uppercase tracking-wide font-bold truncate">
            {deal.brand?.name || 'Unknown'}
          </span>
          {isUsed && (
            <span className="text-[10px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">
              Used
            </span>
          )}
        </div>
        <button
          data-coach="save-button"
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
            isSaved
              ? 'bg-purple-500/10 text-purple-400'
              : 'text-slate-500 hover:text-purple-400 hover:bg-purple-500/10'
          }`}
          aria-label={isSaved ? 'Remove from saved' : 'Save deal'}
        >
          <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Product name */}
      <h3 className="text-[13px] sm:text-sm font-medium text-slate-100 mb-1 line-clamp-2">
        {getDisplayName(deal.product_name, deal.brand?.name || '')}
      </h3>

      {/* Category + Weight */}
      <p className="text-[10px] text-slate-500 mb-3">
        {categoryLabel}
        {deal.weight && <> &middot; {deal.weight}</>}
      </p>

      {/* Price — sale price only, big and clean */}
      <div className="mb-3">
        <span className="text-lg sm:text-xl font-mono font-bold text-white">${deal.deal_price}</span>
      </div>

      {/* Footer: Dispensary + Distance + Dismiss */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0">
          <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
          <span className="truncate">{deal.dispensary?.name || 'Unknown'}</span>
          {(distanceLabel || distance != null) && (
            <span className="text-slate-600 shrink-0">{distanceLabel || `${distance!.toFixed(1)} mi`}</span>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-400 hover:bg-white/5 transition-colors shrink-0"
            aria-label="Dismiss deal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Watermark for screenshots */}
      <p className="text-[8px] text-slate-700 text-right mt-2 select-none">found on cloudeddeals.com</p>

      {showShare && (
        <ShareModal deal={deal} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
