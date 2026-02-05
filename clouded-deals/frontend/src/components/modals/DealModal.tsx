'use client';

import { useEffect, useState } from 'react';
import { X, Heart, BadgeCheck, Star, MapPin, ExternalLink, MessageCircle, CheckCircle } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { AccuracyModal } from './AccuracyModal';
import type { Deal } from '@/types';

interface DealModalProps {
  deal: Deal;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  isUsed?: boolean;
  onMarkUsed?: () => void;
  onAccuracyFeedback?: (accurate: boolean) => void;
}

function formatShareText(deal: Deal, url: string): string {
  return `${deal.brand?.name || ''} — ${deal.product_name}
$${deal.deal_price}${deal.original_price ? ` (was $${deal.original_price})` : ''}
${deal.dispensary?.name || 'Unknown'} — Las Vegas
${url}`;
}

export function DealModal({
  deal,
  onClose,
  isSaved,
  onToggleSave,
  isUsed = false,
  onMarkUsed,
  onAccuracyFeedback,
}: DealModalProps) {
  const savings = (deal.original_price || deal.deal_price) - deal.deal_price;
  const savingsPercent = deal.original_price ? Math.round((savings / deal.original_price) * 100) : 0;
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAccuracyModal, setShowAccuracyModal] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleMarkUsed = () => {
    if (onMarkUsed) {
      onMarkUsed();
      setShowAccuracyModal(true);
    }
  };

  const handleAccuracyResponse = (accurate: boolean) => {
    if (onAccuracyFeedback) {
      onAccuracyFeedback(accurate);
    }
    setShowAccuracyModal(false);
  };

  const handleShare = () => {
    const params = new URLSearchParams({
      utm_source: 'share',
      utm_medium: 'direct',
      utm_campaign: 'deal_share',
      utm_content: deal.id,
    });
    const shareUrl = `${window.location.origin}/deal/${deal.id}?${params.toString()}`;
    const shareText = formatShareText(deal, shareUrl);

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `${deal.brand?.name || ''} ${deal.product_name}`,
        text: shareText,
        url: shareUrl,
      }).catch(() => setShowShareModal(true));
    } else {
      setShowShareModal(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-soft-reveal" />
      <div
        className="relative w-full sm:max-w-lg glass-strong frost rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(7rem, env(safe-area-inset-bottom, 0px) + 4rem)' }}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="p-4 sm:p-6">
          {/* Header badges + close */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {deal.is_verified && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              )}
              {deal.is_top_pick && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Top Pick
                </span>
              )}
              {deal.is_staff_pick && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                  Staff Pick
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 sm:w-9 sm:h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all -mr-1 sm:-mr-2 -mt-1 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Brand + Product name */}
          <p className="text-sm text-slate-400 mb-1">{deal.brand?.name || 'Unknown Brand'}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{deal.product_name}</h3>

          {/* Category + Weight pills */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300 capitalize">
              {deal.category}
            </span>
            {deal.weight && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300">
                {deal.weight}
              </span>
            )}
          </div>

          {/* Price card */}
          <div className="glass-subtle frost rounded-xl p-4 sm:p-5 mb-6">
            <div className="flex items-baseline gap-2 sm:gap-3 mb-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold text-purple-400">${deal.deal_price}</span>
              {deal.original_price && (
                <span className="text-lg sm:text-xl text-slate-500 line-through">${deal.original_price}</span>
              )}
              {savingsPercent > 0 && (
                <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-purple-500/15 text-purple-400">
                  -{savingsPercent}%
                </span>
              )}
            </div>
            {savings > 0 && (
              <p className="text-sm sm:text-base text-purple-400/80 font-medium">You save ${savings.toFixed(2)}</p>
            )}
          </div>

          {/* Dispensary card */}
          <div className="glass-subtle frost rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{deal.dispensary?.name || 'Unknown Dispensary'}</p>
                <p className="text-sm text-slate-400 truncate">{deal.dispensary?.address || 'Las Vegas, NV'}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleShare}
                className="py-3 sm:py-3.5 px-3 sm:px-4 min-h-[48px] min-w-[48px] rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-white/5 text-white hover:bg-white/10"
                title="Share this deal"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={onToggleSave}
                className={`flex-1 py-3 sm:py-3.5 min-h-[48px] rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  isSaved
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                    : 'bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                <span className="text-sm sm:text-base">{isSaved ? 'Saved' : 'Save'}</span>
              </button>
              <a
                href={deal.dispensary?.menu_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 sm:py-3.5 min-h-[48px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                <span className="text-sm sm:text-base">Get Deal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {isSaved && onMarkUsed && (
              <button
                onClick={handleMarkUsed}
                disabled={isUsed}
                className={`w-full py-3 sm:py-3.5 min-h-[48px] rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  isUsed
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20 cursor-default'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <CheckCircle className={`w-5 h-5 ${isUsed ? 'fill-green-500/30' : ''}`} />
                <span className="text-sm sm:text-base">{isUsed ? 'Used' : 'Mark as Used'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareModal deal={deal} onClose={() => setShowShareModal(false)} />
      )}
      <AccuracyModal isOpen={showAccuracyModal} onClose={handleAccuracyResponse} />
    </div>
  );
}
