'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAnalytics, exportEventsCSV } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import type { FunnelStep, DeviceBreakdown, ReferrerSource, DailyVisitors, RetentionCohort, ViralMetrics, GrowthMetrics, DispensaryMetric } from '@/hooks/useAnalytics';

interface ContactRow {
  id: string;
  anon_id: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  saved_deals_count: number | null;
  zip_entered: string | null;
  created_at: string;
}

type DateRange = '24h' | '7d' | '30d' | 'all';

const VISITOR_GOAL = 1000;

// Human-readable event name labels
const EVENT_LABELS: Record<string, string> = {
  deal_saved: 'Saves',
  deal_save: 'Saves (legacy)',
  get_deal_click: 'Deal Clicks',
  deal_modal_open: 'Deal Views',
  deal_view: 'Deal Views (legacy)',
  deal_viewed: 'Deal Views (alt)',
  deal_click: 'Deal Clicks (legacy)',
  deal_shared: 'Shares',
  deal_dismissed: 'Dismissals',
  search: 'Searches',
  search_performed: 'Searches (legacy)',
  filter_change: 'Filter Changes',
  category_filtered: 'Category Filters',
  app_loaded: 'Page Loads',
  page_view: 'Page Views',
  session_heartbeat: 'Heartbeats',
  daily_visit: 'Daily Visits',
  referral_click: 'Referral Clicks',
  referral_conversion: 'Referral Conversions',
  share_saves: 'Share Saves List',
  shared_page_view: 'Shared Page Views',
  shared_get_deal_click: 'Shared Deal Clicks',
  shared_page_cta: 'Shared Page CTAs',
  user_feedback: 'User Feedback',
  onboarding_completed: 'Onboarding Done',
  onboarding_skipped: 'Onboarding Skipped',
  onboarding_screen_viewed: 'Onboarding Views',
  onboarding_email_captured: 'Email Captures',
  zip_email_capture: 'Zip Emails',
  zip_interest_logged: 'Zip Interest',
  challenge_completed: 'Challenges',
  error: 'Errors',
  slow_load: 'Slow Loads',
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>('7d');
  const { data, loading, error, refresh } = useAnalytics(range);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [showOps, setShowOps] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);

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

  // Lazy-load contacts when section is opened
  useEffect(() => {
    if (!showContacts || contactsLoaded) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_contacts')
          .select('*')
          .order('created_at', { ascending: false });
        setContacts((data || []) as ContactRow[]);
      } catch {
        // ignore
      }
      setContactsLoaded(true);
    })();
  }, [showContacts, contactsLoaded]);

  const handleExportContacts = () => {
    if (!contacts.length) return;
    const headers = ['phone', 'email', 'source', 'saved_deals_count', 'zip_entered', 'created_at'];
    const rows = contacts.map(c =>
      headers.map(h => { const v = c[h as keyof ContactRow]; return v != null ? String(v) : ''; })
    );
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clouded-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load analytics: {error}</p>
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
    scoreboard, funnel, eventBreakdown, topDeals, hourlyActivity, recentEvents,
    dailyVisitors, devices, referrers, allTimeUniqueVisitors, retentionCohorts,
    totalEventsInRange, viral, growth, dispensaryMetrics,
  } = data;

  const progressPct = Math.min((allTimeUniqueVisitors / VISITOR_GOAL) * 100, 100);

  return (
    <div className="space-y-8">
      {/* ================================================================ */}
      {/* HEADER: Range selector + Live + Actions                          */}
      {/* ================================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
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

      {/* ================================================================ */}
      {/* SECTION 1: THE SCOREBOARD                                        */}
      {/* ================================================================ */}
      <section>
        <SectionHeading>Morning Scoreboard</SectionHeading>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <ScoreboardCard label="Visitors Today" value={scoreboard.visitorsToday} />
          <ScoreboardCard label="Saves Today" value={scoreboard.savesToday} />
          <ScoreboardCard label="Deal Clicks Today" value={scoreboard.dealClicksToday} />
          <ScoreboardCard label="Shares Today" value={viral.sharesToday} />
          <ScoreboardCard
            label="Return Rate"
            value={`${scoreboard.returnRate}%`}
            sub="7-day"
            indicator={trafficLight(scoreboard.returnRate, 20, 10)}
          />
          <ScoreboardCard
            label="Save Rate"
            value={`${scoreboard.saveRate}%`}
            sub="saves / visitors"
            indicator={trafficLight(scoreboard.saveRate, 15, 5)}
          />
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 2: GROWTH & ENGAGEMENT                                   */}
      {/* ================================================================ */}
      <section className="space-y-6">
        <SectionHeading>Growth &amp; Engagement</SectionHeading>
        <GrowthCard growth={growth} />
      </section>

      {/* ================================================================ */}
      {/* SECTION 3: THE PMF STORY                                         */}
      {/* ================================================================ */}
      <section className="space-y-6">
        <SectionHeading>The PMF Story</SectionHeading>

        {/* Progress to 1,000 */}
        <ProgressCard current={allTimeUniqueVisitors} goal={VISITOR_GOAL} pct={progressPct} />

        {/* Funnel + Top Actions side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <FunnelCard funnel={funnel} />
          <TopActionsCard events={eventBreakdown} />
        </div>

        {/* Daily Unique Visitors */}
        <DailyVisitorsChart data={dailyVisitors} />

        {/* Retention Cohorts */}
        <RetentionCohortsCard cohorts={retentionCohorts} />

        {/* Top Deals + Device/Traffic */}
        <div className="grid gap-6 lg:grid-cols-2">
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
                        {deal.product_name || `Unknown (${deal.deal_id.slice(0, 8)})`}
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
          <div className="space-y-6">
            <DeviceCard devices={devices} />
            <ReferrerCard referrers={referrers} />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 4: VIRAL & SHARING                                       */}
      {/* ================================================================ */}
      <section className="space-y-6">
        <SectionHeading>Viral &amp; Sharing</SectionHeading>
        <ViralCard viral={viral} range={range} />
      </section>

      {/* ================================================================ */}
      {/* SECTION 5: B2B READINESS                                         */}
      {/* ================================================================ */}
      <section className="space-y-6">
        <SectionHeading>B2B Readiness</SectionHeading>
        <DispensaryCard dispensaries={dispensaryMetrics} range={range} />
      </section>

      {/* ================================================================ */}
      {/* SECTION 6: OPERATIONAL (collapsible)                             */}
      {/* ================================================================ */}
      <section>
        <button
          onClick={() => setShowOps(!showOps)}
          className="w-full flex items-center justify-between rounded-xl border border-zinc-300 bg-white px-5 py-3 dark:border-zinc-700 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Operational
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {showOps ? '\u25B2' : '\u25BC'}
          </span>
        </button>

        {showOps && (
          <div className="mt-4 space-y-6">
            {/* Hourly Activity */}
            <Card title="Hourly Activity">
              <HourlyChart hours={hourlyActivity} />
            </Card>

            {/* All Events Breakdown */}
            <Card title={`All Events (${totalEventsInRange.toLocaleString()} total in ${range})`}>
              {eventBreakdown.length === 0 ? (
                <p className="text-sm text-zinc-400">No events recorded</p>
              ) : (
                <div className="space-y-2">
                  {eventBreakdown.map((e) => {
                    const pct = totalEventsInRange > 0 ? (e.count / totalEventsInRange) * 100 : 0;
                    return (
                      <div key={e.event_name} className="flex items-center gap-3">
                        <span className="w-40 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {EVENT_LABELS[e.event_name] || e.event_name}
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

            {/* Live Event Stream */}
            <Card title="Live Event Stream">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Time</th>
                      <th className="px-4 py-2 font-semibold">Event</th>
                      <th className="px-4 py-2 font-semibold">User</th>
                      <th className="px-4 py-2 font-semibold">Properties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recentEvents.slice(0, 50).map((event) => (
                      <tr key={event.id} className="text-zinc-800 dark:text-zinc-200">
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          {formatTimeAgo(event.created_at)}
                        </td>
                        <td className="px-4 py-2">
                          <EventBadge name={event.event_name} />
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {event.anon_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                          {event.properties ? JSON.stringify(event.properties) : '-'}
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
            </Card>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* SECTION 5: CONTACTS & WAITLIST (collapsible)                    */}
      {/* ================================================================ */}
      <section>
        <button
          onClick={() => setShowContacts(!showContacts)}
          className="w-full flex items-center justify-between rounded-xl border border-zinc-300 bg-white px-5 py-3 dark:border-zinc-700 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Contacts &amp; Waitlist
            </span>
            {contactsLoaded && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                {contacts.length}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {showContacts ? '\u25B2' : '\u25BC'}
          </span>
        </button>

        {showContacts && (
          <div className="mt-4 space-y-6">
            {!contactsLoaded ? (
              <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            ) : (
              <>
                {/* Stats row */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <ContactStatCard label="Total Contacts" value={contacts.length} />
                  <ContactStatCard label="Phone Numbers" value={contacts.filter(c => c.phone).length} />
                  <ContactStatCard label="Emails" value={contacts.filter(c => c.email).length} />
                  <ContactStatCard label="From Saved Deals" value={contacts.filter(c => c.source === 'saved_deals_banner').length} />
                </div>

                {/* Table */}
                <Card title={`Recent Contacts (${contacts.length})`}>
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={handleExportContacts}
                      disabled={!contacts.length}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-zinc-200 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Phone</th>
                          <th className="px-4 py-2 font-semibold">Email</th>
                          <th className="px-4 py-2 font-semibold">Source</th>
                          <th className="px-4 py-2 font-semibold">Saves</th>
                          <th className="px-4 py-2 font-semibold">Zip</th>
                          <th className="px-4 py-2 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {contacts.slice(0, 50).map((c) => (
                          <tr key={c.id} className="text-zinc-700 dark:text-zinc-300">
                            <td className="px-4 py-2 text-xs font-mono">{c.phone || '-'}</td>
                            <td className="px-4 py-2 text-xs">{c.email || '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.source === 'saved_deals_banner'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                              }`}>
                                {c.source === 'saved_deals_banner' ? 'Saved Deals' : c.source === 'out_of_market' ? 'Out of Market' : c.source}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-zinc-400">{c.saved_deals_count ?? '-'}</td>
                            <td className="px-4 py-2 text-xs text-zinc-400">{c.zip_entered || '-'}</td>
                            <td className="px-4 py-2 text-xs text-zinc-400 whitespace-nowrap">
                              {new Date(c.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                        {contacts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                              No contacts captured yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trafficLight(value: number, greenThreshold: number, yellowThreshold: number) {
  if (value >= greenThreshold) return 'green' as const;
  if (value >= yellowThreshold) return 'yellow' as const;
  return 'red' as const;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ScoreboardCard({
  label, value, sub, indicator,
}: {
  label: string;
  value: string | number;
  sub?: string;
  indicator?: 'green' | 'yellow' | 'red';
}) {
  const indicatorColors = {
    green: 'bg-green-500',
    yellow: 'bg-amber-400',
    red: 'bg-red-500',
  };

  return (
    <div className="rounded-xl border border-zinc-300 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <p className="text-3xl font-bold text-zinc-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {indicator && (
          <span className={`inline-block h-3 w-3 rounded-full ${indicatorColors[indicator]}`} />
        )}
      </div>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressCard({ current, goal, pct }: { current: number; goal: number; pct: number }) {
  const milestones = [100, 250, 500, 750, 1000];
  const nextMilestone = milestones.find((m) => m > current) ?? goal;

  return (
    <div className="rounded-xl border border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950/50 dark:to-emerald-950/50">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Progress to {goal.toLocaleString()} Unique Visitors
            </h3>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">
              Next milestone: {nextMilestone.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {current.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500">/ {goal.toLocaleString()}</p>
          </div>
        </div>
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
          {milestones.slice(0, -1).map((m) => (
            <div
              key={m}
              className="absolute top-0 h-full w-px bg-zinc-300 dark:bg-zinc-600"
              style={{ left: `${(m / goal) * 100}%` }}
              title={`${m} visitors`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {milestones.map((m) => (
            <span
              key={m}
              className={`text-[9px] font-medium ${
                current >= m ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
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

function FunnelCard({ funnel }: { funnel: FunnelStep[] }) {
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);
  const stepColors = ['bg-blue-500/50', 'bg-purple-500/50', 'bg-green-500/50', 'bg-emerald-500/50'];
  const stepSubs = ['', 'viewed a deal', 'saved or clicked', '3+ days'];

  return (
    <Card title="Conversion Funnel">
      {funnel.every((f) => f.count === 0) ? (
        <p className="text-sm text-zinc-400">No funnel data yet.</p>
      ) : (
        <div className="space-y-1">
          {funnel.map((step, i) => {
            const widthPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
            // Step-to-step conversion (prev step → this step)
            const convRate = i > 0 && funnel[i - 1].count > 0
              ? Math.round((step.count / funnel[i - 1].count) * 100)
              : null;

            return (
              <div key={step.label}>
                {/* Conversion arrow between steps */}
                {convRate !== null && (
                  <div className="flex justify-center py-0.5">
                    <span className={`text-[10px] font-bold ${
                      convRate >= 30 ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
                    }`}>
                      &#x2193; {convRate}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {step.label}
                    </span>
                    {stepSubs[i] && (
                      <span className="text-[9px] text-zinc-400">({stepSubs[i]})</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {step.count}
                  </span>
                </div>
                <div className="h-6 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-500 ${stepColors[i] || 'bg-zinc-500/50'}`}
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

function TopActionsCard({ events }: { events: { event_name: string; count: number }[] }) {
  const maxCount = Math.max(...events.map((e) => e.count), 1);

  return (
    <Card title="Top Actions">
      {events.length === 0 ? (
        <p className="text-sm text-zinc-400">No actions yet</p>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const pct = maxCount > 0 ? (e.count / maxCount) * 100 : 0;
            return (
              <div key={e.event_name} className="flex items-center gap-3">
                <span className="w-32 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {EVENT_LABELS[e.event_name] || e.event_name}
                </span>
                <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500/60"
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">
                  {e.count}
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
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card title={`Daily Unique Visitors (${data.length} days, ${cumulativeTotal} total)`}>
      {data.length === 0 ? (
        <p className="text-sm text-zinc-400">No daily data yet</p>
      ) : (
        <div className="flex items-end gap-1 h-44">
          {data.map((d) => {
            const heightPct = maxVisitors > 0 ? (d.visitors / maxVisitors) * 100 : 0;
            const isToday = d.date === todayStr;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
                title={`${d.date}: ${d.visitors} visitors, ${d.events} events`}
              >
                <span className="text-[8px] font-mono text-zinc-400">{d.visitors}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t transition-colors min-h-[2px] ${
                      isToday
                        ? 'bg-purple-500/70 hover:bg-purple-500/90'
                        : 'bg-blue-500/50 hover:bg-blue-500/70'
                    }`}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className={`text-[7px] truncate w-full text-center ${
                  isToday ? 'text-purple-500 font-bold' : 'text-zinc-400'
                }`}>
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

function RetentionCohortsCard({ cohorts }: { cohorts: RetentionCohort[] }) {
  const cellColor = (pct: number) => {
    if (pct >= 30) return 'bg-green-500/30 text-green-700 dark:text-green-400';
    if (pct >= 15) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
    if (pct > 0) return 'bg-red-500/15 text-red-600 dark:text-red-400';
    return 'bg-zinc-50 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-600';
  };

  return (
    <Card title="Weekly Retention Cohorts">
      {cohorts.length === 0 ? (
        <p className="text-sm text-zinc-400">Need more data for cohort analysis (at least 2 weeks)</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Cohort Week</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">Users</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">Day 1</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">Day 3</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">Day 7</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">Day 14</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cohorts.map((c) => (
                <tr key={c.cohortDate}>
                  <td className="px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    {c.cohortDate}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {c.cohortSize}
                  </td>
                  {[c.day1, c.day3, c.day7, c.day14].map((pct, i) => (
                    <td key={i} className="px-3 py-2 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${cellColor(pct)}`}>
                        {pct}%
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DeviceCard({ devices }: { devices: DeviceBreakdown[] }) {
  const total = devices.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card title="Devices">
      {devices.length === 0 ? (
        <p className="text-sm text-zinc-400">No device data yet</p>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
            return (
              <div key={d.device_type} className="flex items-center gap-3">
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

function HourlyChart({ hours }: { hours: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...hours.map((h) => h.count), 1);

  return (
    <div className="flex items-end gap-1 h-40">
      {hours.map((h) => {
        const heightPct = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
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
    share_saves: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400',
    shared_page_view: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
    referral_click: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    referral_conversion: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    search: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      COLORS[name] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
    }`}>
      {EVENT_LABELS[name] || name}
    </span>
  );
}

function GrowthCard({ growth }: { growth: GrowthMetrics }) {
  const wowArrow = (pct: number) => {
    if (pct > 0) return { arrow: '\u2191', color: 'text-green-600 dark:text-green-400' };
    if (pct < 0) return { arrow: '\u2193', color: 'text-red-500 dark:text-red-400' };
    return { arrow: '\u2192', color: 'text-zinc-400' };
  };

  const wowItems: { label: string; value: number }[] = [
    { label: 'Visitors', value: growth.visitorsWoW },
    { label: 'Saves', value: growth.savesWoW },
    { label: 'Clicks', value: growth.clicksWoW },
    { label: 'Shares', value: growth.sharesWoW },
  ];

  const stickinessColor = growth.stickiness >= 20
    ? 'text-green-600 dark:text-green-400'
    : growth.stickiness >= 10
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-500 dark:text-red-400';

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* WoW Growth */}
      <Card title="Week-over-Week Growth">
        <div className="space-y-3">
          {wowItems.map(({ label, value }) => {
            const { arrow, color } = wowArrow(value);
            return (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
                <span className={`text-sm font-bold ${color}`}>
                  {arrow} {value > 0 ? '+' : ''}{value}%
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* WAU / MAU / Stickiness */}
      <Card title="Active Users">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">WAU (7d)</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{growth.wau.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">MAU (30d)</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{growth.mau.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">DAU/MAU Stickiness</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-bold ${stickinessColor}`}>{growth.stickiness}%</p>
              <span className="text-[10px] text-zinc-400">target: &ge;20%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Engagement Depth */}
      <Card title="Engagement">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Activation Rate</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{growth.activationRate}%</p>
              <span className="text-[10px] text-zinc-400">visitors who saved or clicked</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500/60 transition-all"
                style={{ width: `${Math.min(growth.activationRate, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Events per User</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{growth.eventsPerUser}</p>
            <p className="text-[10px] text-zinc-400">avg actions per visitor in range</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DispensaryCard({ dispensaries, range }: { dispensaries: DispensaryMetric[]; range: string }) {
  const maxClicks = Math.max(...dispensaries.map(d => d.clicks), 1);

  return (
    <Card title={`Dispensary Outbound Clicks (${range}) — B2B Sales Data`}>
      {dispensaries.length === 0 ? (
        <p className="text-sm text-zinc-400">No dispensary click data yet. Outbound &quot;Get Deal&quot; clicks will appear here by dispensary.</p>
      ) : (
        <div className="space-y-2">
          {dispensaries.map((d, i) => {
            const pct = maxClicks > 0 ? (d.clicks / maxClicks) * 100 : 0;
            return (
              <div key={d.dispensary} className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-bold text-zinc-400">{i + 1}</span>
                <span className="w-36 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {d.dispensary}
                </span>
                <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500/50"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="w-14 text-right text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">
                  {d.clicks} clicks
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ViralCard({ viral, range }: { viral: ViralMetrics; range: string }) {
  const kColor = viral.viralCoefficient >= 0.3
    ? 'text-green-600 dark:text-green-400'
    : viral.viralCoefficient >= 0.1
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-500 dark:text-red-400';

  const kIndicator = trafficLight(viral.viralCoefficient * 100, 30, 10);

  // Share funnel steps
  const funnelSteps = [
    { label: 'Shares', count: viral.sharesInRange, sub: 'deal_shared + share_saves' },
    { label: 'Link Views', count: viral.sharedPageViews, sub: 'shared page opens' },
    { label: 'Referral Clicks', count: viral.referralClicks, sub: 'clicked through to app' },
    { label: 'Conversions', count: viral.referralConversions, sub: 'referred user saved a deal' },
  ];
  const maxFunnel = Math.max(...funnelSteps.map(s => s.count), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* K-Factor headline card */}
      <div className="rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Viral Coefficient (K-Factor)</h3>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${kColor}`}>
                {viral.viralCoefficient.toFixed(2)}
              </span>
              <span className={`inline-block h-3 w-3 rounded-full ${
                kIndicator === 'green' ? 'bg-green-500' : kIndicator === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
              }`} />
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              <p>Target: <span className="font-bold text-zinc-800 dark:text-zinc-200">&ge; 0.3</span></p>
              <p className="mt-0.5">Viral at: <span className="font-bold text-zinc-800 dark:text-zinc-200">&ge; 1.0</span></p>
              <p className="mt-0.5 text-[11px]">{range} window</p>
            </div>
          </div>

          {/* Breakdown metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Shares</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">{viral.sharesInRange}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{viral.sharesToday} today</p>
            </div>
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Link Views</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">{viral.sharedPageViews}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{viral.shareViewRate}% view rate</p>
            </div>
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Ref. Clicks</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">{viral.referralClicks}</p>
            </div>
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Conversions</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">{viral.referralConversions}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{viral.clickToConversionRate}% click→save</p>
            </div>
          </div>
        </div>
      </div>

      {/* Share funnel */}
      <Card title="Share Funnel">
        {funnelSteps.every(s => s.count === 0) ? (
          <p className="text-sm text-zinc-400">No share data yet in this range.</p>
        ) : (
          <div className="space-y-1">
            {funnelSteps.map((step, i) => {
              const widthPct = maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0;
              const convRate = i > 0 && funnelSteps[i - 1].count > 0
                ? Math.round((step.count / funnelSteps[i - 1].count) * 100)
                : null;
              const funnelColors = ['bg-pink-500/50', 'bg-rose-500/50', 'bg-orange-500/50', 'bg-emerald-500/50'];

              return (
                <div key={step.label}>
                  {convRate !== null && (
                    <div className="flex justify-center py-0.5">
                      <span className={`text-[10px] font-bold ${
                        convRate >= 30 ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
                      }`}>
                        &#x2193; {convRate}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {step.label}
                      </span>
                      <span className="text-[9px] text-zinc-400">({step.sub})</span>
                    </div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {step.count}
                    </span>
                  </div>
                  <div className="h-6 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-500 ${funnelColors[i]}`}
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Top Referrers Leaderboard — spans full width in the 2-col grid */}
      {viral.topReferrers.length > 0 && (
        <div className="lg:col-span-2">
        <Card title="Top Referrers (who drives your growth?)">
          <div className="space-y-2">
            {viral.topReferrers.map((r, i) => (
              <div key={r.anonId} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span className="w-5 text-center text-xs font-bold text-zinc-400">{i + 1}</span>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{r.anonId.slice(0, 8)}</span>
                <div className="flex-1" />
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  {r.conversions} conversions
                </span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                  {r.clicks} clicks
                </span>
              </div>
            ))}
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}

function ContactStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
        {value.toLocaleString()}
      </p>
    </div>
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
