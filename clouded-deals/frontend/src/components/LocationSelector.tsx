'use client';

import { useState } from 'react';
import { MapPin, X, Bell, CheckCircle, Loader2 } from 'lucide-react';
import { isVegasArea } from '@/lib/zipCodes';
import { supabase } from '@/lib/supabase';

type LocationState = 'idle' | 'editing' | 'confirmed' | 'coming-soon';

export function LocationSelector() {
  const [state, setState] = useState<LocationState>('idle');
  const [zipInput, setZipInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleZipSubmit = () => {
    const zip = zipInput.trim();
    if (zip.length !== 5) return;

    if (isVegasArea(zip)) {
      localStorage.setItem('clouded_zip', zip);
      setState('confirmed');
      setTimeout(() => setState('idle'), 3000);
    } else {
      setState('coming-soon');
    }
  };

  const handleEmailSubmit = async () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) return;

    setSubmitting(true);
    try {
      await supabase
        .from('waitlist')
        .insert({ email, zip_code: zipInput.trim() });
      setEmailSubmitted(true);
    } catch {
      // Silently handle — user can retry
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setState('idle');
    setZipInput('');
    setEmailInput('');
    setEmailSubmitted(false);
  };

  // Editing state — zip code input
  if (state === 'editing') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={zipInput}
          onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="Zip code"
          className="w-24 sm:w-28 px-2 sm:px-3 py-2 min-h-[40px] text-sm bg-slate-800 border border-purple-500 rounded-lg text-white placeholder:text-slate-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleZipSubmit();
            if (e.key === 'Escape') setState('idle');
          }}
        />
        <button
          onClick={handleZipSubmit}
          className="p-2 min-w-[40px] min-h-[40px] text-xs sm:text-sm text-purple-400 hover:text-purple-300 font-medium"
        >
          Go
        </button>
      </div>
    );
  }

  // Confirmed state — brief success flash
  if (state === 'confirmed') {
    return (
      <div className="flex items-center gap-1 p-1.5 min-h-[40px] text-xs sm:text-sm text-green-400">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>Las Vegas</span>
      </div>
    );
  }

  return (
    <>
      {/* Default idle state */}
      <button
        onClick={() => setState('editing')}
        className="flex items-center gap-1 p-1.5 min-h-[40px] text-xs sm:text-sm text-white hover:text-purple-400 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span className="underline underline-offset-2 decoration-purple-500/50 truncate max-w-[80px] sm:max-w-none">
          Las Vegas
        </span>
      </button>

      {/* Coming Soon modal for non-Vegas zips */}
      {state === 'coming-soon' && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-slate-800 rounded-2xl w-full max-w-xs p-5 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6 text-purple-400" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2">Coming soon!</h2>
            <p className="text-sm text-slate-400 mb-5 leading-relaxed">
              We&apos;re launching in your area soon. Enter your email to get notified when we expand.
            </p>

            {emailSubmitted ? (
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium py-3">
                <CheckCircle className="w-4 h-4" />
                You&apos;re on the list!
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-3 min-h-[44px] text-sm bg-slate-700 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEmailSubmit();
                  }}
                />
                <button
                  onClick={handleEmailSubmit}
                  disabled={submitting || !emailInput.includes('@')}
                  className="w-full py-3 min-h-[44px] bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Notify me
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-700">
              <button
                onClick={handleClose}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Browse Vegas deals instead
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
