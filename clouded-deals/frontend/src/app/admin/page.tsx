"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface ScrapeRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  region: string;
  total_products: number;
  qualifying_deals: number;
  sites_scraped: string[];
  sites_failed: { slug: string; error: string }[];
}

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

interface DashboardData {
  totalProducts: number;
  totalDeals: number;
  activeDeals: number;
  successRate: number;
  activeSites: number;
  runs: ScrapeRun[];
  pipeline: PipelineMetrics | null;
  pipelineStatus: "healthy" | "degraded" | "down";
}

const REGION_LABELS: Record<string, string> = {
  "southern-nv": "NV",
  michigan: "MI",
  illinois: "IL",
  arizona: "AZ",
  missouri: "MO",
  "new-jersey": "NJ",
  ohio: "OH",
  colorado: "CO",
  "new-york": "NY",
  massachusetts: "MA",
  pennsylvania: "PA",
  all: "ALL",
};

const REGION_COLORS: Record<string, string> = {
  "southern-nv": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  michigan: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  illinois: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  arizona: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  missouri: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  "new-jersey": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  ohio: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  colorado: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  "new-york": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  massachusetts: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  pennsylvania: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  all: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setData({
        totalProducts: 0,
        totalDeals: 0,
        activeDeals: 0,
        successRate: 0,
        activeSites: 0,
        runs: [],
        pipeline: null,
        pipelineStatus: "down",
      });
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [productsRes, dealsRes, dispensariesRes, runsRes, activeDealsRes] =
          await Promise.all([
            supabase.from("products").select("id", { count: "exact", head: true }),
            supabase.from("products").select("id", { count: "exact", head: true }).gt("deal_score", 0),
            supabase.from("dispensaries").select("id", { count: "exact", head: true }).eq("is_active", true),
            supabase.from("scrape_runs").select("*").order("started_at", { ascending: false }).limit(15),
            supabase.from("products").select("id", { count: "exact", head: true }).gt("deal_score", 0).eq("is_active", true),
          ]);

        const recentRuns = (runsRes.data ?? []) as ScrapeRun[];
        const completedRuns = recentRuns.filter(
          (r) => r.status === "completed" || r.status === "completed_with_errors"
        );
        const successRate =
          recentRuns.length > 0
            ? Math.round((completedRuns.length / recentRuns.length) * 100)
            : 0;

        // Pipeline metrics from daily_metrics
        let pipeline: PipelineMetrics | null = null;
        try {
          const { data: metricsData } = await supabase
            .from("daily_metrics")
            .select("*")
            .order("run_date", { ascending: false })
            .limit(1)
            .single();
          pipeline = metricsData as PipelineMetrics | null;
        } catch {
          // Table may not exist yet
        }

        const adCount = activeDealsRes.count ?? 0;
        let pipelineStatus: "healthy" | "degraded" | "down" = "healthy";
        if (adCount === 0) {
          pipelineStatus = "down";
        } else if (
          adCount < 50 ||
          (pipeline?.edible_count != null && pipeline.edible_count < 5) ||
          (pipeline?.preroll_count != null && pipeline.preroll_count < 3)
        ) {
          pipelineStatus = "degraded";
        }

        setData({
          totalProducts: productsRes.count ?? 0,
          totalDeals: dealsRes.count ?? 0,
          activeDeals: adCount,
          successRate,
          activeSites: dispensariesRes.count ?? 0,
          runs: recentRuns,
          pipeline,
          pipelineStatus,
        });
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setData({
          totalProducts: 0,
          totalDeals: 0,
          activeDeals: 0,
          successRate: 0,
          activeSites: 0,
          runs: [],
          pipeline: null,
          pipelineStatus: "down",
        });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (!data) return null;

  const statusColor =
    data.pipelineStatus === "healthy"
      ? "text-green-500"
      : data.pipelineStatus === "degraded"
        ? "text-yellow-500"
        : "text-red-500";

  const statusBg =
    data.pipelineStatus === "healthy"
      ? "bg-green-500/10 border-green-500/20"
      : data.pipelineStatus === "degraded"
        ? "bg-yellow-500/10 border-yellow-500/20"
        : "bg-red-500/10 border-red-500/20";

  return (
    <div className="space-y-6">
      {/* Pipeline status banner */}
      <div className={`rounded-xl border p-4 ${statusBg}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Pipeline Status
          </span>
          <span className={`text-sm font-bold uppercase ${statusColor}`}>
            {data.pipelineStatus}
          </span>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Sites" value={data.activeSites.toLocaleString()} sub="dispensaries in DB" />
        <StatCard label="Products in DB" value={data.totalProducts.toLocaleString()} sub="unique products" />
        <StatCard
          label="Qualifying Deals"
          value={data.totalDeals.toLocaleString()}
          sub={`${data.activeDeals.toLocaleString()} active`}
        />
        <StatCard
          label="Success Rate"
          value={`${data.successRate}%`}
          accent={data.successRate >= 91 ? "text-green-600 dark:text-green-400" : "text-orange-500"}
          sub="last 15 runs"
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <a
          href="/admin/scraper"
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Scraper &amp; Regions
        </a>
        <a
          href="/admin/settings"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Settings
        </a>
      </div>

      {/* Pipeline quality (from Health) */}
      {data.pipeline && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Pipeline Quality — {data.pipeline.run_date}
          </h3>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <MetricRow label="Deals curated" value={data.pipeline.qualifying_deals} />
            <MetricRow label="Avg score" value={data.pipeline.avg_deal_score} />
            <MetricRow label="Brands" value={data.pipeline.unique_brands} />
            <MetricRow label="Dispensaries" value={data.pipeline.unique_dispensaries} />
            <div className="col-span-full border-t border-zinc-100 dark:border-zinc-800 my-1" />
            <MetricRow label="Flower" value={data.pipeline.flower_count} />
            <MetricRow label="Vape" value={data.pipeline.vape_count} />
            <MetricRow label="Edible" value={data.pipeline.edible_count} warn={data.pipeline.edible_count < 10} />
            <MetricRow label="Concentrate" value={data.pipeline.concentrate_count} />
            <MetricRow label="Preroll" value={data.pipeline.preroll_count} warn={data.pipeline.preroll_count < 5} />
            <div className="col-span-full border-t border-zinc-100 dark:border-zinc-800 my-1" />
            <MetricRow label="STEAL deals" value={data.pipeline.steal_count} />
            <MetricRow label="FIRE deals" value={data.pipeline.fire_count} />
            <MetricRow label="SOLID deals" value={data.pipeline.solid_count} />
          </div>
        </div>
      )}

      {/* Recent scrape runs */}
      <div className="rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Recent Scrape Runs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Started</th>
                <th className="px-4 py-2 font-semibold">Region</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Products</th>
                <th className="px-4 py-2 font-semibold">Deals</th>
                <th className="px-4 py-2 font-semibold">Sites OK</th>
                <th className="px-4 py-2 font-semibold">Failed</th>
                <th className="px-4 py-2 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.runs.map((run) => (
                <tr key={run.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {new Date(run.started_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <RegionBadge region={run.region} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2">{run.total_products?.toLocaleString() ?? "0"}</td>
                  <td className="px-4 py-2">{run.qualifying_deals ?? "—"}</td>
                  <td className="px-4 py-2">
                    {Array.isArray(run.sites_scraped) ? run.sites_scraped.length : 0}
                  </td>
                  <td className="px-4 py-2">
                    {Array.isArray(run.sites_failed) && run.sites_failed.length > 0 ? (
                      <span className="font-medium text-red-500">{run.sites_failed.length}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {run.completed_at ? formatDuration(run.started_at, run.completed_at) : "—"}
                  </td>
                </tr>
              ))}
              {data.runs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No scrape runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-zinc-900 dark:text-white"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
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
        {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}
      </span>
    </div>
  );
}

function RegionBadge({ region }: { region: string }) {
  const label = REGION_LABELS[region] ?? region;
  const color = REGION_COLORS[region] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    completed_with_errors: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };

  const labels: Record<string, string> = {
    completed: "OK",
    completed_with_errors: "partial",
    running: "running",
    failed: "failed",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
