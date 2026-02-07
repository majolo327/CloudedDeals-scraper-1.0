'use client';

import { useState, useEffect } from 'react';
import { X, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOrCreateAnonId, trackEvent } from '@/lib/analytics';

const STORAGE_KEY = 'clouded_sms_waitlist';

/** Format phone input as user types: (702) 555-1234 */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function stripPhone(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

interface SmsWaitlistProps {
  addToast: (message: string, type: 'success' | 'info') => void;
}

export function SmsWaitlist({ addToast }: SmsWaitlistProps) {
  const [dismissed, setDismissed] = useState(true); // hidden by default until check
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Check localStorage on mount — hide if already signed up or dismissed
  useEffect(() => {
    const val = localStorage.getItem(STORAGE_KEY);
    setDismissed(val === 'signed_up' || val === 'dismissed');
  }, []);

  if (dismissed) return null;

  const digits = stripPhone(phone);
  const isValid = digits.length === 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || status === 'submitting') return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const anonId = getOrCreateAnonId();
      const { error } = await supabase
        .from('sms_waitlist')
        .insert({ phone: digits, source: 'sticky_cta', anon_id: anonId || null });

      if (error) {
        // Duplicate phone = already signed up, treat as success
        if (error.code === '23505') {
          setStatus('done');
          localStorage.setItem(STORAGE_KEY, 'signed_up');
          addToast("You're already on the list!", 'info');
          return;
        }
        setStatus('error');
        setErrorMsg('Something went wrong. Try again.');
        return;
      }

      setStatus('done');
      localStorage.setItem(STORAGE_KEY, 'signed_up');
      trackEvent('deal_viewed' as never, undefined, { action: 'sms_waitlist_signup', phone_provided: true });
      addToast("You're in! We'll text you when alerts go live.", 'success');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again.');
    }
  };

  const handleDismissBar = () => {
    localStorage.setItem(STORAGE_KEY, 'dismissed');
    setDismissed(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setPhone('');
    setStatus('idle');
    setErrorMsg('');
  };

  return (
    <>
      {/* ---- Sticky bottom bar (above mobile nav) ---- */}
      {!showModal && (
        <div
          className="fixed bottom-[60px] sm:bottom-0 left-0 right-0 z-40 animate-soft-reveal"
          style={{ backgroundColor: 'rgba(10, 14, 26, 0.95)' }}
        >
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-sm text-slate-300 truncate">
                <span className="hidden sm:inline">Get the best deals texted to you daily </span>
                <span className="sm:hidden">Daily deal alerts </span>
                <span className="text-purple-400 font-medium">&mdash; be first to know</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setShowModal(true);
                  trackEvent('deal_viewed' as never, undefined, { action: 'sms_cta_clicked' });
                }}
                className="px-4 py-2 min-h-[40px] bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                Join VIP
              </button>
              <button
                onClick={handleDismissBar}
                className="p-1.5 min-w-[36px] min-h-[36px] text-slate-600 hover:text-slate-400 transition-colors flex items-center justify-center"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal ---- */}
      {showModal && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
          onClick={handleCloseModal}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-soft-reveal" />
          <div
            className="relative w-full sm:max-w-sm glass-strong frost rounded-t-2xl sm:rounded-2xl animate-soft-reveal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>

            <div className="p-6">
              {/* Close */}
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 w-8 h-8 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {status === 'done' ? (
                /* ---- Success state ---- */
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">You&apos;re on the list!</h2>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    We&apos;ll text you when daily deal alerts go live.
                    Early signups get VIP perks.
                  </p>
                  <button
                    onClick={handleCloseModal}
                    className="w-full py-3 min-h-[48px] rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 font-medium transition-colors text-sm"
                  >
                    Back to deals
                  </button>
                </div>
              ) : (
                /* ---- Form state ---- */
                <>
                  <div className="text-center mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-7 h-7 text-purple-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white mb-1.5">
                      Get VIP deal alerts
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Top deals. Texted daily. Before they sell out.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="(702) 555-1234"
                      autoFocus
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-white/5 border border-slate-700 text-white placeholder-slate-500 text-base tracking-wide focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 text-center"
                    />

                    {errorMsg && (
                      <p className="text-xs text-red-400 text-center">{errorMsg}</p>
                    )}

                    <button
                      type="submit"
                      disabled={!isValid || status === 'submitting'}
                      className="w-full py-3 min-h-[48px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 text-sm"
                    >
                      {status === 'submitting' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        "I'm in"
                      )}
                    </button>

                    <p className="text-[11px] text-slate-600 text-center leading-relaxed">
                      1-2 texts/day when we launch. Reply STOP anytime. No spam ever.
                    </p>

                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="w-full py-2 min-h-[44px] text-slate-500 hover:text-slate-300 text-sm transition-colors"
                    >
                      Maybe later
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
