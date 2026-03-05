"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CohortRow } from "@/components/admin/CohortTable";

export type TimeWindow = "7d" | "30d" | "all";

export interface GrowthMetrics {
  dau: number;
  mau: number;
  total_users: number;
  dau_mau_ratio: number | null;
  save_rate: number | null;
  daily_visitors: { dt: string; visitors: number }[];
}

export interface RetentionMetrics {
  retention_7d: number | null;
  retention_30d: number | null;
  activation_rate: number | null;
  return_rate: number | null;
  bounce_rate: number | null;
  avg_events_per_session: number | null;
  avg_saves_per_active_user: number | null;
}

export interface PipelineMetrics {
  total_deals_active: number;
  total_products: number;
  deals_pipeline_total: number;
  states_live: number;
  scraper_success: number;
  last_run_at: string | null;
}

export interface ViralMetrics {
  total_shares: number;
}

export interface CoverageRow {
  base_region: string;
  sites_ok: number;
  products: number;
  success_rate_7d: number;
  last_run: string;
}

export interface DashboardData {
  growth: GrowthMetrics;
  retention: RetentionMetrics;
  cohorts: CohortRow[];
  pipeline: PipelineMetrics;
  viral: ViralMetrics;
  coverage: CoverageRow[];
  calculated_at: string;
}

function windowToDays(w: TimeWindow): number {
  if (w === "7d") return 7;
  if (w === "30d") return 30;
  return 3650; // ~10 years for "all"
}

export function useDashboardMetrics(window: TimeWindow = "30d") {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "get_dashboard_metrics",
        { window_days: windowToDays(window) }
      );

      if (rpcError) {
        console.error("get_dashboard_metrics RPC error:", rpcError);
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      if (result) {
        setData(result as DashboardData);
      }
    } catch (err) {
      console.error("Dashboard metrics fetch failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }

    setLoading(false);
  }, [window]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    lastUpdated: data?.calculated_at ?? null,
  };
}
