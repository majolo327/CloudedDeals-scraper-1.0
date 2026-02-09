'use client';

import { useState } from 'react';
import { X, Loader2, Smartphone, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOrCreateAnonId, trackEvent } from '@/lib/analytics';

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

interface ContactBannerProps {
  onDismiss: () => void;
  savedDealsCount: number;
  addToast: (message: string, type: 'success' | 'info') => void;
}

export function ContactBanner({ onDismiss, savedDealsCount, addToast }: ContactBannerProps) {
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const digits = method === 'phone' ? stripPhone(value) : '';
  const isValid = method === 'phone' ? digits.length === 10 : isValidEmail(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || status === 'submitting') return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const anonId = getOrCreateAnonId();
      const contactValue = method === 'phone' ? digits : value.trim();

      // Save to user_contacts table
      const { error } = await supabase
        .from('user_contacts')
        .insert({
          anon_id: anonId || null,
          [method]: contactValue,
          source: 'saved_deals_banner',
          saved_deals_count: savedDealsCount,
        });

      if (error) {
        // Duplicate = already captured, treat as success
        if (error.code === '23505') {
          localStorage.setItem('clouded_contact_captured', 'true');
          addToast("You're already on the VIP list!", 'info');
          onDismiss();
          return;
        }
        setStatus('error');
        setErrorMsg('Something went wrong. Try again.');
        return;
      }

      localStorage.setItem('clouded_contact_captured', 'true');
      trackEvent('deal_viewed' as never, undefined, {
        action: 'contact_captured',
        method,
        source: 'saved_deals_banner',
        saved_deals_count: savedDealsCount,
      });
      addToast("Saved! We'll hit you up when we launch new features.", 'success');
      onDismiss();
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again.');
    }
  };

  return (
    <div className="glass rounded-xl p-4 relative">
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 w-7 h-7 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Smartphone className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-sm font-bold text-white mb-0.5">
            Get VIP early access
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            We&apos;re building something big. Drop your info for exclusive deals.
          </p>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Method toggle */}
            <div className="flex gap-1 rounded-lg bg-white/5 p-0.5 w-fit">
              <button
                type="button"
                onClick={() => { setMethod('phone'); setValue(''); setErrorMsg(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  method === 'phone'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                Text
              </button>
              <button
                type="button"
                onClick={() => { setMethod('email'); setValue(''); setErrorMsg(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  method === 'email'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Mail className="w-3 h-3" />
                Email
              </button>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type={method === 'phone' ? 'tel' : 'email'}
                inputMode={method === 'phone' ? 'numeric' : 'email'}
                value={value}
                onChange={(e) => {
                  setValue(method === 'phone' ? formatPhone(e.target.value) : e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={method === 'phone' ? '(702) 555-1234' : 'your@email.com'}
                className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
              />
              <button
                type="submit"
                disabled={!isValid || status === 'submitting'}
                className="px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shrink-0 flex items-center gap-1.5"
              >
                {status === 'submitting' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Count me in'
                )}
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400">{errorMsg}</p>
            )}

            <p className="text-[10px] text-slate-600 leading-relaxed">
              No spam. We&apos;ll only reach out for VIP features and launches.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
