'use client';

import { useState, useEffect } from 'react';
import { Heart, X } from 'lucide-react';
import { STORAGE } from '@/lib/storageKeys';
import { trackEvent } from '@/lib/analytics';

export function isSaveTipSeen(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE.SAVE_TIP_SEEN) === 'true';
}

export function markSaveTipSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE.SAVE_TIP_SEEN, 'true');
}

export function SaveTipBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSaveTipSeen()) {
      // Delay slightly so it appears after the deal grid loads
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    markSaveTipSeen();
    trackEvent('save_tip_dismissed');
    setVisible(false);
  };

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-purple-500/15 bg-purple-950/20 px-4 py-3 mb-4 animate-in fade-in">
      <Heart className="w-4 h-4 text-purple-400/70 flex-shrink-0" />
      <p className="text-xs text-slate-400 flex-1">
        Tap <span className="text-purple-400">&#9829;</span> to save deals &mdash; they refresh at midnight.
      </p>
      <button
        onClick={dismiss}
        className="p-1 rounded-md text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
        aria-label="Dismiss tip"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
