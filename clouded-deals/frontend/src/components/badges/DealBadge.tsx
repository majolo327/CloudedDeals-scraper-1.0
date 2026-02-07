'use client';

import type { BadgeType } from '@/types';

const BADGE_CONFIG: Record<BadgeType, { text: string; bgColor: string; textColor: string }> = {
  hot:   { text: 'Hot Deal',   bgColor: 'bg-red-500/10',    textColor: 'text-red-400' },
  great: { text: 'Great Deal', bgColor: 'bg-orange-500/10', textColor: 'text-orange-400' },
  good:  { text: 'Good Deal',  bgColor: 'bg-green-500/10',  textColor: 'text-green-400' },
  deal:  { text: 'Deal',       bgColor: 'bg-slate-500/10',  textColor: 'text-slate-400' },
};

interface DealBadgeProps {
  type: BadgeType;
  compact?: boolean;
}

export function DealBadge({ type, compact = false }: DealBadgeProps) {
  const config = BADGE_CONFIG[type];

  if (compact) {
    return (
      <span className={`flex items-center gap-0.5 text-[7px] font-semibold uppercase tracking-wide ${config.textColor}`}>
        <span>{config.text}</span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${config.bgColor} ${config.textColor}`}>
      {config.text}
    </span>
  );
}
