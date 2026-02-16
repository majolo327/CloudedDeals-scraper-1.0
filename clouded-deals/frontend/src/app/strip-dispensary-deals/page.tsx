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
  title: 'Dispensary Deals Near the Las Vegas Strip — Today\'s Best Prices',
  description:
    'Find the best cannabis deals near the Las Vegas Strip. Compare prices from Planet 13, Curaleaf, Oasis, The Grove & more — updated daily at 8 AM PT.',
  keywords: [
    'dispensary near the strip',
    'vegas strip weed deals',
    'dispensary las vegas strip',
    'cannabis near las vegas strip',
    'strip dispensary deals',
    'weed near the strip',
  ],
  alternates: {
    canonical: `${SITE_URL}/strip-dispensary-deals`,
  },
  openGraph: {
    title: 'Dispensary Deals Near the Las Vegas Strip | CloudedDeals',
    description:
      'Best cannabis deals from dispensaries near the Las Vegas Strip. Planet 13, Curaleaf, Oasis & more — updated daily.',
    url: `${SITE_URL}/strip-dispensary-deals`,
    siteName: 'CloudedDeals',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strip Dispensary Deals — Las Vegas | CloudedDeals',
    description:
      'Cannabis deals near the Strip. Planet 13, Curaleaf, Oasis, The Grove & more.',
  },
};

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
const FAQS = [
  {
    question: 'Which dispensaries are near the Las Vegas Strip?',
    answer:
      'Popular dispensaries near the Strip include Planet 13, Curaleaf Strip, Curaleaf - The Reef, Oasis Cannabis, The Grove, Thrive Sammy Davis Jr, Cultivate Spring Mountain, and Beyond/Hello Twain. All are within a short drive or rideshare from major Strip hotels.',
  },
  {
    question: 'What are typical prices at Strip dispensaries?',
    answer:
      'Prices vary by dispensary and product. Flower eighths typically range from $15-$50, vape cartridges from $20-$45, and edibles from $10-$30. Strip-adjacent dispensaries often run competitive daily specials to attract visitors.',
  },
  {
    question: 'Can I walk to a dispensary from the Strip?',
    answer:
      'Several dispensaries are within walking distance of the Strip, including Curaleaf Strip on Las Vegas Blvd, and Oasis Cannabis on Industrial Rd. Others like Planet 13 and The Grove are a short rideshare away.',
  },
  {
    question: 'Do Strip dispensaries offer delivery?',
    answer:
      'Many Las Vegas dispensaries offer delivery services. Check each dispensary\'s menu page for delivery options. CloudedDeals focuses on in-store deals and specials, which are typically the best value.',
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function StripDealsPage() {
  const allDeals = await fetchAllActiveDeals();
  const stripDispensaries = getDispensariesByZone('strip');
  const stripDispIds = new Set(stripDispensaries.map((d) => d.id));

  // Filter to strip dispensary deals only
  const stripDeals = allDeals.filter((d) => stripDispIds.has(d.dispensary_id));

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
          { name: 'Strip Dispensary Deals', href: '/strip-dispensary-deals' },
        ]}
      />
      <FaqJsonLd faqs={FAQS} />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
            { name: 'Strip Dispensary Deals', href: '/strip-dispensary-deals' },
          ]}
        />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Dispensary Deals Near the Las Vegas Strip
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mb-6">
            {stripDeals.length} deals from {stripDispensaries.length} dispensaries near
            the Strip. Whether you&apos;re visiting or heading out for the night, find the
            best prices within minutes of the Las Vegas Strip. Updated daily at 8 AM PT.
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

        {/* Strip dispensaries directory */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Dispensaries Near the Strip
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stripDispensaries.map((d) => {
              const dealCount = stripDeals.filter(
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
                        {dealCount} deal{dealCount !== 1 ? 's' : ''}
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

        {/* Strip deals */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today&apos;s Strip Dispensary Deals</h2>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Updated daily at 8 AM PT
            </span>
          </div>
          <SeoDealsTable deals={stripDeals} showDispensary />
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
            Cannabis Shopping Near the Las Vegas Strip
          </h2>
          <div className="text-sm text-slate-400 leading-relaxed space-y-3">
            <p>
              The Las Vegas Strip is surrounded by some of Nevada&apos;s most popular
              cannabis dispensaries. From the massive Planet 13 — one of the largest
              dispensaries in the world — to boutique shops like Oasis Cannabis and
              The Grove, visitors have plenty of options within a short drive or
              rideshare from any major hotel.
            </p>
            <p>
              Strip-area dispensaries are known for running competitive daily specials,
              especially on flower, pre-rolls, and vape cartridges. Prices tend to be
              slightly higher than off-strip locations, but the daily deals can match
              or beat local pricing. CloudedDeals tracks every special so you can
              compare and find the best value without visiting multiple shops.
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
