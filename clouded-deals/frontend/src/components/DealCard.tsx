'use client';

import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Heart, MapPin, X, Share, ExternalLink, Navigation } from 'lucide-react';
import type { Deal } from '@/types';
import { getDistanceMiles, getDisplayName, getPricePerUnit, getMapsUrl } from '@/utils';
import { getUserCoords } from './ftue';
import { hapticMedium } from '@/lib/haptics';
import { trackGetDealClick } from '@/lib/analytics';

interface DealCardProps {
  deal: Deal;
  isSaved: boolean;
  isUsed?: boolean;
  isExpired?: boolean;
  onSave: () => void;
  onDismiss?: () => void;
  onClick: () => void;
  distanceLabel?: string;
  /** Shown as a subtle personalization signal, e.g. "For You" or "Your brand" */
  recommendationLabel?: string;
  /** Whether this deal was seen in a previous session */
  seenBefore?: boolean;
}

const categoryLabels: Record<string, string> = {
  flower: 'Flower',
  vape: 'Vape',
  edible: 'Edible',
  concentrate: 'Concentrate',
  preroll: 'Pre-Roll',
};

export const DealCard = memo(function DealCard({ deal, isSaved, isUsed = false, isExpired = false, onSave, onDismiss, onClick, distanceLabel, recommendationLabel, seenBefore = false }: DealCardProps) {
  // Long-press quick actions
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStartLP = useCallback((e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      hapticMedium();
      setQuickActionsOpen(true);
    }, 500);
  }, []);

  const handleTouchMoveLP = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const dx = e.touches[0].clientX - touchStartPos.current.x;
    const dy = e.touches[0].clientY - touchStartPos.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEndLP = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Quick actions: Escape to close + auto-focus first button
  const firstActionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!quickActionsOpen) return;
    firstActionRef.current?.focus();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setQuickActionsOpen(false); }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [quickActionsOpen]);

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
      onClick={quickActionsOpen ? undefined : onClick}
      onTouchStart={handleTouchStartLP}
      onTouchMove={handleTouchMoveLP}
      onTouchEnd={handleTouchEndLP}
      className={`group glass frost rounded-2xl p-3 sm:p-4 xl:p-5 cursor-pointer transition-gentle card-interactive h-full flex flex-col relative ${
        isExpired ? 'opacity-50 saturate-[0.6]' : ''
      } ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(120,100,200,0.2)] hover:bg-[rgba(22,28,52,0.85)]'
      }`}
    >
      {/* Long-press quick actions overlay */}
      {quickActionsOpen && (
        <>
          <div className="fixed inset-0 z-[90]" aria-hidden="true" onClick={(e) => { e.stopPropagation(); setQuickActionsOpen(false); }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Quick actions"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] flex gap-2 p-2 rounded-2xl animate-in fade-in zoom-in-95 duration-150"
            style={{ backgroundColor: 'rgba(12, 14, 28, 0.95)', border: '1px solid rgba(120, 100, 200, 0.15)', backdropFilter: 'blur(20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={firstActionRef}
              onClick={(e) => { e.stopPropagation(); onSave(); setQuickActionsOpen(false); }}
              className="flex flex-col items-center gap-1 p-3 min-w-[60px] rounded-xl hover:bg-white/5 transition-colors"
              aria-label={isSaved ? 'Unsave' : 'Save'}
            >
              <Heart className={`w-5 h-5 ${isSaved ? 'text-purple-400 fill-current' : 'text-slate-400'}`} />
              <span className="text-[10px] text-slate-400">{isSaved ? 'Saved' : 'Save'}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/deal/${deal.id}`;
                if (navigator.share) {
                  navigator.share({ title: deal.product_name, url }).catch(() => {
                    navigator.clipboard.writeText(url).then(() => {
                      window.dispatchEvent(new CustomEvent('clouded:toast', { detail: { message: 'Link copied!', type: 'success' } }));
                    });
                  });
                } else {
                  navigator.clipboard.writeText(url).then(() => {
                    window.dispatchEvent(new CustomEvent('clouded:toast', { detail: { message: 'Link copied!', type: 'success' } }));
                  });
                }
                setQuickActionsOpen(false);
              }}
              className="flex flex-col items-center gap-1 p-3 min-w-[60px] rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Share"
            >
              <Share className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] text-slate-400">Share</span>
            </button>
            <a
              href={deal.product_url || deal.dispensary?.menu_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); trackGetDealClick(deal.id, deal.dispensary?.name || '', deal.product_url || deal.dispensary?.menu_url || ''); setQuickActionsOpen(false); }}
              className="flex flex-col items-center gap-1 p-3 min-w-[60px] rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Get deal"
            >
              <ExternalLink className="w-5 h-5 text-purple-400" />
              <span className="text-[10px] text-purple-400">Get Deal</span>
            </a>
            {deal.dispensary?.address && (
              <a
                href={getMapsUrl(deal.dispensary.address)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.stopPropagation(); setQuickActionsOpen(false); }}
                className="flex flex-col items-center gap-1 p-3 min-w-[60px] rounded-xl hover:bg-white/5 transition-colors"
                aria-label="Get directions"
              >
                <Navigation className="w-5 h-5 text-slate-400" />
                <span className="text-[10px] text-slate-400">Directions</span>
              </a>
            )}
          </div>
        </>
      )}
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
          {recommendationLabel && !isExpired && !isUsed && (
            <span className="text-[10px] font-medium text-purple-300/80 bg-purple-500/10 px-1.5 py-0.5 rounded-md">
              {recommendationLabel}
            </span>
          )}
          {seenBefore && !isUsed && !isExpired && !recommendationLabel && (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" title="Seen before" />
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
        <span className="text-base sm:text-xl font-mono font-bold text-white" style={{ textShadow: '0 0 12px rgba(168, 85, 247, 0.15)' }}>${Number(deal.deal_price).toFixed(2)}</span>
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
            className="p-2 min-w-[44px] min-h-[44px] -mr-2 -mb-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0 flex items-center justify-center"
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
}, (prev, next) => (
  prev.deal.id === next.deal.id &&
  prev.isSaved === next.isSaved &&
  prev.isUsed === next.isUsed &&
  prev.isExpired === next.isExpired &&
  prev.seenBefore === next.seenBefore &&
  prev.distanceLabel === next.distanceLabel &&
  prev.recommendationLabel === next.recommendationLabel
));
