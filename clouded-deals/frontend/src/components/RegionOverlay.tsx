'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Smartphone, Mail } from 'lucide-react';
import { getCannabisStatus, STATE_NAMES, type CannabisStatus } from '@/utils/cannabisLegality';
import { getNevadaRegion } from '@/utils/zipToState';
import { trackEvent, getOrCreateAnonId } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

interface RegionOverlayProps {
  stateCode: string;
  zip: string;
  onBrowseVegas: () => void;
  onEmailSubmit?: (email: string, stateCode: string, zip: string) => void;
}

// ---- Copy variants per status ----

const REC_VARIANTS = [
  {
    headline: (s: string) => `We see you, ${s}.`,
    subtext: (s: string) =>
      `We\u2019re live in Vegas and expanding to ${s} by Summer 2026.`,
  },
  {
    headline: (s: string) => `${s}, you\u2019re on the list.`,
    subtext: () =>
      `We\u2019re live in Vegas right now. Drop your info and we\u2019ll let you know when we launch near you.`,
  },
  {
    headline: (s: string) => `Good taste, ${s}.`,
    subtext: () =>
      `We\u2019re headed your way. Want us to hit you up when we land in your state?`,
  },
];

const MED_VARIANTS = [
  {
    headline: (s: string) => `${s}, we\u2019re keeping an eye out.`,
    subtext: () =>
      `Medical\u2019s live but rec hasn\u2019t landed yet. When it does, we\u2019ll be there. Browse Vegas deals in the meantime.`,
  },
  {
    headline: (s: string) => `Almost, ${s}. Almost.`,
    subtext: () =>
      `Medical\u2019s live but rec hasn\u2019t landed yet. We\u2019ll be ready when it does.`,
  },
];

const NO_LEGAL_VARIANTS = [
  {
    headline: (s: string) => `Yeah... ${s} isn\u2019t quite there yet.`,
    subtext: () =>
      `Legal cannabis = legal deals. Vegas is always open though.`,
    cta: 'Browse Vegas deals',
  },
  {
    headline: (s: string) => `${s}? We like the enthusiasm.`,
    subtext: () =>
      `Not rec yet, but when you\u2019re in Vegas, we\u2019ve got you.`,
    cta: 'See Vegas deals',
  },
  {
    headline: (s: string) => `We\u2019d love to help, ${s}.`,
    subtext: () =>
      `Your state needs to make some calls first. Plan a Vegas trip \u2014 we\u2019ll have the deals ready.`,
    cta: 'Browse Vegas deals',
  },
  {
    headline: (s: string) => `Not yet, ${s}. Not yet.`,
    subtext: () =>
      `Vegas is always open \u2014 and the deals are waiting.`,
    cta: 'Peek at Vegas deals',
  },
];

const RENO_COPY = {
  headline: 'Reno, we see you.',
  subtext:
    'We\u2019re focused on Las Vegas right now, but Reno deals are coming soon. Browse Vegas deals in the meantime.',
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

export function RegionOverlay({ stateCode, zip, onBrowseVegas, onEmailSubmit }: RegionOverlayProps) {
  const [contactMethod, setContactMethod] = useState<'phone' | 'email'>('phone');
  const [contactValue, setContactValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [inputError, setInputError] = useState('');

  const status: CannabisStatus = getCannabisStatus(stateCode);
  const stateName = STATE_NAMES[stateCode] || stateCode;

  // NV edge case: northern NV (Reno) vs southern NV (Vegas)
  const isNorthernNV = stateCode === 'NV' && getNevadaRegion(zip) === 'northern-nv';

  // Pick a random copy variant once per mount
  const variant = useMemo(() => {
    if (isNorthernNV) return null;
    if (status === 'recreational') return pickRandom(REC_VARIANTS);
    if (status === 'medical_only') return pickRandom(MED_VARIANTS);
    return pickRandom(NO_LEGAL_VARIANTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateCode]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Escape key to dismiss
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBrowseVegas]);

  const handleContactSubmit = () => {
    const trimmed = contactValue.trim();
    if (!trimmed) {
      setInputError(contactMethod === 'phone' ? 'Please enter your phone number' : 'Please enter your email');
      return;
    }
    if (contactMethod === 'email' && !isValidEmail(trimmed)) {
      setInputError('Please enter a valid email');
      return;
    }
    if (contactMethod === 'phone' && stripPhone(trimmed).length !== 10) {
      setInputError('Please enter a 10-digit phone number');
      return;
    }
    setInputError('');
    setSubmitted(true);

    const value = contactMethod === 'phone' ? stripPhone(trimmed) : trimmed;

    // Save to user_contacts for unified tracking
    const anonId = getOrCreateAnonId();
    try {
      const result = supabase?.from('user_contacts')?.insert({
        anon_id: anonId || null,
        [contactMethod]: value,
        source: 'out_of_market',
        zip_entered: zip,
      });
      if (result) Promise.resolve(result).catch(() => {});
    } catch {
      // silently ignore
    }

    // Also fire legacy email flow if email was provided
    if (contactMethod === 'email') {
      onEmailSubmit?.(trimmed, stateCode, zip);
    }
    trackEvent('zip_email_capture', undefined, { state: stateCode, zip, method: contactMethod });
  };

  const handleDismiss = () => {
    // Mark as dismissed for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('clouded_region_dismissed', 'true');
    }
    onBrowseVegas();
  };

  const showEmailCapture = status === 'recreational' || status === 'medical_only';
  const noLegalVariant = status === 'no_legal' ? (variant as typeof NO_LEGAL_VARIANTS[number]) : null;
  const ctaLabel = noLegalVariant?.cta || 'Explore Las Vegas deals';

  // Northern NV (Reno) — soft message
  if (isNorthernNV) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-overlay-in"
        onClick={handleDismiss}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto glass-strong frost rounded-2xl p-6 sm:p-8 text-center mx-4 animate-card-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-9 h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-bold tracking-tight mb-6">
            Clouded<span className="text-purple-400">Deals</span>
          </h1>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{RENO_COPY.headline}</h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8">{RENO_COPY.subtext}</p>

          <button
            onClick={handleDismiss}
            className="w-full py-3.5 min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/20 text-sm"
          >
            Browse Vegas deals &rarr;
          </button>
        </div>
      </div>
    );
  }

  if (!variant) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-overlay-in"
      onClick={handleDismiss}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto glass-strong frost rounded-2xl p-6 sm:p-8 text-center mx-4 animate-card-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-9 h-9 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <h1 className="text-lg font-bold tracking-tight mb-6">
          Clouded<span className="text-purple-400">Deals</span>
        </h1>

        {/* Headline */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          {variant.headline(stateName)}
        </h2>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8">
          {variant.subtext(stateName)}
        </p>

        {/* Contact capture (rec & medical states only) */}
        {showEmailCapture && !submitted && (
          <div className="mb-6 space-y-3">
            {/* Method toggle */}
            <div className="flex gap-1 rounded-lg bg-white/5 p-0.5 w-fit mx-auto">
              <button
                onClick={() => { setContactMethod('phone'); setContactValue(''); setInputError(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contactMethod === 'phone'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                Text
              </button>
              <button
                onClick={() => { setContactMethod('email'); setContactValue(''); setInputError(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contactMethod === 'email'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Mail className="w-3 h-3" />
                Email
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type={contactMethod === 'phone' ? 'tel' : 'email'}
                inputMode={contactMethod === 'phone' ? 'numeric' : 'email'}
                value={contactValue}
                onChange={(e) => {
                  setContactValue(contactMethod === 'phone' ? formatPhone(e.target.value) : e.target.value);
                  if (inputError) setInputError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
                placeholder={contactMethod === 'phone' ? '(702) 555-1234' : "Drop your email \u2014 we'll let you know"}
                className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 transition-colors"
              />
              <button
                onClick={handleContactSubmit}
                className="px-5 py-3 min-h-[48px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors text-sm shrink-0"
              >
                Notify Me
              </button>
            </div>
            {inputError && (
              <p className="text-xs text-red-400 mt-2 text-left">{inputError}</p>
            )}
          </div>
        )}

        {submitted && (
          <p className="text-sm text-emerald-400 mb-6">
            You&apos;re on the list. We&apos;ll reach out when we launch in {stateName}.
          </p>
        )}

        {/* Browse Vegas CTA */}
        <button
          onClick={handleDismiss}
          className="w-full py-3.5 min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/20 text-sm"
        >
          {ctaLabel} &rarr;
        </button>
      </div>
    </div>
  );
}
