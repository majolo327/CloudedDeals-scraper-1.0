"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
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
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------
  // Fetch a page of deals
  // -----------------------------------------------------------------------
  const fetchDeals = useCallback(
    async (pageNum: number, replace = false) => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
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

        const { data, error: fetchError } = await query;

        if (fetchError) {
          console.error("Error fetching deals:", fetchError);
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        const fetched = (data ?? []) as Deal[];
        setDeals((prev) => (replace ? fetched : [...prev, ...fetched]));
        setHasMore(fetched.length === PAGE_SIZE);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching deals:", err);
        setError(err instanceof Error ? err.message : "Failed to load deals");
        setLoading(false);
      }
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
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("deals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals" },
        async (payload) => {
          try {
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
          } catch {
            // Silently ignore realtime fetch errors
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

  // Not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        </div>
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">
          Database not connected
        </p>
        <p className="mt-1 max-w-sm text-sm text-zinc-400 dark:text-zinc-500">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables and redeploy.
        </p>
      </div>
    );
  }

  // Error state
  if (error && deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-red-500">Something went wrong</p>
        <p className="mt-1 max-w-sm text-sm text-zinc-400 dark:text-zinc-500">{error}</p>
        <button
          onClick={() => fetchDeals(0, true)}
          className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (!loading && deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">
          No deals yet
        </p>
        <p className="mt-1 max-w-sm text-sm text-zinc-400 dark:text-zinc-500">
          Deals will appear here once the scraper has run. Check back soon or trigger a scrape from the admin dashboard.
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

      {hasMore && !loading && (
        <div ref={loaderRef} className="h-10" aria-hidden="true" />
      )}
    </div>
  );
}
