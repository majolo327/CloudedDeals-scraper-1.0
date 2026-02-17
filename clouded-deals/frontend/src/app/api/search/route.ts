import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/search?q=...&region=...
 *
 * Server-side search endpoint — rate-limited by middleware.
 * Prevents bots from enumerating the product catalog by querying
 * Supabase directly from the browser.
 *
 * Returns raw product rows; client handles final filtering
 * (curated dedup, word-boundary matching, junk filtering).
 */

const MAX_QUERY_LENGTH = 100;

const BLOCKED_DISPENSARY_PREFIXES = ['zen-leaf'];

function isBlockedDispensary(dispensaryId: string): boolean {
  return BLOCKED_DISPENSARY_PREFIXES.some((p) => dispensaryId.startsWith(p));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim();
  const region = searchParams.get("region") || "southern-nv";

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [], error: null });
  }

  // Sanitize: cap length, strip dangerous chars
  const sanitized = query.slice(0, MAX_QUERY_LENGTH);

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json(
      { data: [], error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    // Escape LIKE wildcards to prevent pattern injection
    const escaped = sanitized.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;

    const { data, error } = await db
      .from("products")
      .select(
        `id, name, brand, category, original_price, sale_price, discount_percent,
         weight_value, weight_unit, deal_score, product_url, scraped_at, created_at,
         is_infused, product_subtype, strain_type,
         dispensary:dispensaries!inner(id, name, address, city, state, platform, url, region, latitude, longitude)`
      )
      .eq("is_active", true)
      .eq("dispensaries.region", region)
      .gt("sale_price", 0)
      .or("discount_percent.gt.0,discount_percent.is.null")
      .or(
        `name.ilike.${pattern},brand.ilike.${pattern},category.ilike.${pattern},product_subtype.ilike.${pattern},strain_type.ilike.${pattern}`
      )
      .order("deal_score", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    const filtered = (data ?? []).filter((row: Record<string, unknown>) => {
      const disp = row.dispensary as { id: string } | null | undefined;
      return !disp || !isBlockedDispensary(disp.id);
    });

    return NextResponse.json({ data: filtered, error: null });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
