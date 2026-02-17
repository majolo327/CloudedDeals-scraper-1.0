import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, TrendingUp, Store } from 'lucide-react';
import { fetchAllActiveDeals, getScrapedDispensaries } from '@/lib/seo-data';
import {
  WebSiteJsonLd,
  OrganizationJsonLd,
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
  title: 'Las Vegas Dispensary Deals Today — Every Deal, Every Dispensary',
  description:
    'Compare cannabis deals from every Las Vegas dispensary, updated daily at 8 AM PT. Flower, vapes, edibles, concentrates & pre-rolls — the best prices in one place.',
  keywords: [
    'las vegas dispensary deals',
    'vegas weed deals',
    'dispensary near the strip',
    'las vegas cannabis deals',
    'cheap weed las vegas',
    'vegas dispensary',
    'las vegas marijuana deals',
  ],
  alternates: {
    canonical: `${SITE_URL}/las-vegas-dispensary-deals`,
  },
  openGraph: {
    title: 'Las Vegas Dispensary Deals Today — Every Deal, Every Dispensary | CloudedDeals',
    description:
      'Compare cannabis deals from every Las Vegas dispensary, updated daily. The best prices on flower, vapes, edibles & concentrates.',
    url: `${SITE_URL}/las-vegas-dispensary-deals`,
    siteName: 'CloudedDeals',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Las Vegas Dispensary Deals Today | CloudedDeals',
    description:
      'Every deal from every Las Vegas dispensary. Flower, vapes, edibles & concentrates — updated daily at 8 AM.',
  },
};

// ---------------------------------------------------------------------------
// FAQs for structured data
// ---------------------------------------------------------------------------
const FAQS = [
  {
    question: 'How often are deals updated on CloudedDeals?',
    answer:
      'We check every Las Vegas dispensary every morning. Deals are refreshed daily at 8 AM Pacific Time, so you always see the latest prices.',
  },
  {
    question: 'Which dispensaries does CloudedDeals cover?',
    answer:
      'We cover 27+ licensed dispensaries across Las Vegas, including popular spots near the Strip like Planet 13, Curaleaf, Oasis Cannabis, The Grove, and Thrive, plus downtown and local dispensaries throughout the valley.',
  },
  {
    question: 'Are these deals near the Las Vegas Strip?',
    answer:
      'Yes! We cover dispensaries in all zones — near the Strip, downtown, and throughout the Las Vegas valley. You can filter by location to find deals closest to you.',
  },
  {
    question: 'Do I need a medical card to get these deals?',
    answer:
      'No. All deals listed on CloudedDeals are from recreational (adult-use) dispensary menus. You just need to be 21+ with a valid government-issued ID.',
  },
  {
    question: 'Is CloudedDeals free to use?',
    answer:
      'Yes, CloudedDeals is completely free. No account needed. We check every dispensary every morning and bring every deal into one place — no sponsored placements.',
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
const CATEGORIES = ['flower', 'vapes', 'edibles', 'concentrates', 'prerolls'] as const;

export default async function LasVegasDealsPage() {
  const deals = await fetchAllActiveDeals();
  const dispensaries = getScrapedDispensaries();

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const deal of deals) {
    const cat = deal.category;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Unique dispensaries with deals
  const dispWithDeals = new Set(deals.map((d) => d.dispensary_id));

  // Zone breakdown
  const stripDisps = dispensaries.filter((d) => d.zone === 'strip');
  const downtownDisps = dispensaries.filter((d) => d.zone === 'downtown');
  const localDisps = dispensaries.filter((d) => d.zone === 'local');

  // Featured deals (top 12)
  const featured = deals.slice(0, 12);

  // Build Deal objects for JSON-LD
  const jsonLdDeals: Deal[] = featured.slice(0, 10).map((d) => {
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
      <WebSiteJsonLd />
      <OrganizationJsonLd />
      <BreadcrumbJsonLd items={[{ name: 'Las Vegas Dispensary Deals', href: '/las-vegas-dispensary-deals' }]} />
      <FaqJsonLd faqs={FAQS} />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb items={[{ name: 'Las Vegas Dispensary Deals', href: '/las-vegas-dispensary-deals' }]} />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Las Vegas Dispensary Deals — Updated Daily
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mb-6">
            We check every dispensary in Las Vegas every morning and bring every deal into one place.
            Flower, vapes, edibles, concentrates — the best prices, no account needed.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-2xl font-bold">{deals.length}</span>
              </div>
              <p className="text-xs text-slate-500">Deals Today</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Store className="w-4 h-4" />
                <span className="text-2xl font-bold">{dispWithDeals.size}</span>
              </div>
              <p className="text-xs text-slate-500">Dispensaries</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-2xl font-bold">{stripDisps.length}</span>
              </div>
              <p className="text-xs text-slate-500">Near the Strip</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-2xl font-bold">8 AM</span>
              </div>
              <p className="text-xs text-slate-500">Daily Refresh</p>
            </div>
          </div>
        </div>

        {/* Category quick links */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {CATEGORIES.map((cat) => {
              const dbCat = cat === 'vapes' ? 'vape' : cat === 'edibles' ? 'edible' : cat === 'concentrates' ? 'concentrate' : cat === 'prerolls' ? 'preroll' : cat;
              return (
                <Link
                  key={cat}
                  href={`/deals/${cat}`}
                  className="p-4 rounded-xl bg-white/[0.03] border text-center hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <p className="text-sm font-semibold text-slate-200 mb-1">
                    {getCategoryLabel(cat)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {categoryCounts[dbCat] || 0} deals
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Featured deals */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Top Deals Today</h2>
            <Link
              href="/"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Open App for All Deals
            </Link>
          </div>
          <SeoDealsTable deals={featured} showDispensary />
        </section>

        {/* Dispensary directory by zone */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-6">Las Vegas Dispensaries</h2>

          {/* Strip */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-300">
                Near the Strip ({stripDisps.length})
              </h3>
              <Link
                href="/strip-dispensary-deals"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                View Strip Deals
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {stripDisps.map((d) => (
                <Link
                  key={d.id}
                  href={`/dispensary/${d.slug}`}
                  className="p-3 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">{d.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{d.address}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Downtown */}
          {downtownDisps.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-semibold text-slate-300 mb-3">
                Downtown ({downtownDisps.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {downtownDisps.map((d) => (
                  <Link
                    key={d.id}
                    href={`/dispensary/${d.slug}`}
                    className="p-3 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <p className="text-sm font-medium text-slate-200 mb-1">{d.name}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{d.address}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Local */}
          <div>
            <h3 className="text-base font-semibold text-slate-300 mb-3">
              Local / Off-Strip ({localDisps.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {localDisps.map((d) => (
                <Link
                  key={d.id}
                  href={`/dispensary/${d.slug}`}
                  className="p-3 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">{d.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{d.address}</p>
                </Link>
              ))}
            </div>
          </div>
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

        {/* SEO body copy */}
        <section className="mb-10 max-w-3xl">
          <h2 className="text-xl font-semibold mb-4">
            Finding the Best Cannabis Deals in Las Vegas
          </h2>
          <div className="prose prose-sm prose-invert prose-slate max-w-none text-slate-400 leading-relaxed space-y-4">
            <p>
              Las Vegas is home to dozens of licensed cannabis dispensaries, each running
              their own daily specials and promotions. With so many options, finding the
              best deal on flower, vapes, edibles, or concentrates can be overwhelming
              — especially if you&apos;re visiting and unfamiliar with local pricing.
            </p>
            <p>
              CloudedDeals solves this by checking every dispensary in Las Vegas every
              single morning. Our system scans menus from 27+ dispensaries across the
              valley — from Strip-adjacent spots like Planet 13 and Oasis Cannabis to
              local favorites in Henderson and North Las Vegas. Every deal is scored on
              discount percentage, absolute savings, and value, then ranked so the best
              deals rise to the top.
            </p>
            <p>
              Whether you&apos;re looking for the cheapest eighth of flower near the
              Strip, the best vape cartridge deals downtown, or affordable edibles for
              a night out, CloudedDeals has you covered. All deals refresh daily at
              8 AM Pacific Time, so you&apos;re always seeing current prices. No
              account required — just open the app and start saving.
            </p>
          </div>
        </section>
      </main>

      <SeoFooter />
    </div>
  );
}
