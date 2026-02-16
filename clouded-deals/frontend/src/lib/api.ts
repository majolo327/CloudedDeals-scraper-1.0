import { supabase, isSupabaseConfigured } from './supabase';
import { trackEvent } from './analytics';
import { normalizeWeightForDisplay } from '@/utils/weightNormalizer';
import { applyChainDiversityCap, applyGlobalBrandCap } from '@/utils/dealFilters';
import { getRegion, DEFAULT_REGION } from './region';
import { DISPENSARIES as DISPENSARIES_STATIC } from '@/data/dispensaries';
import type { Deal, Category, Dispensary, Brand } from '@/types';

// --------------------------------------------------------------------------
// Deal cache for offline support
// --------------------------------------------------------------------------

const DEALS_CACHE_KEY = 'clouded_deals_cache';
const EXPIRED_DEALS_CACHE_KEY = 'clouded_expired_deals_cache';

interface DealCache {
  deals: Deal[];
  timestamp: number;
}

function getCachedDeals(): Deal[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEALS_CACHE_KEY);
    if (!raw) return null;
    const cache: DealCache = JSON.parse(raw);
    // Cache valid for 24 hours
    if (Date.now() - cache.timestamp > 24 * 60 * 60 * 1000) return null;
    // Restore Date objects and filter out deals with missing required fields
    return cache.deals
      .filter(d => d.brand && d.dispensary)
      .map(d => ({ ...d, created_at: new Date(d.created_at) }));
  } catch {
    return null;
  }
}

function setCachedDeals(deals: Deal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEALS_CACHE_KEY, JSON.stringify({ deals, timestamp: Date.now() }));
  } catch {
    // Storage full — ignore
  }
}

function getCachedExpiredDeals(): Deal[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(EXPIRED_DEALS_CACHE_KEY);
    if (!raw) return null;
    const cache: DealCache = JSON.parse(raw);
    // Expired cache valid for 36 hours (covers overnight + morning gap)
    if (Date.now() - cache.timestamp > 36 * 60 * 60 * 1000) return null;
    return cache.deals
      .filter(d => d.brand && d.dispensary)
      .map(d => ({ ...d, created_at: new Date(d.created_at) }));
  } catch {
    return null;
  }
}

function setCachedExpiredDeals(deals: Deal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EXPIRED_DEALS_CACHE_KEY, JSON.stringify({ deals, timestamp: Date.now() }));
  } catch {
    // Storage full — ignore
  }
}

// --------------------------------------------------------------------------
// Raw row shape returned by the Supabase query on `products`
// --------------------------------------------------------------------------

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  original_price: number | null;
  sale_price: number | null;
  discount_percent: number | null;
  weight_value: number | null;
  weight_unit: string | null;
  deal_score: number;
  product_url: string | null;
  is_infused: boolean | null;
  product_subtype: string | null;
  strain_type: string | null;
  scraped_at: string;
  created_at: string;
  dispensary: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    platform: string | null;
    url: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

// --------------------------------------------------------------------------
// Normalization helpers
// --------------------------------------------------------------------------

const VALID_CATEGORIES: Category[] = ['flower', 'preroll', 'vape', 'edible', 'concentrate'];

function toCategory(raw: string | null): Category {
  if (raw && VALID_CATEGORIES.includes(raw as Category)) return raw as Category;
  return 'flower';
}

function toDispensary(row: ProductRow['dispensary']): Dispensary {
  // Fall back to static DISPENSARIES data for coordinates/zone/tier
  const staticDisp = DISPENSARIES_STATIC.find((d) => d.id === row.id);
  return {
    id: row.id,
    name: row.name,
    slug: row.id,
    tier: staticDisp?.tier || 'standard',
    address: row.address || staticDisp?.address || '',
    menu_url: row.url || staticDisp?.menu_url || '',
    platform: (row.platform as Dispensary['platform']) || 'dutchie',
    is_active: true,
    zone: staticDisp?.zone,
    latitude: row.latitude ?? staticDisp?.latitude,
    longitude: row.longitude ?? staticDisp?.longitude,
  };
}

function toBrand(raw: string | null, productName?: string): Brand {
  let name = raw && raw !== 'Unknown' ? raw : '';

  // If brand is missing, try to extract from the product name.
  // Common patterns: "BRAND - Product", "BRAND Product 3.5g"
  if (!name && productName) {
    const dashMatch = productName.match(/^([A-Za-z][A-Za-z0-9'.& ]{1,20}?)\s*[-–—]/);
    if (dashMatch) {
      name = dashMatch[1].trim();
    }
  }

  if (!name) name = 'Unknown';

  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    tier: 'local',
    categories: [],
  };
}

/** Try to extract a weight string from the product name as a fallback. */
function parseWeightFromName(name: string): string {
  // Match mg first to avoid partial match (e.g., "850mg" matching as "85" + "0g")
  const mgMatch = name.match(/(\d+)\s*mg\b/i);
  if (mgMatch) return `${mgMatch[1]}mg`;
  // Match patterns like "3.5g", "0.5g", ".5g", "1g", "14g"
  // The (?:^|[\s([-]) lookbehind handles ".5g" that doesn't start at a word boundary
  const gMatch = name.match(/(?:^|[\s(\[-])(\d*\.?\d+)\s*[gG]\b/);
  if (gMatch) {
    const val = parseFloat(gMatch[1]);
    if (!isNaN(val) && val > 0) return `${val}g`;
  }
  const ozMatch = name.match(/\b(\d+(?:\.\d+)?)\s*oz\b/i);
  if (ozMatch) return `${ozMatch[1]}oz`;
  // Fractions: 1/8 = 3.5g, 1/4 = 7g, 1/2 = 14g
  if (/\b1\/8\b/.test(name)) return '3.5g';
  if (/\b1\/4\b/.test(name)) return '7g';
  if (/\b1\/2\b/.test(name)) return '14g';
  return '';
}

function normalizeDeal(row: ProductRow): Deal {
  let weight = row.weight_value
    ? `${row.weight_value}${row.weight_unit || 'g'}`
    : '';

  // Fix suspicious weight values — CATEGORY-AWARE
  // Sub-gram weights are NORMAL for vapes (.3g, .5g, 1g) and concentrates (.5g, 1g).
  // Only flower should have the *10 decimal correction (.35 → 3.5, .7 → 7).
  const nameWeight = parseWeightFromName(row.name);
  const cat = (row.category || '').toLowerCase();
  if (nameWeight && (!weight || weight === '0g')) {
    weight = nameWeight;
  } else if (row.weight_value && row.weight_value < 1 && nameWeight && cat === 'flower') {
    // DB has 0.35 but name says 3.5g — trust the product name (flower only)
    const nameVal = parseFloat(nameWeight);
    if (!isNaN(nameVal) && Math.abs(row.weight_value * 10 - nameVal) < 0.01) {
      weight = nameWeight;
    }
  }

  // Final safety net: validate weight against category ranges
  // Catches cases like 5g vapes (should be 0.5g) that slip through
  weight = normalizeWeightForDisplay(weight, cat);

  return {
    id: row.id,
    product_name: row.name,
    category: toCategory(row.category),
    weight,
    original_price: row.original_price,
    deal_price: row.sale_price || 0,
    dispensary: toDispensary(row.dispensary),
    brand: toBrand(row.brand, row.name),
    deal_score: row.deal_score || 0,
    is_verified: (row.deal_score || 0) >= 70,
    is_infused: row.is_infused ?? false,
    product_subtype: row.product_subtype as Deal['product_subtype'],
    strain_type: row.strain_type as Deal['strain_type'],
    product_url: row.product_url,
    created_at: new Date(row.scraped_at),
    first_seen_at: new Date(row.created_at),
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export interface FetchDealsResult {
  deals: Deal[];
  error: string | null;
}

export async function fetchDeals(region?: string): Promise<FetchDealsResult> {
  if (!isSupabaseConfigured) {
    return { deals: [], error: null };
  }

  const activeRegion = region ?? getRegion() ?? DEFAULT_REGION;

  // Offline check — serve cached deals
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = getCachedDeals();
    if (cached) {
      return { deals: cached, error: null };
    }
    return { deals: [], error: 'You\'re offline. Check your connection and try again.' };
  }

  const start = performance.now();

  try {
    // Fetch active products directly (joined to dispensaries) and save counts
    const [productsResult, countsResult] = await Promise.all([
      supabase
        .from('products')
        .select(
          `id, name, brand, category, original_price, sale_price, discount_percent,
           weight_value, weight_unit, deal_score, product_url, scraped_at, created_at,
           is_infused, product_subtype, strain_type,
           dispensary:dispensaries!inner(id, name, address, city, state, platform, url, region, latitude, longitude)`
        )
        .eq('is_active', true)
        .eq('dispensaries.region', activeRegion)
        .gt('deal_score', 0)
        .gt('sale_price', 0)
        .order('deal_score', { ascending: false })
        .limit(500),
      supabase
        .from('deal_save_counts')
        .select('deal_id, save_count'),
    ]);

    if (productsResult.error) throw productsResult.error;

    // Build lookup map of deal_id → save_count
    const saveCountMap = new Map<string, number>();
    if (countsResult.data) {
      for (const row of countsResult.data as { deal_id: string; save_count: number }[]) {
        saveCountMap.set(row.deal_id, row.save_count);
      }
    }

    const allDeals = productsResult.data
      ? (productsResult.data as unknown as ProductRow[])
          .filter((row) => {
            if (!row.name || row.name.length < 5 || (row.sale_price ?? 0) <= 0) return false;
            // Guard: Supabase join can return array or null for dispensary in edge cases
            if (!row.dispensary || Array.isArray(row.dispensary)) return false;
            return true;
          })
          .map((row) => {
            const deal = normalizeDeal(row);
            deal.save_count = saveCountMap.get(row.id) ?? 0;
            return deal;
          })
      : [];

    // Chain-level cap: multi-location chains (Rise=7, Thrive=5, etc.)
    // can flood the feed. Cap at 15 per chain while guaranteeing at least
    // 1 deal per individual dispensary. Backend already caps per-store at 10.
    const chainCapped = applyChainDiversityCap(allDeals, 15);

    // Two-tier brand cap: (1) max 4 per brand per category so one brand
    // can't crowd out an entire category, (2) max 12 per brand total so
    // a brand with deals across every category can't flood the deck.
    const deals = applyGlobalBrandCap(chainCapped, 4, 12);

    // Cache for offline use + as expired fallback for next morning
    setCachedDeals(deals);
    if (deals.length > 0) {
      setCachedExpiredDeals(deals);
    }

    // Track slow loads
    const duration = performance.now() - start;
    if (duration > 2000) {
      trackEvent('slow_load', undefined, { duration: Math.round(duration), source: 'fetchDeals' });
    }

    return { deals, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch deals';
    trackEvent('error', undefined, { type: 'deals_fetch_failed', message });

    // Fall back to cached deals
    const cached = getCachedDeals();
    if (cached) {
      return { deals: cached, error: null };
    }

    return { deals: [], error: message };
  }
}

// --------------------------------------------------------------------------
// Expired deals — yesterday's deals for early-morning browsing
// --------------------------------------------------------------------------

export async function fetchExpiredDeals(region?: string): Promise<FetchDealsResult> {
  if (!isSupabaseConfigured) {
    return { deals: [], error: null };
  }

  const activeRegion = region ?? getRegion() ?? DEFAULT_REGION;

  // Offline — serve cached expired deals
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = getCachedExpiredDeals();
    if (cached) return { deals: cached, error: null };
    return { deals: [], error: null };
  }

  try {
    // Fetch recently deactivated products (is_active = false, scraped within last 48h)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('products')
      .select(
        `id, name, brand, category, original_price, sale_price, discount_percent,
         weight_value, weight_unit, deal_score, product_url, scraped_at, created_at,
         is_infused, product_subtype, strain_type,
         dispensary:dispensaries!inner(id, name, address, city, state, platform, url, region, latitude, longitude)`
      )
      .eq('is_active', false)
      .eq('dispensaries.region', activeRegion)
      .gt('deal_score', 0)
      .gt('sale_price', 0)
      .gte('scraped_at', cutoff)
      .order('deal_score', { ascending: false })
      .limit(200);

    if (error) throw error;

    const allDeals = data
      ? (data as unknown as ProductRow[])
          .filter((row) => {
            if (!row.name || row.name.length < 5 || (row.sale_price ?? 0) <= 0) return false;
            if (!row.dispensary || Array.isArray(row.dispensary)) return false;
            return true;
          })
          .map(normalizeDeal)
      : [];

    const chainCapped = applyChainDiversityCap(allDeals, 15);
    const deals = applyGlobalBrandCap(chainCapped, 4, 12);

    setCachedExpiredDeals(deals);
    return { deals, error: null };
  } catch {
    // Fall back to cached expired deals
    const cached = getCachedExpiredDeals();
    if (cached) return { deals: cached, error: null };
    return { deals: [], error: null };
  }
}

// --------------------------------------------------------------------------
// Dispensary browsing (all dispensaries, not just active scrapers)
// --------------------------------------------------------------------------

interface DispensaryRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  platform: string | null;
  url: string | null;
  is_active: boolean;
  region: string | null;
}

export interface BrowseDispensary {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  menu_url: string;
  platform: string;
  is_active: boolean;
  region: string;
  deal_count: number;
}

export interface FetchDispensariesResult {
  dispensaries: BrowseDispensary[];
  error: string | null;
}

export async function fetchDispensaries(region?: string): Promise<FetchDispensariesResult> {
  if (!isSupabaseConfigured) {
    return { dispensaries: [], error: null };
  }

  const activeRegion = region ?? getRegion() ?? DEFAULT_REGION;

  try {
    // Only show active dispensaries — inactive ones (e.g. Rise, blocked
    // by Cloudflare) should not appear in the browse UI.
    const { data, error } = await supabase
      .from('dispensaries')
      .select('id, name, address, city, platform, url, is_active, region')
      .eq('region', activeRegion)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    // Count deals per dispensary from the products table
    const { data: countData } = await supabase
      .from('products')
      .select('dispensary_id')
      .eq('is_active', true)
      .gt('deal_score', 0);

    const dealCounts: Record<string, number> = {};
    if (countData) {
      for (const row of countData as { dispensary_id: string }[]) {
        dealCounts[row.dispensary_id] = (dealCounts[row.dispensary_id] || 0) + 1;
      }
    }

    const dispensaries: BrowseDispensary[] = (data as DispensaryRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.id,
      address: row.address || '',
      city: row.city || '',
      menu_url: row.url || '',
      platform: row.platform || 'dutchie',
      is_active: row.is_active,
      region: row.region || DEFAULT_REGION,
      deal_count: dealCounts[row.id] || 0,
    }));

    // Sort: dispensaries with deals first (by count desc), then without deals (alphabetically)
    dispensaries.sort((a, b) => {
      if (a.deal_count > 0 && b.deal_count === 0) return -1;
      if (a.deal_count === 0 && b.deal_count > 0) return 1;
      if (a.deal_count > 0 && b.deal_count > 0) return b.deal_count - a.deal_count;
      return a.name.localeCompare(b.name);
    });

    return { dispensaries, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dispensaries';
    return { dispensaries: [], error: message };
  }
}

// --------------------------------------------------------------------------
// Extended search — queries ALL scraped products (not just top 100)
// Returns products with a discount that match the search query.
// --------------------------------------------------------------------------

export interface SearchExtendedResult {
  deals: Deal[];
  error: string | null;
}

export async function searchExtendedDeals(
  query: string,
  curatedDealIds: Set<string>,
  region?: string,
): Promise<SearchExtendedResult> {
  if (!query || query.trim().length < 2) {
    return { deals: [], error: null };
  }

  const activeRegion = region ?? getRegion() ?? DEFAULT_REGION;

  try {
    // Route through our rate-limited API endpoint instead of hitting
    // Supabase directly from the browser. Prevents bots from
    // enumerating the product catalog via search queries.
    const params = new URLSearchParams({
      q: query.trim(),
      region: activeRegion,
    });
    const res = await fetch(`/api/search?${params.toString()}`);

    if (res.status === 429) {
      return { deals: [], error: 'Too many searches. Please wait a moment.' };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Search failed' }));
      throw new Error(body.error || `Search failed (${res.status})`);
    }

    const { data } = await res.json();

    // Filter out junk: short names, zero price, batteries, accessories, merch
    const JUNK_KEYWORDS = /\b(battery|batteries|grinder|lighter|rolling\s+papers?|tray|stash|pipe|bong|rig|torch|scale|jar|container|apparel|shirt|hat|merch)\b/i;
    const allResults = data
      ? (data as unknown as ProductRow[])
          .filter((row: ProductRow) => row.name && row.name.length >= 5 && (row.sale_price ?? 0) > 0)
          .filter((row: ProductRow) => !JUNK_KEYWORDS.test(row.name ?? ''))
          .map(normalizeDeal)
      : [];

    // Filter out deals already in the curated set, and apply word-boundary
    // matching client-side (SQL ilike is substring-based so "rove" matches "grove")
    const queryLC = query.trim().toLowerCase();
    const qEscaped = queryLC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRe = new RegExp(`\\b${qEscaped}`, 'i');
    const extended = allResults.filter((d) => {
      if (curatedDealIds.has(d.id)) return false;
      return wordBoundaryRe.test(d.product_name) || wordBoundaryRe.test(d.brand.name)
        || wordBoundaryRe.test(d.category) || wordBoundaryRe.test(d.product_subtype ?? '')
        || wordBoundaryRe.test(d.strain_type ?? '');
    });

    // Rank results: exact brand match first, then by discount, then by price
    extended.sort((a, b) => {
      const aBrand = a.brand.name.toLowerCase() === queryLC ? 0 : 1;
      const bBrand = b.brand.name.toLowerCase() === queryLC ? 0 : 1;
      if (aBrand !== bBrand) return aBrand - bBrand;
      // Then by discount descending
      const aDisc = a.original_price && a.original_price > a.deal_price
        ? (a.original_price - a.deal_price) / a.original_price
        : 0;
      const bDisc = b.original_price && b.original_price > b.deal_price
        ? (b.original_price - b.deal_price) / b.original_price
        : 0;
      if (bDisc !== aDisc) return bDisc - aDisc;
      // Then by price ascending
      return a.deal_price - b.deal_price;
    });

    return { deals: extended.slice(0, 60), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extended search failed';
    return { deals: [], error: message };
  }
}

// --------------------------------------------------------------------------
// Fetch deals by IDs (for shared saves page)
// --------------------------------------------------------------------------

export async function fetchDealsByIds(ids: string[]): Promise<Deal[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        `id, name, brand, category, original_price, sale_price, discount_percent,
         weight_value, weight_unit, deal_score, product_url, is_infused, product_subtype,
         scraped_at, created_at,
         dispensary:dispensaries!inner(id, name, address, city, state, platform, url, latitude, longitude)`
      )
      .in('id', ids);

    if (error) throw error;
    if (!data) return [];

    return (data as unknown as ProductRow[])
      .filter((row) => row.name && (row.sale_price ?? 0) > 0)
      .map(normalizeDeal);
  } catch {
    return [];
  }
}
