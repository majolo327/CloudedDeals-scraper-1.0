import { Heart } from 'lucide-react';

interface Deal {
  id: string;
  product_name: string;
  original_price: number | null;
  deal_price: number;
  brand: { name: string };
}

interface StaffPickMiniCardProps {
  deal: Deal;
  isSaved: boolean;
  onSave: () => void;
  onClick: () => void;
}

export function StaffPickMiniCard({ deal, isSaved, onSave, onClick }: StaffPickMiniCardProps) {
  return (
    <div
      onClick={onClick}
      className={`w-[140px] shrink-0 glass frost rounded-xl p-2.5 cursor-pointer transition-all duration-300 ${
        isSaved
          ? 'card-saved'
          : 'hover:bg-slate-800/70 hover:border-cyan-500/20'
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium truncate flex-1">
          {deal.brand?.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className={`w-5 h-5 rounded flex items-center justify-center transition-all shrink-0 ${
            isSaved
              ? 'text-purple-400'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          <Heart className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>

      <h3 className="text-xs font-medium text-slate-100 truncate mb-2">
        {deal.product_name}
      </h3>

      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold font-mono text-purple-400">${deal.deal_price}</span>
        {deal.original_price && (
          <span className="text-[10px] text-slate-500 line-through">${deal.original_price}</span>
        )}
      </div>
    </div>
  );
}
