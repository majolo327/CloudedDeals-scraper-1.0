"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface PipelineMetrics {
  qualifying_deals: number;
  flower_count: number;
  vape_count: number;
  edible_count: number;
  concentrate_count: number;
  preroll_count: number;
  unique_brands: number;
  unique_dispensaries: number;
  avg_deal_score: number;
  steal_count: number;
  fire_count: number;
  solid_count: number;
  run_date: string;
}

interface HealthData {
  status: "healthy" | "degraded" | "down";
  database: "connected" | "error";
  pipeline: PipelineMetrics | null;
  tables: Record<string, number>;
  checks: Record<string, number | boolean | null>;
  timestamp: string;
  error?: string;
}

/**
 * Admin Health page — queries Supabase directly (no public API endpoint).
 * Protected by the admin PIN gate via the admin layout.
 */
export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setHealth({
        status: "down",
        database: "error",
        pipeline: null,
        tables: {},
        checks: {},
        timestamp: new Date().toISOString(),
        error: "Supabase not configured",
      });
      setLoading(false);
      return;
    }

    (async () => {
      const timestamp = new Date().toISOString();

      try {
        // Table row counts
        const tableNames = ["dispensaries", "products", "scrape_runs"] as const;
        const tables: Record<string, number> = {};

        for (const table of tableNames) {
          const { count } = await supabase
            .from(table)
            .select("id", { count: "exact", head: true });
          tables[table] = count ?? 0;
        }

        // Active deals count
        const { count: activeDeals } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .gt("deal_score", 0)
          .eq("is_active", true);
        tables["active_deals"] = activeDeals ?? 0;

        // Latest daily metrics
        let pipeline: PipelineMetrics | null = null;
        try {
          const { data } = await supabase
            .from("daily_metrics")
            .select("*")
            .order("run_date", { ascending: false })
            .limit(1)
            .single();
          pipeline = data as PipelineMetrics | null;
        } catch {
          // Table may not exist
        }

        // Quality checks
        const checks = {
          hasDealsToday: (tables["active_deals"] ?? 0) > 0,
          dealCount: tables["active_deals"] ?? 0,
          edibleCount: pipeline?.edible_count ?? null,
          prerollCount: pipeline?.preroll_count ?? null,
          uniqueBrands: pipeline?.unique_brands ?? null,
          uniqueDispensaries: pipeline?.unique_dispensaries ?? null,
          avgScore: pipeline?.avg_deal_score ?? null,
        };

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

        setHealth({ status, database: "connected", pipeline, tables, checks, timestamp });
      } catch (err) {
        setHealth({
          status: "down",
          database: "error",
          pipeline: null,
          tables: {},
          checks: {},
          timestamp,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
      setLoading(false);
    })();
  }, []);

  const statusColor =
    health?.status === "healthy"
      ? "text-green-500"
      : health?.status === "degraded"
        ? "text-yellow-500"
        : "text-red-500";

  const statusBg =
    health?.status === "healthy"
      ? "bg-green-500/10 border-green-500/20"
      : health?.status === "degraded"
        ? "bg-yellow-500/10 border-yellow-500/20"
        : "bg-red-500/10 border-red-500/20";

  return (
    <div className="mx-auto max-w-xl">
      {loading ? (
        <div className="text-sm text-zinc-500">Checking pipeline health...</div>
      ) : !health ? (
        <div className="text-sm text-red-500">Failed to load health data</div>
      ) : (
        <div className="space-y-4">
          {/* Overall status */}
          <div className={`rounded-xl border p-4 ${statusBg}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Pipeline Status
              </span>
              <span className={`text-sm font-bold uppercase ${statusColor}`}>
                {health.status}
              </span>
            </div>
          </div>

          {/* Database */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Database
              </span>
              <span
                className={`text-sm font-semibold ${
                  health.database === "connected"
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {health.database}
              </span>
            </div>
          </div>

          {/* Table counts */}
          {Object.keys(health.tables).length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Tables
              </h2>
              <div className="space-y-2">
                {Object.entries(health.tables).map(([table, count]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {table}
                    </span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {typeof count === "number" ? count.toLocaleString() : count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline metrics */}
          {health.pipeline && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Latest Scrape ({health.pipeline.run_date})
              </h2>
              <div className="space-y-2 text-sm">
                <MetricRow label="Deals curated" value={health.pipeline.qualifying_deals} />
                <MetricRow label="Avg score" value={health.pipeline.avg_deal_score} />
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2" />
                <MetricRow label="Flower" value={health.pipeline.flower_count} />
                <MetricRow label="Vape" value={health.pipeline.vape_count} />
                <MetricRow label="Edible" value={health.pipeline.edible_count} warn={health.pipeline.edible_count < 10} />
                <MetricRow label="Concentrate" value={health.pipeline.concentrate_count} />
                <MetricRow label="Preroll" value={health.pipeline.preroll_count} warn={health.pipeline.preroll_count < 5} />
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2" />
                <MetricRow label="Brands" value={health.pipeline.unique_brands} />
                <MetricRow label="Dispensaries" value={health.pipeline.unique_dispensaries} />
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2" />
                <MetricRow label="STEAL deals" value={health.pipeline.steal_count} />
                <MetricRow label="FIRE deals" value={health.pipeline.fire_count} />
                <MetricRow label="SOLID deals" value={health.pipeline.solid_count} />
              </div>
            </div>
          )}

          {health.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                {health.error}
              </p>
            </div>
          )}

          <div className="text-xs text-zinc-400">
            Checked at: {health.timestamp}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span
        className={
          warn
            ? "font-semibold text-yellow-500"
            : "font-medium text-zinc-800 dark:text-zinc-200"
        }
      >
        {typeof value === "number" && !Number.isInteger(value)
          ? value.toFixed(1)
          : value}
      </span>
    </div>
  );
}
