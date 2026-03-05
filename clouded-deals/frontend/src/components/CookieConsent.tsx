'use client';

import { useState, useEffect } from 'react';
import { STORAGE } from '@/lib/storageKeys';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE.COOKIE_CONSENT);
    if (!consent) {
      // Small delay so it doesn't flash on first paint
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE.COOKIE_CONSENT, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed left-4 right-4 z-[60] flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300 safe-bottom-float">
      <div
        className="max-w-lg w-full rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg border border-slate-700/50"
        style={{ backgroundColor: 'rgba(15, 17, 35, 0.95)', backdropFilter: 'blur(20px)' }}
      >
        <p className="text-xs text-slate-300 flex-1">
          We use local storage and analytics to improve your experience.
          By continuing, you agree to our{' '}
          <button
            onClick={() => {
              // Navigate to privacy page — handled by the app's page state
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'privacy' }));
            }}
            className="text-purple-400 underline underline-offset-2 hover:text-purple-300"
          >
            Privacy Policy
          </button>
          .
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/30 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
