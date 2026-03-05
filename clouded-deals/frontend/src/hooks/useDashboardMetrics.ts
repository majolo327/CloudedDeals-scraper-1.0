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

      // Helper: wrap each RPC so individual failures don't block others
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeRpc = async <T>(name: string, call: () => PromiseLike<any>):
        Promise<{ data: T | null; error: string | null }> => {
        try {
          const res = await call();
          if (res.error) return { data: null, error: `${name}: ${res.error.message}` };
          return { data: res.data as T, error: null };
        } catch (e) {
          return { data: null, error: `${name}: ${e instanceof Error ? e.message : "unknown"}` };
        }
      };

      // Fire all 4 RPCs in parallel — each must complete in <8s
      const [growthRes, retentionRes, cohortsRes, pipelineRes] =
        await Promise.all([
          safeRpc<GrowthMetrics>("growth", () =>
            supabase.rpc("get_dashboard_growth", { window_days: days })),
          safeRpc<RetentionMetrics>("retention", () =>
            supabase.rpc("get_dashboard_retention", { window_days: days })),
          safeRpc<{ cohorts: CohortRow[] }>("cohorts", () =>
            supabase.rpc("get_dashboard_cohorts")),
          safeRpc<{
            pipeline: PipelineMetrics;
            viral: ViralMetrics;
            coverage: CoverageRow[];
            calculated_at: string;
          }>("pipeline", () =>
            supabase.rpc("get_dashboard_pipeline")),
        ]);

      // Collect errors
      const errors = [growthRes, retentionRes, cohortsRes, pipelineRes]
        .map((r) => r.error)
        .filter(Boolean) as string[];

      if (errors.length === 4) {
        setError(errors.join("; "));
        setLoading(false);
        return;
      }

      // Show partial errors as a warning but still populate data
      if (errors.length > 0) {
        console.warn("Some dashboard RPCs failed:", errors);
        setError(errors.join("; "));
      }

      // Merge results — zones with failed RPCs get "no data" defaults
      const growth = growthRes.data;
      const retention = retentionRes.data;
      const cohortsData = cohortsRes.data;
      const pipelineData = pipelineRes.data;

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
