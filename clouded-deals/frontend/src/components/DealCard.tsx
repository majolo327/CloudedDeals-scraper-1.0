"use client";

import { Deal, CATEGORY_LABELS, Category } from "@/lib/types";

interface DealCardProps {
  deal: Deal;
  variant?: "compact" | "full";
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "—";
  return `$${cents.toFixed(2)}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export default function DealCard({ deal, variant = "compact" }: DealCardProps) {
  const product = deal.product;
  const dispensary = deal.dispensary;

  if (!product) return null;

  const discount = product.discount_percent;
  const category = product.category;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header: discount badge + score */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        {discount !== null && discount > 0 && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            {Math.round(discount)}% OFF
          </span>
        )}

        {category && (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {CATEGORY_LABELS[category as Category] ?? category}
          </span>
        )}

        <span
          className={`ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${scoreColor(deal.deal_score)}`}
          title={`Deal score: ${deal.deal_score}`}
        >
          {Math.round(deal.deal_score)}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-3">
        {/* Product name */}
        <h3 className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
          {product.name}
        </h3>

        {/* Brand */}
        {product.brand && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {product.brand}
          </p>
        )}

        {/* Prices */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatPrice(product.sale_price)}
          </span>
          {product.original_price !== null &&
            product.original_price !== product.sale_price && (
              <span className="text-sm text-zinc-400 line-through">
                {formatPrice(product.original_price)}
              </span>
            )}
        </div>

        {/* Extended info — full variant only */}
        {variant === "full" && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {product.weight_value !== null && (
              <span>
                {product.weight_value}
                {product.weight_unit ?? "g"}
              </span>
            )}
            {product.thc_percent !== null && (
              <span>THC {product.thc_percent}%</span>
            )}
            {product.cbd_percent !== null && (
              <span>CBD {product.cbd_percent}%</span>
            )}
          </div>
        )}

        {/* Dispensary */}
        {dispensary && (
          <p className="mt-3 truncate border-t border-zinc-100 pt-2 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            {dispensary.name}
          </p>
        )}
      </div>
    </div>
  );
}
