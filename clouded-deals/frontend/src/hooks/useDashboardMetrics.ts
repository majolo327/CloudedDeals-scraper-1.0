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
      const days = windowToDays(window);

      // Fire all 4 RPCs in parallel — each stays under the 8s timeout
      const [growthRes, retentionRes, cohortsRes, pipelineRes] =
        await Promise.all([
          supabase.rpc("get_dashboard_growth", { window_days: days }),
          supabase.rpc("get_dashboard_retention", { window_days: days }),
          supabase.rpc("get_dashboard_cohorts"),
          supabase.rpc("get_dashboard_pipeline"),
        ]);

      // Collect errors from any RPC that failed
      const errors: string[] = [];
      if (growthRes.error) errors.push(`growth: ${growthRes.error.message}`);
      if (retentionRes.error) errors.push(`retention: ${retentionRes.error.message}`);
      if (cohortsRes.error) errors.push(`cohorts: ${cohortsRes.error.message}`);
      if (pipelineRes.error) errors.push(`pipeline: ${pipelineRes.error.message}`);

      if (errors.length === 4) {
        // All failed — show error
        setError(errors.join("; "));
        setLoading(false);
        return;
      }

      if (errors.length > 0) {
        console.warn("Some dashboard RPCs failed:", errors);
      }

      // Merge results into a single DashboardData shape
      // Each RPC returns JSON directly matching the expected sub-shape
      const growth = growthRes.data as GrowthMetrics | null;
      const retention = retentionRes.data as RetentionMetrics | null;
      const cohortsData = cohortsRes.data as { cohorts: CohortRow[] } | null;
      const pipelineData = pipelineRes.data as {
        pipeline: PipelineMetrics;
        viral: ViralMetrics;
        coverage: CoverageRow[];
        calculated_at: string;
      } | null;

      setData({
        growth: growth ?? {
          dau: 0, mau: 0, total_users: 0,
          dau_mau_ratio: null, save_rate: null, daily_visitors: [],
        },
        retention: retention ?? {
          retention_7d: null, retention_30d: null, activation_rate: null,
          return_rate: null, bounce_rate: null,
          avg_events_per_session: null, avg_saves_per_active_user: null,
        },
        cohorts: cohortsData?.cohorts ?? [],
        pipeline: pipelineData?.pipeline ?? {
          total_deals_active: 0, total_products: 0, deals_pipeline_total: 0,
          states_live: 0, scraper_success: 0, last_run_at: null,
        },
        viral: pipelineData?.viral ?? { total_shares: 0 },
        coverage: pipelineData?.coverage ?? [],
        calculated_at: pipelineData?.calculated_at ?? new Date().toISOString(),
      });
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
