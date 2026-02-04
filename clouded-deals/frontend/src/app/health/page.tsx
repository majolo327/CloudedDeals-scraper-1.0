"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface HealthCheck {
  supabase: "connected" | "disconnected" | "checking";
  tables: Record<string, number>;
  timestamp: string;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthCheck>({
    supabase: "checking",
    tables: {},
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setHealth({
        supabase: "disconnected",
        tables: {},
        timestamp: new Date().toISOString(),
      });
      return;
    }

    (async () => {
      try {
        const tableNames = ["dispensaries", "products", "deals", "scrape_runs"];
        const counts: Record<string, number> = {};

        for (const table of tableNames) {
          try {
            const { count } = await supabase
              .from(table)
              .select("id", { count: "exact", head: true });
            counts[table] = count ?? 0;
          } catch {
            counts[table] = -1;
          }
        }

        setHealth({
          supabase: "connected",
          tables: counts,
          timestamp: new Date().toISOString(),
        });
      } catch {
        setHealth({
          supabase: "disconnected",
          tables: {},
          timestamp: new Date().toISOString(),
        });
      }
    })();
  }, []);

  const statusColor =
    health.supabase === "connected"
      ? "text-green-600"
      : health.supabase === "checking"
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
        Health Check
      </h1>

      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Supabase
            </span>
            <span className={`text-sm font-semibold ${statusColor}`}>
              {health.supabase}
            </span>
          </div>
        </div>

        {Object.keys(health.tables).length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Table Row Counts
            </h2>
            <div className="space-y-2">
              {Object.entries(health.tables).map(([table, count]) => (
                <div
                  key={table}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {table}
                  </span>
                  <span
                    className={
                      count >= 0
                        ? "font-medium text-zinc-800 dark:text-zinc-200"
                        : "text-red-500"
                    }
                  >
                    {count >= 0 ? count : "error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-zinc-400">
          Checked at: {health.timestamp}
        </div>
      </div>
    </div>
  );
}
