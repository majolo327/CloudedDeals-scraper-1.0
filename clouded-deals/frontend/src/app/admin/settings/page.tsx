"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Dispensary, Platform } from "@/lib/types";

const PLATFORMS: Platform[] = ["dutchie", "curaleaf", "jane"];

interface PostedDeal {
  id: string;
  deal_score: number;
  posted_at: string;
  tweet_id: string | null;
  product: { name: string; brand: string | null; category: string | null; sale_price: number | null } | null;
  dispensary: { name: string } | null;
}

export default function SettingsPage() {
  const [dispensaries, setDispensaries] = useState<Dispensary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // ----- Threshold state -----
  const [minDiscount, setMinDiscount] = useState(20);
  const [priceMin, setPriceMin] = useState(5);
  const [priceMax, setPriceMax] = useState(100);

  // ----- Twitter state -----
  const [twitterHandle, setTwitterHandle] = useState("@CloudedDeals");
  const [autoPost, setAutoPost] = useState(true);
  const [minScoreToPost, setMinScoreToPost] = useState(55);
  const [recentPosts, setRecentPosts] = useState<PostedDeal[]>([]);
  const [todayCount, setTodayCount] = useState(0);

  // ----- Fetch dispensaries + recent posted deals -----
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [dispResult, postsResult] = await Promise.all([
          supabase
            .from("dispensaries")
            .select("id, name, url, platform, address, city, state, is_active, region")
            .order("platform")
            .order("name"),
          supabase
            .from("deals")
            .select(`
              id, deal_score, posted_at, tweet_id,
              product:products(name, brand, category, sale_price),
              dispensary:dispensaries(name)
            `)
            .eq("is_posted", true)
            .order("posted_at", { ascending: false })
            .limit(10),
        ]);

        if (dispResult.data) setDispensaries(dispResult.data as Dispensary[]);
        if (postsResult.data) {
          setRecentPosts(postsResult.data as unknown as PostedDeal[]);
          // Count today's posts
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const todayPosts = postsResult.data.filter(
            (p: { posted_at?: string | null }) => p.posted_at && new Date(p.posted_at) >= todayStart
          );
          setTodayCount(todayPosts.length);
        }
      } catch {
        // DB not available
      }
      setLoading(false);
    })();
  }, []);

  // ----- Toggle dispensary active state -----
  async function toggleDispensary(id: string, currentActive: boolean) {
    if (!isSupabaseConfigured) return;
    setSaving(id);
    try {
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
    } catch {
      // DB not available
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

      {/* ---- Twitter / X Auto-Post Settings ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Twitter / X Auto-Post
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Automated deal posting to {twitterHandle || "@CloudedDeals"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${autoPost ? "bg-green-500 animate-pulse" : "bg-zinc-400"}`} />
              <span className="text-xs font-medium text-zinc-500">
                {autoPost ? "Active" : "Paused"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* Status bar */}
          <div className="flex items-center gap-4 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{todayCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">Today</div>
            </div>
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-700 dark:text-zinc-200">4</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">Max/Day</div>
            </div>
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{4 - todayCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">Remaining</div>
            </div>
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">
              Posts at 9am, 12pm, 3pm, 6pm PST
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                Twitter Handle
              </span>
              <input
                type="text"
                placeholder="@CloudedDeals"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

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
                className="w-full accent-green-600"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="rounded accent-green-600"
            />
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              Enable automated posting (via GitHub Actions cron)
            </span>
          </label>

          {/* Posting rules summary */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Posting Rules (Active)
            </h4>
            <ul className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <li>- 1-4 deals/day, spaced across 4 time slots</li>
              <li>- Southern NV dispensaries only (beta market)</li>
              <li>- Categories: 1g disposable vapes, 3.5g/7g flower</li>
              <li>- Price cap: under $30</li>
              <li>- No brand repeats per day</li>
              <li>- No brand + dispensary combo repeats per day</li>
              <li>- Min deal score: {minScoreToPost}</li>
            </ul>
          </div>

          {/* Recent posts log */}
          {recentPosts.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recent Posts
              </h4>
              <div className="space-y-1">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {post.product?.category ?? "?"}
                      </span>
                      <span className="truncate text-zinc-600 dark:text-zinc-300">
                        {post.product?.brand && `${post.product.brand} — `}
                        {post.product?.name ?? "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      {post.product?.sale_price && (
                        <span className="text-zinc-500">${post.product.sale_price}</span>
                      )}
                      <span className="text-zinc-400">
                        {post.posted_at
                          ? new Date(post.posted_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                      {post.tweet_id && (
                        <a
                          href={`https://x.com/CloudedDeals/status/${post.tweet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
