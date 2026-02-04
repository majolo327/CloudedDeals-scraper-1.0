"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dispensary, Platform } from "@/lib/types";

const PLATFORMS: Platform[] = ["dutchie", "curaleaf", "jane"];

export default function SettingsPage() {
  const [dispensaries, setDispensaries] = useState<Dispensary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // ----- Threshold state -----
  const [minDiscount, setMinDiscount] = useState(20);
  const [priceMin, setPriceMin] = useState(5);
  const [priceMax, setPriceMax] = useState(100);

  // ----- Twitter state -----
  const [twitterHandle, setTwitterHandle] = useState("");
  const [autoPost, setAutoPost] = useState(false);
  const [minScoreToPost, setMinScoreToPost] = useState(60);

  // ----- Fetch dispensaries -----
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dispensaries")
        .select("id, name, url, platform, address, city, state, is_active")
        .order("platform")
        .order("name");
      if (data) setDispensaries(data as Dispensary[]);
      setLoading(false);
    })();
  }, []);

  // ----- Toggle dispensary active state -----
  async function toggleDispensary(id: string, currentActive: boolean) {
    setSaving(id);
    const { error } = await supabase
      .from("dispensaries")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (!error) {
      setDispensaries((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, is_active: !currentActive } : d
        )
      );
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ---- Dispensary management ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Dispensary Management
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            Enable or disable individual dispensaries from the scrape cycle.
          </p>
        </div>

        {PLATFORMS.map((platform) => {
          const sites = dispensaries.filter((d) => d.platform === platform);
          if (sites.length === 0) return null;
          return (
            <div key={platform} className="border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {platform} ({sites.length})
              </h4>
              <div className="space-y-1">
                {sites.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${d.is_active ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {d.name}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleDispensary(d.id, d.is_active)}
                      disabled={saving === d.id}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        d.is_active
                          ? "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          : "border border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                      } disabled:opacity-50`}
                    >
                      {saving === d.id
                        ? "..."
                        : d.is_active
                          ? "Disable"
                          : "Enable"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* ---- Threshold configuration ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Deal Thresholds
        </h3>
        <p className="mb-4 mt-0.5 text-xs text-zinc-400">
          Configure the minimum criteria for qualifying deals.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              Min Discount: {minDiscount}%
            </span>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={minDiscount}
              onChange={(e) => setMinDiscount(Number(e.target.value))}
              className="accent-green-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              Price Min: ${priceMin}
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={priceMin}
              onChange={(e) => setPriceMin(Number(e.target.value))}
              className="accent-green-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              Price Max: ${priceMax}
            </span>
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="accent-green-600"
            />
          </label>
        </div>
      </section>

      {/* ---- Twitter / social settings ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Twitter / X Settings
        </h3>
        <p className="mb-4 mt-0.5 text-xs text-zinc-400">
          Configure automated deal posting to Twitter/X.
        </p>

        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              Twitter Handle
            </span>
            <input
              type="text"
              placeholder="@CloudedDeals"
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              className="h-9 w-60 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="rounded accent-green-600"
            />
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              Auto-post deals above score threshold
            </span>
          </label>

          {autoPost && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                Min Score to Post: {minScoreToPost}
              </span>
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={minScoreToPost}
                onChange={(e) => setMinScoreToPost(Number(e.target.value))}
                className="w-48 accent-green-600"
              />
            </label>
          )}
        </div>
      </section>
    </div>
  );
}
