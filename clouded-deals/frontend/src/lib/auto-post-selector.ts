/**
 * Auto-post deal selection logic.
 *
 * Picks 1-8 deals per day for @CloudedDeals Twitter with diversity rules:
 *  - Southern NV region only (beta market)
 *  - Target categories: 1g disposable vapes, 3.5g/7g flower,
 *    100mg+ edibles, 1g live resin/rosin/badder concentrates,
 *    single/2-pack prerolls
 *  - Price cap: $35
 *  - No brand repeats within the same day
 *  - No brand+dispensary combo repeats within the same day
 *  - Minimum deal score: 50
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface AutoPostCandidate {
  deal_id: string;
  product_id: string;
  dispensary_id: string;
  deal_score: number;
  product_name: string;
  brand: string | null;
  category: string | null;
  sale_price: number | null;
  original_price: number | null;
  discount_percent: number | null;
  weight_value: number | null;
  weight_unit: string | null;
  product_subtype: string | null;
  product_url: string | null;
  dispensary_name: string;
}

export interface SelectionRules {
  maxPerDay: number;
  minScore: number;
  maxPrice: number;
  region: string;
}

const DEFAULT_RULES: SelectionRules = {
  maxPerDay: 8,
  minScore: 50,
  maxPrice: 35,
  region: "southern-nv",
};

/**
 * Check if a product matches our target categories:
 * - Vape: 1g disposable
 * - Flower: 3.5g or 7g
 * - Edible: 100mg+ multi-dose (gummies, chocolates, etc.)
 * - Concentrate: 1g live resin/rosin/badder
 * - Preroll: single or 2-pack (no large multi-packs)
 */
function matchesTargetCategory(candidate: AutoPostCandidate): boolean {
  const { category, weight_value, weight_unit, product_subtype, product_name } =
    candidate;

  const nameLC = (product_name ?? "").toLowerCase();
  const subtypeLC = (product_subtype ?? "").toLowerCase();
  const unit = (weight_unit ?? "").toLowerCase();
  const weight = weight_value ?? 0;

  if (category === "vape") {
    // 1g disposable vapes
    const isDisposable =
      subtypeLC.includes("disposable") ||
      nameLC.includes("disposable") ||
      nameLC.includes("dispo") ||
      nameLC.includes("all-in-one") ||
      nameLC.includes("aio");

    const is1g =
      (unit === "g" && weight >= 0.9 && weight <= 1.1) ||
      nameLC.includes("1g") ||
      nameLC.includes("1 g");

    return isDisposable && is1g;
  }

  if (category === "flower") {
    // 3.5g (eighth) or 7g (quarter)
    if (unit === "g" || unit === "oz") {
      const isEighth =
        (weight >= 3.4 && weight <= 3.6) ||
        nameLC.includes("3.5g") ||
        nameLC.includes("3.5 g") ||
        nameLC.includes("eighth") ||
        nameLC.includes("1/8");
      const isQuarter =
        (weight >= 6.9 && weight <= 7.1) ||
        nameLC.includes("7g") ||
        nameLC.includes("7 g") ||
        nameLC.includes("quarter") ||
        nameLC.includes("1/4");

      return isEighth || isQuarter;
    }

    // Fallback: check name for weight indicators
    return (
      nameLC.includes("3.5g") ||
      nameLC.includes("3.5 g") ||
      nameLC.includes("7g") ||
      nameLC.includes("7 g") ||
      nameLC.includes("eighth") ||
      nameLC.includes("quarter")
    );
  }

  if (category === "edible") {
    // 100mg+ multi-dose edibles (gummies, chocolates, etc.)
    if (unit === "mg" && weight >= 100) return true;
    // Weight sometimes stored as grams for edibles — 100mg = 0.1g won't match,
    // but some scrapers store the mg value in weight_value with unit "mg"
    // Fallback: check product name
    return (
      nameLC.includes("100mg") ||
      nameLC.includes("200mg") ||
      nameLC.includes("250mg") ||
      nameLC.includes("300mg") ||
      nameLC.includes("500mg")
    );
  }

  if (category === "concentrate") {
    // 1g live resin, live rosin, or badder only (premium concentrates)
    const isLive =
      subtypeLC.includes("live") ||
      subtypeLC.includes("rosin") ||
      subtypeLC.includes("badder") ||
      nameLC.includes("live resin") ||
      nameLC.includes("live rosin") ||
      nameLC.includes("badder");

    const is1g =
      (unit === "g" && weight >= 0.9 && weight <= 1.1) ||
      nameLC.includes("1g") ||
      nameLC.includes("1 g");

    return isLive && is1g;
  }

  if (category === "preroll") {
    // Single prerolls and 2-packs; exclude large multi-packs (5+)
    const packMatch = nameLC.match(/(\d+)\s*(?:pk|pack|ct|count)/i);
    const packSize = packMatch ? parseInt(packMatch[1], 10) : 1;
    return packSize <= 2;
  }

  return false;
}

/**
 * Fetch deals already posted today to enforce daily limits and diversity.
 */
async function getTodaysPostedDeals(
  supabase: SupabaseClient
): Promise<{ brands: Set<string>; combos: Set<string>; count: number }> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("deals")
    .select(
      `
      id,
      dispensary_id,
      product:products(brand)
    `
    )
    .eq("is_posted", true)
    .gte("posted_at", todayStart.toISOString());

  const brands = new Set<string>();
  const combos = new Set<string>();

  if (data) {
    for (const deal of data) {
      const brand = (deal as unknown as { product?: { brand?: string } }).product?.brand;
      if (brand) {
        const brandKey = brand.toLowerCase().trim();
        brands.add(brandKey);
        combos.add(`${brandKey}::${deal.dispensary_id}`);
      }
    }
  }

  return { brands, combos, count: data?.length ?? 0 };
}

/**
 * Select the best deal candidates for auto-posting.
 *
 * Returns an ordered array of deals to post (best first), respecting
 * all diversity and category rules.
 */
export async function selectDealsToPost(
  supabase: SupabaseClient,
  rulesOverride?: Partial<SelectionRules>
): Promise<AutoPostCandidate[]> {
  const rules = { ...DEFAULT_RULES, ...rulesOverride };

  // Check what's already been posted today
  const today = await getTodaysPostedDeals(supabase);
  const slotsRemaining = rules.maxPerDay - today.count;

  if (slotsRemaining <= 0) {
    return [];
  }

  // Fetch eligible deals: region match, not already posted, above score, under price
  const { data: rawDeals, error } = await supabase
    .from("deals")
    .select(
      `
      id,
      product_id,
      dispensary_id,
      deal_score,
      product:products(
        name, brand, category, sale_price, original_price,
        discount_percent, weight_value, weight_unit,
        product_subtype, product_url
      ),
      dispensary:dispensaries(name, region)
    `
    )
    .eq("is_posted", false)
    .gte("deal_score", rules.minScore)
    .order("deal_score", { ascending: false })
    .limit(200);

  if (error || !rawDeals) {
    console.error("[auto-post] Failed to fetch deals:", error?.message);
    return [];
  }

  // Map to flat candidates and apply filters
  const candidates: AutoPostCandidate[] = [];

  for (const raw of rawDeals) {
    const product = (raw as unknown as { product: {
      name: string;
      brand: string | null;
      category: string | null;
      sale_price: number | null;
      original_price: number | null;
      discount_percent: number | null;
      weight_value: number | null;
      weight_unit: string | null;
      product_subtype: string | null;
      product_url: string | null;
    } | null }).product;
    const dispensary = (raw as unknown as { dispensary: { name: string; region: string } | null }).dispensary;

    if (!product || !dispensary) continue;

    // Region filter
    if (dispensary.region !== rules.region) continue;

    // Price filter
    const price = product.sale_price ?? product.original_price;
    if (!price || price > rules.maxPrice) continue;

    candidates.push({
      deal_id: raw.id,
      product_id: raw.product_id,
      dispensary_id: raw.dispensary_id,
      deal_score: raw.deal_score,
      product_name: product.name,
      brand: product.brand,
      category: product.category,
      sale_price: product.sale_price,
      original_price: product.original_price,
      discount_percent: product.discount_percent,
      weight_value: product.weight_value,
      weight_unit: product.weight_unit,
      product_subtype: product.product_subtype,
      product_url: product.product_url,
      dispensary_name: dispensary.name,
    });
  }

  // Filter to target categories only
  const targetDeals = candidates.filter(matchesTargetCategory);

  // Select with diversity enforcement
  const selected: AutoPostCandidate[] = [];
  const usedBrands = new Set(today.brands);
  const usedCombos = new Set(today.combos);

  // Separate into category buckets for balanced selection
  const vapeCandidates = targetDeals.filter((d) => d.category === "vape");
  const flowerCandidates = targetDeals.filter((d) => d.category === "flower");
  const edibleCandidates = targetDeals.filter((d) => d.category === "edible");
  const concentrateCandidates = targetDeals.filter((d) => d.category === "concentrate");
  const prerollCandidates = targetDeals.filter((d) => d.category === "preroll");

  // Try to get a mix: alternate picking from each category
  const buckets = [
    vapeCandidates, flowerCandidates, edibleCandidates,
    concentrateCandidates, prerollCandidates,
  ].filter((b) => b.length > 0);
  let bucketIdx = 0;

  while (selected.length < slotsRemaining) {
    let picked = false;

    // Try each bucket starting from current index
    for (let attempts = 0; attempts < buckets.length; attempts++) {
      const bucket = buckets[(bucketIdx + attempts) % buckets.length];

      for (let i = 0; i < bucket.length; i++) {
        const deal = bucket[i];
        const brandKey = (deal.brand ?? "unknown").toLowerCase().trim();
        const comboKey = `${brandKey}::${deal.dispensary_id}`;

        // Enforce no brand repeats and no brand+dispo combo repeats
        if (usedBrands.has(brandKey)) continue;
        if (usedCombos.has(comboKey)) continue;

        selected.push(deal);
        usedBrands.add(brandKey);
        usedCombos.add(comboKey);
        bucket.splice(i, 1); // Remove from pool
        picked = true;
        break;
      }

      if (picked) break;
    }

    if (!picked) break; // No more eligible deals
    bucketIdx = (bucketIdx + 1) % buckets.length;
  }

  return selected;
}
