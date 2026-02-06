'use client';

import { Heart, X, Crown } from 'lucide-react';
import type { Deal } from '@/types';

interface CompactTopPickProps {
  deal: Deal;
  isSaved: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onClick: () => void;
}

export function CompactTopPick({
  deal,
  isSaved,
  onSave,
  onDismiss,
  onClick,
}: CompactTopPickProps) {
  return (
    <div
      onClick={onClick}
      className="group relative glass frost rounded-xl p-3 cursor-pointer transition-gentle soft-glow-amber hover:bg-slate-800/70 hover:border-amber-500/20"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Top Pick
          </span>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
              {deal.brand.name}
            </span>
            <h3 className="text-sm font-medium text-slate-100 truncate group-hover:text-amber-400 transition-gentle">
              {deal.product_name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">{deal.weight}</span>
              {(deal.save_count ?? 0) >= 20 ? (
                <span className="text-[10px] text-orange-400">🔥 {deal.save_count} saved</span>
              ) : (deal.save_count ?? 0) > 0 ? (
                <span className="text-[10px] text-slate-500">{deal.save_count} saved</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-purple-400">
                ${deal.deal_price}
              </span>
              {deal.original_price && (
                <span className="text-xs text-slate-500 line-through">
                  ${deal.original_price}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className={`w-10 h-10 sm:w-8 sm:h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg flex items-center justify-center transition-gentle ${
                  isSaved
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Heart
                  className={`w-4 h-4 transition-gentle ${isSaved ? 'fill-current' : ''}`}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="w-10 h-10 sm:w-8 sm:h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg flex items-center justify-center bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-gentle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
