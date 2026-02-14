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

const REGION_LABELS: Record<string, string> = {
  "southern-nv": "NV",
  michigan: "MI",
  illinois: "IL",
  arizona: "AZ",
  missouri: "MO",
  "new-jersey": "NJ",
  all: "ALL",
};

const REGION_COLORS: Record<string, string> = {
  "southern-nv": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  michigan: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  illinois: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  arizona: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  missouri: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  "new-jersey": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  all: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function ScraperPage() {
  const [currentRun, setCurrentRun] = useState<ScrapeRun | null>(null);
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [triggering, setTriggering] = useState(false);

  // ----- Fetch runs -----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("scrape_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(20);

        const rows = (data ?? []) as ScrapeRun[];
        setRuns(rows);

        const running = rows.find((r) => r.status === "running");
        if (running) setCurrentRun(running);
      } catch {
        // DB not available
      }
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
    setLogs((prev) => [...prev, `[${timestamp()}] Triggering scrape run...`]);

    try {
      const res = await fetch("/api/scraper/trigger", { method: "POST" });
      const body = await res.json();

      if (res.ok) {
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] Scrape run started: ${body.run_id ?? "OK"}`,
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] ERROR: ${body.error ?? res.statusText}`,
        ]);
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `[${timestamp()}] Network error: ${String(err)}`,
      ]);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Scraper status */}
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
                  Running since{" "}
                  {new Date(currentRun.started_at).toLocaleTimeString()}
                </span>
                <span className="text-xs text-zinc-400">
                  ({currentRun.total_products} products,{" "}
                  {Array.isArray(currentRun.sites_scraped)
                    ? currentRun.sites_scraped.length
                    : 0}{" "}
                  sites done)
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

      {/* Live log stream */}
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
        <div className="h-48 overflow-y-auto bg-zinc-950 p-3 font-mono text-xs text-green-400">
          {logs.length === 0 ? (
            <span className="text-zinc-600">
              Waiting for activity...
            </span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="leading-relaxed">
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Historical runs table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Historical Runs
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
              {runs.map((run) => {
                const scraped = Array.isArray(run.sites_scraped)
                  ? run.sites_scraped.length
                  : 0;
                const failed = Array.isArray(run.sites_failed)
                  ? run.sites_failed.length
                  : 0;
                return (
                  <tr key={run.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className="whitespace-nowrap px-4 py-2">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${REGION_COLORS[run.region] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {REGION_LABELS[run.region] ?? run.region}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          run.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : run.status === "running"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">{run.total_products}</td>
                    <td className="px-4 py-2">{run.qualifying_deals}</td>
                    <td className="px-4 py-2">
                      <span className="text-green-600">{scraped}</span>
                      {" / "}
                      <span className="text-red-500">{failed}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {run.completed_at
                        ? formatDuration(run.started_at, run.completed_at)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {runs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-zinc-400"
                  >
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

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
