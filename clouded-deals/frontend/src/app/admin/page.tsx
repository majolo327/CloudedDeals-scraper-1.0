"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/admin/MetricCard";
import { CohortTable } from "@/components/admin/CohortTable";
import { SparklineChart } from "@/components/admin/SparklineChart";
import { ScraperHealthBadge } from "@/components/admin/ScraperHealthBadge";
import {
  useDashboardMetrics,
  type TimeWindow,
  type CoverageRow,
} from "@/hooks/useDashboardMetrics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGION_LABELS: Record<string, string> = {
  "southern-nv": "Nevada (S)",
  "northern-nv": "Nevada (N)",
  michigan: "Michigan",
  illinois: "Illinois",
  arizona: "Arizona",
  missouri: "Missouri",
  "new-jersey": "New Jersey",
  ohio: "Ohio",
  colorado: "Colorado",
  "new-york": "New York",
  massachusetts: "Massachusetts",
  pennsylvania: "Pennsylvania",
};

const TIME_WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All Time" },
];

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("30d");
  const { data, loading, error, refresh, lastUpdated } =
    useDashboardMetrics(timeWindow);
  const router = useRouter();

  const g = data?.growth;
  const r = data?.retention;
  const p = data?.pipeline;
  const v = data?.viral;

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* ZONE 0 — Page Header                                            */}
      {/* ================================================================ */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center gap-3">
          {/* Time selector */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
            {TIME_WINDOWS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeWindow(key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  timeWindow === key
                    ? "bg-green-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Last updated */}
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {lastUpdated
              ? `Updated ${new Date(lastUpdated).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>

          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>

        {/* Scraper health badge */}
        <ScraperHealthBadge
          successRate={p?.scraper_success ?? null}
          statesLive={p?.states_live ?? 0}
          lastRunAt={p?.last_run_at ?? null}
          loading={loading}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          Failed to load metrics: {error}
        </div>
      )}

      {/* ================================================================ */}
      {/* ZONE 1 — Growth Signal                                           */}
      {/* ================================================================ */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Growth Signal
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Total Users"
            value={g?.total_users ?? null}
            sub="all time"
            loading={loading}
            noData={!loading && g?.total_users == null}
          />
          <MetricCard
            label="DAU"
            value={g?.dau ?? null}
            sub="today"
            loading={loading}
            noData={!loading && g?.dau == null}
          />
          <MetricCard
            label="MAU"
            value={g?.mau ?? null}
            sub="30-day actives"
            loading={loading}
            noData={!loading && g?.mau == null}
          />
          <MetricCard
            label="DAU / MAU"
            value={g?.dau_mau_ratio != null ? `${g.dau_mau_ratio}%` : null}
            sub="stickiness ratio"
            color={
              g?.dau_mau_ratio != null
                ? g.dau_mau_ratio >= 30
                  ? "green"
                  : g.dau_mau_ratio >= 20
                    ? "amber"
                    : "red"
                : undefined
            }
            loading={loading}
            noData={!loading && g?.dau_mau_ratio == null}
          />
          <MetricCard
            label="Save Rate"
            value={g?.save_rate != null ? `${g.save_rate}%` : null}
            sub="users who saved"
            color={
              g?.save_rate != null
                ? g.save_rate >= 12
                  ? "green"
                  : g.save_rate >= 5
                    ? "amber"
                    : "red"
                : undefined
            }
            loading={loading}
            noData={!loading && g?.save_rate == null}
          />
        </div>

        {/* Daily visitors sparkline */}
        <div className="mt-3">
          <SparklineChart
            data={g?.daily_visitors ?? []}
            loading={loading}
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* ZONE 2 — Retention & Stickiness                                  */}
      {/* ================================================================ */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
          Retention &amp; Stickiness
        </h2>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Panel A: Key Retention Numbers */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="7-Day Retention"
                value={r?.retention_7d != null ? `${r.retention_7d}%` : null}
                sub="return within 7d"
                color={
                  r?.retention_7d != null
                    ? r.retention_7d >= 25
                      ? "green"
                      : r.retention_7d >= 10
                        ? "amber"
                        : "red"
                    : undefined
                }
                loading={loading}
                noData={!loading && r?.retention_7d == null}
              />
              <MetricCard
                label="30-Day Retention"
                value={r?.retention_30d != null ? `${r.retention_30d}%` : null}
                sub="return within 30d"
                color={
                  r?.retention_30d != null
                    ? r.retention_30d >= 15
                      ? "green"
                      : r.retention_30d >= 5
                        ? "amber"
                        : "red"
                    : undefined
                }
                loading={loading}
                noData={!loading && r?.retention_30d == null}
              />
              <MetricCard
                label="Activation Rate"
                value={r?.activation_rate != null ? `${r.activation_rate}%` : null}
                sub="saved in 1st session"
                color="blue"
                loading={loading}
                noData={!loading && r?.activation_rate == null}
              />
              <MetricCard
                label="Return Rate"
                value={r?.return_rate != null ? `${r.return_rate}%` : null}
                sub="multi-day users"
                color="blue"
                loading={loading}
                noData={!loading && r?.return_rate == null}
              />
            </div>
          </div>

          {/* Panel B: Cohort Table */}
          <div className="lg:col-span-2">
            <CohortTable
              cohorts={data?.cohorts ?? []}
              loading={loading}
            />
          </div>
        </div>

        {/* Panel C: Engagement Depth */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Avg Events / Session"
            value={r?.avg_events_per_session ?? null}
            sub="per user-day"
            loading={loading}
            noData={!loading && r?.avg_events_per_session == null}
          />
          <MetricCard
            label="Avg Saves / Active User"
            value={r?.avg_saves_per_active_user ?? null}
            sub="among savers"
            loading={loading}
            noData={!loading && r?.avg_saves_per_active_user == null}
          />
          <MetricCard
            label="Bounce Rate"
            value={r?.bounce_rate != null ? `${r.bounce_rate}%` : null}
            sub="single-event users"
            color={
              r?.bounce_rate != null
                ? r.bounce_rate <= 30
                  ? "green"
                  : r.bounce_rate <= 60
                    ? "amber"
                    : "red"
                : undefined
            }
            trendDirection="up-bad"
            loading={loading}
            noData={!loading && r?.bounce_rate == null}
          />
          <MetricCard
            label="Session Duration"
            value={null}
            sub="coming soon"
            loading={false}
            noData={true}
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* ZONE 3 — Data Moat & Pipeline                                    */}
      {/* ================================================================ */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Data Moat &amp; Pipeline
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Deals in DB"
            value={p?.total_deals_active ?? null}
            sub="active today"
            loading={loading}
            noData={!loading && p?.total_deals_active == null}
          />
          <MetricCard
            label="Unique Products in DB"
            value={
              p?.total_products != null
                ? p.total_products.toLocaleString()
                : null
            }
            sub="active products"
            loading={loading}
            noData={!loading && p?.total_products == null}
          />
          <MetricCard
            label="States Live"
            value={p?.states_live ?? null}
            sub="scraped this week"
            loading={loading}
            noData={!loading && p?.states_live == null}
          />
          <MetricCard
            label="Scraper Success"
            value={p?.scraper_success != null ? `${p.scraper_success}%` : null}
            sub="last 15 runs"
            color={
              p?.scraper_success != null
                ? p.scraper_success >= 85
                  ? "green"
                  : p.scraper_success >= 60
                    ? "amber"
                    : "red"
                : undefined
            }
            loading={loading}
            noData={!loading && p?.scraper_success == null}
          />
        </div>

        {/* Path to 1M deals progress bar */}
        {p && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                Path to 1,000,000 Deals Pipeline
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {(p.deals_pipeline_total ?? 0).toLocaleString()} / 1,000,000
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                style={{
                  width: `${Math.min(((p.deals_pipeline_total ?? 0) / 1_000_000) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
              {(((p.deals_pipeline_total ?? 0) / 1_000_000) * 100).toFixed(2)}%
              complete
            </p>
          </div>
        )}

        {/* Coverage by State (condensed) */}
        {data?.coverage && data.coverage.length > 0 && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Coverage by State (7-Day)
              </h3>
              <button
                onClick={() => router.push("/admin/scraper")}
                className="text-[10px] font-medium text-green-600 hover:text-green-700 dark:text-green-400"
              >
                Full detail &rarr;
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">State</th>
                    <th className="px-4 py-2 text-right font-semibold">Sites OK</th>
                    <th className="px-4 py-2 text-right font-semibold">Products</th>
                    <th className="px-4 py-2 text-right font-semibold">7D Rate</th>
                    <th className="px-4 py-2 text-right font-semibold">Last Run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.coverage.map((cov: CoverageRow) => (
                    <tr key={cov.base_region} className="text-zinc-800 dark:text-zinc-200">
                      <td className="px-4 py-2 text-xs font-medium">
                        {REGION_LABELS[cov.base_region] ?? cov.base_region}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {cov.sites_ok}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {(cov.products ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                            cov.success_rate_7d >= 85
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              : cov.success_rate_7d >= 60
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          }`}
                        >
                          {cov.success_rate_7d}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
                        {cov.last_run
                          ? new Date(cov.last_run).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* ZONE 4 — Viral & Sharing Signal                                  */}
      {/* ================================================================ */}
      {v && v.total_shares > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Viral &amp; Sharing
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Total Shares"
              value={v.total_shares}
              sub="all time"
              loading={loading}
            />
            <MetricCard
              label="K-Factor"
              value={null}
              sub="target >0.3"
              noData={true}
            />
            <MetricCard
              label="Referral Signups"
              value={null}
              sub="from shares"
              noData={true}
            />
          </div>
        </section>
      ) : !loading ? (
        <section className="rounded-xl border border-dashed border-zinc-200 px-6 py-8 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No sharing data yet &mdash; sharing features launch in beta.
          </p>
        </section>
      ) : null}
    </div>
  );
}
