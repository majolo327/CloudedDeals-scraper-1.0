'use client';

interface FooterProps {
  onNavigateToForBusiness?: () => void;
  onNavigate?: (page: 'terms' | 'privacy') => void;
}

export function Footer({ onNavigateToForBusiness, onNavigate }: FooterProps) {
  return (
    <footer className="relative border-t mt-8" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'rgba(10, 14, 26, 0.6)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
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
