'use client';

import type { BadgeType } from '@/types';

const BADGE_CONFIG: Record<BadgeType, { emoji: string; text: string; bgColor: string; textColor: string }> = {
  fire: { emoji: '🔥', text: 'Hot Deal', bgColor: 'bg-red-500/10', textColor: 'text-red-400' },
  trending: { emoji: '📈', text: 'Trending', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400' },
  steal: { emoji: '💎', text: 'Steal', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400' },
};

interface DealBadgeProps {
  type: BadgeType;
  compact?: boolean;
}

export function DealBadge({ type, compact = false }: DealBadgeProps) {
  const config = BADGE_CONFIG[type];

  if (compact) {
    return (
      <span className={`flex items-center gap-0.5 text-[7px] ${config.textColor}`}>
        <span>{config.emoji}</span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${config.bgColor} ${config.textColor}`}>
      {config.emoji} {config.text}
    </span>
  );
}
