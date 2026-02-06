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

export interface AnalyticsData {
  stats: AnalyticsStats;
  eventBreakdown: EventBreakdown[];
  topDeals: TopDeal[];
  hourlyActivity: HourlyActivity[];
  recentEvents: EventRow[];
}

export interface EventRow {
  id: string;
  anon_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

type DateRange = '24h' | '7d' | '30d';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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
    }
  }, [range]);

  const fetchAnalytics = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData({
        stats: { uniqueUsers: 0, totalEvents: 0, savesToday: 0, activeSessions: 0 },
        eventBreakdown: [],
        topDeals: [],
        hourlyActivity: [],
        recentEvents: [],
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

      // Fetch all data in parallel
      const [
        eventsRes,
        sessionsRes,
        savesTodayRes,
        recentEventsRes,
        topDealsRes,
      ] = await Promise.all([
        // All events in range
        supabase
          .from('analytics_events')
          .select('anon_id, event_name, created_at')
          .gte('created_at', rangeStart),
        // Active sessions in range
        supabase
          .from('user_sessions')
          .select('user_id', { count: 'exact', head: true })
          .gte('last_seen', rangeStart),
        // Saves today
        supabase
          .from('user_saved_deals')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString()),
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
      ]);

      const events = (eventsRes.data ?? []) as { anon_id: string; event_name: string; created_at: string }[];

      // Unique users
      const uniqueUsers = new Set(events.map((e) => e.anon_id)).size;

      // Event breakdown
      const eventCounts: Record<string, number> = {};
      const hourlyCounts: Record<number, number> = {};

      for (const event of events) {
        eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;
        const hour = new Date(event.created_at).getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      }

      const eventBreakdown: EventBreakdown[] = Object.entries(eventCounts)
        .map(([event_name, count]) => ({ event_name, count }))
        .sort((a, b) => b.count - a.count);

      // Hourly activity (all 24 hours)
      const hourlyActivity: HourlyActivity[] = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourlyCounts[hour] || 0,
      }));

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
        },
        eventBreakdown,
        topDeals,
        hourlyActivity,
        recentEvents: (recentEventsRes.data ?? []) as EventRow[],
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
