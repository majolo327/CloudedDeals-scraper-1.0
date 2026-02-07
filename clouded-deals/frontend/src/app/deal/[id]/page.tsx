import { redirect } from 'next/navigation';

interface DealPageProps {
  params: { id: string };
  searchParams: Record<string, string>;
}

/**
 * Shared deal link handler — redirects to the main page with `?deal=<id>`
 * so the DealModal opens automatically. Preserves UTM and referral params.
 */
export default function DealPage({ params, searchParams }: DealPageProps) {
  const qs = new URLSearchParams(searchParams);
  qs.set('deal', params.id);
  redirect(`/?${qs.toString()}`);
}
