'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, DollarSign, Ban, HelpCircle, Send, Loader2 } from 'lucide-react';
import { trackEvent, getOrCreateAnonId } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Deal } from '@/types';

type ReportType = 'wrong_price' | 'deal_gone' | 'wrong_product' | 'other';

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof DollarSign; desc: string }[] = [
  { id: 'wrong_price', label: 'Wrong price', icon: DollarSign, desc: 'The price shown doesn\'t match the dispensary' },
  { id: 'deal_gone', label: 'Deal is gone', icon: Ban, desc: 'This deal is no longer available' },
  { id: 'wrong_product', label: 'Wrong info', icon: AlertTriangle, desc: 'Product name, weight, or category is wrong' },
  { id: 'other', label: 'Other issue', icon: HelpCircle, desc: 'Something else is off' },
];

interface ReportDealModalProps {
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
  onReported?: () => void;
}

export function ReportDealModal({ deal, isOpen, onClose, onReported }: ReportDealModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedType || status === 'submitting') return;

    setStatus('submitting');
    const anonId = getOrCreateAnonId();

    // Write to deal_reports table
    const { error } = await supabase
      .from('deal_reports')
      .insert({
        deal_id: deal.id,
        anon_id: anonId || null,
        report_type: selectedType,
        report_message: message.trim() || null,
        deal_price: deal.deal_price,
        dispensary_name: deal.dispensary?.name || null,
        brand_name: deal.brand?.name || null,
        product_name: deal.product_name,
      });

    if (error) {
      // Duplicate report — treat as success
      if (error.code === '23505') {
        setStatus('done');
        return;
      }
      setStatus('error');
      return;
    }

    // Track in analytics
    trackEvent('deal_reported' as never, deal.id, {
      report_type: selectedType,
      has_message: !!message.trim(),
      dispensary: deal.dispensary?.name,
      deal_price: deal.deal_price,
    });

    setStatus('done');
    onReported?.();
  };

  const handleClose = () => {
    setSelectedType(null);
    setMessage('');
    setStatus('idle');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-soft-reveal" />
      <div
        className="relative w-full max-w-sm glass-strong frost rounded-2xl overflow-hidden animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          {/* Close */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {status === 'done' ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Thanks for flagging</h2>
              <p className="text-sm text-slate-400 mb-4">We&apos;ll review this and update the deal.</p>
              <button
                onClick={handleClose}
                className="w-full py-3 min-h-[48px] rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 font-medium transition-colors text-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1 pr-8">Flag this deal</h2>
              <p className="text-xs text-slate-400 mb-4">
                {deal.brand?.name} &mdash; ${deal.deal_price} at {deal.dispensary?.name}
              </p>

              {/* Report type selection */}
              <div className="space-y-2 mb-4">
                {REPORT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = selectedType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedType(opt.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                          : 'bg-white/5 border border-transparent text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[11px] text-slate-500">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Optional message */}
              {selectedType && (
                <div className="mb-4">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={selectedType === 'wrong_price' ? 'What\'s the actual price?' : 'Details (optional)'}
                    rows={2}
                    maxLength={300}
                    className="w-full resize-none rounded-xl border border-slate-700 bg-white/5 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                  />
                </div>
              )}

              {status === 'error' && (
                <p className="text-xs text-red-400 mb-3">Something went wrong. Try again.</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!selectedType || status === 'submitting'}
                className="w-full py-3 min-h-[48px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Report
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
