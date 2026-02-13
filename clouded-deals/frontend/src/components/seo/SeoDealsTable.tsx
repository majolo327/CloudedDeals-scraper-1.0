import Link from 'next/link';
import type { SeoDeal } from '@/lib/seo-data';
import { getCategoryLabel } from './JsonLd';

interface SeoDealsTableProps {
  deals: SeoDeal[];
  showDispensary?: boolean;
}

function discountBadge(deal: SeoDeal) {
  if (!deal.original_price || deal.original_price <= deal.sale_price) return null;
  const pct = Math.round(
    ((deal.original_price - deal.sale_price) / deal.original_price) * 100
  );
  if (pct <= 0) return null;

  let color = 'bg-emerald-500/15 text-emerald-400';
  if (pct >= 50) color = 'bg-purple-500/20 text-purple-400';
  else if (pct >= 30) color = 'bg-amber-500/15 text-amber-400';

  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${color}`}>
      -{pct}%
    </span>
  );
}

function weight(deal: SeoDeal) {
  if (!deal.weight_value) return null;
  return `${deal.weight_value}${deal.weight_unit || 'g'}`;
}

export function SeoDealsTable({ deals, showDispensary = true }: SeoDealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">
          No deals available right now. Deals refresh daily at 8 AM PT.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors"
        >
          Browse all deals
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal) => (
        <article
          key={deal.id}
          className="rounded-xl border p-4 transition-colors hover:border-purple-500/30"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-purple-400 font-medium mb-0.5">{deal.brand}</p>
              <h3 className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">
                {deal.name}
              </h3>
            </div>
            {discountBadge(deal)}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold text-white">
              ${deal.sale_price.toFixed(2)}
            </span>
            {deal.original_price && deal.original_price > deal.sale_price && (
              <span className="text-xs text-slate-500 line-through">
                ${deal.original_price.toFixed(2)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              {getCategoryLabel(deal.category)}
            </span>
            {weight(deal) && (
              <span className="px-1.5 py-0.5 rounded bg-white/5">{weight(deal)}</span>
            )}
            {deal.strain_type && (
              <span className="px-1.5 py-0.5 rounded bg-white/5">{deal.strain_type}</span>
            )}
          </div>

          {showDispensary && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <Link
                href={`/dispensary/${deal.dispensary_id}`}
                className="text-xs text-slate-400 hover:text-purple-400 transition-colors"
              >
                {deal.dispensary_name}
              </Link>
            </div>
          )}

          {deal.product_url && (
            <a
              href={deal.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-center py-2 rounded-lg bg-purple-500/15 text-purple-400 text-sm font-medium hover:bg-purple-500/25 transition-colors"
            >
              Get This Deal
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
