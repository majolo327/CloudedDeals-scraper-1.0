'use client';

import { Heart } from 'lucide-react';
import type { Deal } from '@/types';
import { getDisplayName } from '@/utils';

interface StaffPickMiniCardProps {
  deal: Deal;
  isSaved: boolean;
  onSave: () => void;
  onClick: () => void;
}

export function StaffPickMiniCard({
  deal,
  isSaved,
  onSave,
  onClick,
}: StaffPickMiniCardProps) {
  return (
    <div
      onClick={onClick}
      className={`w-[150px] shrink-0 glass frost rounded-xl p-3 cursor-pointer transition-gentle ${
        isSaved
          ? 'card-saved'
          : 'hover:border-[rgba(99,115,171,0.22)] hover:bg-[rgba(28,35,56,0.8)]'
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium truncate flex-1">
          {deal.brand.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`w-8 h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded flex items-center justify-center transition-gentle shrink-0 ${
            isSaved ? 'text-purple-400' : 'text-slate-500 hover:text-white'
          }`}
        >
          <Heart
            className={`w-4 h-4 transition-gentle ${isSaved ? 'fill-current' : ''}`}
          />
        </button>
      </div>

      <h3 className="text-xs font-semibold text-slate-100 truncate mb-2">
        {getDisplayName(deal.product_name, deal.brand.name)}
      </h3>

      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold font-mono text-purple-400">
          ${deal.deal_price}
        </span>
        {deal.original_price && deal.original_price > deal.deal_price && (
          <span className="text-[10px] text-slate-500 line-through">
            ${deal.original_price}
          </span>
        )}
      </div>
      {(deal.save_count ?? 0) > 0 && (
        <span className="text-[8px] text-slate-500 mt-1">
          {(deal.save_count ?? 0) >= 20 ? `${deal.save_count}` : deal.save_count} saved
        </span>
      )}
    </div>
  );
}
