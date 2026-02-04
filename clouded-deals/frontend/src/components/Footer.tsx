export function Footer() {
  return (
    <footer className="relative border-t border-slate-800/50 bg-slate-900/50 mt-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-center mb-4">
          <span className="text-sm text-slate-400">For Business</span>
        </div>
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          Clouded Deals is not a licensed cannabis retailer. All deals are subject to dispensary verification.
          Prices shown do not include tax. For adults 21+ only. This is not medical advice.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-600 mb-3">
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Terms of Service</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Contact</span>
          </div>
          <p className="text-[10px] text-slate-600 text-center leading-relaxed max-w-md mx-auto">
            For entertainment and informational purposes only. Prices and availability subject to change without notice.
            Clouded Deals is not a dispensary and does not sell cannabis products.
            Please consume responsibly. Must be 21+ to use this site.
          </p>
          <p className="text-[10px] text-slate-700 text-center mt-3">
            © {new Date().getFullYear()} Clouded Deals. Las Vegas, NV.
          </p>
        </div>
      </div>
    </footer>
  );
}
