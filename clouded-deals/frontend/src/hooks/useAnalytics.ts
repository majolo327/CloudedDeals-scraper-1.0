'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreboardData {
  visitorsToday: number;
  savesToday: number;
  dealClicksToday: number;
  returnRate: number;   // 7-day return rate (%)
  saveRate: number;     // saves / visitors today (%)
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
  day3: number;
  day7: number;
  day14: number;
}

export interface ViralMetrics {
  sharesToday: number;
  sharesInRange: number;
  sharedPageViews: number;
  referralClicks: number;
  referralConversions: number;
  /** K-factor = (avg invites per user) * (conversion rate of invites) */
  viralCoefficient: number;
  /** Shares that resulted in at least one page view */
  shareViewRate: number;
  /** Referral clicks that converted to a save action */
  clickToConversionRate: number;
  /** Users ranked by conversions they drove */
  topReferrers: TopReferrer[];
}

export interface TopReferrer {
  anonId: string;
  conversions: number;
  clicks: number;
}

export interface GrowthMetrics {
  /** WoW change in unique visitors (%) */
  visitorsWoW: number;
  /** WoW change in saves (%) */
  savesWoW: number;
  /** WoW change in deal clicks (%) */
  clicksWoW: number;
  /** WoW change in shares (%) */
  sharesWoW: number;
  /** Weekly Active Users (distinct users with events in last 7d) */
  wau: number;
  /** Monthly Active Users (distinct users with events in last 30d) */
  mau: number;
  /** DAU/MAU stickiness ratio (%) — investors' favorite metric */
  stickiness: number;
  /** Activation rate: % of visitors who saved or clicked (%) */
  activationRate: number;
  /** Avg events per user in range (engagement depth) */
  eventsPerUser: number;
}

export interface DispensaryMetric {
  dispensary: string;
  clicks: number;
  saves: number;
}

export interface AcquisitionChannel {
  source: string;
  visitors: number;
  saves: number;
  clicks: number;
}

export interface AnalyticsData {
  scoreboard: ScoreboardData;
  funnel: FunnelStep[];
  eventBreakdown: EventBreakdown[];
  topDeals: TopDeal[];
  hourlyActivity: HourlyActivity[];
  recentEvents: EventRow[];
  dailyVisitors: DailyVisitors[];
  devices: DeviceBreakdown[];
  referrers: ReferrerSource[];
  allTimeUniqueVisitors: number;
  retentionCohorts: RetentionCohort[];
  totalEventsInRange: number;
  viral: ViralMetrics;
  growth: GrowthMetrics;
  dispensaryMetrics: DispensaryMetric[];
  acquisitionChannels: AcquisitionChannel[];
}

export interface EventRow {
  id: string;
  anon_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

type DateRange = '24h' | '7d' | '30d' | 'all';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY_SCOREBOARD: ScoreboardData = {
  visitorsToday: 0, savesToday: 0, dealClicksToday: 0, returnRate: 0, saveRate: 0,
};

export function useAnalytics(range: DateRange = '7d') {
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
        scoreboard: EMPTY_SCOREBOARD,
        funnel: [], eventBreakdown: [], topDeals: [], hourlyActivity: [],
        recentEvents: [], dailyVisitors: [], devices: [], referrers: [],
        allTimeUniqueVisitors: 0, retentionCohorts: [], totalEventsInRange: 0,
        viral: {
          sharesToday: 0, sharesInRange: 0, sharedPageViews: 0,
          referralClicks: 0, referralConversions: 0, viralCoefficient: 0,
          shareViewRate: 0, clickToConversionRate: 0, topReferrers: [],
        },
        acquisitionChannels: [],
        growth: {
          visitorsWoW: 0, savesWoW: 0, clicksWoW: 0, sharesWoW: 0,
          wau: 0, mau: 0, stickiness: 0, activationRate: 0, eventsPerUser: 0,
        },
        dispensaryMetrics: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rangeStart = getRangeStart();
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayStr = todayStart.toISOString().slice(0, 10);
      const mauStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all data in parallel
      const [
        eventsRes,
        recentEventsRes,
        topDealsRes,
        allTimeSessionsRes,
        mauEventsRes,
      ] = await Promise.all([
        // All events in selected range
        supabase
          .from('analytics_events')
          .select('anon_id, event_name, properties, created_at')
          .gte('created_at', rangeStart)
          .order('created_at', { ascending: true }),
        // Recent events for live stream
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
        // 30-day events for return rate + retention cohorts
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

      // ----- Process range events in a single pass -----
      const eventCounts: Record<string, number> = {};
      const hourlyCounts: Record<number, number> = {};
      const dailyMap: Record<string, { visitors: Set<string>; events: number }> = {};
      const userDays: Record<string, Set<string>> = {};
      const deviceCounts: Record<string, number> = {};
      const referrerCounts: Record<string, number> = {};
      const deviceSeen = new Set<string>();

      // Funnel sets
      const funnelVisitors = new Set<string>();
      const funnelEngaged = new Set<string>();    // viewed a deal
      const funnelActivated = new Set<string>(); // saved or clicked

      // Today scoreboard accumulators
      const todayVisitors = new Set<string>();
      let savesToday = 0;
      let dealClicksToday = 0;

      // Viral / referral accumulators
      const sharers = new Set<string>();          // unique users who shared
      let sharesInRange = 0;                       // total share events (deal_shared + share_saves)
      let sharesToday = 0;
      let sharedPageViews = 0;                     // shared_page_view events
      let referralClicks = 0;                      // referral_click events
      let referralConversions = 0;                 // referral_conversion events
      const referralConverters = new Set<string>();// unique users who converted

      // Growth / B2B accumulators
      const dispensaryClicks: Record<string, { clicks: number; saves: number }> = {};
      const referrerConversions: Record<string, { conversions: number; clicks: number }> = {};
      // Weekly buckets for WoW comparison (current week vs prior week)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const thisWeekVisitors = new Set<string>(), lastWeekVisitors = new Set<string>();
      let thisWeekSaves = 0, lastWeekSaves = 0;
      let thisWeekClicks = 0, lastWeekClicks = 0;
      let thisWeekShares = 0, lastWeekShares = 0;

      // Acquisition channel tracking (from UTM params on app_loaded events)
      const userAcqSource: Record<string, string> = {}; // anon_id → source (first seen)
      const acqChannelData: Record<string, { visitors: Set<string>; saves: number; clicks: number }> = {};

      for (const event of events) {
        const dateKey = event.created_at.slice(0, 10);

        // Event counts
        eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;

        // Hourly
        const hour = new Date(event.created_at).getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;

        // Daily visitors
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { visitors: new Set(), events: 0 };
        dailyMap[dateKey].visitors.add(event.anon_id);
        dailyMap[dateKey].events++;

        // Per-user distinct days (for funnel power-user step)
        if (!userDays[event.anon_id]) userDays[event.anon_id] = new Set();
        userDays[event.anon_id].add(dateKey);

        // Funnel
        funnelVisitors.add(event.anon_id);
        if (['deal_view', 'deal_viewed', 'deal_modal_open', 'deal_click'].includes(event.event_name)) {
          funnelEngaged.add(event.anon_id);
        }
        if (['deal_saved', 'deal_save', 'get_deal_click'].includes(event.event_name)) {
          funnelActivated.add(event.anon_id);
        }

        // Today scoreboard
        if (dateKey === todayStr) {
          todayVisitors.add(event.anon_id);
          if (['deal_saved', 'deal_save'].includes(event.event_name)) savesToday++;
          if (event.event_name === 'get_deal_click') dealClicksToday++;
          if (['deal_shared', 'share_saves'].includes(event.event_name)) sharesToday++;
        }

        // Viral / referral tracking
        if (['deal_shared', 'share_saves'].includes(event.event_name)) {
          sharesInRange++;
          sharers.add(event.anon_id);
        }
        if (event.event_name === 'shared_page_view') sharedPageViews++;
        if (event.event_name === 'referral_click') referralClicks++;
        if (event.event_name === 'referral_conversion') {
          referralConversions++;
          referralConverters.add(event.anon_id);
          // Track which referrer drove this conversion
          const refProps = event.properties as Record<string, unknown> | null;
          const refId = refProps?.referrer;
          if (typeof refId === 'string') {
            if (!referrerConversions[refId]) referrerConversions[refId] = { conversions: 0, clicks: 0 };
            referrerConversions[refId].conversions++;
          }
        }
        if (event.event_name === 'referral_click') {
          const refProps = event.properties as Record<string, unknown> | null;
          const refId = refProps?.referrer;
          if (typeof refId === 'string') {
            if (!referrerConversions[refId]) referrerConversions[refId] = { conversions: 0, clicks: 0 };
            referrerConversions[refId].clicks++;
          }
        }

        // B2B: dispensary-level outbound clicks (the primary B2B metric).
        // Note: deal_saved events don't include dispensary in properties,
        // so saves-per-dispensary isn't tracked here. Clicks are the real
        // B2B value signal ("we drove X qualified clicks to your website").
        if (event.event_name === 'get_deal_click') {
          const p = event.properties as Record<string, unknown> | null;
          const disp = (p?.dispensary as string) || 'Unknown';
          if (!dispensaryClicks[disp]) dispensaryClicks[disp] = { clicks: 0, saves: 0 };
          dispensaryClicks[disp].clicks++;
        }

        // WoW buckets
        if (event.created_at >= weekAgo) {
          thisWeekVisitors.add(event.anon_id);
          if (['deal_saved', 'deal_save'].includes(event.event_name)) thisWeekSaves++;
          if (event.event_name === 'get_deal_click') thisWeekClicks++;
          if (['deal_shared', 'share_saves'].includes(event.event_name)) thisWeekShares++;
        } else if (event.created_at >= twoWeeksAgo) {
          lastWeekVisitors.add(event.anon_id);
          if (['deal_saved', 'deal_save'].includes(event.event_name)) lastWeekSaves++;
          if (event.event_name === 'get_deal_click') lastWeekClicks++;
          if (['deal_shared', 'share_saves'].includes(event.event_name)) lastWeekShares++;
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

          // Referrer (only from app_loaded events)
          const referrer = (props as Record<string, unknown>).referrer;
          if (referrer && typeof referrer === 'string' && referrer.length > 0 && event.event_name === 'app_loaded') {
            try {
              const hostname = new URL(referrer).hostname || 'direct';
              referrerCounts[hostname] = (referrerCounts[hostname] || 0) + 1;
            } catch {
              referrerCounts['direct'] = (referrerCounts['direct'] || 0) + 1;
            }
          }

          // Acquisition source from UTM params (first-touch per user)
          if (event.event_name === 'app_loaded') {
            const utmSource = (props as Record<string, unknown>).utm_source ??
                              (props as Record<string, unknown>).acquisition_source;
            if (typeof utmSource === 'string' && utmSource && !userAcqSource[event.anon_id]) {
              userAcqSource[event.anon_id] = utmSource;
            }
          }
        }

        // Accumulate per-channel metrics using first-touch source
        const source = userAcqSource[event.anon_id] || 'organic';
        if (!acqChannelData[source]) {
          acqChannelData[source] = { visitors: new Set(), saves: 0, clicks: 0 };
        }
        acqChannelData[source].visitors.add(event.anon_id);
        if (['deal_saved', 'deal_save'].includes(event.event_name)) {
          acqChannelData[source].saves++;
        }
        if (event.event_name === 'get_deal_click') {
          acqChannelData[source].clicks++;
        }
      }

      // Power Users: 3+ distinct-day visitors
      const powerUserCount = Object.values(userDays).filter((days) => days.size >= 3).length;

      // If no referrer data, default to "direct"
      if (Object.keys(referrerCounts).length === 0 && funnelVisitors.size > 0) {
        referrerCounts['direct'] = funnelVisitors.size;
      }

      // ----- Return Rate (7-day) from 30-day event window -----
      const oldVisitors = new Set<string>();
      const recentVisitors = new Set<string>();
      for (const e of mauEvents) {
        if (e.created_at < sevenDaysAgo) oldVisitors.add(e.anon_id);
        if (e.created_at >= sevenDaysAgo) recentVisitors.add(e.anon_id);
      }
      let returnedCount = 0;
      Array.from(oldVisitors).forEach((uid) => {
        if (recentVisitors.has(uid)) returnedCount++;
      });
      const returnRate = oldVisitors.size > 0
        ? Math.round((returnedCount / oldVisitors.size) * 100) : 0;

      // ----- Scoreboard -----
      const visitorsToday = todayVisitors.size;
      const saveRate = visitorsToday > 0
        ? Math.round((savesToday / visitorsToday) * 100) : 0;

      const scoreboard: ScoreboardData = {
        visitorsToday,
        savesToday,
        dealClicksToday,
        returnRate,
        saveRate,
      };

      // ----- Funnel (4 steps) -----
      const funnel: FunnelStep[] = [
        { label: 'Visited', count: funnelVisitors.size },
        { label: 'Engaged', count: funnelEngaged.size },
        { label: 'Activated', count: funnelActivated.size },
        { label: 'Power User', count: powerUserCount },
      ];

      // ----- Derived arrays -----
      const eventBreakdown: EventBreakdown[] = Object.entries(eventCounts)
        .map(([event_name, count]) => ({ event_name, count }))
        .sort((a, b) => b.count - a.count);

      const hourlyActivity: HourlyActivity[] = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourlyCounts[hour] || 0,
      }));

      const dailyVisitors: DailyVisitors[] = Object.entries(dailyMap)
        .map(([date, d]) => ({ date, visitors: d.visitors.size, events: d.events }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const devices: DeviceBreakdown[] = Object.entries(deviceCounts)
        .map(([device_type, count]) => ({ device_type, count }))
        .sort((a, b) => b.count - a.count);

      const referrers: ReferrerSource[] = Object.entries(referrerCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // ----- Retention Cohorts (Day 1 / Day 3 / Day 7 / Day 14) -----
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

      // Group users by the Monday of their first-seen week
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
        .slice(-6)
        .map(([cohortDate, { users }]) => {
          const cohortStart = new Date(cohortDate);
          let day1 = 0, day3 = 0, day7 = 0, day14 = 0;
          for (const uid of users) {
            const days = userAllDays[uid];
            if (!days) continue;
            let d1 = false, d3 = false, d7 = false, d14 = false;
            for (const d of Array.from(days)) {
              const diff = Math.floor(
                (new Date(d).getTime() - cohortStart.getTime()) / (24 * 60 * 60 * 1000)
              );
              if (diff === 1) d1 = true;
              if (diff >= 1 && diff <= 3) d3 = true;
              if (diff >= 1 && diff <= 7) d7 = true;
              if (diff >= 1 && diff <= 14) d14 = true;
            }
            if (d1) day1++;
            if (d3) day3++;
            if (d7) day7++;
            if (d14) day14++;
          }
          const n = users.length;
          return {
            cohortDate,
            cohortSize: n,
            day1: n > 0 ? Math.round((day1 / n) * 100) : 0,
            day3: n > 0 ? Math.round((day3 / n) * 100) : 0,
            day7: n > 0 ? Math.round((day7 / n) * 100) : 0,
            day14: n > 0 ? Math.round((day14 / n) * 100) : 0,
          };
        });

      // ----- Enrich top deals with product names -----
      const topDealsRaw = (topDealsRes.data ?? []) as { deal_id: string; save_count: number }[];
      let topDeals: TopDeal[] = topDealsRaw;

      if (topDealsRaw.length > 0) {
        const dealIds = topDealsRaw.map((d) => d.deal_id);
        // deal_save_counts.deal_id references products.id (not the deals table)
        const { data: dealDetails } = await supabase
          .from('products')
          .select('id, name, brand')
          .in('id', dealIds);

        if (dealDetails) {
          const detailMap = new Map(
            (dealDetails as unknown as { id: string; name: string; brand: string | null }[]).map(
              (d) => [d.id, d]
            )
          );
          topDeals = topDealsRaw.map((td) => {
            const detail = detailMap.get(td.deal_id);
            return {
              deal_id: td.deal_id,
              save_count: td.save_count,
              product_name: detail?.name,
              brand_name: detail?.brand ?? undefined,
            };
          });
        }
      }

      // ----- Viral coefficient -----
      const activeUsers = funnelActivated.size || funnelVisitors.size || 1;
      const avgSharesPerUser = sharesInRange / activeUsers;
      const shareImpressions = Math.max(referralClicks, sharedPageViews, 1);
      const conversionRate = referralConversions / shareImpressions;
      const viralCoefficient = parseFloat((avgSharesPerUser * conversionRate).toFixed(3));

      const shareViewRate = sharesInRange > 0
        ? Math.round((sharedPageViews / sharesInRange) * 100) : 0;
      const clickToConversionRate = referralClicks > 0
        ? Math.round((referralConversions / referralClicks) * 100) : 0;

      // Top referrers (users who drove the most conversions)
      const topReferrers: TopReferrer[] = Object.entries(referrerConversions)
        .map(([anonId, data]) => ({ anonId, conversions: data.conversions, clicks: data.clicks }))
        .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
        .slice(0, 10);

      const viral: ViralMetrics = {
        sharesToday,
        sharesInRange,
        sharedPageViews,
        referralClicks,
        referralConversions,
        viralCoefficient,
        shareViewRate,
        clickToConversionRate,
        topReferrers,
      };

      // ----- Growth metrics -----
      const wowPct = (curr: number, prev: number) =>
        prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);

      // WAU/MAU from 30-day event window
      const wauUsers = new Set<string>();
      const mauUsers = new Set<string>();
      // Track daily unique users for average DAU calculation
      const mauDailyUsers: Record<string, Set<string>> = {};
      for (const e of mauEvents) {
        mauUsers.add(e.anon_id);
        if (e.created_at >= sevenDaysAgo) {
          wauUsers.add(e.anon_id);
          // Accumulate per-day users for avg DAU
          const dayKey = e.created_at.slice(0, 10);
          if (!mauDailyUsers[dayKey]) mauDailyUsers[dayKey] = new Set();
          mauDailyUsers[dayKey].add(e.anon_id);
        }
      }
      const mauSize = mauUsers.size || 1;

      // Average DAU over last 7 days (standard stickiness formula)
      const dailySizes = Object.values(mauDailyUsers).map(s => s.size);
      const avgDau = dailySizes.length > 0
        ? dailySizes.reduce((a, b) => a + b, 0) / dailySizes.length
        : todayVisitors.size;

      const activationRate = funnelVisitors.size > 0
        ? Math.round((funnelActivated.size / funnelVisitors.size) * 100) : 0;
      const eventsPerUser = funnelVisitors.size > 0
        ? parseFloat((events.length / funnelVisitors.size).toFixed(1)) : 0;

      const growth: GrowthMetrics = {
        visitorsWoW: wowPct(thisWeekVisitors.size, lastWeekVisitors.size),
        savesWoW: wowPct(thisWeekSaves, lastWeekSaves),
        clicksWoW: wowPct(thisWeekClicks, lastWeekClicks),
        sharesWoW: wowPct(thisWeekShares, lastWeekShares),
        wau: wauUsers.size,
        mau: mauUsers.size,
        stickiness: Math.round((avgDau / mauSize) * 100),
        activationRate,
        eventsPerUser,
      };

      // ----- B2B dispensary metrics -----
      const dispensaryMetrics: DispensaryMetric[] = Object.entries(dispensaryClicks)
        .map(([dispensary, data]) => ({ dispensary, clicks: data.clicks, saves: data.saves }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 15);

      // ----- Acquisition channel breakdown -----
      const acquisitionChannels: AcquisitionChannel[] = Object.entries(acqChannelData)
        .map(([source, data]) => ({
          source,
          visitors: data.visitors.size,
          saves: data.saves,
          clicks: data.clicks,
        }))
        .sort((a, b) => b.visitors - a.visitors);

      setData({
        scoreboard,
        funnel,
        eventBreakdown,
        topDeals,
        hourlyActivity,
        recentEvents: (recentEventsRes.data ?? []) as EventRow[],
        dailyVisitors,
        devices,
        referrers,
        allTimeUniqueVisitors: allTimeSessionsRes.count ?? 0,
        retentionCohorts,
        totalEventsInRange: events.length,
        viral,
        growth,
        dispensaryMetrics,
        acquisitionChannels,
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
