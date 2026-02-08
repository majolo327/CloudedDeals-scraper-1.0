'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FooterProps {
  onNavigateToForBusiness?: () => void;
  onNavigate?: (page: 'terms' | 'privacy') => void;
}

export function Footer({ onNavigateToForBusiness, onNavigate }: FooterProps) {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <footer className="relative border-t mt-8" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'rgba(10, 14, 26, 0.6)' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* About / Brand Statement */}
        <div className="mb-8">
          <button
            onClick={() => setShowAbout(!showAbout)}
            className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-purple-400 transition-colors"
          >
            About Clouded Deals
            {showAbout ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showAbout && (
            <div className="mt-5 max-w-md mx-auto p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-4">
              <h3 className="text-base font-bold text-white text-center leading-snug">
                Every deal. Every dispensary. One place.
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                We check every dispensary in Las Vegas every single morning and bring every deal into one place.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                No accounts required. No ads. No sponsored placements. Every deal is ranked on its own merit.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                We built this because we were tired of opening 10 different apps and scrolling through 10 different menus just to find out who has the best price on a cart today. So we fixed it.
              </p>
              <p className="text-xs font-semibold text-slate-300 text-center">
                Clouded Deals is free. It will always be free for consumers.
              </p>
              <p className="text-xs text-slate-500 text-center">
                Built in Las Vegas.
              </p>
            </div>
          )}
        </div>

        {/* Trust commitment */}
        <p className="text-center text-[10px] text-slate-600 mb-6 max-w-xs mx-auto leading-relaxed">
          Every deal is ranked on merit. No sponsored placements. No ads. Ever.
        </p>

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
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          Clouded Deals is not a licensed cannabis retailer. All deals are subject to
          dispensary verification. Prices shown do not include tax. For adults 21+ only.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 mb-3">
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
          <p className="text-xs text-slate-600 text-center leading-relaxed max-w-md mx-auto">
            For entertainment and informational purposes only. Prices and availability
            subject to change. Please consume responsibly. Must be 21+ to use this site.
          </p>
          <p className="text-xs text-slate-700 text-center mt-3">
            &copy; {new Date().getFullYear()} Clouded Deals. Las Vegas, NV.
          </p>
        </div>
      </div>
    </footer>
  );
}
