'use client';

import { useMemo } from 'react';
import { Heart, MapPin, X } from 'lucide-react';
import type { Deal } from '@/types';
import { getDistanceMiles, getDisplayName, getPricePerUnit } from '@/utils';
import { getUserCoords } from './ftue';

interface DealCardProps {
  deal: Deal;
  isSaved: boolean;
  isUsed?: boolean;
  isExpired?: boolean;
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

export function DealCard({ deal, isSaved, isUsed = false, isExpired = false, onSave, onDismiss, onClick, distanceLabel }: DealCardProps) {
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
    : deal.product_subtype === 'disposable' ? 'Disposable Vape'
    : deal.product_subtype === 'cartridge' ? 'Vape Cartridge'
    : deal.product_subtype === 'pod' ? 'Vape Pod'
    : categoryLabels[deal.category] || deal.category.charAt(0).toUpperCase() + deal.category.slice(1);

  return (
    <div
      onClick={onClick}
      className={`group glass frost rounded-2xl p-3 sm:p-4 xl:p-5 cursor-pointer transition-gentle card-interactive h-full flex flex-col ${
        isExpired ? 'opacity-50 saturate-[0.6]' : ''
      } ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(120,100,200,0.2)] hover:bg-[rgba(22,28,52,0.85)]'
      }`}
    >
      {/* Top row: brand + save */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1 sm:mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-[10px] sm:text-[13px] text-purple-400 uppercase tracking-wide font-bold truncate">
            {deal.brand?.name || 'Unknown'}
          </span>
          {isUsed && (
            <span className="text-[11px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">
              Used
            </span>
          )}
          {isExpired && (
            <span className="text-[11px] font-medium text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded-md">
              Yesterday
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`min-w-[44px] min-h-[44px] -mt-2 -mr-2 rounded-lg flex items-center justify-center transition-all shrink-0 ${
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
      <h3 className="text-xs sm:text-sm font-medium text-slate-100 mb-0.5 sm:mb-1 line-clamp-2 leading-snug">
        {getDisplayName(deal.product_name, deal.brand?.name || '')}
      </h3>

      {/* Category + Strain Type + Weight */}
      <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mb-2 sm:mb-3">
        {categoryLabel}
        {deal.strain_type && (
          <span className={`ml-1 font-medium ${
            deal.strain_type === 'Indica' ? 'text-purple-400/70' :
            deal.strain_type === 'Sativa' ? 'text-amber-400/70' :
            'text-emerald-400/70'
          }`}>
            ({deal.strain_type === 'Indica' ? 'I' : deal.strain_type === 'Sativa' ? 'S' : 'H'})
          </span>
        )}
        {deal.weight && <> &middot; {deal.weight}</>}
      </p>

      {/* Spacer to push price + footer to bottom */}
      <div className="flex-1 min-h-[4px]" />

      {/* Price — sale price only, big and clean */}
      <div className="mb-2 sm:mb-3 flex items-baseline gap-1.5">
        <span className="text-base sm:text-xl font-mono font-bold text-white" style={{ textShadow: '0 0 12px rgba(168, 85, 247, 0.15)' }}>${deal.deal_price}</span>
        {deal.category === 'flower' && (() => {
          const ppg = getPricePerUnit(deal);
          return ppg ? <span className="text-[10px] text-slate-500 font-medium">{ppg}</span> : null;
        })()}
      </div>

      {/* Footer: Dispensary + Distance + Dismiss */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-slate-400 min-w-0">
          <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />
          <span className="truncate">{deal.dispensary?.name || 'Unknown'}</span>
          {(distanceLabel || distance != null) && (
            <span className="text-slate-500 shrink-0">{distanceLabel || `${distance!.toFixed(1)} mi`}</span>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-2 min-w-[44px] min-h-[44px] -mr-2 -mb-1 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-colors shrink-0 flex items-center justify-center"
            aria-label="Dismiss deal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Watermark for screenshots */}
      <p className="text-[8px] sm:text-[9px] text-slate-600 text-right mt-1 sm:mt-2 select-none">found on cloudeddeals.com</p>
    </div>
  );
}
