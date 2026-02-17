import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/admin/flags
 * Returns unreviewed deal reports grouped by deal with product details.
 * Uses service client to bypass RLS (deal_reports only allows anon INSERT).
 *
 * PATCH /api/admin/flags
 * Actions: edit_product, hide_product, resolve
 */

export async function GET() {
  let sb;
  try {
    sb = createServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[flags] Service client init failed:', msg);
    return NextResponse.json(
      { error: `Service client unavailable: ${msg}. Check SUPABASE_SERVICE_ROLE_KEY env var.` },
      { status: 503 }
    );
  }

  try {
    // Fetch ALL reports (both reviewed and unreviewed) to show historical flags too
    const { data: reports, error } = await sb
      .from('deal_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[flags] Query error:', error.message);
      return NextResponse.json({ error: `DB query failed: ${error.message}` }, { status: 500 });
    }

    if (!reports || reports.length === 0) {
      return NextResponse.json({ flags: [], total_reports: 0 });
    }

    // Group by deal_id — unreviewed first, then reviewed
    const grouped: Record<string, {
      deal_id: string;
      product_name: string;
      brand_name: string | null;
      dispensary_name: string | null;
      deal_price: number | null;
      reviewed: boolean;
      reports: typeof reports;
    }> = {};

    for (const r of reports) {
      if (!grouped[r.deal_id]) {
        grouped[r.deal_id] = {
          deal_id: r.deal_id,
          product_name: r.product_name,
          brand_name: r.brand_name,
          dispensary_name: r.dispensary_name,
          deal_price: r.deal_price,
          reviewed: true, // will flip to false if any report is unreviewed
          reports: [],
        };
      }
      grouped[r.deal_id].reports.push(r);
      if (!r.reviewed) {
        grouped[r.deal_id].reviewed = false;
      }
    }

    // For each flagged deal, fetch current product data
    const dealIds = Object.keys(grouped);
    const productMap: Record<string, {
      id: string;
      name: string;
      brand: string | null;
      category: string | null;
      product_subtype: string | null;
      sale_price: number | null;
      original_price: number | null;
      deal_score: number;
      is_active: boolean;
      dispensary_id: string;
    }> = {};

    if (dealIds.length > 0) {
      const { data: products } = await sb
        .from('products')
        .select('id, name, brand, category, product_subtype, sale_price, original_price, deal_score, is_active, dispensary_id')
        .in('id', dealIds);

      for (const p of products ?? []) {
        productMap[p.id] = p;
      }
    }

    const flags = Object.values(grouped).map((g) => ({
      ...g,
      report_count: g.reports.length,
      wrong_price_count: g.reports.filter((r) => r.report_type === 'wrong_price').length,
      deal_gone_count: g.reports.filter((r) => r.report_type === 'deal_gone').length,
      wrong_product_count: g.reports.filter((r) => r.report_type === 'wrong_product').length,
      product: productMap[g.deal_id] ?? null,
    }));

    // Sort: unreviewed first, then by report count descending
    flags.sort((a, b) => {
      if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
      return b.report_count - a.report_count;
    });

    return NextResponse.json({ flags, total_reports: reports.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[flags] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let sb;
  try {
    sb = createServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: `Service client unavailable: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { action, deal_id, updates } = body;

    if (!action || !deal_id) {
      return NextResponse.json({ error: 'Missing action or deal_id' }, { status: 400 });
    }

    if (action === 'edit_product') {
      // Update product fields
      const allowed = ['name', 'brand', 'category', 'product_subtype', 'sale_price', 'original_price', 'deal_score'];
      const safeUpdates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (updates && key in updates) {
          safeUpdates[key] = updates[key];
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }

      const { error } = await sb
        .from('products')
        .update(safeUpdates)
        .eq('id', deal_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'edit_product' });
    }

    if (action === 'hide_product') {
      // Set is_active = false on the product
      const { error } = await sb
        .from('products')
        .update({ is_active: false })
        .eq('id', deal_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Also mark all reports for this deal as reviewed
      await sb
        .from('deal_reports')
        .update({ reviewed: true, reviewed_at: new Date().toISOString() })
        .eq('deal_id', deal_id);

      return NextResponse.json({ success: true, action: 'hide_product' });
    }

    if (action === 'resolve') {
      // Mark all reports for this deal as reviewed without changing product
      const { error } = await sb
        .from('deal_reports')
        .update({ reviewed: true, reviewed_at: new Date().toISOString() })
        .eq('deal_id', deal_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'resolve' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
