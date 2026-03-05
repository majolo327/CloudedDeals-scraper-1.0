"use client";

import { useState } from "react";

export interface CohortRow {
  cohort_week: string;
  cohort_size: number;
  week0: number;
  week1: number | null;
  week2: number | null;
  week3: number | null;
  week4: number | null;
}

interface CohortTableProps {
  cohorts: CohortRow[];
  loading?: boolean;
}

function cellColor(pct: number | null): string {
  if (pct === null || pct === undefined) return "bg-zinc-50 text-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-600";
  if (pct >= 30) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (pct >= 10) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (pct > 0) return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  return "bg-zinc-50 text-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-600";
}

function cellValue(pct: number | null, cohortSize: number): string {
  if (pct === null || pct === undefined) return "–";
  if (cohortSize < 5) return "n<5";
  if (pct === 0) return "0%";
  return `${pct}%`;
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function exportAsMarkdown(cohorts: CohortRow[]): string {
  const lines: string[] = [
    "| Cohort | Users | Week 0 | Week 1 | Week 2 | Week 3 | Week 4 |",
    "|--------|------:|-------:|-------:|-------:|-------:|-------:|",
  ];

  for (const c of cohorts) {
    const w = (v: number | null) => (v === null ? "–" : `${v}%`);
    lines.push(
      `| ${formatWeekLabel(c.cohort_week)} | ${c.cohort_size} | ${w(c.week0)} | ${w(c.week1)} | ${w(c.week2)} | ${w(c.week3)} | ${w(c.week4)} |`
    );
  }

  return lines.join("\n");
}

export function CohortTable({ cohorts, loading }: CohortTableProps) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-4">
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  const rows = cohorts.slice(-8);
  const WEEKS = ["week0", "week1", "week2", "week3", "week4"] as const;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Weekly Cohort Retention
        </h3>
        <button
          onClick={() => {
            const md = exportAsMarkdown(rows);
            navigator.clipboard.writeText(md).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
        >
          {copied ? "Copied!" : "Export Markdown"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No cohort data yet &middot; collecting...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Cohort
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Users
                </th>
                {WEEKS.map((w, i) => (
                  <th
                    key={w}
                    className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  >
                    Week {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {rows.map((c) => (
                <tr key={c.cohort_week}>
                  <td className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {formatWeekLabel(c.cohort_week)}
                  </td>
                  <td className="px-3 py-1.5 text-center text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {c.cohort_size < 5 ? (
                      <span className="text-zinc-400">n&lt;5</span>
                    ) : (
                      c.cohort_size
                    )}
                  </td>
                  {WEEKS.map((w) => {
                    const val = c[w];
                    return (
                      <td key={w} className="px-3 py-1.5 text-center">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            w === "week0"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : c.cohort_size < 5
                                ? "bg-zinc-50 text-zinc-400 dark:bg-zinc-800/50 dark:text-zinc-600"
                                : cellColor(val)
                          }`}
                        >
                          {w === "week0" ? "100%" : cellValue(val, c.cohort_size)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
