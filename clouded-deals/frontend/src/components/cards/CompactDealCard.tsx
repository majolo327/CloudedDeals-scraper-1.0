'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Heart, X, MapPin, Sparkles } from 'lucide-react';
import type { Deal } from '@/types';
import { getDistanceMiles, getDisplayName } from '@/utils';
import { getUserCoords } from '../ftue';
import { HeatIndicator } from '../HeatIndicator';
import { getDealHeat } from '@/utils/dealHeat';
import type { RecommendationReason } from '@/lib/personalization';

interface CompactDealCardProps {
  deal: Deal;
  isSaved: boolean;
  isDismissing: boolean;
  isAppearing?: boolean;
  showSparkle?: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onClick: () => void;
  onShare?: () => void;
  isRecommended?: boolean;
  recommendationReason?: RecommendationReason | null;
  personalizationScore?: number;
}

const categoryLabels: Record<string, string> = {
  flower: 'Flower',
  vape: 'Vape',
  edible: 'Edible',
  concentrate: 'Concentrate',
  preroll: 'Pre-Roll',
};

export function CompactDealCard({
  deal,
  isSaved,
  isDismissing,
  isAppearing = false,
  showSparkle = false,
  onSave,
  onDismiss,
  onClick,
  isRecommended = false,
}: CompactDealCardProps) {
  const [heartPulse, setHeartPulse] = useState(false);
  const [saveGlow, setSaveGlow] = useState(false);
  const prevSavedRef = useRef(isSaved);

  const heat = getDealHeat(deal);
  const distance = useMemo(() => {
    const userCoords = getUserCoords();
    if (!userCoords) return null;
    return getDistanceMiles(userCoords.lat, userCoords.lng, deal.dispensary.latitude, deal.dispensary.longitude);
  }, [deal.dispensary.latitude, deal.dispensary.longitude]);

  useEffect(() => {
    if (isSaved && !prevSavedRef.current) {
      setHeartPulse(true);
      setSaveGlow(true);
      const heartTimer = setTimeout(() => setHeartPulse(false), 200);
      const glowTimer = setTimeout(() => setSaveGlow(false), 400);
      return () => {
        clearTimeout(heartTimer);
        clearTimeout(glowTimer);
      };
    }
    prevSavedRef.current = isSaved;
  }, [isSaved]);

  const getAnimationClass = () => {
    if (isDismissing) return 'animate-soft-dismiss';
    if (isAppearing) return 'animate-soft-reveal';
    return '';
  };

  const categoryLabel = deal.product_subtype === 'infused_preroll' ? 'Infused Pre-Roll'
    : deal.product_subtype === 'preroll_pack' ? 'Pre-Roll Pack'
    : categoryLabels[deal.category] || deal.category;

  return (
    <div
      data-coach="deal-card"
      onClick={onClick}
      className={`relative glass frost rounded-xl p-4 cursor-pointer transition-gentle min-h-[170px] flex flex-col ${getAnimationClass()} ${
        saveGlow ? 'animate-save-glow' : ''
      } ${
        isRecommended ? 'border-l-2 border-l-purple-500/40' : ''
      } ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(99,115,171,0.22)] hover:bg-[rgba(28,35,56,0.8)]'
      }`}
    >
      {showSparkle && (
        <div className="absolute top-2 right-10 animate-sparkle">
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
      )}

      {/* Top row: heat + brand | save heart */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <HeatIndicator heat={heat} compact />
          <span className="text-[10px] text-purple-400 uppercase tracking-wider font-bold truncate">
            {deal.brand.name}
          </span>
        </div>
        <button
          data-coach="save-button"
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`p-1.5 -mt-1 -mr-1.5 rounded-lg transition-all shrink-0 ${
            isSaved
              ? 'text-purple-400 bg-purple-500/15'
              : 'text-slate-600 hover:text-purple-400 hover:bg-purple-500/10'
          }`}
          title={isSaved ? 'Saved' : 'Save deal'}
        >
          <Heart
            className={`w-4 h-4 ${isSaved ? 'fill-current' : ''} ${
              heartPulse ? 'animate-heart-pulse' : ''
            }`}
          />
        </button>
      </div>

      {/* Product name */}
      <h3 className="text-[12px] sm:text-[13px] font-semibold text-slate-100 line-clamp-2 leading-snug mb-0.5">
        {getDisplayName(deal.product_name, deal.brand.name)}
      </h3>

      {/* Category + Weight */}
      <p className="text-[10px] text-slate-500">
        {categoryLabel}
        {deal.weight && <> &middot; {deal.weight}</>}
      </p>

      {/* Spacer */}
      <div className="flex-1 min-h-[8px]" />

      {/* Price — sale price only */}
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-lg font-bold font-mono text-white">
          ${deal.deal_price}
        </span>
      </div>

      {/* Footer: dispensary + dismiss */}
      <div className="flex items-center justify-between gap-1 pt-2" style={{ borderTop: '1px solid rgba(99, 115, 171, 0.06)' }}>
        <div className="flex items-center gap-1 min-w-0">
          <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-600" />
          <span className="text-[9px] text-slate-500 truncate">{deal.dispensary.name}</span>
          {distance != null && (
            <span className="text-[9px] text-slate-600 shrink-0">{distance.toFixed(1)} mi</span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 rounded text-slate-700 hover:text-slate-400 transition-colors shrink-0"
          title="Pass"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
