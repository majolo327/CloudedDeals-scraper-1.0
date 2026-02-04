"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Category,
  CATEGORY_LABELS,
  DealFilters,
  DEFAULT_FILTERS,
  Dispensary,
} from "@/lib/types";

interface FilterBarProps {
  filters: DealFilters;
  onChange: (filters: DealFilters) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [dispensaries, setDispensaries] = useState<Dispensary[]>([]);

  // Fetch dispensary list once for the dropdown.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dispensaries")
        .select("id, name, url, platform, address, city, state, is_active")
        .eq("is_active", true)
        .order("name");
      if (data) setDispensaries(data as Dispensary[]);
    })();
  }, []);

  function update(patch: Partial<DealFilters>) {
    onChange({ ...filters, ...patch });
  }

  function reset() {
    onChange(DEFAULT_FILTERS);
  }

  const categories: (Category | "all")[] = [
    "all",
    "flower",
    "preroll",
    "vape",
    "edible",
    "concentrate",
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-end gap-4">
        {/* Category dropdown */}
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Category
          <select
            value={filters.category}
            onChange={(e) =>
              update({ category: e.target.value as Category | "all" })
            }
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </label>

        {/* Dispensary dropdown */}
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Dispensary
          <select
            value={filters.dispensary_id}
            onChange={(e) => update({ dispensary_id: e.target.value })}
            className="h-9 max-w-[220px] truncate rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="all">All Dispensaries</option>
            {dispensaries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {/* Price range slider */}
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span>
            Price: ${filters.min_price} – ${filters.max_price}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.min_price}
              onChange={(e) =>
                update({
                  min_price: Math.min(Number(e.target.value), filters.max_price),
                })
              }
              className="h-1.5 w-20 cursor-pointer accent-green-600"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.max_price}
              onChange={(e) =>
                update({
                  max_price: Math.max(Number(e.target.value), filters.min_price),
                })
              }
              className="h-1.5 w-20 cursor-pointer accent-green-600"
            />
          </div>
        </label>

        {/* Minimum discount slider */}
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span>Min Discount: {filters.min_discount}%</span>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={filters.min_discount}
            onChange={(e) => update({ min_discount: Number(e.target.value) })}
            className="h-1.5 w-32 cursor-pointer accent-green-600"
          />
        </label>

        {/* Reset */}
        <button
          type="button"
          onClick={reset}
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
