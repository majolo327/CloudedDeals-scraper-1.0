'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'clouded_cookie_consent';

export type CookieConsent = 'accepted' | 'declined' | null;

/** Read consent status from localStorage. */
export function getCookieConsent(): CookieConsent {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === 'accepted' || v === 'declined') return v;
  return null;
}

/** Returns true if the user has given affirmative cookie consent. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted';
}

interface Props {
  onNavigateToPrivacy?: () => void;
}

export function CookieConsentBanner({ onNavigateToPrivacy }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if no consent decision has been made yet
    if (getCookieConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(10, 14, 26, 0.97)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed flex-1">
          We use cookies and local storage to remember your preferences, track anonymous
          usage analytics, and improve your experience.{' '}
          {onNavigateToPrivacy ? (
            <button
              onClick={onNavigateToPrivacy}
              className="underline text-purple-400 hover:text-purple-300 transition-colors"
            >
              Privacy Policy
            </button>
          ) : (
            <span className="text-slate-500">See our Privacy Policy for details.</span>
          )}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 rounded-lg transition-colors min-h-[44px]"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors min-h-[44px]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
