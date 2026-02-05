'use client';

import { Clock, TrendingUp, Users, Sparkles } from 'lucide-react';
import type { Deal } from '@/types';
import {
  getDealAge,
  isFreshDeal,
  getSocialProofBadges,
  formatSaveCount,
  type SocialProofBadge,
} from '@/lib/socialProof';

interface DealSocialProofProps {
  deal: Deal;
  totalSaves?: number;
  recentSavesLastHour?: number;
  variant?: 'compact' | 'full';
}

/**
 * Shows social proof badges for a deal (hot, trending, new, etc.)
 */
export function DealSocialProof({
  deal,
  totalSaves,
  recentSavesLastHour,
  variant = 'compact',
}: DealSocialProofProps) {
  const badges = getSocialProofBadges(deal, {
    totalSaves: totalSaves ?? deal.save_count,
    recentSavesLastHour,
  });

  // Only show top badge in compact mode
  const displayBadges = variant === 'compact' ? badges.slice(0, 1) : badges.slice(0, 2);

  if (displayBadges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {displayBadges.map((badge) => (
        <SocialProofPill key={badge.type} badge={badge} size={variant === 'compact' ? 'sm' : 'md'} />
      ))}
    </div>
  );
}

interface SocialProofPillProps {
  badge: SocialProofBadge;
  size?: 'sm' | 'md';
}

function SocialProofPill({ badge, size = 'sm' }: SocialProofPillProps) {
  const sizeClasses = size === 'sm'
    ? 'text-[8px] px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-1 gap-1';

  const colorClasses = {
    hot_deal: 'bg-red-500/15 text-red-400 border-red-500/30',
    trending: 'bg-green-500/15 text-green-400 border-green-500/30',
    popular_dispensary: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    weekend_special: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    last_day: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    new_arrival: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses} rounded-full border font-medium ${colorClasses[badge.type]}`}
    >
      <span>{badge.icon}</span>
      <span className="truncate max-w-[100px]">{badge.text}</span>
    </span>
  );
}

/**
 * Compact save count display
 */
export function SaveCountBadge({ count }: { count: number }) {
  const formatted = formatSaveCount(count);
  if (!formatted) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] text-slate-500">
      <Users className="w-2 h-2" />
      <span>{formatted}</span>
    </span>
  );
}

/**
 * Deal freshness indicator
 */
export function DealAgeBadge({
  createdAt,
  showIcon = true
}: {
  createdAt: Date | string;
  showIcon?: boolean;
}) {
  const age = getDealAge(createdAt);
  const isFresh = isFreshDeal(createdAt, 4);

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[8px] ${
        isFresh ? 'text-green-400' : 'text-slate-500'
      }`}
    >
      {showIcon && <Clock className="w-2 h-2" />}
      <span>{age}</span>
    </span>
  );
}

/**
 * Trending indicator for deals with high recent activity
 */
export function TrendingBadge({
  recentSaves
}: {
  recentSaves: number;
}) {
  if (recentSaves < 5) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
      <TrendingUp className="w-2 h-2" />
      <span>Trending</span>
    </span>
  );
}

/**
 * "Hot deal" badge for popular deals
 */
export function HotDealBadge({
  saveCount,
  threshold = 10
}: {
  saveCount: number;
  threshold?: number;
}) {
  if (saveCount < threshold) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full border border-orange-500/20">
      <span>🔥</span>
      <span>{saveCount} grabbed</span>
    </span>
  );
}

/**
 * New arrival sparkle badge
 */
export function NewArrivalBadge({ createdAt }: { createdAt: Date | string }) {
  if (!isFreshDeal(createdAt, 3)) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-500/20">
      <Sparkles className="w-2 h-2" />
      <span>New</span>
    </span>
  );
}
