import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ExternalLink, Clock } from 'lucide-react';
import { DISPENSARIES } from '@/data/dispensaries';
import { getDispensaryWithDeals } from '@/lib/seo-data';
import {
  LocalBusinessJsonLd,
  BreadcrumbJsonLd,
  ProductListJsonLd,
  getCategoryLabel,
  Breadcrumb,
  SeoDealsTable,
  SeoPageHeader,
  SeoFooter,
} from '@/components/seo';
import type { Deal, Dispensary as DispensaryType } from '@/types';

// ---------------------------------------------------------------------------
// ISR: revalidate every hour so deals stay fresh
// ---------------------------------------------------------------------------
export const revalidate = 3600;

// ---------------------------------------------------------------------------
// Generate static params for all scraped dispensaries
// ---------------------------------------------------------------------------
export async function generateStaticParams() {
  return DISPENSARIES.filter((d) => d.scraped).map((d) => ({ slug: d.slug }));
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------
interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';
  const staticDisp = DISPENSARIES.find((d) => d.slug === params.slug);

  if (!staticDisp) {
    return { title: 'Dispensary Not Found' };
  }

  const title = `${staticDisp.name} Deals Today — Las Vegas`;
  const description = `Today's best cannabis deals at ${staticDisp.name} in Las Vegas. Flower, vapes, edibles & concentrates updated daily at 8 AM PT.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/dispensary/${params.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/dispensary/${params.slug}`,
      siteName: 'CloudedDeals',
      type: 'website',
      images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function DispensaryPage({ params }: PageProps) {
  const { dispensary, deals } = await getDispensaryWithDeals(params.slug);

  if (!dispensary) {
    return (
      <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
        <SeoPageHeader />
        <main className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Dispensary Not Found</h1>
          <p className="text-slate-400 mb-6">
            We don&apos;t have deals for this dispensary yet.
          </p>
          <Link
            href="/las-vegas-dispensary-deals"
            className="inline-block px-6 py-3 bg-purple-500/20 text-purple-400 rounded-lg font-medium hover:bg-purple-500/30 transition-colors"
          >
            Browse All Dispensaries
          </Link>
        </main>
        <SeoFooter />
      </div>
    );
  }

  const staticDisp = DISPENSARIES.find((d) => d.slug === params.slug)!;
  const zoneLabel =
    dispensary.zone === 'strip'
      ? 'Near the Strip'
      : dispensary.zone === 'downtown'
        ? 'Downtown'
        : 'Local';

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const deal of deals) {
    categoryCounts[deal.category] = (categoryCounts[deal.category] || 0) + 1;
  }

  // Build mock Deal objects for ProductListJsonLd
  const jsonLdDeals: Deal[] = deals.slice(0, 10).map((d) => ({
    id: d.id,
    product_name: d.name,
    category: d.category,
    weight: d.weight_value ? `${d.weight_value}${d.weight_unit || 'g'}` : '',
    original_price: d.original_price,
    deal_price: d.sale_price,
    dispensary: staticDisp as DispensaryType,
    brand: { id: d.brand.toLowerCase().replace(/\s+/g, '-'), name: d.brand, slug: d.brand.toLowerCase().replace(/\s+/g, '-'), tier: 'local' as const, categories: [] },
    deal_score: d.deal_score,
    is_verified: d.deal_score >= 70,
    created_at: new Date(),
  }));

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Structured data */}
      <LocalBusinessJsonLd dispensary={staticDisp as DispensaryType} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
          { name: dispensary.name, href: `/dispensary/${dispensary.slug}` },
        ]}
      />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
            { name: dispensary.name, href: `/dispensary/${dispensary.slug}` },
          ]}
        />

        {/* Dispensary header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {dispensary.name} Deals Today
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mb-4">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} available today at{' '}
            {dispensary.name} in Las Vegas. Updated daily at 8 AM PT.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {dispensary.address}
            </span>
            <span className="px-2 py-0.5 rounded bg-white/5 text-xs">
              {zoneLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Refreshed daily
            </span>
            {dispensary.menu_url && (
              <a
                href={dispensary.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Full Menu
              </a>
            )}
          </div>
        </div>

        {/* Category quick links */}
        {Object.keys(categoryCounts).length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
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

        {/* Deals grid */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Today&apos;s Deals at {dispensary.name}
          </h2>
          <SeoDealsTable deals={deals} showDispensary={false} />
        </section>

        {/* Internal links */}
        <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-lg font-semibold mb-4">More Las Vegas Dispensary Deals</h2>
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
              Strip Dispensary Deals
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
