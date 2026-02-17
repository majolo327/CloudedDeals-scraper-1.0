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
  try {
    const sb = createServiceClient();

    // Fetch unreviewed reports with product join
    const { data: reports, error } = await sb
      .from('deal_reports')
      .select('*')
      .eq('reviewed', false)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by deal_id
    const grouped: Record<string, {
      deal_id: string;
      product_name: string;
      brand_name: string | null;
      dispensary_name: string | null;
      deal_price: number | null;
      reports: typeof reports;
    }> = {};

    for (const r of reports ?? []) {
      if (!grouped[r.deal_id]) {
        grouped[r.deal_id] = {
          deal_id: r.deal_id,
          product_name: r.product_name,
          brand_name: r.brand_name,
          dispensary_name: r.dispensary_name,
          deal_price: r.deal_price,
          reports: [],
        };
      }
      grouped[r.deal_id].reports.push(r);
    }

    // For each flagged deal, fetch current product data
    const dealIds = Object.keys(grouped);
    const productMap: Record<string, {
      id: string;
      name: string;
      brand: string | null;
      category: string | null;
      sale_price: number | null;
      original_price: number | null;
      deal_score: number;
      is_active: boolean;
      dispensary_id: string;
    }> = {};

    if (dealIds.length > 0) {
      const { data: products } = await sb
        .from('products')
        .select('id, name, brand, category, sale_price, original_price, deal_score, is_active, dispensary_id')
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

    // Sort by report count descending
    flags.sort((a, b) => b.report_count - a.report_count);

    return NextResponse.json({ flags });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deal_id, updates } = body;

    if (!action || !deal_id) {
      return NextResponse.json({ error: 'Missing action or deal_id' }, { status: 400 });
    }

    const sb = createServiceClient();

    if (action === 'edit_product') {
      // Update product fields
      const allowed = ['name', 'brand', 'category', 'sale_price', 'original_price', 'deal_score'];
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
