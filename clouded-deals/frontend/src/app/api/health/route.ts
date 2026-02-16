import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/health
 *
 * Public monitoring endpoint — returns pipeline status only.
 * No business metrics exposed (deal counts, categories, brands).
 *
 * Full health data is available in the admin panel (/admin/health)
 * behind the PIN gate.
 *
 * Response shape:
 * {
 *   status: "healthy" | "degraded" | "down",
 *   database: "connected" | "error",
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
      { status: "down", database: "error", timestamp },
      { status: 503 }
    );
  }

  try {
    // Quick check: can we reach the DB and are there active deals?
    const { count } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .gt("deal_score", 0);

    const dealCount = count ?? 0;

    let status: "healthy" | "degraded" | "down" = "healthy";
    if (dealCount === 0) {
      status = "down";
    } else if (dealCount < 50) {
      status = "degraded";
    }

    return NextResponse.json({
      status,
      database: "connected",
      timestamp,
    });
  } catch {
    return NextResponse.json(
      { status: "down", database: "error", timestamp },
      { status: 503 }
    );
  }
}
