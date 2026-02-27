'use client';

import { useEffect, useState } from 'react';
import { X, Heart, BadgeCheck, MapPin, ExternalLink, Share, CheckCircle, Navigation, Flag } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { AccuracyModal } from './AccuracyModal';
import { ReportDealModal } from './ReportDealModal';
import type { Deal } from '@/types';
import { getMapsUrl, getDisplayName } from '@/utils';
import { trackGetDealClick } from '@/lib/analytics';

interface DealModalProps {
  deal: Deal;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  isUsed?: boolean;
  onMarkUsed?: () => void;
  onAccuracyFeedback?: (accurate: boolean) => void;
  onDealReported?: () => void;
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
  onDealReported,
}: DealModalProps) {
  const savings = (deal.original_price || deal.deal_price) - deal.deal_price;
  const savingsPercent = deal.original_price ? Math.round((savings / deal.original_price) * 100) : 0;
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAccuracyModal, setShowAccuracyModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      window.scrollTo(0, scrollY);
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
      className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Deal details"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 animate-soft-reveal" style={{ WebkitBackdropFilter: 'blur(8px) saturate(1.2)', backdropFilter: 'blur(8px) saturate(1.2)' }} />
      <div
        className="relative w-full sm:max-w-lg glass-strong frost rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="p-4 sm:p-6">
          {/* Header heat + close */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {deal.is_verified && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Top Pick
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 sm:w-9 sm:h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
              aria-label="Close deal details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Brand + Product name */}
          <p className="text-sm text-slate-400 mb-1">{deal.brand?.name || 'Unknown Brand'}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{getDisplayName(deal.product_name, deal.brand?.name || '')}</h3>

          {/* Category + Weight pills */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300 capitalize">
              {deal.product_subtype === 'infused_preroll' ? 'Infused Pre-Roll'
                : deal.product_subtype === 'preroll_pack' ? 'Pre-Roll Pack'
                : deal.product_subtype === 'disposable' ? 'Disposable Vape'
                : deal.product_subtype === 'cartridge' ? 'Vape Cartridge'
                : deal.product_subtype === 'pod' ? 'Vape Pod'
                : deal.category}
            </span>
            {deal.strain_type && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                deal.strain_type === 'Indica' ? 'bg-purple-500/10 text-purple-400' :
                deal.strain_type === 'Sativa' ? 'bg-amber-500/10 text-amber-400' :
                'bg-emerald-500/10 text-emerald-400'
              }`}>
                {deal.strain_type}
              </span>
            )}
            {deal.weight && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300">
                {deal.weight}
              </span>
            )}
          </div>

          {/* Price card */}
          <div className="glass-subtle frost rounded-2xl p-4 sm:p-5 mb-6">
            <div className="flex items-baseline gap-2 sm:gap-3 mb-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold text-purple-400" style={{ textShadow: '0 0 20px rgba(168, 85, 247, 0.2)' }}>${deal.deal_price}</span>
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
              <p className="text-sm sm:text-base text-purple-400/80 font-medium">You save ${savings.toFixed(2)} vs menu price</p>
            )}
          </div>

          {/* Dispensary card */}
          <div className="glass-subtle frost rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{deal.dispensary?.name || 'Unknown Dispensary'}</p>
                <p className="text-sm text-slate-400 truncate">{deal.dispensary?.address || 'Las Vegas, NV'}</p>
              </div>
            </div>
            {deal.dispensary?.address && (
              <a
                href={getMapsUrl(deal.dispensary.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full py-2.5 min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Get Directions
              </a>
            )}
          </div>

          {/* Watermark for screenshots */}
          <p className="text-[8px] text-slate-700 text-right mb-4 select-none">found on cloudeddeals.com</p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleShare}
                className="py-3 sm:py-3.5 px-3 sm:px-4 min-h-[48px] min-w-[48px] rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 bg-white/5 text-white hover:bg-white/10"
                aria-label="Share this deal"
              >
                <Share className="w-5 h-5" />
                <span className="text-sm">Share</span>
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="py-3 sm:py-3.5 px-3 sm:px-4 min-h-[48px] min-w-[48px] rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                aria-label="Flag this deal"
              >
                <Flag className="w-4 h-4" />
              </button>
              <button
                onClick={onToggleSave}
                className={`flex-1 py-3 sm:py-3.5 min-h-[48px] rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  isSaved
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                    : 'bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                <span className="text-sm sm:text-base">{isSaved ? 'Saved' : 'Save'}</span>
              </button>
              <a
                href={deal.product_url || deal.dispensary?.menu_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackGetDealClick(deal.id, deal.dispensary?.name || '', deal.product_url || deal.dispensary?.menu_url || '')}
                className="flex-1 py-3.5 sm:py-4 min-h-[48px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(139, 92, 246, 0.25)' }}
              >
                <span className="text-sm sm:text-base">Get This Deal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {isSaved && onMarkUsed && (
              <button
                onClick={handleMarkUsed}
                disabled={isUsed}
                className={`w-full py-3 sm:py-3.5 min-h-[48px] rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 ${
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
      <ReportDealModal
        deal={deal}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReported={onDealReported}
      />
    </div>
  );
}
