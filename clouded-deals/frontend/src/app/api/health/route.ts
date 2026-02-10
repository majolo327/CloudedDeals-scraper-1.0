import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/health
 *
 * Server-side health check — returns pipeline status and daily metrics.
 * No auth required (public monitoring endpoint).
 *
 * Response shape:
 * {
 *   status: "healthy" | "degraded" | "down",
 *   database: "connected" | "error",
 *   pipeline: { ... latest daily_metrics row ... } | null,
 *   tables: { products: number, dispensaries: number, ... },
 *   checks: { hasDealsToday: boolean, edibleCount: number, ... },
 *   timestamp: string
 * }
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json(
      {
        status: "down",
        database: "error",
        pipeline: null,
        tables: {},
        checks: {},
        timestamp,
        error: "Database not configured",
      },
      { status: 503 }
    );
  }

  try {
    // --- Table row counts ---
    const tableNames = ["dispensaries", "products", "scrape_runs"] as const;
    const tables: Record<string, number> = {};

    for (const table of tableNames) {
      const { count } = await db
        .from(table)
        .select("id", { count: "exact", head: true });
      tables[table] = count ?? 0;
    }

    // Active deals count (deal_score > 0)
    const { count: activeDeals } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .gt("deal_score", 0);
    tables["active_deals"] = activeDeals ?? 0;

    // --- Latest daily metrics (if table exists) ---
    let pipeline = null;
    try {
      const { data } = await db
        .from("daily_metrics")
        .select("*")
        .order("run_date", { ascending: false })
        .limit(1)
        .single();
      pipeline = data;
    } catch {
      // Table may not exist yet — that's fine
    }

    // --- Quality checks ---
    const checks = {
      hasDealsToday: (tables["active_deals"] ?? 0) > 0,
      dealCount: tables["active_deals"] ?? 0,
      edibleCount: pipeline?.edible_count ?? null,
      prerollCount: pipeline?.preroll_count ?? null,
      uniqueBrands: pipeline?.unique_brands ?? null,
      uniqueDispensaries: pipeline?.unique_dispensaries ?? null,
      avgScore: pipeline?.avg_deal_score ?? null,
    };

    // Determine overall status
    let status: "healthy" | "degraded" | "down" = "healthy";
    if (checks.dealCount === 0) {
      status = "down";
    } else if (
      checks.dealCount < 50 ||
      (checks.edibleCount !== null && checks.edibleCount < 5) ||
      (checks.prerollCount !== null && checks.prerollCount < 3)
    ) {
      status = "degraded";
    }

    return NextResponse.json({
      status,
      database: "connected",
      pipeline,
      tables,
      checks,
      timestamp,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "down",
        database: "error",
        pipeline: null,
        tables: {},
        checks: {},
        timestamp,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
