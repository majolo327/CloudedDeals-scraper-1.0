"use client";

interface MetricCardProps {
  label: string;
  value: string | number | null;
  sub?: string;
  trend?: string;
  trendDirection?: "up-good" | "up-bad";
  color?: "green" | "amber" | "red" | "purple" | "blue";
  loading?: boolean;
  noData?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-500 dark:text-red-400",
  purple: "text-purple-600 dark:text-purple-400",
  blue: "text-blue-600 dark:text-blue-400",
};

export function MetricCard({
  label,
  value,
  sub,
  trend,
  trendDirection = "up-good",
  color,
  loading,
  noData,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-1 h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  const isNoData = noData || value === null || value === undefined;
  const valueColor = isNoData
    ? "text-zinc-300 dark:text-zinc-600"
    : color
      ? COLOR_MAP[color]
      : "text-zinc-900 dark:text-white";

  const isPositiveTrend = trend?.startsWith("+");
  const trendColor =
    trendDirection === "up-good"
      ? isPositiveTrend
        ? "text-green-600 dark:text-green-400"
        : "text-red-500 dark:text-red-400"
      : isPositiveTrend
        ? "text-red-500 dark:text-red-400"
        : "text-green-600 dark:text-green-400";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="mt-0.5 flex items-baseline gap-2">
        <p className={`text-3xl font-bold ${valueColor}`}>
          {isNoData ? "—" : value}
        </p>
        {trend && !isNoData && (
          <span className={`text-xs font-semibold ${trendColor}`}>{trend}</span>
        )}
      </div>
      {isNoData ? (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
          No data yet
        </p>
      ) : sub ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
      ) : null}
    </div>
  );
}
