import { supabase, isSupabaseConfigured } from './supabase';
import { trackEvent } from './analytics';
import { applyDispensaryDiversityCap } from '@/utils/dealFilters';
import type { Deal, Category, Dispensary, Brand } from '@/types';

// --------------------------------------------------------------------------
// Deal cache for offline support
// --------------------------------------------------------------------------

const DEALS_CACHE_KEY = 'clouded_deals_cache';

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
    // Restore Date objects
    return cache.deals.map(d => ({ ...d, created_at: new Date(d.created_at) }));
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
  return {
    id: row.id,
    name: row.name,
    slug: row.id,
    tier: 'standard',
    address: row.address || '',
    menu_url: row.url || '',
    platform: (row.platform as Dispensary['platform']) || 'dutchie',
    is_active: true,
  };
}

function toBrand(raw: string | null): Brand {
  const name = raw || 'Unknown';
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    tier: 'local',
    categories: [],
  };
}

function normalizeDeal(row: ProductRow): Deal {
  const weight = row.weight_value
    ? `${row.weight_value}${row.weight_unit || 'g'}`
    : '';

  return {
    id: row.id,
    product_name: row.name,
    category: toCategory(row.category),
    weight,
    original_price: row.original_price,
    deal_price: row.sale_price || 0,
    dispensary: toDispensary(row.dispensary),
    brand: toBrand(row.brand),
    deal_score: row.deal_score || 0,
    is_verified: (row.deal_score || 0) >= 70,
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

export async function fetchDeals(): Promise<FetchDealsResult> {
  if (!isSupabaseConfigured) {
    return { deals: [], error: null };
  }

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
           dispensary:dispensaries!inner(id, name, address, city, state, platform, url)`
        )
        .eq('is_active', true)
        .gt('deal_score', 0)
        .order('deal_score', { ascending: false })
        .limit(200),
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
      ? (productsResult.data as unknown as ProductRow[]).map((row) => {
          const deal = normalizeDeal(row);
          deal.save_count = saveCountMap.get(row.id) ?? 0;
          return deal;
        })
      : [];

    // Enforce dispensary diversity: max 5 deals per dispensary
    const deals = applyDispensaryDiversityCap(allDeals, 5);

    // Cache for offline use
    setCachedDeals(deals);

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
