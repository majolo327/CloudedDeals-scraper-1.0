/**
 * JSON-LD structured data components for SEO.
 *
 * These render <script type="application/ld+json"> tags that help search engines
 * understand page content and display rich results (price cards, breadcrumbs, etc.).
 */

import type { Deal, Dispensary, Category } from '@/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';

// ---------------------------------------------------------------------------
// WebSite schema — homepage only, enables sitelinks search box in Google
// ---------------------------------------------------------------------------

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CloudedDeals',
    url: SITE_URL,
    description:
      'Every deal from every Las Vegas dispensary, updated daily. Compare prices on flower, vapes, edibles & concentrates.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Organization schema — establishes brand entity
// ---------------------------------------------------------------------------

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CloudedDeals',
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.png`,
    sameAs: ['https://twitter.com/CloudedDeals'],
    description:
      'Las Vegas cannabis deals aggregator. We check every dispensary every morning and bring every deal into one place.',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// LocalBusiness schema — for individual dispensary pages
// ---------------------------------------------------------------------------

interface LocalBusinessJsonLdProps {
  dispensary: Dispensary;
}

export function LocalBusinessJsonLd({ dispensary }: LocalBusinessJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: dispensary.name,
    url: `${SITE_URL}/dispensary/${dispensary.slug}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: dispensary.address,
      addressLocality: 'Las Vegas',
      addressRegion: 'NV',
      addressCountry: 'US',
    },
  };

  if (dispensary.latitude && dispensary.longitude) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: dispensary.latitude,
      longitude: dispensary.longitude,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Product + Offer schema — for deal cards on category/dispensary pages
// ---------------------------------------------------------------------------

interface ProductJsonLdProps {
  deals: Deal[];
}

export function ProductListJsonLd({ deals }: ProductJsonLdProps) {
  if (deals.length === 0) return null;

  // Render up to 10 products as an ItemList for rich results
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: deals.slice(0, 10).map((deal, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: deal.product_name,
        brand: {
          '@type': 'Brand',
          name: deal.brand.name,
        },
        offers: {
          '@type': 'Offer',
          price: deal.deal_price.toFixed(2),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'LocalBusiness',
            name: deal.dispensary.name,
          },
          ...(deal.original_price && deal.original_price > deal.deal_price
            ? {
                priceValidUntil: new Date(
                  Date.now() + 24 * 60 * 60 * 1000
                ).toISOString().split('T')[0],
              }
            : {}),
        },
        url: `${SITE_URL}/deal/${deal.id}`,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// BreadcrumbList schema
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// FAQPage schema — for landing pages with FAQ sections
// ---------------------------------------------------------------------------

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqJsonLdProps {
  faqs: FaqItem[];
}

export function FaqJsonLd({ faqs }: FaqJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Category display name helper
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  flower: 'Flower',
  vapes: 'Vapes',
  vape: 'Vapes',
  edibles: 'Edibles',
  edible: 'Edibles',
  concentrates: 'Concentrates',
  concentrate: 'Concentrates',
  prerolls: 'Pre-Rolls',
  preroll: 'Pre-Rolls',
};

export function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

/** Map URL slug to DB category value */
export function slugToCategory(slug: string): Category | null {
  const map: Record<string, Category> = {
    flower: 'flower',
    vapes: 'vape',
    edibles: 'edible',
    concentrates: 'concentrate',
    prerolls: 'preroll',
  };
  return map[slug] ?? null;
}
