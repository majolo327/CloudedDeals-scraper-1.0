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
  { title: string; description: string; keywords: string[]; intro: string; tips: string }
> = {
  flower: {
    title: 'Las Vegas Flower Deals Today — Best Prices',
    description:
      'Compare flower deals from every Las Vegas dispensary. Find the cheapest eighths, quarters, and ounces updated daily at 8 AM PT.',
    keywords: ['las vegas flower deals', 'cheap weed las vegas', 'vegas eighths deals', 'dispensary flower prices'],
    intro:
      'Flower is the most popular product in Las Vegas dispensaries, and prices vary wildly from shop to shop. An eighth that costs $60 at one dispensary can be $30 down the street — but only if you know where to look. CloudedDeals checks every dispensary in the valley every morning and lists every flower deal in one place so you can compare before you drive.',
    tips:
      'Look for daily specials — most Las Vegas dispensaries rotate flower deals throughout the week. Eighths are the most common deal size, but half-ounce and full-ounce bundles often have the deepest discounts. If you see a deal score above 70 on CloudedDeals, that means the price is significantly below the market average for that product. Tourists near the Strip should compare nearby dispensaries like Planet 13, The Grove, and Oasis — all within a short ride and often running competing flower specials.',
  },
  vapes: {
    title: 'Las Vegas Vape Deals Today — Carts, Disposables & Pods',
    description:
      'Best vape deals in Las Vegas. Compare prices on cartridges, disposables & pods from every dispensary, updated daily.',
    keywords: ['vegas vape deals', 'las vegas cartridge deals', 'cheap vapes vegas', 'dispensary vape prices'],
    intro:
      'Vape products are the fastest-growing category in the Las Vegas cannabis market. Half-gram and full-gram cartridges, all-in-one disposables, and pod systems are available at every dispensary in town — but pricing is all over the map. CloudedDeals tracks vape deals across every dispensary daily so you can find the best price on your preferred brand and format.',
    tips:
      'Half-gram cartridges are the entry point, but gram carts and multi-packs usually deliver better value per milligram. Live resin and rosin carts cost more but offer fuller flavor profiles. Disposable vapes are convenient for tourists who don\'t want to buy a battery. Check deal scores to find carts priced well below the Las Vegas average — anything above 70 is a strong deal.',
  },
  edibles: {
    title: 'Las Vegas Edible Deals Today — Gummies, Chocolates & More',
    description:
      'Find the best edible deals in Las Vegas. Gummies, chocolates, drinks & more from every dispensary, updated daily at 8 AM PT.',
    keywords: ['vegas edible deals', 'las vegas gummy deals', 'cheap edibles vegas', 'dispensary edible prices'],
    intro:
      'Edibles are a popular choice for Las Vegas visitors who prefer a smoke-free experience. Gummies, chocolates, drinks, and baked goods are available at dispensaries across the valley — and prices fluctuate daily. CloudedDeals compares edible pricing from every dispensary every morning so you can find the best deal without checking each menu individually.',
    tips:
      'Nevada edibles are capped at 100mg THC per package (10 servings of 10mg). If you\'re new to edibles, start with 5mg or less — Vegas edibles tend to hit differently at elevation with the dry climate. Multi-packs and bundle deals often bring the per-milligram cost down significantly. Look for dispensaries running edible-specific daily specials — many shops designate certain days of the week as "edible days" with deeper discounts.',
  },
  concentrates: {
    title: 'Las Vegas Concentrate Deals Today — Wax, Shatter & Live Resin',
    description:
      'Top concentrate deals in Las Vegas. Live resin, badder, shatter & wax from every dispensary, updated daily.',
    keywords: ['vegas concentrate deals', 'las vegas dab deals', 'cheap concentrates vegas', 'live resin deals vegas'],
    intro:
      'Concentrates — including live resin, badder, shatter, wax, and rosin — are premium products with premium price tags. But deals exist if you know where to look. CloudedDeals tracks concentrate pricing at every Las Vegas dispensary daily, so you can compare live resin deals, find the cheapest grams of wax, and spot limited-time drops from top brands before they sell out.',
    tips:
      'Live resin and live rosin are solventless or full-spectrum extracts that preserve more terpenes — they cost more, but many consumers prefer the flavor and effects. Cured resin and shatter are typically more affordable. Bundle deals (buy 2, get 1) are common in the concentrate category and can save 30% or more. If you\'re visiting the Strip, dispensaries like Oasis, The Grove, and Cultivate frequently run concentrate specials.',
  },
  prerolls: {
    title: 'Las Vegas Pre-Roll Deals Today — Singles, Packs & Infused',
    description:
      'Best pre-roll deals in Las Vegas. Singles, multi-packs & infused pre-rolls from every dispensary, updated daily at 8 AM PT.',
    keywords: ['vegas preroll deals', 'las vegas joint deals', 'cheap prerolls vegas', 'infused preroll deals'],
    intro:
      'Pre-rolls are the most convenient way to enjoy cannabis in Las Vegas — no grinder, no papers, just light up. Singles, multi-packs, and infused pre-rolls are on the menu at every dispensary in the valley. CloudedDeals compares pre-roll pricing across all Las Vegas dispensaries every morning so you can grab the best deal on your way to the Strip, a show, or dinner.',
    tips:
      'Multi-packs (3, 5, or 7 joints) almost always offer a better per-joint price than singles. Infused pre-rolls — dipped or rolled in concentrate and kief — deliver stronger effects but cost more. Check the weight: most singles are 0.5g or 1g, and pricing should reflect that. Many dispensaries offer "pre-roll of the day" or "joint Tuesday" specials. If you\'re a tourist, pre-rolls are the easiest grab-and-go option — no accessories needed.',
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

  const seo = CATEGORY_SEO[params.category];
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
          {seo && (
            <p className="text-slate-500 text-sm leading-relaxed max-w-3xl">
              {seo.intro}
            </p>
          )}
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

        {/* Tips section — unique SEO copy per category */}
        {seo && (
          <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-lg font-semibold mb-3">
              Tips for Buying {label} in Las Vegas
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-3xl">
              {seo.tips}
            </p>
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
