'use client';

import { useState, useMemo } from 'react';
import { getCannabisStatus, STATE_NAMES, type CannabisStatus } from '@/utils/cannabisLegality';
import { getNevadaRegion } from '@/utils/zipToState';
import { trackEvent } from '@/lib/analytics';

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
      `Clouded Deals is live in Nevada right now \u2014 and we\u2019re working on bringing every deal from every dispensary in ${s} to one place too. We\u2019re aiming to launch in your state by late 2026.`,
  },
  {
    headline: (s: string) => `${s}, you\u2019re on the list.`,
    subtext: () =>
      `We\u2019re not there yet, but when we launch, you\u2019ll be the first to know. Right now we\u2019re live in Nevada with every deal from every dispensary.`,
  },
  {
    headline: (s: string) => `Good taste, ${s}.`,
    subtext: () =>
      `Clouded Deals is headed your way. We\u2019re live in Vegas right now \u2014 want us to hit you up when we land in your state?`,
  },
];

const MED_VARIANTS = [
  {
    headline: (s: string) => `${s}, we\u2019re watching the vibes.`,
    subtext: () =>
      `Your state has medical cannabis but hasn\u2019t gone fully recreational yet. When it does \u2014 and when dispensaries start competing on deals \u2014 we\u2019ll be there. In the meantime, check out what we\u2019re doing in Nevada.`,
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
      `Cannabis deals require, well, legal cannabis. But hey, Vegas is always accepting visitors.`,
    cta: 'Browse Vegas deals (for your next trip)',
  },
  {
    headline: (s: string) => `${s}? Bold of you to be here.`,
    subtext: () =>
      `We respect the energy. Your state hasn\u2019t caught up yet, but when you\u2019re in Vegas, we\u2019ve got you covered.`,
    cta: 'See what you\u2019re missing',
  },
  {
    headline: (s: string) => `We\u2019d love to help, ${s}.`,
    subtext: () =>
      `But we\u2019re gonna need your state to make some calls first. Until then, plan a Vegas trip \u2014 we\u2019ll have the deals ready.`,
    cta: 'Browse Vegas deals',
  },
  {
    headline: (s: string) => `Not yet, ${s}. Not yet.`,
    subtext: () =>
      `Your legislators are... working on it. (Are they though?) Come visit Vegas in the meantime \u2014 deals are waiting.`,
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

export function RegionOverlay({ stateCode, zip, onBrowseVegas, onEmailSubmit }: RegionOverlayProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

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

  const handleEmailSubmit = () => {
    if (!email.trim() || !email.includes('@')) return;
    setSubmitted(true);
    onEmailSubmit?.(email.trim(), stateCode, zip);
    trackEvent('zip_email_capture', undefined, { state: stateCode, zip });
  };

  // Northern NV (Reno) — soft message, not a full block
  if (isNorthernNV) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto px-6 py-12" style={{ backgroundColor: 'rgba(10,10,10,0.97)' }}>
        <div className="max-w-md w-full text-center animate-in fade-in my-auto">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight mb-2">
            Clouded<span className="text-purple-400">Deals</span>
          </h1>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-8 mb-4">{RENO_COPY.headline}</h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8">{RENO_COPY.subtext}</p>

          <button
            onClick={onBrowseVegas}
            className="w-full py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors text-sm"
          >
            Browse Vegas deals &rarr;
          </button>
        </div>
      </div>
    );
  }

  if (!variant) return null;

  const showEmailCapture = status === 'recreational' || status === 'medical_only';
  const noLegalVariant = status === 'no_legal' ? (variant as typeof NO_LEGAL_VARIANTS[number]) : null;
  const ctaLabel = noLegalVariant?.cta || 'Peek at Vegas deals in the meantime';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto px-6 py-12" style={{ backgroundColor: 'rgba(10,10,10,0.97)' }}>
      <div className="max-w-md w-full text-center animate-in fade-in my-auto">
        {/* Logo */}
        <h1 className="text-lg sm:text-xl font-bold tracking-tight mb-2">
          Clouded<span className="text-purple-400">Deals</span>
        </h1>

        {/* Headline */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mt-8 mb-4">
          {variant.headline(stateName)}
        </h2>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8">
          {variant.subtext(stateName)}
        </p>

        {/* Email capture (rec & medical states only) */}
        {showEmailCapture && !submitted && (
          <div className="flex gap-2 mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
              placeholder="Drop your email \u2014 we\u2019ll let you know when we go live"
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40"
            />
            <button
              onClick={handleEmailSubmit}
              className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors text-sm shrink-0"
            >
              Notify Me
            </button>
          </div>
        )}

        {submitted && (
          <p className="text-sm text-emerald-400 mb-6">
            You&apos;re on the list. We&apos;ll reach out when we launch in {stateName}.
          </p>
        )}

        {/* Browse Vegas CTA — always present */}
        <button
          onClick={onBrowseVegas}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          {ctaLabel} &rarr;
        </button>
      </div>
    </div>
  );
}
