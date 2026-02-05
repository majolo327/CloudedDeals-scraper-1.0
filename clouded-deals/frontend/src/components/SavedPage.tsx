'use client';

import { Heart, DollarSign, Trash2 } from 'lucide-react';
import { useSavedDeals } from '@/hooks/useSavedDeals';
import { getDiscountPercent } from '@/utils';

interface SavedDeal {
  id: string;
  product_name: string;
  category: string;
  weight: string;
  original_price: number | null;
  deal_price: number;
  dispensary: { id: string; name: string };
  brand: { id: string; name: string };
}

interface SavedPageProps {
  deals: SavedDeal[];
}

export function SavedPage({ deals }: SavedPageProps) {
  const { savedDeals, toggleSavedDeal, isDealUsed, markDealUsed } = useSavedDeals();

  const savedDealsList = deals.filter((d) => savedDeals.has(d.id));
  const usedDeals = savedDealsList.filter((d) => isDealUsed(d.id));
  const activeDeals = savedDealsList.filter((d) => !isDealUsed(d.id));

  const potentialSavings = activeDeals.reduce((sum, deal) => {
    if (!deal.original_price || deal.original_price <= deal.deal_price) return sum;
    return sum + (deal.original_price - deal.deal_price);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats bar */}
        {savedDealsList.length > 0 && (
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {activeDeals.length} saved deal{activeDeals.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {usedDeals.length} used
                </p>
              </div>
            </div>
            {potentialSavings > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-400">
                    ${potentialSavings.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500">potential savings</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active saved deals */}
        {activeDeals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Active Deals</h2>
            <div className="space-y-2">
              {activeDeals.map((deal) => (
                <SavedDealCard
                  key={deal.id}
                  deal={deal}
                  onRemove={() => toggleSavedDeal(deal.id)}
                  onMarkUsed={() => markDealUsed(deal.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Used deals */}
        {usedDeals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 mb-3">Used Deals</h2>
            <div className="space-y-2 opacity-50">
              {usedDeals.map((deal) => (
                <SavedDealCard
                  key={deal.id}
                  deal={deal}
                  isUsed
                  onRemove={() => toggleSavedDeal(deal.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {savedDealsList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">No saved deals</h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Tap the heart icon on any deal to save it here for quick access.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function SavedDealCard({
  deal,
  isUsed = false,
  onRemove,
  onMarkUsed,
}: {
  deal: SavedDeal;
  isUsed?: boolean;
  onRemove: () => void;
  onMarkUsed?: () => void;
}) {
  const discount = getDiscountPercent(deal.original_price, deal.deal_price);

  return (
    <div className="glass rounded-lg px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{deal.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{deal.dispensary.name}</span>
          {deal.weight && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">{deal.weight}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-white">${deal.deal_price.toFixed(2)}</p>
          {discount > 0 && (
            <p className="text-[10px] text-emerald-400 font-medium">-{discount}%</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isUsed && onMarkUsed && (
            <button
              onClick={onMarkUsed}
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center justify-center"
              title="Mark as used"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
