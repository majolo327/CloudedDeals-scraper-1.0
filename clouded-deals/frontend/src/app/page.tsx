"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Heart } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AgeGate } from "@/components/AgeGate";
import { CompactDealCard } from "@/components/CompactDealCard";
import { CompactTopPick } from "@/components/CompactTopPick";
import { StaffPickMiniCard } from "@/components/StaffPickMiniCard";
import { StickyStatsBar } from "@/components/StickyStatsBar";
import { Footer } from "@/components/Footer";
import { LocationSelector } from "@/components/LocationSelector";
import { DealModal } from "@/components/DealModal";
import { DealCardSkeleton, TopPickSkeleton } from "@/components/Skeleton";
import { ToastContainer } from "@/components/Toast";
import type { ToastData } from "@/components/Toast";
import { useSavedDeals } from "@/hooks/useSavedDeals";
import { useStreak } from "@/hooks/useStreak";
import { useBrandAffinity } from "@/hooks/useBrandAffinity";

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
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [deals, setDeals] = useState<NormalizedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DealsTab>("today");
  const [activeCategory, setActiveCategory] = useState<DealCategory>("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedDeal, setSelectedDeal] = useState<NormalizedDeal | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const { savedDeals, toggleSavedDeal, markDealUsed, isDealUsed } = useSavedDeals();
  const { streak, isNewMilestone, clearMilestone } = useStreak();
  const { trackBrand } = useBrandAffinity();

  // Check age verification on mount
  useEffect(() => {
    const verified = localStorage.getItem("clouded_age_verified");
    if (verified === "true") {
      setIsAgeVerified(true);
    }
  }, []);

  // Show streak milestone toast
  useEffect(() => {
    if (isNewMilestone) {
      addToast(`${isNewMilestone}-day streak! Keep it up.`, "streak");
      clearMilestone();
    }
  }, [isNewMilestone, clearMilestone]);

  const handleAgeVerify = () => {
    localStorage.setItem("clouded_age_verified", "true");
    setIsAgeVerified(true);
  };

  const addToast = (message: string, type: ToastData["type"]) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

  const handleToggleSave = (deal: NormalizedDeal) => {
    const wasSaved = savedDeals.has(deal.id);
    toggleSavedDeal(deal.id);
    if (!wasSaved) {
      trackBrand(deal.brand.name);
      addToast("Deal saved!", "saved");
    } else {
      addToast("Removed from saved", "removed");
    }
  };

  const handleMarkUsed = (deal: NormalizedDeal) => {
    markDealUsed(deal.id);
    addToast("Marked as used", "success");
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

  // Show AgeGate if not verified
  if (!isAgeVerified) {
    return <AgeGate onVerify={handleAgeVerify} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-purple-500/10">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">
            Clouded<span className="text-purple-400">Deals</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <LocationSelector />
            <span className="h-3 w-px bg-slate-800" />
            {savedDeals.size > 0 && (
              <>
                <span className="flex items-center gap-1 text-purple-400">
                  <Heart className="w-3 h-3 fill-current" />
                  {savedDeals.size}
                </span>
                <span className="h-3 w-px bg-slate-800" />
              </>
            )}
            {streak > 1 && (
              <>
                <span className="text-orange-400">{streak}d streak</span>
                <span className="h-3 w-px bg-slate-800" />
              </>
            )}
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
            <TopPickSkeleton />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
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
                  isSaved={savedDeals.has(topPick.id)}
                  onSave={() => handleToggleSave(topPick)}
                  onDismiss={() => dismiss(topPick.id)}
                  onClick={() => setSelectedDeal(topPick)}
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
                      isSaved={savedDeals.has(deal.id)}
                      onSave={() => handleToggleSave(deal)}
                      onClick={() => setSelectedDeal(deal)}
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
                      isSaved={savedDeals.has(deal.id)}
                      isAppearing
                      onSave={() => handleToggleSave(deal)}
                      onDismiss={() => dismiss(deal.id)}
                      onClick={() => setSelectedDeal(deal)}
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

      {/* Deal Modal */}
      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          isSaved={savedDeals.has(selectedDeal.id)}
          onToggleSave={() => handleToggleSave(selectedDeal)}
          isUsed={isDealUsed(selectedDeal.id)}
          onMarkUsed={() => handleMarkUsed(selectedDeal)}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
