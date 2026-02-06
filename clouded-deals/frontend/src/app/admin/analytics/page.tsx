'use client';

import { useState } from 'react';
import { useAnalytics, exportEventsCSV } from '@/hooks/useAnalytics';

type DateRange = '24h' | '7d' | '30d';

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>('24h');
  const { data, loading, error, refresh } = useAnalytics(range);

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

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load analytics: {error}
        </p>
        <button
          onClick={refresh}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats, eventBreakdown, topDeals, hourlyActivity, recentEvents } = data;

  // Compute max for hourly chart scaling
  const maxHourlyCount = Math.max(...hourlyActivity.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Range selector + actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {(['24h', '7d', '30d'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
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

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unique Users" value={stats.uniqueUsers.toLocaleString()} />
        <StatCard label="Total Events" value={stats.totalEvents.toLocaleString()} />
        <StatCard
          label="Saves Today"
          value={stats.savesToday.toLocaleString()}
          accent="text-green-600 dark:text-green-400"
        />
        <StatCard label="Active Sessions" value={stats.activeSessions.toLocaleString()} />
      </div>

      {/* Two-column: Event Breakdown + Top Deals */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Event Breakdown */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Event Breakdown
            </h3>
          </div>
          <div className="p-4">
            {eventBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-400">No events recorded</p>
            ) : (
              <div className="space-y-2">
                {eventBreakdown.map((e) => {
                  const pct = stats.totalEvents > 0 ? (e.count / stats.totalEvents) * 100 : 0;
                  return (
                    <div key={e.event_name} className="flex items-center gap-3">
                      <span className="w-32 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {e.event_name}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500/60"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-mono text-zinc-500">
                        {e.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top Saved Deals */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Top Saved Deals
            </h3>
          </div>
          <div className="p-4">
            {topDeals.length === 0 ? (
              <p className="text-sm text-zinc-400">No saved deals yet</p>
            ) : (
              <div className="space-y-2">
                {topDeals.map((deal, i) => (
                  <div
                    key={deal.deal_id}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="w-5 text-center text-xs font-bold text-zinc-400">
                      {i + 1}
                    </span>
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
          </div>
        </div>
      </div>

      {/* Hourly Activity Chart */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Hourly Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-1 h-40">
            {hourlyActivity.map((h) => {
              const heightPct = maxHourlyCount > 0 ? (h.count / maxHourlyCount) * 100 : 0;
              return (
                <div
                  key={h.hour}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${h.hour}:00 — ${h.count} events`}
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
        </div>
      </div>

      {/* Recent Events Table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Recent Events (last 100)
          </h3>
        </div>
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
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {event.event_name}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-400">
                    {event.anon_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400 max-w-xs truncate">
                    {event.properties ? JSON.stringify(event.properties) : '—'}
                  </td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                    No events recorded yet.
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
        className={`mt-1 text-2xl font-bold ${accent ?? 'text-zinc-900 dark:text-zinc-100'}`}
      >
        {value}
      </p>
    </div>
  );
}
