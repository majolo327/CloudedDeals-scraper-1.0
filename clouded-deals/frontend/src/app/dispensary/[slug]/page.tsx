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
// Unique SEO descriptions per dispensary
// ---------------------------------------------------------------------------
const DISPENSARY_ABOUT: Record<string, string> = {
  'td-gibson':
    'The Dispensary on Gibson is a locally owned shop in Henderson, popular with east-side locals for its deep daily specials and loyalty program. Located just off the 215 near Sunset, it\'s an easy stop for Henderson and Green Valley residents looking for competitive flower and concentrate pricing without the Strip markup.',
  'td-decatur':
    'The Dispensary on Decatur serves the southwest Las Vegas corridor with a wide selection of flower, vapes, and edibles. Known for aggressive daily specials — especially on eighths and pre-rolls — it\'s a go-to for locals who want dispensary-quality products at below-average prices. Free parking and a quick in-and-out experience.',
  'planet13':
    'Planet 13 is the world\'s largest dispensary and one of the most recognizable cannabis destinations on the Las Vegas Strip. Located on Desert Inn Road, it features an immersive retail experience with LED installations and a massive product selection. Tourists flock here for the spectacle, but the daily deals — especially on house brands — are genuinely competitive.',
  'medizin':
    'Medizin is Planet 13\'s sister dispensary on Sunset Road, offering a more low-key shopping experience with the same product quality. Popular with locals in the southwest valley, Medizin frequently runs deal-of-the-day specials on flower and concentrates. It\'s a solid alternative if you want Planet 13 pricing without the tourist crowds.',
  'greenlight-downtown':
    'Greenlight Downtown is a quick walk from Fremont Street and the Arts District, making it a convenient stop for downtown visitors. The shop carries a curated selection of flower, vapes, and edibles with daily rotating specials. If you\'re staying downtown and want to avoid the drive to the Strip dispensaries, Greenlight is one of the closest options.',
  'greenlight-paradise':
    'Greenlight Paradise is located on Paradise Road near the Convention Center and several major hotels. It\'s a convenient mid-Strip option for tourists and convention-goers who don\'t want to trek to the main Strip dispensaries. The shop runs daily specials and carries a solid range of local and national brands.',
  'the-grove':
    'The Grove sits on University Center Drive, just east of the Strip near the UNLV area. It\'s a favorite among both locals and tourists for its clean layout, knowledgeable staff, and consistent daily specials. The Grove tends to carry a strong concentrate and vape selection, and its proximity to the Strip makes it an easy Uber ride from most hotels.',
  'mint-paradise':
    'Mint Cannabis on Paradise Road is a well-established dispensary near the Convention Center corridor. Known for its "Mint Deals" loyalty program and rotating daily specials, it\'s popular with locals who work in the resort corridor. The shop carries a wide range of products across all categories with competitive pricing on flower and pre-rolls.',
  'mint-rainbow':
    'Mint Cannabis on Rainbow Boulevard serves the southwest Las Vegas community near Spring Valley. This location mirrors the Paradise store\'s product selection and deal structure but caters to a more local clientele. It\'s a convenient stop for residents in the 89118 and 89103 zip codes looking for consistent daily specials.',
  'curaleaf-western':
    'Curaleaf on Western Avenue is a downtown-adjacent dispensary with easy access from both the I-15 and US-95. As part of the national Curaleaf chain, it carries a mix of Curaleaf house brands and popular Nevada labels. The store frequently runs percentage-off and buy-one-get-one specials, especially on Curaleaf-branded products.',
  'curaleaf-cheyenne':
    'Curaleaf Cheyenne serves North Las Vegas shoppers with a clean, modern retail experience. Located on West Cheyenne Avenue, it\'s a convenient option for residents in the Centennial Hills and Aliante areas. The store runs the same promotional calendar as other Curaleaf locations, often featuring aggressive daily deals on vapes and edibles.',
  'curaleaf-strip':
    'Curaleaf on the Strip is one of the most accessible dispensaries for tourists — located on Las Vegas Boulevard between the Stratosphere and downtown. Walk-in traffic is high, but the store keeps lines moving. Curaleaf\'s Strip location matches its other stores on pricing and often adds Strip-exclusive bundle deals.',
  'curaleaf-the-reef':
    'Curaleaf – The Reef (formerly Reef Dispensary) is located on Western Avenue near the Strip, making it one of the more accessible options for visitors staying at mid-Strip hotels. The Reef brand has a loyal local following, and the store carries both Curaleaf house products and a curated selection of Nevada-grown brands.',
  'oasis':
    'Oasis Cannabis is a Strip-adjacent dispensary on Industrial Road, just west of the Wynn and Encore. It\'s a frequent recommendation for tourists because of its walkable location and above-average deal flow. Oasis runs rotating daily specials and tends to stock a strong selection of concentrates and premium flower from local growers.',
  'deep-roots-cheyenne':
    'Deep Roots Harvest on Cheyenne Avenue is a North Las Vegas staple with a reputation for affordable pricing and a wide flower selection. The shop runs frequent BOGO and percentage-off deals, making it a favorite for budget-conscious locals in the northwest valley.',
  'deep-roots-craig':
    'Deep Roots Harvest on Craig Road serves the North Las Vegas community with competitive pricing across all categories. Like other Deep Roots locations, it emphasizes value — expect daily specials on flower, edibles, and pre-rolls that often undercut Strip pricing by 20–30%.',
  'deep-roots-blue-diamond':
    'Deep Roots Harvest on Blue Diamond Road is a convenient stop for southwest Las Vegas residents and visitors heading to Red Rock Canyon. The shop carries the full Deep Roots product lineup with the same deal-forward pricing the brand is known for across its other locations.',
  'deep-roots-parkson':
    'Deep Roots Harvest on Parkson Road is the brand\'s Henderson location, serving the far east side of the valley. It\'s a bit off the beaten path, but locals appreciate the lower prices and rotating specials that come with being outside the Strip corridor.',
  'cultivate-spring':
    'Cultivate on Spring Mountain Road is a Strip-adjacent dispensary popular with Chinatown-area visitors and locals. The shop has a loyal following for its curated selection and knowledgeable staff. Cultivate runs daily specials and often features exclusive drops from local Nevada growers.',
  'cultivate-durango':
    'Cultivate Durango is the brand\'s second location, serving the Centennial Hills and northwest Las Vegas corridor. It offers the same product selection and deal calendar as the Spring Mountain store but with easier parking and shorter lines. A solid option for locals in the 89149 and 89166 zip codes.',
  'thrive-sahara':
    'Thrive on West Sahara Avenue is a well-known mid-valley dispensary with a strong reputation for daily specials and a broad product selection. Located near the intersection of Sahara and Valley View, it\'s convenient for both locals and visitors staying at off-Strip hotels in the area.',
  'thrive-cheyenne':
    'Thrive Cheyenne is a North Las Vegas location that caters to the growing residential communities in the northwest valley. The shop runs the same promotional calendar as other Thrive locations, with daily rotating specials across flower, vapes, and edibles.',
  'thrive-strip':
    'Thrive on Sammy Davis Jr. Drive is one of the closest dispensaries to the mid-Strip hotels and the Convention Center. It\'s a popular tourist stop with walk-in traffic, but the daily deals are competitive with off-Strip pricing. The store carries a wide range of products and runs frequent bundle specials.',
  'thrive-main':
    'Thrive on Main Street is located in the heart of the Arts District, making it a convenient stop for downtown visitors exploring Fremont East or the 18b Arts District. The shop has a boutique feel with a curated product selection and daily rotating specials.',
  'beyond-hello-sahara':
    'Beyond/Hello on West Sahara Avenue is part of a multi-state dispensary chain, located in the far-west valley near Summerlin. The shop carries a mix of national and Nevada-local brands with regular daily specials. It\'s a convenient option for residents in the 89117 and 89135 zip codes.',
  'beyond-hello-twain':
    'Beyond/Hello on East Twain Avenue (formerly NuLeaf) is located just east of the Strip, making it walkable from several major hotels. The shop has a loyal customer base and runs consistent daily specials, particularly on flower and vape products. A solid mid-Strip alternative to the bigger-name dispensaries.',
  'rise-sunset':
    'RISE Henderson on Sunset Road is part of the Green Thumb Industries family, serving the Henderson community with a clean, modern retail experience. The shop runs daily specials and carries a mix of GTI house brands (Rhythm, Dogwalkers, incredibles) alongside popular Nevada labels.',
  'rise-tropicana':
    'RISE on West Tropicana Avenue is located near the south end of the Strip, making it accessible for tourists staying at Mandalay Bay, Luxor, or Excalibur. The shop runs daily rotating specials and carries the full GTI product lineup alongside local Nevada brands.',
  'rise-rainbow':
    'RISE on South Rainbow Boulevard serves the southwest Las Vegas community near Spring Valley and Enterprise. It\'s a neighborhood shop with a straightforward retail experience, daily specials, and competitive pricing on GTI house brands like Rhythm and Dogwalkers.',
  'rise-nellis':
    'RISE on Nellis Boulevard is one of the few dispensaries serving the east Las Vegas corridor. The shop caters to a local clientele with daily specials and the full GTI product range. If you\'re staying near Nellis Air Force Base or the eastern suburbs, this is the closest option.',
  'rise-boulder':
    'RISE Henderson on Boulder Highway is a convenient stop for residents in the Boulder City and Henderson areas. The shop carries the standard GTI product lineup with daily rotating specials. Its location on Boulder Highway makes it an easy stop for visitors heading to or from Lake Mead.',
  'rise-durango':
    'RISE on South Durango Drive serves the far-southwest Las Vegas community near Mountains Edge and Southern Highlands. The shop offers the same GTI product lineup and daily specials as other RISE locations, with ample parking and a quick shopping experience.',
  'rise-craig':
    'RISE on West Craig Road is the brand\'s North Las Vegas location, serving the growing communities in the northwest valley. Like all RISE stores, it runs daily rotating specials and carries the full range of GTI house brands alongside popular Nevada labels.',
};

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

        {/* About this dispensary — unique SEO copy */}
        {DISPENSARY_ABOUT[params.slug] && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-slate-300 mb-2">
              About {dispensary.name}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed max-w-3xl">
              {DISPENSARY_ABOUT[params.slug]}
            </p>
          </section>
        )}

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

        {/* Nearby dispensaries in same zone */}
        {(() => {
          const zoneDispensaries = DISPENSARIES.filter(
            (d) => d.scraped && d.zone === dispensary.zone && d.slug !== params.slug
          ).slice(0, 6);
          if (zoneDispensaries.length === 0) return null;
          const zoneTitle =
            dispensary.zone === 'strip'
              ? 'Other Strip Dispensaries'
              : dispensary.zone === 'downtown'
                ? 'Other Downtown Dispensaries'
                : 'Nearby Las Vegas Dispensaries';
          return (
            <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-lg font-semibold mb-4">{zoneTitle}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {zoneDispensaries.map((d) => (
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
          );
        })()}

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
