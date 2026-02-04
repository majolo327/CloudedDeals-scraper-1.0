"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ScrapeRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  total_products: number;
  qualifying_deals: number;
  sites_scraped: string[];
  sites_failed: { slug: string; error: string }[];
}

interface Stats {
  totalProducts: number;
  totalDeals: number;
  successRate: number;
  activeSites: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [productsRes, dealsRes, dispensariesRes, runsRes] =
        await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("deals").select("id", { count: "exact", head: true }),
          supabase
            .from("dispensaries")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from("scrape_runs")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(10),
        ]);

      // Calculate success rate from recent runs.
      const recentRuns = (runsRes.data ?? []) as ScrapeRun[];
      const completedRuns = recentRuns.filter((r) => r.status === "completed");
      const successRate =
        recentRuns.length > 0
          ? Math.round((completedRuns.length / recentRuns.length) * 100)
          : 0;

      setStats({
        totalProducts: productsRes.count ?? 0,
        totalDeals: dealsRes.count ?? 0,
        successRate,
        activeSites: dispensariesRes.count ?? 0,
      });
      setRuns(recentRuns);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Products"
          value={stats?.totalProducts.toLocaleString() ?? "0"}
        />
        <StatCard
          label="Qualifying Deals"
          value={stats?.totalDeals.toLocaleString() ?? "0"}
        />
        <StatCard
          label="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          accent={
            (stats?.successRate ?? 0) >= 91
              ? "text-green-600"
              : "text-orange-500"
          }
        />
        <StatCard
          label="Active Sites"
          value={`${stats?.activeSites ?? 0} / 27`}
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <a
          href="/admin/scraper"
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Run Scraper
        </a>
        <a
          href="/admin/settings"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Manage Settings
        </a>
      </div>

      {/* Recent scrape runs */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Recent Scrape Runs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Products</th>
                <th className="px-4 py-2 font-medium">Deals</th>
                <th className="px-4 py-2 font-medium">Sites OK</th>
                <th className="px-4 py-2 font-medium">Failed</th>
                <th className="px-4 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="text-zinc-700 dark:text-zinc-300"
                >
                  <td className="whitespace-nowrap px-4 py-2">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2">{run.total_products}</td>
                  <td className="px-4 py-2">{run.qualifying_deals}</td>
                  <td className="px-4 py-2">
                    {Array.isArray(run.sites_scraped)
                      ? run.sites_scraped.length
                      : 0}
                  </td>
                  <td className="px-4 py-2">
                    {Array.isArray(run.sites_failed)
                      ? run.sites_failed.length
                      : 0}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {run.completed_at
                      ? formatDuration(run.started_at, run.completed_at)
                      : "—"}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-zinc-400"
                  >
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
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ?? "text-zinc-900 dark:text-zinc-100"}`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    running:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {status}
    </span>
  );
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
