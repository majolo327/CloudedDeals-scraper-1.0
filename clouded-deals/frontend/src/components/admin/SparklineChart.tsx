"use client";

interface DataPoint {
  dt: string;
  visitors: number;
}

interface SparklineChartProps {
  data: DataPoint[];
  height?: number;
  loading?: boolean;
}

export function SparklineChart({ data, height = 80, loading }: SparklineChartProps) {
  if (loading) {
    return (
      <div
        className="w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
        style={{ height }}
      />
    );
  }

  if (!data || data.length < 2) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
        style={{ height }}
      >
        Not enough data for chart
      </div>
    );
  }

  const width = 600;
  const padding = 4;
  const values = data.map((d) => d.visitors);
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="w-full rounded-lg border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height }}
      >
        <defs>
          <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkline-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#16a34a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Last point dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill="#16a34a"
        />
      </svg>
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {data[0].dt}
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          Daily Unique Visitors
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {data[data.length - 1].dt}
        </span>
      </div>
    </div>
  );
}
