import type { Deal } from '@/types';

export type HeatLevel = 1 | 2 | 3 | null;

/**
 * Calculate the heat level for a deal based on discount percentage.
 *   3 = Steal  (50%+ off)     — triple flame, bright red-orange
 *   2 = Fire   (30-49% off)   — double flame, warm orange
 *   1 = Solid  (15-29% off)   — single flame, muted orange
 *   null = No heat (<15% off or no discount)
 */
export function getDealHeat(deal: Deal): HeatLevel {
  const discount = deal.original_price && deal.original_price > deal.deal_price
    ? Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)
    : 0;

  if (discount >= 50) return 3;
  if (discount >= 30) return 2;
  if (discount >= 15) return 1;
  return null;
}

export function getDealHeatFromValues(
  price: number,
  originalPrice: number | null,
  discountPercent?: number | null,
): HeatLevel {
  const discount = discountPercent ??
    (originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0);

  if (!discount || discount <= 0) return null;
  if (discount >= 50) return 3;
  if (discount >= 30) return 2;
  if (discount >= 15) return 1;
  return null;
}

export function getHeatLabel(heat: HeatLevel): string {
  switch (heat) {
    case 3: return 'Steal';
    case 2: return 'Fire Deal';
    case 1: return 'Solid Deal';
    default: return '';
  }
}

export function getHeatDescription(heat: HeatLevel, totalDeals?: number): string {
  switch (heat) {
    case 3: return `This is a Steal — top tier deal${totalDeals ? ` out of ${totalDeals} today` : ''}`;
    case 2: return `This is a Fire Deal — well above average`;
    case 1: return `Solid Deal — good value for the category`;
    default: return '';
  }
}

export const HEAT_COLORS = {
  1: { flame: '#C2884A', glow: 'rgba(194, 136, 74, 0.15)' },
  2: { flame: '#E8843C', glow: 'rgba(232, 132, 60, 0.2)' },
  3: { flame: '#FF5722', glow: 'rgba(255, 87, 34, 0.25)' },
} as const;
