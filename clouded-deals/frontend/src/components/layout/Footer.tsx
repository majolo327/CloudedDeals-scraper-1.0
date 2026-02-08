'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FooterProps {
  onNavigateToForBusiness?: () => void;
  onNavigate?: (page: 'terms' | 'privacy') => void;
}

export function Footer({ onNavigateToForBusiness, onNavigate }: FooterProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);

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
                We check every dispensary in Vegas every morning. Every deal you see is live today.
                Tap any deal to go straight to the product page and grab it. Save deals with the{' '}
                <span className="text-purple-400">&hearts;</span> before midnight &mdash; they refresh daily.
              </p>
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
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          Clouded Deals is not a licensed cannabis retailer. All deals are subject to
          dispensary verification. Prices shown do not include tax. For adults 21+ only.
          This is not medical advice.
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
