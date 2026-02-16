'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface FooterProps {
  onNavigateToForBusiness?: () => void;
  onNavigate?: (page: 'terms' | 'privacy') => void;
  onNavigateToAbout?: () => void;
  onReplayTour?: () => void;
}

export function Footer({ onNavigateToForBusiness, onNavigate, onNavigateToAbout, onReplayTour }: FooterProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [tourReset, setTourReset] = useState(false);

  const handleReplayTour = useCallback(() => {
    // Clear FTUE and coach marks flags so the tour replays
    localStorage.removeItem('clouded_ftue_completed');
    localStorage.removeItem('clouded_coach_marks_seen');
    setTourReset(true);
    if (onReplayTour) {
      onReplayTour();
    } else {
      // Fallback: reload to trigger FTUE from scratch
      setTimeout(() => window.location.reload(), 300);
    }
  }, [onReplayTour]);

  return (
    <footer className="relative border-t mt-8" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'rgba(10, 14, 26, 0.6)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* How It Works collapsible section */}
        <div className="mb-6">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-purple-400 transition-colors"
          >
            How It Works
            {showHowItWorks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHowItWorks && (
            <div className="mt-4 max-w-md mx-auto p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                We check every dispensary in Las Vegas every single morning and bring every deal into one place.
                Tap any deal to go straight to the dispensary. Save with{' '}
                <span className="text-purple-400">&hearts;</span> &mdash; deals refresh at midnight.
              </p>
              {/* Replay guided tour toggle */}
              <button
                onClick={handleReplayTour}
                disabled={tourReset}
                className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-slate-400 hover:text-purple-400 transition-colors disabled:text-purple-400 disabled:cursor-default"
              >
                <RotateCcw className={`w-3 h-3 ${tourReset ? 'animate-spin' : ''}`} />
                {tourReset ? 'Restarting tour\u2026' : 'Replay guided tour'}
              </button>
            </div>
          )}
        </div>

        {onNavigateToForBusiness && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onNavigateToForBusiness}
              className="text-sm text-slate-400 hover:text-purple-400 transition-colors"
            >
              For Business
            </button>
          </div>
        )}
        {/* Trust commitment */}
        <p className="text-center text-xs text-slate-500 leading-relaxed mb-4">
          Every deal is ranked on merit. No sponsored placements. No ads. Ever.
        </p>

        {onNavigateToAbout && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onNavigateToAbout}
              className="text-sm text-slate-400 hover:text-purple-400 transition-colors"
            >
              About
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 leading-relaxed">
          Clouded Deals is not a licensed cannabis retailer and does not sell, distribute,
          or deliver cannabis products. All deals are subject to dispensary verification.
          Prices shown do not include tax. For adults 21+ only. This is not medical advice.
        </p>
        <p className="text-center text-[10px] text-slate-600 leading-relaxed mt-2 max-w-lg mx-auto">
          Cannabis is illegal under federal law. Do not transport cannabis across state lines.
          Do not operate a vehicle under the influence. Cannabis may be harmful to your health.
          Do not use if pregnant or nursing. Keep out of reach of children.
          Nevada law limits adult possession to 1 oz of flower or 1/8 oz of concentrates.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 mb-3">
            <button
              onClick={() => onNavigate?.('terms')}
              className="py-2 px-1 min-h-[44px] flex items-center hover:text-slate-400 transition-colors"
            >
              Terms of Service
            </button>
            <span>·</span>
            <button
              onClick={() => onNavigate?.('privacy')}
              className="py-2 px-1 min-h-[44px] flex items-center hover:text-slate-400 transition-colors"
            >
              Privacy Policy
            </button>
            <span>·</span>
            <a
              href="mailto:hello@cloudeddeals.com"
              className="py-2 px-1 min-h-[44px] flex items-center hover:text-slate-400 transition-colors"
            >
              Contact
            </a>
          </div>
          <p className="text-xs text-slate-500 text-center leading-relaxed max-w-md mx-auto">
            For entertainment and informational purposes only. Prices and availability
            subject to change. Please consume responsibly. Must be 21+ to use this site.
          </p>
          <p className="text-xs text-slate-600 text-center mt-3">
            &copy; {new Date().getFullYear()} Clouded Deals. Las Vegas, NV.
          </p>
        </div>
      </div>
    </footer>
  );
}
