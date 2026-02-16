/**
 * Server-side data fetching for SEO pages.
 *
 * These functions run at build time (ISR) or on the server,
 * fetching from Supabase using the anon key (safe for SSR).
 * They provide data for the crawlable SEO pages.
 */

import { createClient } from '@supabase/supabase-js';
import { DISPENSARIES } from '@/data/dispensaries';
import type { Category, DispensaryZone } from '@/types';

// ---------------------------------------------------------------------------
// Supabase client for server-side rendering
// ---------------------------------------------------------------------------

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Types for SEO page data
// ---------------------------------------------------------------------------

export interface SeoDeal {
  id: string;
  name: string;
  brand: string;
  category: Category;
  sale_price: number;
  original_price: number | null;
  discount_percent: number | null;
  deal_score: number;
  weight_value: number | null;
  weight_unit: string | null;
  product_url: string | null;
  strain_type: string | null;
  dispensary_id: string;
  dispensary_name: string;
}

export interface SeoDispensaryInfo {
  id: string;
  name: string;
  slug: string;
  address: string;
  zone: DispensaryZone;
  latitude: number | null;
  longitude: number | null;
  menu_url: string;
  deal_count: number;
}

// ---------------------------------------------------------------------------
// Fetch active deals for a specific dispensary
// ---------------------------------------------------------------------------

export async function fetchDealsForDispensary(dispensaryId: string): Promise<SeoDeal[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        `id, name, brand, category, sale_price, original_price, discount_percent,
         deal_score, weight_value, weight_unit, product_url, strain_type,
         dispensary_id`
      )
      .eq('is_active', true)
      .eq('dispensary_id', dispensaryId)
      .gt('deal_score', 0)
      .gt('sale_price', 0)
      .order('deal_score', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((row) => {
      const staticDisp = DISPENSARIES.find((d) => d.id === row.dispensary_id);
      return {
        id: row.id,
        name: row.name,
        brand: row.brand || 'Unknown',
        category: row.category || 'flower',
        sale_price: row.sale_price,
        original_price: row.original_price,
        discount_percent: row.discount_percent,
        deal_score: row.deal_score,
        weight_value: row.weight_value,
        weight_unit: row.weight_unit,
        product_url: row.product_url,
        strain_type: row.strain_type,
        dispensary_id: row.dispensary_id,
        dispensary_name: staticDisp?.name || row.dispensary_id,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch active deals for a specific category
// ---------------------------------------------------------------------------

export async function fetchDealsForCategory(category: Category, region = 'southern-nv'): Promise<SeoDeal[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        `id, name, brand, category, sale_price, original_price, discount_percent,
         deal_score, weight_value, weight_unit, product_url, strain_type,
         dispensary_id, dispensary:dispensaries!inner(id, name, region)`
      )
      .eq('is_active', true)
      .eq('dispensaries.region', region)
      .eq('category', category)
      .gt('deal_score', 0)
      .gt('sale_price', 0)
      .order('deal_score', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => {
      const disp = row.dispensary as { id: string; name: string } | null;
      return {
        id: row.id as string,
        name: row.name as string,
        brand: (row.brand as string) || 'Unknown',
        category: (row.category as Category) || 'flower',
        sale_price: row.sale_price as number,
        original_price: row.original_price as number | null,
        discount_percent: row.discount_percent as number | null,
        deal_score: row.deal_score as number,
        weight_value: row.weight_value as number | null,
        weight_unit: row.weight_unit as string | null,
        product_url: row.product_url as string | null,
        strain_type: row.strain_type as string | null,
        dispensary_id: row.dispensary_id as string,
        dispensary_name: disp?.name || (row.dispensary_id as string),
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch all active deals (for hub pages)
// ---------------------------------------------------------------------------

export async function fetchAllActiveDeals(region = 'southern-nv'): Promise<SeoDeal[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        `id, name, brand, category, sale_price, original_price, discount_percent,
         deal_score, weight_value, weight_unit, product_url, strain_type,
         dispensary_id, dispensary:dispensaries!inner(id, name, region)`
      )
      .eq('is_active', true)
      .eq('dispensaries.region', region)
      .gt('deal_score', 0)
      .gt('sale_price', 0)
      .order('deal_score', { ascending: false })
      .limit(200);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => {
      const disp = row.dispensary as { id: string; name: string } | null;
      return {
        id: row.id as string,
        name: row.name as string,
        brand: (row.brand as string) || 'Unknown',
        category: (row.category as Category) || 'flower',
        sale_price: row.sale_price as number,
        original_price: row.original_price as number | null,
        discount_percent: row.discount_percent as number | null,
        deal_score: row.deal_score as number,
        weight_value: row.weight_value as number | null,
        weight_unit: row.weight_unit as string | null,
        product_url: row.product_url as string | null,
        strain_type: row.strain_type as string | null,
        dispensary_id: row.dispensary_id as string,
        dispensary_name: disp?.name || (row.dispensary_id as string),
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Get dispensary info from static data with deal counts from DB
// ---------------------------------------------------------------------------

export async function getDispensaryWithDeals(slug: string): Promise<{
  dispensary: SeoDispensaryInfo | null;
  deals: SeoDeal[];
}> {
  const staticDisp = DISPENSARIES.find((d) => d.slug === slug && d.scraped);
  if (!staticDisp) return { dispensary: null, deals: [] };

  const deals = await fetchDealsForDispensary(staticDisp.id);

  return {
    dispensary: {
      id: staticDisp.id,
      name: staticDisp.name,
      slug: staticDisp.slug,
      address: staticDisp.address,
      zone: staticDisp.zone || 'local',
      latitude: staticDisp.latitude ?? null,
      longitude: staticDisp.longitude ?? null,
      menu_url: staticDisp.menu_url,
      deal_count: deals.length,
    },
    deals,
  };
}

// ---------------------------------------------------------------------------
// Get all scraped dispensaries (for directory listings)
// ---------------------------------------------------------------------------

export function getScrapedDispensaries(): SeoDispensaryInfo[] {
  return DISPENSARIES
    .filter((d) => d.scraped)
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      address: d.address,
      zone: d.zone || 'local',
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      menu_url: d.menu_url,
      deal_count: 0,
    }));
}

// ---------------------------------------------------------------------------
// Get dispensaries by zone
// ---------------------------------------------------------------------------

export function getDispensariesByZone(zone: DispensaryZone): SeoDispensaryInfo[] {
  return DISPENSARIES
    .filter((d) => d.scraped && d.zone === zone)
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      address: d.address,
      zone: d.zone || zone,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      menu_url: d.menu_url,
      deal_count: 0,
    }));
}
