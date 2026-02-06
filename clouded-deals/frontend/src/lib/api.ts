import { supabase, isSupabaseConfigured } from './supabase';
import type { Deal, Category, Dispensary, Brand } from '@/types';

// --------------------------------------------------------------------------
// Raw row shape returned by the Supabase join query
// --------------------------------------------------------------------------

interface DealRow {
  id: string;
  deal_score: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    original_price: number | null;
    sale_price: number | null;
    weight_value: number | null;
    weight_unit: string | null;
  };
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

function toDispensary(row: DealRow['dispensary']): Dispensary {
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

function normalizeDeal(row: DealRow): Deal {
  const weight = row.product.weight_value
    ? `${row.product.weight_value}${row.product.weight_unit || 'g'}`
    : '';

  return {
    id: row.id,
    product_name: row.product.name,
    category: toCategory(row.product.category),
    weight,
    original_price: row.product.original_price,
    deal_price: row.product.sale_price || 0,
    dispensary: toDispensary(row.dispensary),
    brand: toBrand(row.product.brand),
    is_top_pick: row.deal_score >= 80,
    is_staff_pick: row.deal_score >= 65 && row.deal_score < 80,
    is_verified: row.deal_score >= 70,
    is_featured: row.deal_score >= 75,
    created_at: new Date(row.created_at),
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

  try {
    // Fetch deals and save counts in parallel
    const [dealsResult, countsResult] = await Promise.all([
      supabase
        .from('deals')
        .select(
          `id, deal_score, created_at,
           product:products!inner(id, name, brand, category, original_price, sale_price, weight_value, weight_unit),
           dispensary:dispensaries!inner(id, name, address, city, state, platform, url)`
        )
        .order('deal_score', { ascending: false })
        .limit(100),
      supabase
        .from('deal_save_counts')
        .select('deal_id, save_count'),
    ]);

    if (dealsResult.error) throw dealsResult.error;

    // Build lookup map of deal_id → save_count
    const saveCountMap = new Map<string, number>();
    if (countsResult.data) {
      for (const row of countsResult.data as { deal_id: string; save_count: number }[]) {
        saveCountMap.set(row.deal_id, row.save_count);
      }
    }

    const deals = dealsResult.data
      ? (dealsResult.data as unknown as DealRow[]).map((row) => {
          const deal = normalizeDeal(row);
          deal.save_count = saveCountMap.get(row.id) ?? 0;
          return deal;
        })
      : [];

    return { deals, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch deals';
    return { deals: [], error: message };
  }
}
