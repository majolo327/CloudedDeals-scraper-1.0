'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAnalytics, exportEventsCSV } from '@/hooks/useAnalytics';
import type { FunnelStep, DeviceBreakdown, ReferrerSource, DailyVisitors } from '@/hooks/useAnalytics';

type DateRange = '24h' | '7d' | '30d' | 'all';

const VISITOR_GOAL = 1000;

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>('24h');
  const { data, loading, error, refresh } = useAnalytics(range);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refresh();
      setLastRefreshed(new Date());
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  const handleRefresh = useCallback(() => {
    refresh();
    setLastRefreshed(new Date());
  }, [refresh]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load analytics: {error}
        </p>
        <button
          onClick={handleRefresh}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const {
    stats, eventBreakdown, topDeals, hourlyActivity, recentEvents,
    dailyVisitors, funnel, devices, referrers, allTimeUniqueVisitors,
    signalEvents,
  } = data;

  const progressPct = Math.min((allTimeUniqueVisitors / VISITOR_GOAL) * 100, 100);
  const maxHourlyCount = Math.max(...hourlyActivity.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Header: Range selector + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            {(['24h', '7d', '30d', 'all'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {r === 'all' ? 'All Time' : r}
              </button>
            ))}
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {autoRefresh ? 'LIVE' : 'PAUSED'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Refresh
          </button>
          <button
            onClick={() => exportEventsCSV(recentEvents)}
            disabled={recentEvents.length === 0}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* 1K Visitor Progress */}
      <ProgressCard current={allTimeUniqueVisitors} goal={VISITOR_GOAL} pct={progressPct} />

      {/* KPI Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Unique Visitors" value={stats.uniqueUsers.toLocaleString()} sub={`of ${range}`} />
        <StatCard label="Active Sessions" value={stats.activeSessions.toLocaleString()} />
        <StatCard
          label="Saves Today"
          value={stats.savesToday.toLocaleString()}
          accent="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Get Deal Clicks"
          value={stats.getDealClicks.toLocaleString()}
          accent="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          label="Engagement Rate"
          value={`${stats.engagementRate}%`}
          accent={stats.engagementRate >= 30 ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}
          sub={`${stats.avgSavesPerUser} saves/user`}
        />
      </div>

      {/* Row: Funnel + Key Signals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelCard funnel={funnel} />
        <SignalCard signals={signalEvents} totalEvents={stats.totalEvents} />
      </div>

      {/* Daily Visitors Chart */}
      <DailyVisitorsChart data={dailyVisitors} />

      {/* Row: Hourly Activity + Top Deals */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hourly Activity Chart */}
        <Card title="Hourly Activity">
          <div className="flex items-end gap-1 h-40">
            {hourlyActivity.map((h) => {
              const heightPct = maxHourlyCount > 0 ? (h.count / maxHourlyCount) * 100 : 0;
              return (
                <div
                  key={h.hour}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${h.hour}:00 - ${h.count} events`}
                >
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t bg-green-500/50 hover:bg-green-500/70 transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(heightPct, 1)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-zinc-400">{h.hour}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Saved Deals */}
        <Card title="Top Saved Deals">
          {topDeals.length === 0 ? (
            <p className="text-sm text-zinc-400">No saved deals yet</p>
          ) : (
            <div className="space-y-2">
              {topDeals.map((deal, i) => (
                <div
                  key={deal.deal_id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <span className="w-5 text-center text-xs font-bold text-zinc-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                      {deal.product_name || deal.deal_id.slice(0, 8)}
                    </p>
                    {deal.brand_name && (
                      <p className="text-xs text-zinc-400 truncate">{deal.brand_name}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                    {deal.save_count} saves
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row: Devices + Referrers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DeviceCard devices={devices} />
        <ReferrerCard referrers={referrers} />
      </div>

      {/* Full Event Breakdown */}
      <Card title="All Events Breakdown">
        {eventBreakdown.length === 0 ? (
          <p className="text-sm text-zinc-400">No events recorded</p>
        ) : (
          <div className="space-y-2">
            {eventBreakdown.map((e) => {
              const pct = stats.totalEvents > 0 ? (e.count / stats.totalEvents) * 100 : 0;
              return (
                <div key={e.event_name} className="flex items-center gap-3">
                  <span className="w-40 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {e.event_name}
                  </span>
                  <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500/60"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-mono text-zinc-500">{e.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Events Table */}
      <Card title="Live Event Stream">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Properties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentEvents.slice(0, 50).map((event) => (
                <tr key={event.id} className="text-zinc-700 dark:text-zinc-300">
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {formatTimeAgo(event.created_at)}
                  </td>
                  <td className="px-4 py-2">
                    <EventBadge name={event.event_name} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-400">
                    {event.anon_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400 max-w-xs truncate">
                    {event.properties ? JSON.stringify(event.properties) : '-'}
                  </td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                    No events recorded yet. Browse your site to generate events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ProgressCard({ current, goal, pct }: { current: number; goal: number; pct: number }) {
  const milestones = [100, 250, 500, 750, 1000];
  const nextMilestone = milestones.find((m) => m > current) ?? goal;

  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:border-zinc-800 dark:from-green-950/30 dark:to-emerald-950/30">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Progress to {goal.toLocaleString()} Unique Visitors
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Next milestone: {nextMilestone.toLocaleString()} visitors
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {current.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500">/ {goal.toLocaleString()}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-4 rounded-full bg-white/60 dark:bg-zinc-800 overflow-hidden relative">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700 relative"
            style={{ width: `${Math.max(pct, 0.5)}%` }}
          >
            {pct >= 5 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                {pct.toFixed(1)}%
              </span>
            )}
          </div>
          {/* Milestone markers */}
          {milestones.slice(0, -1).map((m) => {
            const mPct = (m / goal) * 100;
            return (
              <div
                key={m}
                className="absolute top-0 h-full w-px bg-zinc-300 dark:bg-zinc-600"
                style={{ left: `${mPct}%` }}
                title={`${m} visitors`}
              />
            );
          })}
        </div>
        {/* Milestone labels */}
        <div className="flex justify-between mt-1">
          {milestones.map((m) => (
            <span
              key={m}
              className={`text-[9px] font-medium ${
                current >= m
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-zinc-400'
              }`}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: FunnelStep[] }) {
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);
  return (
    <Card title="Conversion Funnel (Unique Users)">
      {funnel.every((f) => f.count === 0) ? (
        <p className="text-sm text-zinc-400">No funnel data yet. Browse your site to generate events.</p>
      ) : (
        <div className="space-y-3">
          {funnel.map((step, i) => {
            const widthPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
            const convRate = i > 0 && funnel[0].count > 0
              ? Math.round((step.count / funnel[0].count) * 100)
              : 100;
            return (
              <div key={step.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {step.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {step.count}
                    </span>
                    {i > 0 && (
                      <span className={`text-[10px] font-medium ${
                        convRate >= 30 ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
                      }`}>
                        {convRate}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-6 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-500 ${
                      i === 0 ? 'bg-blue-500/50' :
                      i === 1 ? 'bg-purple-500/50' :
                      i === 2 ? 'bg-green-500/50' :
                      'bg-emerald-500/50'
                    }`}
                    style={{ width: `${Math.max(widthPct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SignalCard({ signals, totalEvents }: { signals: { event_name: string; count: number }[]; totalEvents: number }) {
  const LABELS: Record<string, string> = {
    deal_saved: 'Saves',
    deal_save: 'Saves (legacy)',
    get_deal_click: 'Get Deal Clicks',
    deal_shared: 'Shares',
    deal_modal_open: 'Deal Views',
    search: 'Searches',
    search_performed: 'Searches (legacy)',
    filter_change: 'Filter Changes',
    category_filtered: 'Category Filters',
    referral_click: 'Referral Clicks',
    onboarding_completed: 'Onboarding Done',
    zip_email_capture: 'Email Captures',
    zip_interest_logged: 'Zip Interest',
  };

  return (
    <Card title="Key Signal Interactions">
      {signals.length === 0 ? (
        <p className="text-sm text-zinc-400">No signal events yet</p>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => {
            const pct = totalEvents > 0 ? (s.count / totalEvents) * 100 : 0;
            return (
              <div key={s.event_name} className="flex items-center gap-3">
                <span className="w-36 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {LABELS[s.event_name] || s.event_name}
                </span>
                <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500/60"
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">
                  {s.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DailyVisitorsChart({ data }: { data: DailyVisitors[] }) {
  const maxVisitors = Math.max(...data.map((d) => d.visitors), 1);
  const cumulativeTotal = data.reduce((sum, d) => sum + d.visitors, 0);

  return (
    <Card title={`Daily Unique Visitors (${data.length} days, ${cumulativeTotal} total)`}>
      {data.length === 0 ? (
        <p className="text-sm text-zinc-400">No daily data yet</p>
      ) : (
        <div className="flex items-end gap-1 h-44">
          {data.map((d) => {
            const heightPct = maxVisitors > 0 ? (d.visitors / maxVisitors) * 100 : 0;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
                title={`${d.date}: ${d.visitors} visitors, ${d.events} events`}
              >
                <span className="text-[8px] font-mono text-zinc-400">{d.visitors}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t bg-blue-500/50 hover:bg-blue-500/70 transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className="text-[7px] text-zinc-400 truncate w-full text-center">
                  {d.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DeviceCard({ devices }: { devices: DeviceBreakdown[] }) {
  const total = devices.reduce((sum, d) => sum + d.count, 0);
  const ICONS: Record<string, string> = {
    mobile: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm5 18h.01',
    tablet: 'M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 18h.01',
    desktop: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm5 14h8',
  };

  return (
    <Card title="Devices">
      {devices.length === 0 ? (
        <p className="text-sm text-zinc-400">No device data yet (appears after page_view events)</p>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
            return (
              <div key={d.device_type} className="flex items-center gap-3">
                <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[d.device_type] || ICONS.desktop} />
                </svg>
                <span className="w-16 text-xs font-medium text-zinc-600 dark:text-zinc-400 capitalize">
                  {d.device_type}
                </span>
                <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/50"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-500">{pct}%</span>
                <span className="w-8 text-right text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">{d.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ReferrerCard({ referrers }: { referrers: ReferrerSource[] }) {
  return (
    <Card title="Traffic Sources">
      {referrers.length === 0 ? (
        <p className="text-sm text-zinc-400">No referrer data yet</p>
      ) : (
        <div className="space-y-2">
          {referrers.map((r, i) => (
            <div key={r.source} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <span className="w-5 text-center text-xs font-bold text-zinc-400">{i + 1}</span>
              <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {r.source}
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                {r.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EventBadge({ name }: { name: string }) {
  const COLORS: Record<string, string> = {
    app_loaded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    page_view: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
    deal_saved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    deal_save: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    get_deal_click: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    deal_modal_open: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
    deal_shared: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400',
    search: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      COLORS[name] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
    }`}>
      {name}
    </span>
  );
}

function formatTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoDate).toLocaleDateString();
}
