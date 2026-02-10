'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, MessageCircle, Check, Link, Send } from 'lucide-react';
import type { Deal } from '@/types';
import { trackEvent, getOrCreateAnonId } from '@/lib/analytics';

interface ShareModalProps {
  deal: Deal;
  onClose: () => void;
}

function buildShareUrl(deal: Deal): string {
  if (typeof window === 'undefined') return '';
  const anonId = getOrCreateAnonId();
  const base = `${window.location.origin}/deal/${deal.id}`;
  const params = new URLSearchParams({
    utm_source: 'share',
    utm_medium: 'direct',
    utm_campaign: 'deal_share',
    utm_content: deal.id,
    ...(anonId ? { ref: anonId } : {}),
  });
  return `${base}?${params.toString()}`;
}

function buildShareText(deal: Deal, url: string): string {
  const product = deal.brand?.name
    ? `${deal.brand.name} ${deal.product_name}`
    : deal.product_name;
  const dispensary = deal.dispensary?.name || 'Las Vegas';
  return `${product} for $${deal.deal_price} at ${dispensary}. Found it on Clouded Deals \u2192 ${url}`;
}

export function ShareModal({ deal, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = buildShareUrl(deal);
  const shareText = buildShareText(deal, shareUrl);

  const discount = deal.original_price
    ? Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)
    : 0;

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

  const handleTrack = useCallback((method: 'copy' | 'sms' | 'whatsapp') => {
    trackEvent('deal_shared', deal.id, {
      share_method: method,
      brand: deal.brand?.name,
      category: deal.category,
    });
  }, [deal]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    handleTrack('copy');
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl, handleTrack]);

  const handleSMS = useCallback(() => {
    handleTrack('sms');
    window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`;
  }, [shareText, handleTrack]);

  const handleWhatsApp = useCallback(() => {
    handleTrack('whatsapp');
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  }, [shareText, handleTrack]);

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-soft-reveal" />
      <div
        className="relative w-full sm:max-w-sm glass-strong frost rounded-t-2xl sm:rounded-2xl overflow-hidden animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Share this deal</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Deal preview */}
          <div className="glass rounded-xl p-3 mb-5">
            <p className="text-[10px] text-purple-400 uppercase tracking-wide font-bold mb-0.5">
              {deal.brand?.name || 'Unknown Brand'}
            </p>
            <p className="text-sm font-medium text-slate-200 truncate mb-1">
              {deal.product_name}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-mono font-bold text-purple-400">${deal.deal_price}</span>
              {deal.original_price && (
                <span className="text-[10px] text-slate-500 line-through">${deal.original_price}</span>
              )}
              {discount > 0 && (
                <span className="text-[10px] font-semibold text-emerald-400">-{discount}%</span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {deal.dispensary?.name || 'Unknown Dispensary'}
            </p>
          </div>

          {/* Share options */}
          <div className="space-y-2">
            <button
              onClick={handleCopyLink}
              className="w-full py-3.5 px-4 min-h-[48px] rounded-xl font-medium transition-all flex items-center gap-3 bg-purple-500 hover:bg-purple-400 text-white"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 shrink-0" />
                  <span>Link copied!</span>
                </>
              ) : (
                <>
                  <Link className="w-5 h-5 shrink-0" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              onClick={handleSMS}
              className="w-full py-3.5 px-4 min-h-[48px] rounded-xl font-medium transition-colors flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              <span>Text Message</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="w-full py-3.5 px-4 min-h-[48px] rounded-xl font-medium transition-colors flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white"
            >
              <Send className="w-5 h-5 shrink-0" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Safe area padding on mobile */}
        <div className="sm:hidden pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
