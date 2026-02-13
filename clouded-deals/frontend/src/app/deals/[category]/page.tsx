import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchDealsForCategory } from '@/lib/seo-data';
import {
  BreadcrumbJsonLd,
  ProductListJsonLd,
  getCategoryLabel,
  slugToCategory,
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

const VALID_SLUGS = ['flower', 'vapes', 'edibles', 'concentrates', 'prerolls'] as const;

export async function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ category: slug }));
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------
interface PageProps {
  params: { category: string };
}

const CATEGORY_SEO: Record<
  string,
  { title: string; description: string; keywords: string[] }
> = {
  flower: {
    title: 'Las Vegas Flower Deals Today — Best Prices',
    description:
      'Compare flower deals from every Las Vegas dispensary. Find the cheapest eighths, quarters, and ounces updated daily at 8 AM PT.',
    keywords: ['las vegas flower deals', 'cheap weed las vegas', 'vegas eighths deals', 'dispensary flower prices'],
  },
  vapes: {
    title: 'Las Vegas Vape Deals Today — Carts, Disposables & Pods',
    description:
      'Best vape deals in Las Vegas. Compare prices on cartridges, disposables & pods from every dispensary, updated daily.',
    keywords: ['vegas vape deals', 'las vegas cartridge deals', 'cheap vapes vegas', 'dispensary vape prices'],
  },
  edibles: {
    title: 'Las Vegas Edible Deals Today — Gummies, Chocolates & More',
    description:
      'Find the best edible deals in Las Vegas. Gummies, chocolates, drinks & more from every dispensary, updated daily at 8 AM PT.',
    keywords: ['vegas edible deals', 'las vegas gummy deals', 'cheap edibles vegas', 'dispensary edible prices'],
  },
  concentrates: {
    title: 'Las Vegas Concentrate Deals Today — Wax, Shatter & Live Resin',
    description:
      'Top concentrate deals in Las Vegas. Live resin, badder, shatter & wax from every dispensary, updated daily.',
    keywords: ['vegas concentrate deals', 'las vegas dab deals', 'cheap concentrates vegas', 'live resin deals vegas'],
  },
  prerolls: {
    title: 'Las Vegas Pre-Roll Deals Today — Singles, Packs & Infused',
    description:
      'Best pre-roll deals in Las Vegas. Singles, multi-packs & infused pre-rolls from every dispensary, updated daily at 8 AM PT.',
    keywords: ['vegas preroll deals', 'las vegas joint deals', 'cheap prerolls vegas', 'infused preroll deals'],
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';
  const seo = CATEGORY_SEO[params.category];

  if (!seo) {
    return { title: 'Category Not Found' };
  }

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: `${siteUrl}/deals/${params.category}`,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${siteUrl}/deals/${params.category}`,
      siteName: 'CloudedDeals',
      type: 'website',
      images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function CategoryDealsPage({ params }: PageProps) {
  const dbCategory = slugToCategory(params.category);
  const label = getCategoryLabel(params.category);

  if (!dbCategory) {
    return (
      <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
        <SeoPageHeader />
        <main className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
          <Link
            href="/las-vegas-dispensary-deals"
            className="inline-block px-6 py-3 bg-purple-500/20 text-purple-400 rounded-lg font-medium hover:bg-purple-500/30 transition-colors"
          >
            Browse All Deals
          </Link>
        </main>
        <SeoFooter />
      </div>
    );
  }

  const deals = await fetchDealsForCategory(dbCategory);

  // Unique dispensaries in this category
  const dispensaryIds = new Set(deals.map((d) => d.dispensary_id));
  const dispensariesWithDeals = DISPENSARIES.filter(
    (d) => d.scraped && dispensaryIds.has(d.id)
  );

  // Price range
  const prices = deals.map((d) => d.sale_price).sort((a, b) => a - b);
  const minPrice = prices[0] ?? 0;
  const maxPrice = prices[prices.length - 1] ?? 0;

  // Top brands
  const brandCounts: Record<string, number> = {};
  for (const deal of deals) {
    if (deal.brand && deal.brand !== 'Unknown') {
      brandCounts[deal.brand] = (brandCounts[deal.brand] || 0) + 1;
    }
  }
  const topBrands = Object.entries(brandCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  // Build Deal objects for JSON-LD
  const jsonLdDeals: Deal[] = deals.slice(0, 10).map((d) => {
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
          { name: `${label} Deals`, href: `/deals/${params.category}` },
        ]}
      />
      <ProductListJsonLd deals={jsonLdDeals} />

      <SeoPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Breadcrumb
          items={[
            { name: 'Las Vegas Deals', href: '/las-vegas-dispensary-deals' },
            { name: `${label} Deals`, href: `/deals/${params.category}` },
          ]}
        />

        {/* Category header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Best {label} Deals in Las Vegas Today
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mb-4">
            {deals.length} {label.toLowerCase()} deal{deals.length !== 1 ? 's' : ''} from{' '}
            {dispensariesWithDeals.length} dispensaries.
            {minPrice > 0 && maxPrice > 0 && (
              <> Prices from ${minPrice.toFixed(0)} to ${maxPrice.toFixed(0)}.</>
            )}{' '}
            Updated daily at 8 AM PT.
          </p>
        </div>

        {/* Top brands in this category */}
        {topBrands.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-slate-300 mb-3">
              Top {label} Brands Today
            </h2>
            <div className="flex flex-wrap gap-2">
              {topBrands.map(([brand, count]) => (
                <span
                  key={brand}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300"
                >
                  {brand} ({count})
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Category links */}
        <div className="flex flex-wrap gap-2 mb-6">
          {VALID_SLUGS.map((cat) => (
            <Link
              key={cat}
              href={`/deals/${cat}`}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                cat === params.category
                  ? 'bg-purple-500/20 text-purple-400 font-semibold'
                  : 'bg-white/5 text-slate-400 hover:bg-purple-500/10 hover:text-purple-400'
              }`}
            >
              {getCategoryLabel(cat)}
            </Link>
          ))}
        </div>

        {/* Deals grid */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Today&apos;s {label} Deals
          </h2>
          <SeoDealsTable deals={deals} showDispensary />
        </section>

        {/* Dispensaries with deals in this category */}
        {dispensariesWithDeals.length > 0 && (
          <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-lg font-semibold mb-4">
              Dispensaries with {label} Deals
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {dispensariesWithDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/dispensary/${d.slug}`}
                  className="p-3 rounded-xl bg-white/[0.03] border hover:border-purple-500/30 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.address}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

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
              Strip Dispensary Deals
            </Link>
          </div>
        </section>
      </main>

      <SeoFooter />
    </div>
  );
}
