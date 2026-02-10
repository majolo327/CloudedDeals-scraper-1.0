import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { DealRedirect } from './DealRedirect';

interface DealPageProps {
  params: { id: string };
  searchParams: Record<string, string>;
}

export async function generateMetadata({ params }: DealPageProps): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudeddeals.com';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { title: 'Deal — Clouded Deals' };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from('products')
      .select(
        'name, brand, sale_price, original_price, category, dispensary:dispensaries!inner(name)'
      )
      .eq('id', params.id)
      .single();

    if (data) {
      const label = data.brand ? `${data.brand} ${data.name}` : data.name;
      const price =
        data.original_price && data.original_price > data.sale_price
          ? `$${data.sale_price} (was $${data.original_price})`
          : `$${data.sale_price}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const disp = data.dispensary as any;
      const dispName: string = Array.isArray(disp) ? disp[0]?.name || '' : disp?.name || '';

      const title = `${label} — ${price}`;
      const description = dispName
        ? `${label} for ${price} at ${dispName}. Found on Clouded Deals.`
        : `${label} for ${price}. Found on Clouded Deals.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `${siteUrl}/deal/${params.id}`,
          siteName: 'Clouded Deals',
          type: 'article',
          images: [
            {
              url: `${siteUrl}/og-image.png`,
              width: 1200,
              height: 630,
              alt: 'Clouded Deals — Every Deal. Every Dispensary. One Place.',
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [`${siteUrl}/og-image.png`],
        },
      };
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: 'Deal — Clouded Deals',
    description: 'Every deal. Every dispensary. One place.',
  };
}

/**
 * Shared deal link handler — renders OG meta tags for social previews,
 * then client-side redirects to the main page with `?deal=<id>` so the
 * DealModal opens automatically.
 */
export default function DealPage({ params, searchParams }: DealPageProps) {
  const qs = new URLSearchParams(searchParams);
  qs.set('deal', params.id);
  return <DealRedirect url={`/?${qs.toString()}`} />;
}
