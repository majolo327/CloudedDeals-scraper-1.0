'use client';

import { Flame } from 'lucide-react';
import type { HeatLevel } from '@/utils/dealHeat';
import { HEAT_COLORS } from '@/utils/dealHeat';

interface HeatIndicatorProps {
  heat: HeatLevel;
  compact?: boolean;
}

/**
 * Renders 1-3 flame icons based on deal heat level.
 * No text — users learn the system intuitively.
 */
export function HeatIndicator({ heat, compact = false }: HeatIndicatorProps) {
  if (!heat) return null;

  const color = HEAT_COLORS[heat].flame;
  const size = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const gap = compact ? 'gap-0' : 'gap-0.5';

  return (
    <span
      className={`inline-flex items-center ${gap} shrink-0`}
      title={heat === 3 ? 'Steal' : heat === 2 ? 'Fire Deal' : 'Solid Deal'}
    >
      {Array.from({ length: heat }, (_, i) => (
        <Flame
          key={i}
          className={`${size} ${heat === 3 ? 'animate-heat-pulse' : ''}`}
          style={{ color, fill: color, opacity: heat === 1 ? 0.7 : 1 }}
        />
      ))}
    </span>
  );
}
