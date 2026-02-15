"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Expansion regions — everything except production NV
const EXPANSION_REGIONS = [
  { id: "michigan", label: "Michigan", emoji: "MI", color: "blue" },
  { id: "illinois", label: "Illinois", emoji: "IL", color: "purple" },
  { id: "arizona", label: "Arizona", emoji: "AZ", color: "orange" },
  { id: "missouri", label: "Missouri", emoji: "MO", color: "emerald" },
  { id: "new-jersey", label: "New Jersey", emoji: "NJ", color: "cyan" },
] as const;

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
  runtime_seconds: number | null;
}

interface RegionSummary {
  region: string;
  label: string;
  latestRun: ScrapeRun | null;
  last7Runs: ScrapeRun[];
  totalProductsLast7: number;
  successRate7: number;
  avgRuntime7: number;
  configuredSites: number;
}

// How many sites are configured per region (from dispensaries.py)
const CONFIGURED_SITES: Record<string, number> = {
  michigan: 114,
  illinois: 88,
  arizona: 52,
  missouri: 31,
  "new-jersey": 34,
};

export default function ExpansionDashboard() {
  const [summaries, setSummaries] = useState<RegionSummary[]>([]);
  const [allRuns, setAllRuns] = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSummaries(
        EXPANSION_REGIONS.map((r) => ({
          region: r.id,
          label: r.label,
          latestRun: null,
          last7Runs: [],
          totalProductsLast7: 0,
          successRate7: 0,
          avgRuntime7: 0,
          configuredSites: CONFIGURED_SITES[r.id] ?? 0,
        }))
      );
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Fetch recent runs for all expansion regions
        const regionIds = EXPANSION_REGIONS.map((r) => r.id);
        const { data: runs } = await supabase
          .from("scrape_runs")
          .select("*")
          .in("region", regionIds)
          .order("started_at", { ascending: false })
          .limit(200);

        const allRunsData = (runs ?? []) as ScrapeRun[];
        setAllRuns(allRunsData);

        const regionSummaries = EXPANSION_REGIONS.map((r) => {
          const regionRuns = allRunsData.filter(
            (run) => run.region === r.id
          );
          const last7 = regionRuns.slice(0, 7);
          const completed7 = last7.filter(
            (run) =>
              run.status === "completed" ||
              run.status === "completed_with_errors"
          );

          const totalProducts = last7.reduce(
            (sum, run) => sum + (run.total_products || 0),
            0
          );
          const successRate =
            last7.length > 0
              ? Math.round((completed7.length / last7.length) * 100)
              : 0;
          const avgRuntime =
            completed7.length > 0
              ? Math.round(
                  completed7.reduce(
                    (sum, run) => sum + (run.runtime_seconds || 0),
                    0
                  ) / completed7.length
                )
              : 0;

          return {
            region: r.id,
            label: r.label,
            latestRun: regionRuns[0] ?? null,
            last7Runs: last7,
            totalProductsLast7: totalProducts,
            successRate7: successRate,
            avgRuntime7: avgRuntime,
            configuredSites: CONFIGURED_SITES[r.id] ?? 0,
          };
        });

        setSummaries(regionSummaries);
      } catch (err) {
        console.error("Failed to load expansion data:", err);
        setSummaries(
          EXPANSION_REGIONS.map((r) => ({
            region: r.id,
            label: r.label,
            latestRun: null,
            last7Runs: [],
            totalProductsLast7: 0,
            successRate7: 0,
            avgRuntime7: 0,
            configuredSites: CONFIGURED_SITES[r.id] ?? 0,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalConfigured = Object.values(CONFIGURED_SITES).reduce(
    (a, b) => a + b,
    0
  );
  const totalProductsAll = summaries.reduce(
    (sum, s) => sum + s.totalProductsLast7,
    0
  );
  const regionsWithData = summaries.filter((s) => s.latestRun !== null).length;

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Expansion States"
          value={`${regionsWithData} / ${EXPANSION_REGIONS.length}`}
          sub="with scrape data"
        />
        <SummaryCard
          label="Configured Sites"
          value={totalConfigured.toString()}
          sub="across 5 states"
        />
        <SummaryCard
          label="Products (7d)"
          value={totalProductsAll.toLocaleString()}
          sub="total scraped"
        />
        <SummaryCard
          label="NV Production"
          value="63 sites"
          sub="separate — not shown here"
          muted
        />
      </div>

      {/* Region cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((s) => (
          <RegionCard
            key={s.region}
            summary={s}
            meta={EXPANSION_REGIONS.find((r) => r.id === s.region)!}
            onClick={() =>
              setSelectedRegion(
                selectedRegion === s.region ? null : s.region
              )
            }
            expanded={selectedRegion === s.region}
          />
        ))}
      </div>

      {/* Expanded detail for selected region */}
      {selectedRegion && (
        <RegionDetail
          runs={allRuns.filter((r) => r.region === selectedRegion)}
          regionLabel={
            EXPANSION_REGIONS.find((r) => r.id === selectedRegion)?.label ??
            selectedRegion
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        muted
          ? "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80"
          : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-white"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
    </div>
  );
}

function RegionCard({
  summary,
  meta,
  onClick,
  expanded,
}: {
  summary: RegionSummary;
  meta: (typeof EXPANSION_REGIONS)[number];
  onClick: () => void;
  expanded: boolean;
}) {
  const { latestRun, successRate7, configuredSites } = summary;

  const hasData = latestRun !== null;
  const statusColor = !hasData
    ? "zinc"
    : latestRun.status === "completed"
      ? "green"
      : latestRun.status === "completed_with_errors"
        ? "yellow"
        : latestRun.status === "running"
          ? "blue"
          : "red";

  const statusStyles: Record<string, string> = {
    green:
      "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/60",
    yellow:
      "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/60",
    red: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/60",
    blue: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60",
    zinc: "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900",
  };

  const dotStyles: Record<string, string> = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
    blue: "bg-blue-500 animate-pulse",
    zinc: "bg-zinc-300",
  };

  const sitesOk = hasData
    ? Array.isArray(latestRun.sites_scraped)
      ? latestRun.sites_scraped.length
      : 0
    : 0;
  const sitesFailed = hasData
    ? Array.isArray(latestRun.sites_failed)
      ? latestRun.sites_failed.length
      : 0
    : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-md ${
        statusStyles[statusColor]
      } ${expanded ? "ring-2 ring-green-500/40" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
              {meta.emoji}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {meta.label}
            </h3>
          </div>
          <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {configuredSites} configured sites
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[statusColor]}`} />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {hasData ? latestRun.status.replace(/_/g, " ") : "no data"}
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat
            label="Sites OK"
            value={`${sitesOk}/${sitesOk + sitesFailed}`}
          />
          <MiniStat
            label="Products"
            value={latestRun.total_products?.toLocaleString() ?? "0"}
          />
          <MiniStat
            label="7d Rate"
            value={`${successRate7}%`}
            accent={successRate7 >= 80}
          />
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-zinc-100 px-3 py-4 text-center text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          Awaiting first scrape run
        </div>
      )}

      {hasData && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Last run:{" "}
          {new Date(latestRun.started_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {latestRun.runtime_seconds
            ? ` (${Math.round(latestRun.runtime_seconds / 60)}m)`
            : ""}
        </p>
      )}
    </button>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white/80 px-2.5 py-2 dark:bg-zinc-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`text-sm font-bold ${
          accent
            ? "text-green-700 dark:text-green-400"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RegionDetail({
  runs,
  regionLabel,
}: {
  runs: ScrapeRun[];
  regionLabel: string;
}) {
  const recent = runs.slice(0, 10);

  return (
    <div className="rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {regionLabel} — Recent Runs
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Date</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Products</th>
              <th className="px-4 py-2 font-semibold">Deals</th>
              <th className="px-4 py-2 font-semibold">Sites OK</th>
              <th className="px-4 py-2 font-semibold">Failed</th>
              <th className="px-4 py-2 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((run) => {
              const sitesOk = Array.isArray(run.sites_scraped)
                ? run.sites_scraped.length
                : 0;
              const sitesFailed = Array.isArray(run.sites_failed)
                ? run.sites_failed.length
                : 0;

              return (
                <tr
                  key={run.id}
                  className="text-zinc-800 dark:text-zinc-200"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {new Date(run.started_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2">
                    {run.total_products?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {run.qualifying_deals ?? "—"}
                  </td>
                  <td className="px-4 py-2">{sitesOk}</td>
                  <td className="px-4 py-2">
                    {sitesFailed > 0 ? (
                      <span className="font-medium text-red-500">
                        {sitesFailed}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {run.runtime_seconds
                      ? `${Math.floor(run.runtime_seconds / 60)}m ${run.runtime_seconds % 60}s`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {recent.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No runs yet for this region.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Failed sites detail for the latest run */}
      {recent[0] &&
        Array.isArray(recent[0].sites_failed) &&
        recent[0].sites_failed.length > 0 && (
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <p className="mb-2 text-xs font-semibold text-red-600 dark:text-red-400">
              Failed Sites (latest run):
            </p>
            <div className="space-y-1">
              {recent[0].sites_failed.map((f, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{f.slug}</span>
                  <span className="truncate text-red-500 dark:text-red-400">{f.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    completed_with_errors:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    running:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    failed:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
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
