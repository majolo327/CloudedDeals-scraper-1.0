'use client';

import { useState, useEffect } from 'react';
import { Clock, Sunrise, X, CheckCircle, Loader2, Mail, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOrCreateAnonId, trackEvent } from '@/lib/analytics';

const STORAGE_KEY = 'clouded_early_bird_captured';

interface ExpiredDealsBannerProps {
  expiredCount: number;
  onDismiss?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getNextDropMessage(): string {
  const now = new Date();
  const ptStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pt = new Date(ptStr);
  const hour = pt.getHours();

  if (hour < 8) {
    const hoursLeft = 7 - hour;
    const minsLeft = 59 - pt.getMinutes();
    if (hoursLeft <= 0) return `New deals dropping in ${minsLeft}m`;
    return `New deals drop around 8 AM (${hoursLeft}h ${minsLeft}m)`;
  }
  if (hour < 10) {
    return "Today's deals are being prepared — check back shortly!";
  }
  return 'New deals drop every morning around 8 AM PT.';
}

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ExpiredDealsBanner({ expiredCount, onDismiss }: ExpiredDealsBannerProps) {
  const [nextDrop, setNextDrop] = useState(getNextDropMessage);
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setNextDrop(getNextDropMessage());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Check if already captured
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'captured') {
      setStatus('done');
    }
  }, []);

  const phoneDigits = stripPhone(phone);
  const isPhoneValid = phoneDigits.length === 10;
  const isEmailValid = isValidEmail(email);
  const canSubmit = mode === 'phone' ? isPhoneValid : isEmailValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || status === 'submitting') return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const anonId = getOrCreateAnonId();
      const payload: Record<string, unknown> = {
        source: 'early_bird_banner',
        anon_id: anonId || null,
      };

      if (mode === 'phone') {
        payload.phone = phoneDigits;
      } else {
        payload.email = email.trim().toLowerCase();
      }

      const { error } = await supabase
        .from('user_contacts')
        .insert(payload);

      if (error) {
        // Duplicate = already signed up, treat as success
        if (error.code === '23505') {
          setStatus('done');
          localStorage.setItem(STORAGE_KEY, 'captured');
          return;
        }
        setStatus('idle');
        setErrorMsg('Something went wrong. Try again.');
        return;
      }

      setStatus('done');
      localStorage.setItem(STORAGE_KEY, 'captured');
      trackEvent('deal_viewed' as never, undefined, {
        action: 'contact_captured',
        source: 'early_bird_banner',
        method: mode,
      });
    } catch {
      setStatus('idle');
      setErrorMsg('Something went wrong. Try again.');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-900/40 p-5 mb-6">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] rounded-lg text-slate-600 hover:text-slate-400 transition-colors flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="relative">
        {/* Greeting + Icon */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Sunrise className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {getGreeting()}, early bird!
            </h3>
            <p className="text-xs text-slate-400">
              You&apos;re here before the new deals
            </p>
          </div>
        </div>

        {/* Main message */}
        <p className="text-sm text-slate-300 mb-3 leading-relaxed">
          {expiredCount > 0 ? (
            <>
              Yesterday&apos;s <span className="text-purple-400 font-medium">{expiredCount} deals</span> are
              shown below — browse while we get today&apos;s deals together.
              Prices may have changed, so verify at the dispensary.
            </>
          ) : (
            <>We&apos;re getting today&apos;s deals together. Check back soon!</>
          )}
        </p>

        {/* Next drop timer */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <Clock className="w-3.5 h-3.5 text-purple-400/70" />
          <span>{nextDrop}</span>
        </div>

        {/* Contact capture */}
        {status === 'done' ? (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-300">
              You&apos;re on the list. We&apos;ll let you know when daily alerts go live.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2.5">
              Want a heads up when deals are live? Drop your info — daily alerts coming soon.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                {/* Mode toggle */}
                <div className="flex rounded-lg overflow-hidden border border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setMode('phone'); setErrorMsg(''); }}
                    className={`flex items-center justify-center w-10 h-10 transition-colors ${
                      mode === 'phone'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                    aria-label="Phone"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('email'); setErrorMsg(''); }}
                    className={`flex items-center justify-center w-10 h-10 transition-colors ${
                      mode === 'email'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                    aria-label="Email"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>

                {/* Input */}
                {mode === 'phone' ? (
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(702) 555-1234"
                    className="flex-1 min-w-0 px-3 py-2 h-10 rounded-lg bg-white/5 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                  />
                ) : (
                  <input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 min-w-0 px-3 py-2 h-10 rounded-lg bg-white/5 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                  />
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit || status === 'submitting'}
                  className="px-4 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shrink-0 flex items-center justify-center gap-1.5"
                >
                  {status === 'submitting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Notify me'
                  )}
                </button>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400">{errorMsg}</p>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {mode === 'phone'
                  ? 'We\'ll text you once a day when deals drop. Reply STOP anytime.'
                  : 'One email a day when deals go live. Unsubscribe anytime.'}
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
