"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Flagged Products types (moved from dashboard)
// ---------------------------------------------------------------------------

interface FlagReport {
  id: string;
  deal_id: string;
  anon_id: string | null;
  report_type: string;
  report_message: string | null;
  created_at: string;
}

interface FlaggedDeal {
  deal_id: string;
  product_name: string;
  brand_name: string | null;
  dispensary_name: string | null;
  deal_price: number | null;
  report_count: number;
  wrong_price_count: number;
  deal_gone_count: number;
  wrong_product_count: number;
  reviewed: boolean;
  reports: FlagReport[];
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    product_subtype: string | null;
    sale_price: number | null;
    original_price: number | null;
    deal_score: number;
    is_active: boolean;
  } | null;
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

const CATEGORIES = ["flower", "preroll", "vape", "edible", "concentrate", "other"] as const;

const SUBTYPES: { value: string; label: string; categories: string[] }[] = [
  { value: "",                label: "None",            categories: [] },
  { value: "disposable",     label: "Disposable Vape",  categories: ["vape"] },
  { value: "cartridge",      label: "Vape Cartridge",   categories: ["vape"] },
  { value: "pod",            label: "Vape Pod",         categories: ["vape"] },
  { value: "infused_preroll", label: "Infused Pre-Roll", categories: ["preroll"] },
  { value: "preroll_pack",   label: "Pre-Roll Pack",    categories: ["preroll"] },
];

// All regions including NV production (both southern + northern)
const ALL_REGIONS = [
  { id: "southern-nv", label: "Nevada (S)", emoji: "NV", color: "amber" },
  { id: "northern-nv", label: "Nevada (N)", emoji: "NV", color: "amber" },
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
  // Aggregated today's data across all shards
  todaySitesOk: number;
  todaySitesFailed: number;
  todayProducts: number;
  todayDeals: number;
  todayShardsRan: number;
  todayShardsExpected: number;
}

const REGION_LABELS: Record<string, string> = {
  "southern-nv": "NV",
  "northern-nv": "NV",
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

// Expected shards per region — must match REGION_SHARDS in main.py
const EXPECTED_SHARDS: Record<string, number> = {
  "southern-nv": 1,
  "northern-nv": 1,
  michigan: 6,
  illinois: 3,
  colorado: 3,
  massachusetts: 2,
  "new-jersey": 4,
  arizona: 2,
  missouri: 4,
  ohio: 4,
  "new-york": 2,
  pennsylvania: 1,
};

const REGION_COLORS: Record<string, string> = {
  "southern-nv": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  "northern-nv": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
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

  // Flagged products state
  const [flags, setFlags] = useState<FlaggedDeal[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [editingFlag, setEditingFlag] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineMetrics | null>(null);

  const fetchFlags = useCallback(async () => {
    setFlagsError(null);
    try {
      const res = await fetch("/api/admin/flags");
      if (res.ok) {
        const body = await res.json();
        setFlags(body.flags ?? []);
      } else {
        const body = await res.json().catch(() => ({}));
        setFlagsError(body.error || `API returned ${res.status}`);
      }
    } catch (err) {
      setFlagsError(err instanceof Error ? err.message : "Failed to fetch flags");
    }
    setFlagsLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        const { data: metricsData } = await supabase
          .from("daily_metrics")
          .select("*")
          .order("run_date", { ascending: false })
          .limit(1)
          .single();
        setPipeline(metricsData as PipelineMetrics | null);
      } catch {
        // Table may not exist yet
      }
    })();
  }, []);

  async function handleFlagAction(dealId: string, action: string, updates?: Record<string, unknown>) {
    setActionLoading(dealId);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deal_id: dealId, updates }),
      });
      if (res.ok) {
        await fetchFlags();
        if (action === "edit_product") setEditingFlag(null);
      }
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  const activeFlags = flags.filter((f) => !f.reviewed);
  const historyFlags = flags.filter((f) => f.reviewed);

  function exportFlagsMarkdown(subset: FlaggedDeal[]): string {
    const lines: string[] = [
      `# Flagged Products Export — ${new Date().toLocaleDateString()}`,
      "",
      `Total: ${subset.length} flagged product${subset.length !== 1 ? "s" : ""}`,
      "",
    ];
    for (const flag of subset) {
      const status = flag.reviewed ? "RESOLVED" : "ACTIVE";
      lines.push(`## ${flag.product_name}`);
      lines.push("");
      lines.push(`| Field | Value |`);
      lines.push(`|-------|-------|`);
      lines.push(`| **Deal ID** | \`${flag.deal_id}\` |`);
      lines.push(`| **Status** | ${status} |`);
      lines.push(`| **Brand** | ${flag.brand_name ?? "—"} |`);
      lines.push(`| **Dispensary** | ${flag.dispensary_name ?? "—"} |`);
      lines.push(`| **Deal Price** | ${flag.deal_price != null ? `$${flag.deal_price}` : "—"} |`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    return lines.join("\n");
  }

  // ----- Fetch runs + region data -----
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingRegions(false);
      return;
    }

    (async () => {
      try {
        // Fetch recent runs, exact active-site count, and per-region coverage in parallel
        const [runsResult, dispensaryCountResult, regionCoverageResult] = await Promise.all([
          supabase
            .from("scrape_runs")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(300),
          supabase
            .from("dispensaries")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
          supabase.rpc("get_region_site_coverage"),
        ]);

        const allRuns = (runsResult.data ?? []) as ScrapeRun[];
        setRuns(allRuns);

        const running = allRuns.find((r) => r.status === "running");
        if (running) setCurrentRun(running);

        // Use server-side count (no 1k row-limit cap)
        setTotalActiveSites(dispensaryCountResult.count ?? 0);

        // Build per-region active-site counts from RPC
        const regionCounts: Record<string, number> = {};
        if (regionCoverageResult.error) {
          console.error("get_region_site_coverage RPC error:", regionCoverageResult.error);
        }
        for (const row of regionCoverageResult.data ?? []) {
          regionCounts[row.region] = Number(row.active_sites);
        }

        // Build region summaries — aggregate ALL of today's shard runs
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const regionSummaries = ALL_REGIONS.map((r) => {
          const regionRuns = allRuns.filter(
            (run) => run.region === r.id || run.region?.startsWith(r.id + "-")
          );
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

          // Aggregate today's runs across ALL shards — deduplicate sites by slug
          const todayRuns = regionRuns.filter(
            (run) => new Date(run.started_at) >= todayStart
          );
          const uniqueShards = new Set(todayRuns.map((run) => run.region));
          const allScraped = new Set<string>();
          const allFailedMap = new Map<string, { slug: string; error: string }>();
          let todayProducts = 0;
          let todayDeals = 0;
          for (const run of todayRuns) {
            if (Array.isArray(run.sites_scraped)) {
              for (const slug of run.sites_scraped) allScraped.add(slug);
            }
            if (Array.isArray(run.sites_failed)) {
              for (const f of run.sites_failed) allFailedMap.set(f.slug, f);
            }
            todayProducts += run.total_products || 0;
            todayDeals += run.qualifying_deals || 0;
          }
          // Remove sites that succeeded in one shard but failed in another
          for (const slug of allScraped) allFailedMap.delete(slug);
          const todaySitesOk = allScraped.size;
          const todaySitesFailed = allFailedMap.size;

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
            todaySitesOk,
            todaySitesFailed,
            todayProducts,
            todayDeals,
            todayShardsRan: uniqueShards.size,
            todayShardsExpected: EXPECTED_SHARDS[r.id] ?? 1,
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
          runs={runs.filter((r) => r.region === selectedRegion || r.region?.startsWith(selectedRegion + "-"))}
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
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${REGION_COLORS[getBaseRegion(run.region)] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {REGION_LABELS[getBaseRegion(run.region)] ?? run.region}
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

      {/* ── Pipeline Quality ──────────────────────────────────── */}
      {pipeline && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Pipeline Quality — {pipeline.run_date}
            </h3>
          </div>
          <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 text-sm px-4 py-3">
            <PipelineRow label="Deals curated" value={pipeline.qualifying_deals} />
            <PipelineRow label="Avg score" value={pipeline.avg_deal_score} />
            <PipelineRow label="Brands" value={pipeline.unique_brands} />
            <PipelineRow label="Dispensaries" value={pipeline.unique_dispensaries} />
            <div className="col-span-full border-t border-zinc-100 dark:border-zinc-800 my-0.5" />
            <PipelineRow label="Flower" value={pipeline.flower_count} />
            <PipelineRow label="Vape" value={pipeline.vape_count} />
            <PipelineRow label="Edible" value={pipeline.edible_count} warn={pipeline.edible_count < 10} />
            <PipelineRow label="Concentrate" value={pipeline.concentrate_count} />
            <PipelineRow label="Preroll" value={pipeline.preroll_count} warn={pipeline.preroll_count < 5} />
            <div className="col-span-full border-t border-zinc-100 dark:border-zinc-800 my-0.5" />
            <PipelineRow label="STEAL deals" value={pipeline.steal_count} />
            <PipelineRow label="FIRE deals" value={pipeline.fire_count} />
            <PipelineRow label="SOLID deals" value={pipeline.solid_count} />
          </div>
        </div>
      )}

      {/* ── Flagged Products ──────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Flagged Products
            </h3>
            {activeFlags.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                {activeFlags.length} new
              </span>
            )}
            {historyFlags.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {historyFlags.length} resolved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {flags.length > 0 && (
              <button
                onClick={() => {
                  const md = exportFlagsMarkdown(flags);
                  navigator.clipboard.writeText(md).then(() => {
                    setExportCopied(true);
                    setTimeout(() => setExportCopied(false), 2000);
                  });
                }}
                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              >
                {exportCopied ? "Copied!" : "Copy Markdown"}
              </button>
            )}
            <button onClick={fetchFlags} className="text-xs text-zinc-400 hover:text-zinc-600">
              Refresh
            </button>
          </div>
        </div>

        {flagsLoading ? (
          <div className="p-4">
            <div className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : flagsError ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-red-500 dark:text-red-400 mb-1">Failed to load flags</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{flagsError}</p>
            <button onClick={fetchFlags} className="text-xs text-blue-500 hover:text-blue-400 underline">
              Retry
            </button>
          </div>
        ) : flags.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">
            No flagged products — looking clean.
          </div>
        ) : (
          <div>
            {activeFlags.length > 0 && (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {activeFlags.map((flag) => (
                  <FlagRow
                    key={flag.deal_id}
                    flag={flag}
                    dimmed={false}
                    expandedFlag={expandedFlag}
                    setExpandedFlag={setExpandedFlag}
                    editingFlag={editingFlag}
                    setEditingFlag={setEditingFlag}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    actionLoading={actionLoading}
                    handleFlagAction={handleFlagAction}
                  />
                ))}
              </div>
            )}
            {activeFlags.length === 0 && historyFlags.length > 0 && (
              <div className="px-4 py-4 text-center text-sm text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                No active flags — all resolved.
              </div>
            )}
            {historyFlags.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 border-t border-zinc-100 dark:border-zinc-800 transition-colors"
                >
                  <span>History ({historyFlags.length} resolved)</span>
                  <svg className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showHistory && (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {historyFlags.map((flag) => (
                      <FlagRow
                        key={flag.deal_id}
                        flag={flag}
                        dimmed
                        expandedFlag={expandedFlag}
                        setExpandedFlag={setExpandedFlag}
                        editingFlag={editingFlag}
                        setEditingFlag={setEditingFlag}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        actionLoading={actionLoading}
                        handleFlagAction={handleFlagAction}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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

  const { todaySitesOk, todaySitesFailed, todayProducts, todayShardsRan, todayShardsExpected } = summary;
  const hasTodayData = todaySitesOk > 0 || todaySitesFailed > 0;
  const shardCoverage = todayShardsExpected > 0 ? todayShardsRan / todayShardsExpected : 0;

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
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[statusColor]}`} />
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {hasData ? latestRun.status.replace(/_/g, " ") : "no data"}
            </span>
          </div>
          {todayShardsExpected > 1 && (
            <span className={`text-[10px] font-medium ${
              shardCoverage >= 1 ? "text-green-600 dark:text-green-400"
                : shardCoverage > 0 ? "text-yellow-600 dark:text-yellow-400"
                : "text-zinc-400"
            }`}>
              {todayShardsRan}/{todayShardsExpected} shards
            </span>
          )}
        </div>
      </div>

      {hasTodayData ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <MiniStat
            label="Sites OK"
            value={`${todaySitesOk}/${todaySitesOk + todaySitesFailed}`}
            accent={todaySitesFailed === 0 && todaySitesOk > 0}
          />
          <MiniStat label="Products" value={todayProducts.toLocaleString()} />
          <MiniStat label="Deals" value={summary.todayDeals.toLocaleString()} />
          <MiniStat label="7d Rate" value={`${successRate7}%`} accent={successRate7 >= 80} />
        </div>
      ) : hasData ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat
            label="Sites OK"
            value={`${Array.isArray(latestRun.sites_scraped) ? latestRun.sites_scraped.length : 0}/${(Array.isArray(latestRun.sites_scraped) ? latestRun.sites_scraped.length : 0) + (Array.isArray(latestRun.sites_failed) ? latestRun.sites_failed.length : 0)}`}
          />
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

/** Map sharded region names like "michigan-2" to their base "michigan". */
function getBaseRegion(region: string): string {
  const match = region.match(/^(.+)-(\d+)$/);
  if (match && match[1] in REGION_LABELS) return match[1];
  return region;
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

function PipelineRow({
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

function FlagRow({
  flag,
  dimmed,
  expandedFlag,
  setExpandedFlag,
  editingFlag,
  setEditingFlag,
  editForm,
  setEditForm,
  actionLoading,
  handleFlagAction,
}: {
  flag: FlaggedDeal;
  dimmed: boolean;
  expandedFlag: string | null;
  setExpandedFlag: (id: string | null) => void;
  editingFlag: string | null;
  setEditingFlag: (id: string | null) => void;
  editForm: Record<string, string>;
  setEditForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  actionLoading: string | null;
  handleFlagAction: (dealId: string, action: string, updates?: Record<string, unknown>) => void;
}) {
  const isExpanded = expandedFlag === flag.deal_id;
  const isEditing = editingFlag === flag.deal_id;
  const isActing = actionLoading === flag.deal_id;
  const prod = flag.product;

  return (
    <div className={`px-4 py-3 ${dimmed ? "opacity-50 hover:opacity-80 transition-opacity" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setExpandedFlag(isExpanded ? null : flag.deal_id)}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {flag.product_name}
            </span>
            {flag.brand_name && (
              <span className="text-xs text-zinc-500">by {flag.brand_name}</span>
            )}
            {flag.dispensary_name && (
              <span className="text-xs text-zinc-400">@ {flag.dispensary_name}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {flag.wrong_price_count > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                Wrong Price ({flag.wrong_price_count})
              </span>
            )}
            {flag.wrong_product_count > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                Wrong Product ({flag.wrong_product_count})
              </span>
            )}
            {flag.deal_gone_count > 0 && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                Deal Gone ({flag.deal_gone_count})
              </span>
            )}
            <span className="text-[10px] text-zinc-400">
              {flag.report_count} report{flag.report_count > 1 ? "s" : ""}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {!dimmed && (
            <>
              <button
                onClick={() => {
                  if (isEditing) {
                    setEditingFlag(null);
                  } else {
                    setEditingFlag(flag.deal_id);
                    setEditForm({
                      name: prod?.name ?? flag.product_name,
                      brand: prod?.brand ?? flag.brand_name ?? "",
                      category: prod?.category ?? "",
                      product_subtype: prod?.product_subtype ?? "",
                      sale_price: String(prod?.sale_price ?? flag.deal_price ?? ""),
                      original_price: String(prod?.original_price ?? ""),
                    });
                  }
                }}
                disabled={isActing}
                className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                {isEditing ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={() => handleFlagAction(flag.deal_id, "hide_product")}
                disabled={isActing}
                className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {isActing ? "..." : "Hide"}
              </button>
              <button
                onClick={() => handleFlagAction(flag.deal_id, "resolve")}
                disabled={isActing}
                className="rounded-md border border-green-200 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 disabled:opacity-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                Dismiss
              </button>
            </>
          )}
          {dimmed && prod && !prod.is_active && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/40 dark:text-red-400">
              HIDDEN
            </span>
          )}
        </div>
      </div>

      {prod && !dimmed && (
        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            DB: ${prod.sale_price ?? "?"}
            {prod.original_price ? ` (was $${prod.original_price})` : ""}
          </span>
          <span>{prod.category}</span>
          {prod.product_subtype && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
              {SUBTYPES.find(s => s.value === prod.product_subtype)?.label ?? prod.product_subtype}
            </span>
          )}
          <span>Score: {prod.deal_score}</span>
          {!prod.is_active && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/40 dark:text-red-400">
              HIDDEN
            </span>
          )}
        </div>
      )}

      {isEditing && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Name</span>
              <input
                type="text"
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Brand</span>
              <input
                type="text"
                value={editForm.brand ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Category</span>
              <select
                value={editForm.category ?? ""}
                onChange={(e) => {
                  const cat = e.target.value;
                  setEditForm((f) => {
                    const currentSub = SUBTYPES.find(s => s.value === f.product_subtype);
                    const keepSub = currentSub && (currentSub.categories.length === 0 || currentSub.categories.includes(cat));
                    return { ...f, category: cat, ...(keepSub ? {} : { product_subtype: "" }) };
                  });
                }}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sale Price ($)</span>
              <input
                type="number"
                step="0.01"
                value={editForm.sale_price ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, sale_price: e.target.value }))}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Original Price ($)</span>
              <input
                type="number"
                step="0.01"
                value={editForm.original_price ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, original_price: e.target.value }))}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                const updates: Record<string, unknown> = {};
                if (editForm.name) updates.name = editForm.name;
                if (editForm.brand) updates.brand = editForm.brand;
                if (editForm.category) updates.category = editForm.category;
                if ('product_subtype' in editForm) updates.product_subtype = editForm.product_subtype || null;
                if (editForm.sale_price) updates.sale_price = parseFloat(editForm.sale_price);
                if (editForm.original_price) updates.original_price = parseFloat(editForm.original_price);
                handleFlagAction(flag.deal_id, "edit_product", updates);
              }}
              disabled={isActing}
              className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isActing ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {flag.reports.map((r) => (
            <div key={r.id} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2 text-xs">
                <ReportTypeBadge type={r.report_type} />
                <span className="text-zinc-500 dark:text-zinc-400">
                  {r.anon_id ? r.anon_id.slice(0, 8) : "anon"}
                </span>
                <span className="text-zinc-400">
                  {new Date(r.created_at).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </span>
              </div>
              {r.report_message && (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  &ldquo;{r.report_message}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    wrong_price: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    wrong_product: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    deal_gone: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  const labels: Record<string, string> = {
    wrong_price: "Wrong Price",
    wrong_product: "Wrong Product",
    deal_gone: "Deal Gone",
    other: "Other",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[type] ?? styles.other}`}>
      {labels[type] ?? type}
    </span>
  );
}
