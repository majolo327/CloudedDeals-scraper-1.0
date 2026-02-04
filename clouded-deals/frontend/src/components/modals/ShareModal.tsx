'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Copy, Mail, Smartphone, Check } from 'lucide-react';
import type { Deal } from '@/types';

interface ShareModalProps {
  deal: Deal;
  onClose: () => void;
}

function formatShareText(deal: Deal, url: string): string {
  return `${deal.brand?.name || ''} — ${deal.product_name}
$${deal.deal_price}${deal.original_price ? ` (was $${deal.original_price})` : ''}
${deal.dispensary?.name || 'Unknown'} — Las Vegas
${url}`;
}

export function ShareModal({ deal, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/deal/${deal.id}` : '';
  const shareText = formatShareText(deal, shareUrl);

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

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareText]);

  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(`Deal: ${deal.brand?.name || ''} ${deal.product_name}`);
    const body = encodeURIComponent(shareText);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }, [deal.brand?.name, deal.product_name, shareText]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-soft-reveal" />
      <div
        className="relative w-full max-w-sm glass-strong frost rounded-2xl overflow-hidden animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Share this deal</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCopyLink}
              className="w-full py-3.5 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2.5 bg-purple-500 hover:bg-purple-400 text-white"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Link
                </>
              )}
            </button>

            <button
              onClick={handleEmail}
              className="w-full py-3.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 text-white"
            >
              <Mail className="w-5 h-5" />
              Send via Email
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <Smartphone className="w-4 h-4" />
              <span className="text-sm font-medium">Text from your phone</span>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Scan QR code to open on mobile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
