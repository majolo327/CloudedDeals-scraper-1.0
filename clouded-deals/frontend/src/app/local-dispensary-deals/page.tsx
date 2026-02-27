import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { fetchAllActiveDeals, getDispensariesByZone } from '@/lib/seo-data';
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
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
// Metadata
// ---------------------------------------------------------------------------
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';

export const metadata: Metadata = {
  title: 'Local Las Vegas Dispensary Deals — Henderson, NLV & Off-Strip Prices',
  description:
    'Best deals from local Las Vegas dispensaries. Henderson, North Las Vegas, Spring Valley & more — off-strip pricing updated daily.',
  keywords: [
    'local las vegas dispensary deals',
    'henderson dispensary deals',
    'north las vegas dispensary',
    'off strip dispensary deals',
    'cheap dispensary las vegas',
    'dispensary deals near me las vegas',
  ],
  alternates: {
    canonical: `${SITE_URL}/local-dispensary-deals`,
  },
  openGraph: {
    title: 'Local Las Vegas Dispensary Deals | CloudedDeals',
    description:
      'Best deals from local dispensaries. Henderson, NLV, Spring Valley & more — updated daily.',
    url: `${SITE_URL}/local-dispensary-deals`,
    siteName: 'CloudedDeals',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Dispensary Deals — Las Vegas | CloudedDeals',
    description:
      'Off-strip dispensary deals. Henderson, NLV, Spring Valley & more.',
  },
};

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
const FAQS = [
  {
    question: 'Are off-strip dispensaries cheaper than the Strip?',
    answer:
      'Generally yes. Off-strip dispensaries like The Dispensary, Deep Roots Harvest, and Medizin regularly post lower everyday prices than Strip locations. They also run aggressive daily specials that can save 20-40% off retail.',
  },
  {
    question: 'Which local dispensary has the best deals?',
    answer:
      'It changes daily. The Dispensary (Gibson and Decatur) and Deep Roots Harvest locations consistently score well on CloudedDeals. Check the current deals above — they refresh every morning at 8 AM PT.',
  },
  {
    question: 'Is it worth driving off-strip for dispensary deals?',
    answer:
      'For locals, absolutely — you can save significantly. For tourists, a 10-15 minute Uber to Henderson or North Las Vegas can save $20-30 per purchase compared to Strip pricing, especially on flower and concentrates.',
  },
  {
    question: 'Which neighborhoods have dispensaries?',
    answer:
      'Henderson (The Dispensary Gibson), Spring Valley (Mint Rainbow), North Las Vegas (Deep Roots, Thrive Cheyenne, Curaleaf Cheyenne), and the southwest valley (Medizin, Beyond/Hello Sahara, Cultivate Durango).',
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function LocalDealsPage() {
  const allDeals = await fetchAllActiveDeals();
  const localDispensaries = getDispensariesByZone('local');
  const localDispIds = new Set(localDispensaries.map((d) => d.id));

  // Filter to local dispensary deals only
  const localDeals = allDeals.filter((d) => localDispIds.has(d.dispensary_id));

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const deal of localDeals) {
    categoryCounts[deal.category] = (categoryCounts[deal.category] || 0) + 1;
  }

  // Build Deal objects for JSON-LD
  const jsonLdDeals: Deal[] = localDeals.slice(0, 10).map((d) => {
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
          { name: 'Local Dispensary Deals', href: '/local-dispensary-deals' },
        ]}
      />
      <FaqJsonLd faqs={FAQS} />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
            { name: 'Local Dispensary Deals', href: '/local-dispensary-deals' },
          ]}
        />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Local Las Vegas Dispensary Deals
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mb-6">
            {localDeals.length} deals from {localDispensaries.length} off-strip
            dispensaries in Henderson, North Las Vegas, Spring Valley & beyond.
            Updated daily at 8 AM PT.
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

        {/* Local dispensaries directory */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Local Dispensaries
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {localDispensaries.map((d) => {
              const dealCount = localDeals.filter(
                (deal) => deal.dispensary_id === d.id
              ).length;
              return (
                <Link
                  key={d.id}
                  href={`/dispensary/${d.slug}`}
                  className="p-4 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-200">{d.name}</p>
                    {dealCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/15 text-xs text-purple-400 font-medium">
                        {dealCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {d.address}
                  </p>
                  {d.menu_url && (
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

        {/* Local deals */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today&apos;s Local Dispensary Deals</h2>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Updated daily at 8 AM PT
            </span>
          </div>
          <SeoDealsTable deals={localDeals} showDispensary />
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div
                key={faq.question}
                className="p-4 rounded-xl bg-white/[0.02] border"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <h3 className="text-sm font-semibold text-slate-200 mb-2">{faq.question}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SEO copy */}
        <section className="mb-10 max-w-3xl">
          <h2 className="text-lg font-semibold mb-4">
            Off-Strip Cannabis Deals in Las Vegas
          </h2>
          <div className="text-sm text-slate-400 leading-relaxed space-y-3">
            <p>
              Las Vegas locals know that the best dispensary deals aren&apos;t on the
              Strip — they&apos;re in the neighborhoods. Henderson, North Las Vegas,
              Spring Valley, and the southwest valley are home to dozens of
              dispensaries that compete aggressively on price. Shops like The
              Dispensary, Deep Roots Harvest, and Medizin consistently undercut
              Strip pricing by 20-30%, and their daily specials go even deeper.
            </p>
            <p>
              CloudedDeals tracks every local dispensary in the valley, from
              Henderson&apos;s east side to North Las Vegas and everywhere in between.
              Whether you&apos;re a resident looking for your regular shop&apos;s
              daily specials or a tourist willing to Uber 10 minutes for better
              prices, the off-strip dispensaries deliver the best value in Las Vegas
              cannabis.
            </p>
          </div>
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
            <Link
              href="/strip-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              Strip Deals
            </Link>
            <Link
              href="/downtown-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              Downtown Deals
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
