"use client";

import Link from "next/link";

interface ScraperHealthBadgeProps {
  successRate: number | null;
  statesLive: number;
  lastRunAt: string | null;
  loading?: boolean;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getStatus(
  successRate: number | null,
  lastRunAt: string | null
): { emoji: string; label: string; color: string } {
  const hoursSince = lastRunAt
    ? (Date.now() - new Date(lastRunAt).getTime()) / 3_600_000
    : Infinity;

  if (
    (successRate !== null && successRate < 60) ||
    hoursSince > 6
  ) {
    return {
      emoji: "\u{1F534}",
      label: "Critical",
      color: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
    };
  }

  if (
    (successRate !== null && successRate < 85) ||
    hoursSince > 2
  ) {
    return {
      emoji: "\u{1F7E1}",
      label: "Degraded",
      color: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
    };
  }

  return {
    emoji: "\u{1F7E2}",
    label: "Healthy",
    color: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
  };
}

export function ScraperHealthBadge({
  successRate,
  statesLive,
  lastRunAt,
  loading,
}: ScraperHealthBadgeProps) {
  if (loading) {
    return (
      <div className="h-7 w-48 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
    );
  }

  const status = getStatus(successRate, lastRunAt);
  const rateStr = successRate !== null ? `${successRate}%` : "–";
  const timeStr = lastRunAt ? timeAgo(lastRunAt) : "never";

  return (
    <Link
      href="/admin/scraper"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${status.color}`}
    >
      <span>{status.emoji}</span>
      <span>
        {rateStr} &middot; {statesLive} states &middot; {timeStr}
      </span>
    </Link>
  );
}
