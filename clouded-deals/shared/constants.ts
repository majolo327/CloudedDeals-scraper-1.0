/**
 * Shared constants between the scraper and frontend.
 *
 * The Python scraper reads these values at build time via the
 * deal_detector module; the Next.js frontend imports them directly.
 */

/** Canonical deal categories — the scraper normalizes all scraped values to this set. */
export const DEAL_CATEGORIES = [
  'flower',
  'preroll',
  'vape',
  'edible',
  'concentrate',
  'other',
] as const;

export type DealCategory = (typeof DEAL_CATEGORIES)[number];

/** Human-readable display names for each category. */
export const CATEGORY_DISPLAY_NAMES: Record<DealCategory, string> = {
  flower: 'Flower',
  preroll: 'Pre-Rolls',
  vape: 'Vapes',
  edible: 'Edibles',
  concentrate: 'Concentrates',
  other: 'Other',
};

/** Emoji icons for categories (used in FTUE preference selector). */
export const CATEGORY_ICONS: Record<DealCategory, string> = {
  flower: '\uD83C\uDF3F',
  preroll: '\uD83D\uDEAC',
  vape: '\uD83D\uDCA8',
  edible: '\uD83C\uDF6C',
  concentrate: '\uD83E\uDDCA',
  other: '\uD83D\uDCE6',
};

/** Configuration for the Top 100 curated deals selection. */
export const TOP_DEALS_CONFIG = {
  /** Maximum results target. */
  maxResults: 100,
  /** Category diversity cap — no more than N deals from any single category. */
  maxPerCategory: 30,
  /** Brand diversity cap — no more than N deals from any single brand. */
  maxPerBrand: 5,
  /** Dispensary diversity cap — no more than N deals from any single dispensary. */
  maxPerDispensary: 10,
  /** Default geographic region. */
  region: 'southern-nv',
  /** Label when fewer than maxResults qualify. */
  fallbackLabel: "Today's Top Deals",
  /** Label when >= maxResults qualify. */
  primaryLabel: "Today's Top 100",
} as const;

/**
 * Categories the scraper marks as "skip" — these products are scraped
 * but excluded from curated deals. They may still appear in extended
 * search results.
 */
export const SKIP_CATEGORIES = [
  'topical',
  'tincture',
  'capsule',
  'rso',
  'accessory',
] as const;
