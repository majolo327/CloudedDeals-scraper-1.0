"use client";

import { useState, useEffect, useCallback } from "react";
import { Star } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CompactDealCard } from "@/components/CompactDealCard";
import { CompactTopPick } from "@/components/CompactTopPick";
import { StaffPickMiniCard } from "@/components/StaffPickMiniCard";
import { StickyStatsBar } from "@/components/StickyStatsBar";
import { Footer } from "@/components/Footer";

type DealsTab = "today" | "verified";
type DealCategory = "all" | "flower" | "concentrate" | "vape" | "edible" | "preroll";

interface DealRow {
  id: string;
  deal_score: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    original_price: number | null;
    sale_price: number | null;
    weight_value: number | null;
    weight_unit: string | null;
  };
  dispensary: {
    id: string;
    name: string;
  };
}

interface NormalizedDeal {
  id: string;
  product_name: string;
  category: string;
  weight: string;
  original_price: number | null;
  deal_price: number;
  dispensary: { id: string; name: string };
  brand: { id: string; name: string };
  is_top_pick: boolean;
  is_staff_pick: boolean;
  is_featured: boolean;
}

function normalizeDeal(row: DealRow): NormalizedDeal {
  const weight = row.product.weight_value
    ? `${row.product.weight_value}${row.product.weight_unit || "g"}`
    : "";
  return {
    id: row.id,
    product_name: row.product.name,
    category: row.product.category || "flower",
    weight,
    original_price: row.product.original_price,
    deal_price: row.product.sale_price || 0,
    dispensary: row.dispensary,
    brand: { id: row.product.brand || "", name: row.product.brand || "Unknown" },
    is_top_pick: row.deal_score >= 80,
    is_staff_pick: row.deal_score >= 65 && row.deal_score < 80,
    is_featured: row.deal_score >= 70,
  };
}

export default function Home() {
  const [deals, setDeals] = useState<NormalizedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DealsTab>("today");
  const [activeCategory, setActiveCategory] = useState<DealCategory>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchDeals = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("deals")
        .select(
          `id, deal_score, created_at,
           product:products!inner(id, name, brand, category, original_price, sale_price, weight_value, weight_unit),
           dispensary:dispensaries!inner(id, name)`
        )
        .eq("qualified", true)
        .order("deal_score", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        setDeals((data as unknown as DealRow[]).map(normalizeDeal));
      }
    } catch {
      // DB not available
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  // Filter deals
  const visibleDeals = deals.filter((d) => {
    if (dismissedIds.has(d.id)) return false;
    if (activeCategory !== "all" && d.category !== activeCategory) return false;
    return true;
  });

  const topPick = visibleDeals.find((d) => d.is_top_pick);
  const staffPicks = visibleDeals.filter((d) => d.is_staff_pick);
  const gridDeals = visibleDeals.filter(
    (d) => d.id !== topPick?.id && !staffPicks.some((sp) => sp.id === d.id)
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-purple-500/10">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">
            Clouded<span className="text-purple-400">Deals</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Las Vegas</span>
            <span className="h-3 w-px bg-slate-800" />
            <span>{deals.length} deals</span>
          </div>
        </div>
      </header>

      {/* Sticky stats / category bar */}
      <StickyStatsBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      {/* Main content */}
      <main className="relative max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[140px] animate-pulse rounded-xl glass"
              />
            ))}
          </div>
        ) : visibleDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">
              No deals yet
            </h2>
            <p className="text-sm text-slate-500 max-w-sm">
              {!isSupabaseConfigured
                ? "Database not connected. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to see live deals."
                : "Deals will appear here once the scraper runs. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Pick */}
            {topPick && (
              <section>
                <CompactTopPick
                  deal={topPick}
                  isSaved={savedIds.has(topPick.id)}
                  onSave={() => toggleSave(topPick.id)}
                  onDismiss={() => dismiss(topPick.id)}
                  onClick={() => {}}
                />
              </section>
            )}

            {/* Staff Picks */}
            {staffPicks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-300">
                    Staff Picks
                  </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {staffPicks.map((deal) => (
                    <StaffPickMiniCard
                      key={deal.id}
                      deal={deal}
                      isSaved={savedIds.has(deal.id)}
                      onSave={() => toggleSave(deal.id)}
                      onClick={() => {}}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Deal Grid */}
            {gridDeals.length > 0 && (
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gridDeals.map((deal) => (
                    <CompactDealCard
                      key={deal.id}
                      deal={deal}
                      isSaved={savedIds.has(deal.id)}
                      isAppearing
                      onSave={() => toggleSave(deal.id)}
                      onDismiss={() => dismiss(deal.id)}
                      onClick={() => {}}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
