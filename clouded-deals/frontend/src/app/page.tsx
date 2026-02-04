"use client";

import { useState } from "react";
import DealFeed from "@/components/DealFeed";
import FilterBar from "@/components/FilterBar";
import { DealFilters, DEFAULT_FILTERS } from "@/lib/types";

export default function Home() {
  const [filters, setFilters] = useState<DealFilters>(DEFAULT_FILTERS);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="border-b border-zinc-200 bg-gradient-to-br from-green-600 to-emerald-700 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:py-16">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            CloudedDeals
          </h1>
          <p className="mt-3 text-lg text-green-100 sm:text-xl">
            Real-time cannabis deals across Las Vegas dispensaries
          </p>
          <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2 text-sm text-green-200">
            <span className="rounded-full border border-green-400/30 px-3 py-0.5">
              27 Dispensaries
            </span>
            <span className="rounded-full border border-green-400/30 px-3 py-0.5">
              3 Platforms
            </span>
            <span className="rounded-full border border-green-400/30 px-3 py-0.5">
              Live Updates
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Filters */}
        <section className="mb-6">
          <FilterBar filters={filters} onChange={setFilters} />
        </section>

        {/* Deal feed */}
        <section>
          <DealFeed filters={filters} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        CloudedDeals &mdash; Scraped daily from public dispensary menus.
      </footer>
    </div>
  );
}
