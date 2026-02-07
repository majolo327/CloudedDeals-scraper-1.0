'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, X, MapPin, Sparkles, Info, Zap } from 'lucide-react';
import type { Deal } from '@/types';
import { getBadge, getPricePerUnit, isJustDropped } from '@/utils';
import { DealBadge } from '../badges/DealBadge';
import type { RecommendationReason } from '@/lib/personalization';
import { getRecommendationText } from '@/lib/personalization';

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
  // Personalization props
  isRecommended?: boolean;
  recommendationReason?: RecommendationReason | null;
  personalizationScore?: number;
}

const categoryLabels: Record<string, string> = {
  flower: 'Flower',
  vape: 'Vape',
  edible: 'Edible',
  concentrate: 'Conc.',
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
  recommendationReason,
  personalizationScore,
}: CompactDealCardProps) {
  const [heartPulse, setHeartPulse] = useState(false);
  const [saveGlow, setSaveGlow] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const prevSavedRef = useRef(isSaved);

  const reasonText = getRecommendationText(recommendationReason ?? null);
  const pricePerUnit = getPricePerUnit(deal);
  const justDropped = isJustDropped(deal);

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

  return (
    <div
      onClick={onClick}
      className={`relative glass frost rounded-xl p-4 cursor-pointer transition-gentle min-h-[160px] flex flex-col ${getAnimationClass()} ${
        saveGlow ? 'animate-save-glow' : ''
      } ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(99,115,171,0.22)] hover:bg-[rgba(28,35,56,0.8)]'
      }`}
    >
      {showSparkle && (
        <div className="absolute top-2 left-2 animate-sparkle">
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
      )}

      {/* Recommended badge */}
      {isRecommended && !showSparkle && (
        <div className="absolute top-2 left-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(!showTooltip);
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30"
          >
            <Sparkles className="w-2 h-2" />
            <span>For You</span>
          </button>
          {showTooltip && reasonText && (
            <div
              className="absolute z-50 top-full left-0 mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 shadow-xl whitespace-nowrap animate-in fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5">
                <Info className="w-2.5 h-2.5 text-purple-400" />
                <span className="text-[10px] text-slate-200">{reasonText}</span>
              </div>
              {personalizationScore !== undefined && (
                <div className="mt-0.5 text-[8px] text-slate-500">
                  Match: {personalizationScore}%
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top row: brand + badge | dismiss */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {(() => { const badge = getBadge(deal); return badge ? <DealBadge type={badge} compact /> : null; })()}
          <span className="text-[10px] text-purple-400 uppercase tracking-wider font-bold truncate">
            {deal.brand.name}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1.5 -mt-1 -mr-1.5 rounded text-slate-600 hover:text-slate-400 transition-colors shrink-0"
          title="Pass"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Product name */}
      <h3 className="text-[12px] sm:text-[13px] font-semibold text-slate-100 truncate leading-snug">
        {deal.product_name}
      </h3>

      {/* Weight + Category */}
      <p className="text-[10px] text-slate-500 mt-0.5">
        {deal.weight} &middot; {categoryLabels[deal.category] || deal.category}
      </p>

      {/* Spacer */}
      <div className="flex-1 min-h-[12px]" />

      {/* Price row */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold font-mono text-purple-400">
              ${deal.deal_price}
            </span>
            {deal.original_price && deal.original_price > deal.deal_price && (
              <span className="text-[10px] text-slate-600 line-through">
                ${deal.original_price}
              </span>
            )}
          </div>
          {pricePerUnit && (
            <p className="text-[8px] text-slate-500 mt-0.5">{pricePerUnit}</p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`p-2 rounded-lg transition-all ${
            isSaved
              ? 'text-purple-400 bg-purple-500/15'
              : 'text-slate-500 hover:text-purple-400 hover:bg-purple-500/10'
          }`}
          title={isSaved ? 'Saved' : 'Save'}
        >
          <Heart
            className={`w-4 h-4 ${isSaved ? 'fill-current' : ''} ${
              heartPulse ? 'animate-heart-pulse' : ''
            }`}
          />
        </button>
      </div>

      {/* Footer: dispensary + indicators */}
      <div className="flex items-center justify-between gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(99, 115, 171, 0.06)' }}>
        <div className="flex items-center gap-1 min-w-0">
          <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-600" />
          <span className="text-[9px] text-slate-500 truncate">{deal.dispensary.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {justDropped && (
            <span className="flex items-center gap-0.5 text-[8px] text-cyan-400">
              <Zap className="w-2 h-2" />
              <span>New</span>
            </span>
          )}
          {(deal.save_count ?? 0) > 0 && (
            <span className="text-[8px] text-slate-500">
              {deal.save_count} saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
