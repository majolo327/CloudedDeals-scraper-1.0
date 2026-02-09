'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsStats {
  uniqueUsers: number;
  totalEvents: number;
  savesToday: number;
  activeSessions: number;
  getDealClicks: number;
  engagementRate: number;
  avgSavesPerUser: number;
}

export interface StartupKPIs {
  // DAU/WAU/MAU
  dau: number;
  wau: number;
  mau: number;
  stickiness: number; // DAU/MAU ratio (0-100)

  // Activation & Retention
  activationRate: number; // % of visitors who take key action (save/get-deal)
  retentionRate: number; // % of users who visited 2+ different days
  returningUsers: number;
  newUsers: number;

  // Depth & Quality
  avgSessionDepth: number; // events per user
  powerUsers: number; // users with 10+ events
  powerUserPct: number;

  // Virality & Growth
  shareRate: number; // shares per 100 users
  onboardingCompletionRate: number; // % completed vs total started

  // Fundraising highlights
  totalSaves: number;
  totalShares: number;
  totalGetDealClicks: number;
  saveToClickRate: number; // % of savers who also clicked get-deal
}

export interface EventBreakdown {
  event_name: string;
  count: number;
}

export interface TopDeal {
  deal_id: string;
  save_count: number;
  product_name?: string;
  brand_name?: string;
}

export interface HourlyActivity {
  hour: number;
  count: number;
}

export interface DailyVisitors {
  date: string;
  visitors: number;
  events: number;
}

export interface FunnelStep {
  label: string;
  count: number;
  event: string;
}

export interface DeviceBreakdown {
  device_type: string;
  count: number;
}

export interface ReferrerSource {
  source: string;
  count: number;
}

export interface RetentionCohort {
  cohortDate: string;
  cohortSize: number;
  day1: number;
  day7: number;
  day30: number;
}

export interface AnalyticsData {
  stats: AnalyticsStats;
  kpis: StartupKPIs;
  eventBreakdown: EventBreakdown[];
  topDeals: TopDeal[];
  hourlyActivity: HourlyActivity[];
  recentEvents: EventRow[];
  dailyVisitors: DailyVisitors[];
  funnel: FunnelStep[];
  devices: DeviceBreakdown[];
  referrers: ReferrerSource[];
  allTimeUniqueVisitors: number;
  signalEvents: EventBreakdown[];
  retentionCohorts: RetentionCohort[];
}

export interface EventRow {
  id: string;
  anon_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

type DateRange = '24h' | '7d' | '30d' | 'all';

// Signal events we care about for conversion
const SIGNAL_EVENTS = [
  'deal_saved', 'deal_save', 'get_deal_click', 'deal_shared',
  'deal_modal_open', 'search', 'search_performed', 'filter_change',
  'category_filtered', 'referral_click', 'onboarding_completed',
  'zip_email_capture', 'zip_interest_logged',
] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY_KPIS: StartupKPIs = {
  dau: 0, wau: 0, mau: 0, stickiness: 0,
  activationRate: 0, retentionRate: 0, returningUsers: 0, newUsers: 0,
  avgSessionDepth: 0, powerUsers: 0, powerUserPct: 0,
  shareRate: 0, onboardingCompletionRate: 0,
  totalSaves: 0, totalShares: 0, totalGetDealClicks: 0, saveToClickRate: 0,
};

export function useAnalytics(range: DateRange = '24h') {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRangeStart = useCallback((): string => {
    const now = new Date();
    switch (range) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'all':
        return new Date(2024, 0, 1).toISOString();
    }
  }, [range]);

  const fetchAnalytics = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData({
        stats: { uniqueUsers: 0, totalEvents: 0, savesToday: 0, activeSessions: 0, getDealClicks: 0, engagementRate: 0, avgSavesPerUser: 0 },
        kpis: EMPTY_KPIS,
        eventBreakdown: [],
        topDeals: [],
        hourlyActivity: [],
        recentEvents: [],
        dailyVisitors: [],
        funnel: [],
        devices: [],
        referrers: [],
        allTimeUniqueVisitors: 0,
        signalEvents: [],
        retentionCohorts: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rangeStart = getRangeStart();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const now = new Date();
      const dauStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const wauStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const mauStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all data in parallel
      const [
        eventsRes,
        sessionsRes,
        savesTodayRes,
        recentEventsRes,
        topDealsRes,
        allTimeSessionsRes,
        // For DAU/WAU/MAU: fetch 30d of events regardless of current range
        mauEventsRes,
      ] = await Promise.all([
        // All events in range
        supabase
          .from('analytics_events')
          .select('anon_id, event_name, properties, created_at')
          .gte('created_at', rangeStart)
          .order('created_at', { ascending: true }),
        // Active sessions in range
        supabase
          .from('user_sessions')
          .select('user_id', { count: 'exact', head: true })
          .gte('last_seen', rangeStart),
        // Saves today
        supabase
          .from('user_saved_deals')
          .select('id', { count: 'exact', head: true })
          .gte('saved_at', todayStart.toISOString()),
        // Recent events for table
        supabase
          .from('analytics_events')
          .select('id, anon_id, event_name, properties, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        // Top deals by save count
        supabase
          .from('deal_save_counts')
          .select('deal_id, save_count')
          .order('save_count', { ascending: false })
          .limit(10),
        // All-time unique visitors
        supabase
          .from('user_sessions')
          .select('user_id', { count: 'exact', head: true }),
        // 30-day events for DAU/WAU/MAU computation
        supabase
          .from('analytics_events')
          .select('anon_id, event_name, created_at')
          .gte('created_at', mauStart)
          .order('created_at', { ascending: true }),
      ]);

      type EventRecord = { anon_id: string; event_name: string; properties: Record<string, unknown> | null; created_at: string };
      const events = (eventsRes.data ?? []) as EventRecord[];

      type LightEvent = { anon_id: string; event_name: string; created_at: string };
      const mauEvents = (mauEventsRes.data ?? []) as LightEvent[];

      // --- Unique users ---
      const uniqueUserSet = new Set(events.map((e) => e.anon_id));
      const uniqueUsers = uniqueUserSet.size;

      // --- Event breakdown ---
      const eventCounts: Record<string, number> = {};
      const hourlyCounts: Record<number, number> = {};
      const dailyMap: Record<string, { visitors: Set<string>; events: number }> = {};

      // Funnel counters (unique users per step)
      const funnelVisitors = new Set<string>();
      const funnelViewers = new Set<string>();
      const funnelSavers = new Set<string>();
      const funnelClickers = new Set<string>();
      const funnelSharers = new Set<string>();

      // Device & referrer counters
      const deviceCounts: Record<string, number> = {};
      const referrerCounts: Record<string, number> = {};
      const deviceSeen = new Set<string>();

      // Per-user event count for power user & session depth
      const userEventCounts: Record<string, number> = {};
      // Per-user day sets for retention
      const userDays: Record<string, Set<string>> = {};

      let getDealClicks = 0;
      let totalSaves = 0;
      let totalShares = 0;
      let onboardingCompleted = 0;
      let onboardingStarted = 0; // splash views + completed + skipped

      for (const event of events) {
        // Event counts
        eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;

        // Hourly
        const hour = new Date(event.created_at).getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;

        // Daily visitors
        const dateKey = event.created_at.slice(0, 10);
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { visitors: new Set(), events: 0 };
        }
        dailyMap[dateKey].visitors.add(event.anon_id);
        dailyMap[dateKey].events++;

        // Per-user metrics
        userEventCounts[event.anon_id] = (userEventCounts[event.anon_id] || 0) + 1;
        if (!userDays[event.anon_id]) userDays[event.anon_id] = new Set();
        userDays[event.anon_id].add(dateKey);

        // Funnel
        funnelVisitors.add(event.anon_id);
        if (['deal_view', 'deal_viewed', 'deal_modal_open', 'deal_click'].includes(event.event_name)) {
          funnelViewers.add(event.anon_id);
        }
        if (['deal_saved', 'deal_save'].includes(event.event_name)) {
          funnelSavers.add(event.anon_id);
          totalSaves++;
        }
        if (event.event_name === 'get_deal_click') {
          funnelClickers.add(event.anon_id);
          getDealClicks++;
        }
        if (event.event_name === 'deal_shared') {
          funnelSharers.add(event.anon_id);
          totalShares++;
        }
        if (event.event_name === 'onboarding_completed') onboardingCompleted++;
        if (['onboarding_completed', 'onboarding_skipped', 'onboarding_screen_viewed'].includes(event.event_name)) {
          const props = event.properties as Record<string, unknown> | null;
          if (event.event_name === 'onboarding_completed' || (props && props.screen === 'splash')) {
            onboardingStarted++;
          }
        }

        // Device type
        const props = event.properties;
        if (props && typeof props === 'object') {
          const deviceType = (props as Record<string, unknown>).device_type;
          if (deviceType && typeof deviceType === 'string') {
            const deviceKey = `${event.anon_id}:${deviceType}`;
            if (!deviceSeen.has(deviceKey)) {
              deviceSeen.add(deviceKey);
              deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
            }
          }

          // Referrer
          const referrer = (props as Record<string, unknown>).referrer;
          if (referrer && typeof referrer === 'string' && referrer.length > 0 && event.event_name === 'app_loaded') {
            try {
              const hostname = new URL(referrer).hostname || 'direct';
              referrerCounts[hostname] = (referrerCounts[hostname] || 0) + 1;
            } catch {
              referrerCounts['direct'] = (referrerCounts['direct'] || 0) + 1;
            }
          }
        }
      }

      // If no referrer data, add 'direct'
      if (Object.keys(referrerCounts).length === 0) {
        referrerCounts['direct'] = uniqueUsers;
      }

      const eventBreakdown: EventBreakdown[] = Object.entries(eventCounts)
        .map(([event_name, count]) => ({ event_name, count }))
        .sort((a, b) => b.count - a.count);

      // Signal events only
      const signalEvents: EventBreakdown[] = eventBreakdown.filter(
        (e) => (SIGNAL_EVENTS as readonly string[]).includes(e.event_name)
      );

      // Hourly activity (all 24 hours)
      const hourlyActivity: HourlyActivity[] = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourlyCounts[hour] || 0,
      }));

      // Daily visitors
      const dailyVisitors: DailyVisitors[] = Object.entries(dailyMap)
        .map(([date, d]) => ({ date, visitors: d.visitors.size, events: d.events }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Funnel — now 5 steps
      const funnel: FunnelStep[] = [
        { label: 'Visited', count: funnelVisitors.size, event: 'app_loaded' },
        { label: 'Viewed Deal', count: funnelViewers.size, event: 'deal_viewed' },
        { label: 'Saved Deal', count: funnelSavers.size, event: 'deal_saved' },
        { label: 'Clicked Get Deal', count: funnelClickers.size, event: 'get_deal_click' },
        { label: 'Shared', count: funnelSharers.size, event: 'deal_shared' },
      ];

      // Device breakdown
      const devices: DeviceBreakdown[] = Object.entries(deviceCounts)
        .map(([device_type, count]) => ({ device_type, count }))
        .sort((a, b) => b.count - a.count);

      // Referrer sources
      const referrers: ReferrerSource[] = Object.entries(referrerCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Engagement rate
      const engagedUsers = new Set<string>();
      for (const event of events) {
        if ((SIGNAL_EVENTS as readonly string[]).includes(event.event_name)) {
          engagedUsers.add(event.anon_id);
        }
      }
      const engagementRate = uniqueUsers > 0 ? Math.round((engagedUsers.size / uniqueUsers) * 100) : 0;
      const avgSavesPerUser = uniqueUsers > 0 ? Math.round((totalSaves / uniqueUsers) * 10) / 10 : 0;

      // -----------------------------------------------------------------------
      // Startup KPIs
      // -----------------------------------------------------------------------

      // DAU/WAU/MAU from 30-day events
      const dauUsers = new Set<string>();
      const wauUsers = new Set<string>();
      const mauUsers = new Set<string>();
      for (const e of mauEvents) {
        mauUsers.add(e.anon_id);
        if (e.created_at >= wauStart) wauUsers.add(e.anon_id);
        if (e.created_at >= dauStart) dauUsers.add(e.anon_id);
      }

      const dau = dauUsers.size;
      const wau = wauUsers.size;
      const mau = mauUsers.size;
      const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

      // Activation: users who saved or clicked get-deal / total visitors
      const activatedUsers = new Set<string>([...Array.from(funnelSavers), ...Array.from(funnelClickers)]);
      const activationRate = uniqueUsers > 0 ? Math.round((activatedUsers.size / uniqueUsers) * 100) : 0;

      // Retention: users who came on 2+ different days
      let returningUsers = 0;
      const totalUsersWithDays = Object.keys(userDays).length;
      for (const days of Object.values(userDays)) {
        if (days.size >= 2) returningUsers++;
      }
      const newUsers = totalUsersWithDays - returningUsers;
      const retentionRate = totalUsersWithDays > 0 ? Math.round((returningUsers / totalUsersWithDays) * 100) : 0;

      // Session depth
      const eventCountValues = Object.values(userEventCounts);
      const avgSessionDepth = eventCountValues.length > 0
        ? Math.round((eventCountValues.reduce((a, b) => a + b, 0) / eventCountValues.length) * 10) / 10
        : 0;

      // Power users (10+ events)
      const powerUsers = eventCountValues.filter((c) => c >= 10).length;
      const powerUserPct = uniqueUsers > 0 ? Math.round((powerUsers / uniqueUsers) * 100) : 0;

      // Share rate (per 100 users)
      const shareRate = uniqueUsers > 0 ? Math.round((totalShares / uniqueUsers) * 100) : 0;

      // Onboarding completion
      const onboardingCompletionRate = onboardingStarted > 0
        ? Math.round((onboardingCompleted / onboardingStarted) * 100)
        : 0;

      // Save-to-click: % of savers who also clicked get deal
      const saverWhoClicked = Array.from(funnelSavers).filter((u) => funnelClickers.has(u)).length;
      const saveToClickRate = funnelSavers.size > 0
        ? Math.round((saverWhoClicked / funnelSavers.size) * 100)
        : 0;

      // -----------------------------------------------------------------------
      // Retention Cohorts (weekly cohorts based on first-seen date)
      // -----------------------------------------------------------------------
      // Build first-seen date per user from the 30-day events
      const userFirstDay: Record<string, string> = {};
      const userAllDays: Record<string, Set<string>> = {};
      for (const e of mauEvents) {
        const day = e.created_at.slice(0, 10);
        if (!userFirstDay[e.anon_id] || day < userFirstDay[e.anon_id]) {
          userFirstDay[e.anon_id] = day;
        }
        if (!userAllDays[e.anon_id]) userAllDays[e.anon_id] = new Set();
        userAllDays[e.anon_id].add(day);
      }

      // Group users by first-seen week (Monday of their first day)
      const cohortMap: Record<string, { users: string[] }> = {};
      for (const [userId, firstDay] of Object.entries(userFirstDay)) {
        const d = new Date(firstDay);
        const dayOfWeek = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
        const cohortKey = monday.toISOString().slice(0, 10);
        if (!cohortMap[cohortKey]) cohortMap[cohortKey] = { users: [] };
        cohortMap[cohortKey].users.push(userId);
      }

      const retentionCohorts: RetentionCohort[] = Object.entries(cohortMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6) // last 6 weeks
        .map(([cohortDate, { users }]) => {
          const cohortFirstDate = new Date(cohortDate);
          let day1 = 0, day7 = 0, day30 = 0;
          for (const uid of users) {
            const days = userAllDays[uid];
            if (!days) continue;
            for (const d of Array.from(days)) {
              const diff = Math.floor((new Date(d).getTime() - cohortFirstDate.getTime()) / (24 * 60 * 60 * 1000));
              if (diff >= 1 && diff <= 2) day1++;
              if (diff >= 7 && diff <= 8) day7++;
              if (diff >= 28 && diff <= 31) day30++;
            }
          }
          return {
            cohortDate,
            cohortSize: users.length,
            day1: users.length > 0 ? Math.round((day1 / users.length) * 100) : 0,
            day7: users.length > 0 ? Math.round((day7 / users.length) * 100) : 0,
            day30: users.length > 0 ? Math.round((day30 / users.length) * 100) : 0,
          };
        });

      const kpis: StartupKPIs = {
        dau, wau, mau, stickiness,
        activationRate, retentionRate, returningUsers, newUsers,
        avgSessionDepth, powerUsers, powerUserPct,
        shareRate, onboardingCompletionRate,
        totalSaves, totalShares, totalGetDealClicks: getDealClicks,
        saveToClickRate,
      };

      // Enrich top deals with product info
      const topDealsRaw = (topDealsRes.data ?? []) as { deal_id: string; save_count: number }[];
      let topDeals: TopDeal[] = topDealsRaw;

      if (topDealsRaw.length > 0) {
        const dealIds = topDealsRaw.map((d) => d.deal_id);
        const { data: dealDetails } = await supabase
          .from('deals')
          .select('id, product_name, brand:brands(name)')
          .in('id', dealIds);

        if (dealDetails) {
          const detailMap = new Map(
            (dealDetails as unknown as { id: string; product_name: string; brand: { name: string }[] | null }[]).map(
              (d) => [d.id, d]
            )
          );
          topDeals = topDealsRaw.map((td) => {
            const detail = detailMap.get(td.deal_id);
            return {
              deal_id: td.deal_id,
              save_count: td.save_count,
              product_name: detail?.product_name,
              brand_name: detail?.brand?.[0]?.name,
            };
          });
        }
      }

      setData({
        stats: {
          uniqueUsers,
          totalEvents: events.length,
          savesToday: savesTodayRes.count ?? 0,
          activeSessions: sessionsRes.count ?? 0,
          getDealClicks,
          engagementRate,
          avgSavesPerUser,
        },
        kpis,
        eventBreakdown,
        topDeals,
        hourlyActivity,
        recentEvents: (recentEventsRes.data ?? []) as EventRow[],
        dailyVisitors,
        funnel,
        devices,
        referrers,
        allTimeUniqueVisitors: allTimeSessionsRes.count ?? 0,
        signalEvents,
        retentionCohorts,
      });
    } catch (err) {
      setError(String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getRangeStart]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refresh: fetchAnalytics };
}

// ---------------------------------------------------------------------------
// CSV Export Helper
// ---------------------------------------------------------------------------

export function exportEventsCSV(events: EventRow[]): void {
  const header = 'id,anon_id,event_name,properties,created_at';
  const rows = events.map((e) =>
    [
      e.id,
      e.anon_id,
      e.event_name,
      JSON.stringify(e.properties ?? {}).replace(/"/g, '""'),
      e.created_at,
    ]
      .map((v) => `"${v}"`)
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clouded-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
