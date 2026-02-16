import Link from 'next/link';

const CATEGORIES = [
  { slug: 'flower', label: 'Flower Deals' },
  { slug: 'vapes', label: 'Vape Deals' },
  { slug: 'edibles', label: 'Edible Deals' },
  { slug: 'concentrates', label: 'Concentrate Deals' },
  { slug: 'prerolls', label: 'Pre-Roll Deals' },
];

const POPULAR_DISPENSARIES = [
  { slug: 'planet13', label: 'Planet 13' },
  { slug: 'curaleaf-strip', label: 'Curaleaf Strip' },
  { slug: 'oasis', label: 'Oasis Cannabis' },
  { slug: 'the-grove', label: 'The Grove' },
  { slug: 'thrive-strip', label: 'Thrive Strip' },
  { slug: 'cultivate-spring', label: 'Cultivate' },
  { slug: 'medizin', label: 'Medizin' },
  { slug: 'td-gibson', label: 'The Dispensary Gibson' },
  { slug: 'greenlight-downtown', label: 'Greenlight Downtown' },
  { slug: 'deep-roots-cheyenne', label: 'Deep Roots Cheyenne' },
];

export function SeoFooter() {
  return (
    <footer
      className="border-t mt-12"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'rgba(10, 14, 26, 0.6)' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Navigation columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          {/* Deals */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Deals</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/las-vegas-dispensary-deals"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  All Las Vegas Deals
                </Link>
              </li>
              <li>
                <Link
                  href="/strip-dispensary-deals"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Strip Dispensary Deals
                </Link>
              </li>
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/deals/${cat.slug}`}
                    className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Dispensaries */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Dispensaries</h2>
            <ul className="space-y-2">
              {POPULAR_DISPENSARIES.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/dispensary/${d.slug}`}
                    className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                  >
                    {d.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/browse"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  View All Dispensaries
                </Link>
              </li>
            </ul>
          </div>

          {/* App */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">App</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Today&apos;s Deals
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Search Deals
                </Link>
              </li>
              <li>
                <Link
                  href="/browse"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Browse
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Legal</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@cloudeddeals.com"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Trust + disclaimer */}
        <div className="border-t pt-6" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-center text-xs text-slate-500 leading-relaxed mb-3">
            Every deal is ranked on merit. No sponsored placements. No ads. Ever.
          </p>
          <p className="text-center text-xs text-slate-600 leading-relaxed max-w-lg mx-auto mb-2">
            CloudedDeals is not a licensed cannabis retailer and does not sell, distribute,
            or deliver cannabis products. All deals are subject to dispensary verification.
            Prices shown do not include tax. For adults 21+ only. This is not medical advice.
          </p>
          <p className="text-center text-[10px] text-slate-700 leading-relaxed max-w-lg mx-auto mb-3">
            Cannabis is illegal under federal law. Do not transport cannabis across state lines.
            Do not operate a vehicle under the influence. Keep out of reach of children.
          </p>
          <p className="text-xs text-slate-600 text-center">
            &copy; {new Date().getFullYear()} CloudedDeals. Las Vegas, NV.
          </p>
        </div>
      </div>
    </footer>
  );
}
