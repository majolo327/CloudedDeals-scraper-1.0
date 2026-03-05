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
  title: 'Downtown Las Vegas Dispensary Deals — Fremont & Arts District Prices',
  description:
    'Find the best cannabis deals near Downtown Las Vegas and Fremont Street. Compare prices from Greenlight, Thrive, Curaleaf Western & more — updated daily.',
  keywords: [
    'downtown las vegas dispensary',
    'fremont street dispensary deals',
    'arts district dispensary',
    'downtown vegas weed deals',
    'dispensary near fremont street',
    'downtown las vegas cannabis',
  ],
  alternates: {
    canonical: `${SITE_URL}/downtown-dispensary-deals`,
  },
  openGraph: {
    title: 'Downtown Las Vegas Dispensary Deals | CloudedDeals',
    description:
      'Best cannabis deals from dispensaries near Downtown Las Vegas. Greenlight, Thrive, Curaleaf & more — updated daily.',
    url: `${SITE_URL}/downtown-dispensary-deals`,
    siteName: 'CloudedDeals',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Downtown Dispensary Deals — Las Vegas | CloudedDeals',
    description:
      'Cannabis deals near Downtown Las Vegas. Greenlight, Thrive, Curaleaf Western & more.',
  },
};

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
const FAQS = [
  {
    question: 'Which dispensaries are in Downtown Las Vegas?',
    answer:
      'Downtown dispensaries include Greenlight Downtown on 3rd Street (near Fremont East), Curaleaf Western on Western Avenue, and Thrive Main Street in the Arts District. All are within a short drive or rideshare from Fremont Street Experience.',
  },
  {
    question: 'Are Downtown dispensaries cheaper than the Strip?',
    answer:
      'Downtown dispensaries generally price between Strip and off-strip levels. Daily specials at Greenlight Downtown and Thrive Main St often match local pricing. Curaleaf Western runs the same promotions as other Curaleaf locations.',
  },
  {
    question: 'Can I walk to a dispensary from Fremont Street?',
    answer:
      'Greenlight Downtown is the closest to Fremont Street, located on South 3rd Street — about a 10-minute walk from the Fremont Street Experience. Thrive Main Street in the Arts District is also within walking distance.',
  },
  {
    question: 'What deals are available Downtown today?',
    answer:
      'Deals change daily. CloudedDeals checks every Downtown dispensary every morning at 8 AM PT. Visit this page or the homepage to see today\'s current specials.',
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function DowntownDealsPage() {
  const allDeals = await fetchAllActiveDeals();
  const downtownDispensaries = getDispensariesByZone('downtown');
  const downtownDispIds = new Set(downtownDispensaries.map((d) => d.id));

  // Filter to downtown dispensary deals only
  const downtownDeals = allDeals.filter((d) => downtownDispIds.has(d.dispensary_id));

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const deal of downtownDeals) {
    categoryCounts[deal.category] = (categoryCounts[deal.category] || 0) + 1;
  }

  // Build Deal objects for JSON-LD
  const jsonLdDeals: Deal[] = downtownDeals.slice(0, 10).map((d) => {
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
          { name: 'Downtown Dispensary Deals', href: '/downtown-dispensary-deals' },
        ]}
      />
      <FaqJsonLd faqs={FAQS} />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
            { name: 'Downtown Dispensary Deals', href: '/downtown-dispensary-deals' },
          ]}
        />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Downtown Las Vegas Dispensary Deals
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mb-6">
            {downtownDeals.length} deals from {downtownDispensaries.length} dispensaries
            in Downtown Las Vegas. Covering the Fremont Street area and Arts District.
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

        {/* Downtown dispensaries directory */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Downtown Dispensaries
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {downtownDispensaries.map((d) => {
              const dealCount = downtownDeals.filter(
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

        {/* Downtown deals */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today&apos;s Downtown Dispensary Deals</h2>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Updated daily at 8 AM PT
            </span>
          </div>
          <SeoDealsTable deals={downtownDeals} showDispensary />
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
            Cannabis Shopping in Downtown Las Vegas
          </h2>
          <div className="text-sm text-slate-400 leading-relaxed space-y-3">
            <p>
              Downtown Las Vegas — including the Fremont Street Experience and the
              Arts District — is home to a growing number of cannabis dispensaries.
              While the Strip gets most of the tourist traffic, Downtown shops like
              Greenlight Downtown and Thrive Main Street offer a more relaxed shopping
              experience with competitive daily specials. Curaleaf Western, located on
              Western Avenue near the I-15, is easily accessible from both Downtown and
              the Strip corridor.
            </p>
            <p>
              Downtown dispensaries tend to see less foot traffic than Strip locations,
              which often means shorter wait times and more attentive service. If
              you&apos;re staying at a Downtown hotel or visiting Fremont Street,
              there&apos;s no need to Uber to the Strip for cannabis — the Downtown
              options have you covered with fresh deals every morning.
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
              href="/local-dispensary-deals"
              className="px-4 py-2 rounded-lg bg-white/5 text-sm text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
            >
              Local / Off-Strip Deals
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
