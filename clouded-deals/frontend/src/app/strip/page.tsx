import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { fetchAllActiveDeals } from '@/lib/seo-data';
import {
  BreadcrumbJsonLd,
  ProductListJsonLd,
  getCategoryLabel,
  Breadcrumb,
  SeoDealsTable,
  SeoPageHeader,
  SeoFooter,
} from '@/components/seo';
import { DISPENSARIES } from '@/data/dispensaries';
import type { Deal, Dispensary as DispensaryType } from '@/types';

// ---------------------------------------------------------------------------
// ISR: revalidate every hour
// ---------------------------------------------------------------------------
export const revalidate = 3600;

// ---------------------------------------------------------------------------
// Curated dispensary list — strip + downtown + select nearby locals
// "Within an 8 min uber from the Strip" — tourist beta targeting
// ---------------------------------------------------------------------------
const STRIP_PAGE_DISPENSARY_IDS = new Set([
  // Strip zone
  'planet13',
  'curaleaf-strip',
  'curaleaf-the-reef',
  'oasis',
  'the-grove',
  'cultivate-spring',
  'thrive-strip',
  'beyond-hello-twain',
  'rise-tropicana',
  // Downtown
  'greenlight-downtown',
  'curaleaf-western',
  'thrive-main',
  // Nearby locals (Paradise Rd / Decatur — short ride from strip)
  'td-decatur',
  'mint-paradise',
  'greenlight-paradise',
]);

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';

export const metadata: Metadata = {
  title: 'Las Vegas Strip Dispensary Deals — Best Prices Near You | CloudedDeals',
  description:
    'Cannabis deals near the Las Vegas Strip & Downtown. Compare prices from Planet 13, Curaleaf, Oasis, The Grove, Mint & more — updated daily at 8 AM PT.',
  keywords: [
    'dispensary near the strip',
    'vegas strip weed deals',
    'dispensary las vegas strip',
    'cannabis near las vegas strip',
    'weed deals vegas tourist',
    'dispensary downtown las vegas',
    'best dispensary near strip',
  ],
  alternates: {
    canonical: `${SITE_URL}/strip`,
  },
  openGraph: {
    title: 'Strip & Downtown Dispensary Deals | CloudedDeals',
    description:
      'Best cannabis deals near the Las Vegas Strip & Downtown. Planet 13, Curaleaf, Oasis, Mint & more — updated daily.',
    url: `${SITE_URL}/strip`,
    siteName: 'CloudedDeals',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strip & Downtown Deals — Las Vegas | CloudedDeals',
    description:
      'Cannabis deals near the Strip & Downtown. Planet 13, Curaleaf, Oasis, Mint & more.',
  },
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function StripPage() {
  const allDeals = await fetchAllActiveDeals();

  // Filter to curated dispensary list only
  const stripDeals = allDeals.filter((d) => STRIP_PAGE_DISPENSARY_IDS.has(d.dispensary_id));

  // Get static dispensary info for the directory cards
  const stripDispensaries = DISPENSARIES.filter(
    (d) => d.scraped && STRIP_PAGE_DISPENSARY_IDS.has(d.id)
  );

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const deal of stripDeals) {
    categoryCounts[deal.category] = (categoryCounts[deal.category] || 0) + 1;
  }

  // Build Deal objects for JSON-LD
  const jsonLdDeals: Deal[] = stripDeals.slice(0, 10).map((d) => {
    const staticDisp = DISPENSARIES.find((disp) => disp.id === d.dispensary_id);
    return {
      id: d.id,
      product_name: d.name,
      category: d.category,
      weight: d.weight_value ? `${d.weight_value}${d.weight_unit || 'g'}` : '',
      original_price: d.original_price,
      deal_price: d.sale_price,
      dispensary: (staticDisp || { id: d.dispensary_id, name: d.dispensary_name, slug: d.dispensary_id, tier: 'standard', address: '', menu_url: '', platform: 'dutchie', is_active: true }) as DispensaryType,
      brand: { id: d.brand.toLowerCase().replace(/\s+/g, '-'), name: d.brand, slug: d.brand.toLowerCase().replace(/\s+/g, '-'), tier: 'local' as const, categories: [] },
      deal_score: d.deal_score,
      is_verified: d.deal_score >= 70,
      created_at: new Date(),
    };
  });

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Structured data */}
      <BreadcrumbJsonLd
        items={[
          { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
          { name: 'Strip & Downtown Deals', href: '/strip' },
        ]}
      />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
            { name: 'Strip & Downtown Deals', href: '/strip' },
          ]}
        />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Dispensary Deals Near the Las Vegas Strip
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mb-4">
            {stripDeals.length} deals from {stripDispensaries.length} dispensaries near
            the Strip &amp; Downtown. All within a short rideshare from major hotels.
            Updated daily at 8 AM PT.
          </p>
          <p className="text-slate-500 text-xs max-w-xl mb-6">
            Includes Strip, Downtown, and nearby locations on Paradise Rd &amp; Decatur
            — everywhere worth hitting within an 8-minute Uber.
          </p>

          {/* Category quick links */}
          {Object.keys(categoryCounts).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <Link
                  key={cat}
                  href={`/deals/${cat === 'vape' ? 'vapes' : cat === 'edible' ? 'edibles' : cat === 'concentrate' ? 'concentrates' : cat === 'preroll' ? 'prerolls' : cat}`}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
                >
                  {getCategoryLabel(cat)} ({count})
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Dispensary directory */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Dispensaries Near the Strip &amp; Downtown
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stripDispensaries.map((disp) => {
              const dealCount = stripDeals.filter(
                (deal) => deal.dispensary_id === disp.id
              ).length;
              const zoneLabel = disp.zone === 'strip' ? 'Strip' : disp.zone === 'downtown' ? 'Downtown' : 'Nearby';
              const zoneBg = disp.zone === 'strip' ? 'bg-amber-500/10 text-amber-400' : disp.zone === 'downtown' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-500/10 text-slate-400';
              return (
                <Link
                  key={disp.id}
                  href={`/dispensary/${disp.slug}`}
                  className="p-4 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-200">{disp.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${zoneBg}`}>
                        {zoneLabel}
                      </span>
                      {dealCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-xs text-purple-400 font-medium">
                          {dealCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {disp.address}
                  </p>
                  {disp.menu_url && (
                    <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      View Full Menu
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Deals */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today&apos;s Deals</h2>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Updated daily at 8 AM PT
            </span>
          </div>
          <SeoDealsTable deals={stripDeals} showDispensary />
        </section>

        {/* CTA to main app */}
        <section className="mb-10 p-6 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center">
          <p className="text-sm text-slate-300 mb-3">
            Want filters, saved deals, and real-time price comparisons?
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
          >
            Open CloudedDeals App
          </Link>
        </section>

        {/* Internal links */}
        <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-semibold mb-4">More Las Vegas Cannabis Deals</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/las-vegas-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              All Las Vegas Deals
            </Link>
            {['flower', 'vapes', 'edibles', 'concentrates', 'prerolls'].map((cat) => (
              <Link
                key={cat}
                href={`/deals/${cat}`}
                className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
              >
                {getCategoryLabel(cat)} Deals
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SeoFooter />
    </div>
  );
}
