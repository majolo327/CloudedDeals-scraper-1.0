"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// All regions including NV production
const ALL_REGIONS = [
  { id: "southern-nv", label: "Nevada", emoji: "NV", color: "amber" },
  { id: "michigan", label: "Michigan", emoji: "MI", color: "blue" },
  { id: "illinois", label: "Illinois", emoji: "IL", color: "indigo" },
  { id: "new-jersey", label: "New Jersey", emoji: "NJ", color: "teal" },
  { id: "massachusetts", label: "Massachusetts", emoji: "MA", color: "emerald" },
  { id: "arizona", label: "Arizona", emoji: "AZ", color: "orange" },
  { id: "pennsylvania", label: "Pennsylvania", emoji: "PA", color: "rose" },
  { id: "ohio", label: "Ohio", emoji: "OH", color: "red" },
  { id: "missouri", label: "Missouri", emoji: "MO", color: "purple" },
  { id: "colorado", label: "Colorado", emoji: "CO", color: "sky" },
  { id: "new-york", label: "New York", emoji: "NY", color: "yellow" },
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
  emoji: string;
  latestRun: ScrapeRun | null;
  last7Runs: ScrapeRun[];
  totalProductsLastRun: number;
  successRate7: number;
  avgRuntime7: number;
  activeSites: number;
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

export default function ScraperPage() {
  const [currentRun, setCurrentRun] = useState<ScrapeRun | null>(null);
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [summaries, setSummaries] = useState<RegionSummary[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [totalActiveSites, setTotalActiveSites] = useState(0);
  const [loadingRegions, setLoadingRegions] = useState(true);

  // ----- Fetch runs + region data -----
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingRegions(false);
      return;
    }

    (async () => {
      try {
        // Fetch recent runs for all regions and active site counts in parallel
        const [runsResult, dispensaryResult] = await Promise.all([
          supabase
            .from("scrape_runs")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(300),
          supabase
            .from("dispensaries")
            .select("region")
            .eq("is_active", true),
        ]);

        const allRuns = (runsResult.data ?? []) as ScrapeRun[];
        setRuns(allRuns);

        const running = allRuns.find((r) => r.status === "running");
        if (running) setCurrentRun(running);

        // Count active sites per region from DB
        const regionCounts: Record<string, number> = {};
        for (const d of dispensaryResult.data ?? []) {
          regionCounts[d.region] = (regionCounts[d.region] || 0) + 1;
        }
        setTotalActiveSites(dispensaryResult.data?.length ?? 0);

        // Build region summaries
        const regionSummaries = ALL_REGIONS.map((r) => {
          const regionRuns = allRuns.filter((run) => run.region === r.id);
          const last7 = regionRuns.slice(0, 7);
          const completed7 = last7.filter(
            (run) =>
              run.status === "completed" || run.status === "completed_with_errors"
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

          const latestRun = regionRuns[0] ?? null;

          return {
            region: r.id,
            label: r.label,
            emoji: r.emoji,
            latestRun,
            last7Runs: last7,
            totalProductsLastRun: latestRun?.total_products ?? 0,
            successRate7: successRate,
            avgRuntime7: avgRuntime,
            activeSites: regionCounts[r.id] ?? 0,
          };
        });

        setSummaries(regionSummaries);
      } catch (err) {
        console.error("Failed to load scraper data:", err);
      }
      setLoadingRegions(false);
    })();
  }, []);

  // ----- Real-time run updates -----
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("scrape-runs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scrape_runs" },
        (payload) => {
          const row = payload.new as ScrapeRun;
          setRuns((prev) => {
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = row;
              return updated;
            }
            return [row, ...prev];
          });

          if (row.status === "running") {
            setCurrentRun(row);
          } else if (currentRun?.id === row.id) {
            setCurrentRun(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRun]);

  // ----- Trigger scrape -----
  async function triggerScrape() {
    setTriggering(true);
    setLogs((prev) => [...prev, `[${ts()}] Triggering scrape run...`]);

    try {
      const res = await fetch("/api/scraper/trigger", { method: "POST" });
      const body = await res.json();

      if (res.ok) {
        setLogs((prev) => [
          ...prev,
          `[${ts()}] Scrape run started: ${body.run_id ?? "OK"}`,
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          `[${ts()}] ERROR: ${body.error ?? res.statusText}`,
        ]);
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `[${ts()}] Network error: ${String(err)}`,
      ]);
    } finally {
      setTriggering(false);
    }
  }

  const regionsWithData = summaries.filter((s) => s.latestRun !== null).length;

  return (
    <div className="space-y-6">
      {/* Scraper status + trigger */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Scraper Status
            </h3>
            {currentRun ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-sm text-green-600 dark:text-green-400">
                  Running since {new Date(currentRun.started_at).toLocaleTimeString()}
                </span>
                <span className="text-xs text-zinc-400">
                  ({currentRun.total_products} products,{" "}
                  {Array.isArray(currentRun.sites_scraped) ? currentRun.sites_scraped.length : 0} sites done)
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">Idle — no active run</p>
            )}
          </div>
          <button
            onClick={triggerScrape}
            disabled={triggering || currentRun !== null}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {triggering ? "Starting..." : "Run Now"}
          </button>
        </div>
      </div>

      {/* Log stream */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Log Stream
          </h3>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Clear
            </button>
          )}
        </div>
        <div className="h-36 overflow-y-auto bg-zinc-950 p-3 font-mono text-xs text-green-400">
          {logs.length === 0 ? (
            <span className="text-zinc-600">Waiting for activity...</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="leading-relaxed">{line}</div>
            ))
          )}
        </div>
      </div>

      {/* ── Region Overview ─────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            All Regions
          </h2>
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              <strong className="text-zinc-800 dark:text-zinc-200">{regionsWithData}</strong> / {ALL_REGIONS.length} with data
            </span>
            <span>
              <strong className="text-zinc-800 dark:text-zinc-200">{totalActiveSites.toLocaleString()}</strong> active sites
            </span>
          </div>
        </div>

        {loadingRegions ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => (
              <RegionCard
                key={s.region}
                summary={s}
                onClick={() =>
                  setSelectedRegion(selectedRegion === s.region ? null : s.region)
                }
                expanded={selectedRegion === s.region}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expanded region detail */}
      {selectedRegion && (
        <RegionDetail
          runs={runs.filter((r) => r.region === selectedRegion)}
          regionLabel={
            ALL_REGIONS.find((r) => r.id === selectedRegion)?.label ?? selectedRegion
          }
        />
      )}

      {/* ── Historical Runs ─────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            All Historical Runs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Region</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Products</th>
                <th className="px-4 py-2 font-medium">Deals</th>
                <th className="px-4 py-2 font-medium">Sites OK / Failed</th>
                <th className="px-4 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {runs.slice(0, 30).map((run) => {
                const scraped = Array.isArray(run.sites_scraped) ? run.sites_scraped.length : 0;
                const failed = Array.isArray(run.sites_failed) ? run.sites_failed.length : 0;
                return (
                  <tr key={run.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className="whitespace-nowrap px-4 py-2 text-xs">
                      {new Date(run.started_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${REGION_COLORS[run.region] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {REGION_LABELS[run.region] ?? run.region}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2">{run.total_products?.toLocaleString() ?? "0"}</td>
                    <td className="px-4 py-2">{run.qualifying_deals ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="text-green-600">{scraped}</span>
                      {" / "}
                      <span className="text-red-500">{failed}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs">
                      {run.completed_at
                        ? formatDuration(run.started_at, run.completed_at)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    No runs recorded yet.
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

function RegionCard({
  summary,
  onClick,
  expanded,
}: {
  summary: RegionSummary;
  onClick: () => void;
  expanded: boolean;
}) {
  const { latestRun, successRate7, activeSites } = summary;

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
    green: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/60",
    yellow: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/60",
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
    ? Array.isArray(latestRun.sites_scraped) ? latestRun.sites_scraped.length : 0
    : 0;
  const sitesFailed = hasData
    ? Array.isArray(latestRun.sites_failed) ? latestRun.sites_failed.length : 0
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
              {summary.emoji}
            </span>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {summary.label}
            </h3>
          </div>
          <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {activeSites} active sites
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
          <MiniStat label="Sites OK" value={`${sitesOk}/${sitesOk + sitesFailed}`} />
          <MiniStat label="Products" value={latestRun.total_products?.toLocaleString() ?? "0"} />
          <MiniStat label="7d Rate" value={`${successRate7}%`} accent={successRate7 >= 80} />
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
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
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
              const sitesOk = Array.isArray(run.sites_scraped) ? run.sites_scraped.length : 0;
              const sitesFailed = Array.isArray(run.sites_failed) ? run.sites_failed.length : 0;

              return (
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
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2">{run.total_products?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2">{run.qualifying_deals ?? "—"}</td>
                  <td className="px-4 py-2">{sitesOk}</td>
                  <td className="px-4 py-2">
                    {sitesFailed > 0 ? (
                      <span className="font-medium text-red-500">{sitesFailed}</span>
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
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
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

function ts(): string {
  return new Date().toLocaleTimeString();
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
