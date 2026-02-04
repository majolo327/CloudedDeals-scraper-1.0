"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Deal, DealFilters, DEFAULT_FILTERS } from "@/lib/types";
import DealCard from "./DealCard";

const PAGE_SIZE = 20;

interface DealFeedProps {
  filters?: DealFilters;
}

export default function DealFeed({ filters = DEFAULT_FILTERS }: DealFeedProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------
  // Fetch a page of deals
  // -----------------------------------------------------------------------
  const fetchDeals = useCallback(
    async (pageNum: number, replace = false) => {
      setLoading(true);

      let query = supabase
        .from("deals")
        .select(
          `
          *,
          product:products(*),
          dispensary:dispensaries(*)
        `
        )
        .order("deal_score", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      // Apply filters
      if (filters.category !== "all") {
        query = query.eq("product.category", filters.category);
      }
      if (filters.dispensary_id !== "all") {
        query = query.eq("dispensary_id", filters.dispensary_id);
      }
      if (filters.min_price > 0) {
        query = query.gte("product.sale_price", filters.min_price);
      }
      if (filters.max_price < 100) {
        query = query.lte("product.sale_price", filters.max_price);
      }
      if (filters.min_discount > 0) {
        query = query.gte("product.discount_percent", filters.min_discount);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching deals:", error);
        setLoading(false);
        return;
      }

      const fetched = (data ?? []) as Deal[];
      setDeals((prev) => (replace ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length === PAGE_SIZE);
      setLoading(false);
    },
    [filters]
  );

  // -----------------------------------------------------------------------
  // Reset on filter change
  // -----------------------------------------------------------------------
  useEffect(() => {
    setPage(0);
    setDeals([]);
    setHasMore(true);
    fetchDeals(0, true);
  }, [fetchDeals]);

  // -----------------------------------------------------------------------
  // Infinite scroll via IntersectionObserver
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchDeals(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    const el = loaderRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loading, page, fetchDeals]);

  // -----------------------------------------------------------------------
  // Real-time subscription — new deals appear at the top
  // -----------------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel("deals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals" },
        async (payload) => {
          // Fetch the full deal with joins.
          const { data } = await supabase
            .from("deals")
            .select(
              `
              *,
              product:products(*),
              dispensary:dispensaries(*)
            `
            )
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setDeals((prev) => [data as Deal, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (!loading && deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">
          No deals found
        </p>
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
          Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} variant="full" />
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      {hasMore && !loading && (
        <div ref={loaderRef} className="h-10" aria-hidden="true" />
      )}
    </div>
  );
}
