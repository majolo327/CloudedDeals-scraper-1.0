'use client';

import { useState } from 'react';
import { Sparkles, Info } from 'lucide-react';
import type { RecommendationReason } from '@/lib/personalization';
import { getRecommendationText } from '@/lib/personalization';

interface RecommendationBadgeProps {
  reason: RecommendationReason | null;
  score?: number;
  isTopRecommended?: boolean;
  size?: 'sm' | 'md';
}

export function RecommendationBadge({
  reason,
  score,
  isTopRecommended = false,
  size = 'sm',
}: RecommendationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const reasonText = getRecommendationText(reason);
  if (!reasonText && !isTopRecommended) return null;

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowTooltip(!showTooltip);
  };

  const sizeClasses = size === 'sm'
    ? 'text-[8px] px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-1 gap-1';

  const iconSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="relative inline-flex">
      <button
        onClick={handleInteraction}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center ${sizeClasses} rounded-full font-medium transition-all ${
          isTopRecommended
            ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30'
            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
        }`}
      >
        {isTopRecommended ? (
          <>
            <Sparkles className={`${iconSize} text-purple-400`} />
            <span>For You</span>
          </>
        ) : (
          <>
            <Info className={iconSize} />
            <span>Why?</span>
          </>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && reasonText && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-slate-200">{reasonText}</span>
          </div>
          {score !== undefined && (
            <div className="mt-1 text-[10px] text-slate-500">
              Match score: {score}%
            </div>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function WhyThisDealTooltip({
  reason,
  score,
}: {
  reason: RecommendationReason | null;
  score?: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const reasonText = getRecommendationText(reason);

  if (!reasonText) return null;

  return (
    <div className="relative inline-flex">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-slate-500 hover:text-slate-400 transition-colors"
        title="Why this deal?"
      >
        <Info className="w-3 h-3" />
      </button>

      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-slate-200">{reasonText}</span>
          </div>
          {score !== undefined && (
            <div className="mt-1 text-[10px] text-slate-500">
              Match: {score}%
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}
