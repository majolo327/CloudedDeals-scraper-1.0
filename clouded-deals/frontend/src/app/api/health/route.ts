import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/health
 *
 * Public health check for monitoring (UptimeRobot, etc.) returns only
 * { status, database, timestamp }.
 *
 * Authenticated requests (Bearer ADMIN_API_KEY) also receive detailed
 * pipeline metrics, table counts, and quality checks — same data the
 * admin dashboard uses.
 */
function isAdminAuthed(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey) return false;
  return authHeader === `Bearer ${expectedKey}`;
}

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const detailed = isAdminAuthed(request);

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json(
      {
        status: "down",
        database: "error",
        timestamp,
        ...(detailed ? { pipeline: null, tables: {}, checks: {} } : {}),
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

    // Public response — just enough for uptime monitoring
    const publicResponse = { status, database: "connected" as const, timestamp };

    if (!detailed) {
      return NextResponse.json(publicResponse);
    }

    // Admin response — full pipeline details
    return NextResponse.json({
      ...publicResponse,
      pipeline,
      tables,
      checks,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "down",
        database: "error",
        timestamp,
        ...(detailed
          ? {
              pipeline: null,
              tables: {},
              checks: {},
              error: err instanceof Error ? err.message : "Unknown error",
            }
          : {}),
      },
      { status: 503 }
    );
  }
}
