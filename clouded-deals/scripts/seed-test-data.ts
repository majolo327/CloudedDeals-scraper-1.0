/**
 * Seed script — inserts 3 dispensaries, 10 products, and 10 deals
 * into a local or remote Supabase instance for testing.
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const dispensaries = [
  {
    name: "The Dispensary (Henderson)",
    slug: "the-dispensary-henderson",
    url: "https://thedispensarynv.com",
    platform: "dutchie",
    address: "50 N Gibson Rd",
    city: "Henderson",
    state: "NV",
    is_active: true,
  },
  {
    name: "Curaleaf Las Vegas",
    slug: "curaleaf-las-vegas",
    url: "https://curaleaf.com/shop/nevada/curaleaf-las-vegas",
    platform: "curaleaf",
    address: "1736 Las Vegas Blvd S",
    city: "Las Vegas",
    state: "NV",
    is_active: true,
  },
];

const categories = ["flower", "preroll", "vape", "edible", "concentrate"] as const;
const brands = ["STIIIZY", "Cookies", "Old Pal", "CAMP", "Select", "Wana", "Wyld", "Kiva", "RAD", "Deep Roots"];

function randomPrice(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function seed() {
  console.log("Seeding dispensaries...");
  const { data: insertedDisps, error: dispError } = await supabase
    .from("dispensaries")
    .upsert(dispensaries, { onConflict: "slug" })
    .select("id, slug");

  if (dispError) {
    console.error("Failed to seed dispensaries:", dispError.message);
    process.exit(1);
  }

  const dispMap = new Map(insertedDisps!.map((d: { id: string; slug: string }) => [d.slug, d.id]));
  console.log(`  Inserted/updated ${insertedDisps!.length} dispensaries`);

  console.log("Seeding products...");
  const products = Array.from({ length: 10 }, (_, i) => {
    const category = categories[i % categories.length];
    const brand = brands[i];
    const originalPrice = randomPrice(20, 80);
    const discountPct = Math.floor(Math.random() * 40 + 15);
    const salePrice = Math.round(originalPrice * (1 - discountPct / 100) * 100) / 100;
    const dispSlugs = [...dispMap.keys()];
    const dispSlug = dispSlugs[i % dispSlugs.length];

    return {
      dispensary_id: dispMap.get(dispSlug),
      name: `${brand} ${category.charAt(0).toUpperCase() + category.slice(1)} #${i + 1}`,
      brand,
      category,
      original_price: originalPrice,
      sale_price: salePrice,
      discount_percent: discountPct,
      weight: category === "edible" ? "100mg" : "3.5g",
      thc_percent: Math.round(Math.random() * 25 + 10),
      url: `https://example.com/product-${i + 1}`,
      image_url: null,
      scraped_at: new Date().toISOString(),
    };
  });

  const { data: insertedProducts, error: prodError } = await supabase
    .from("products")
    .upsert(products, { onConflict: "dispensary_id,name,scraped_at" })
    .select("id, dispensary_id, name, sale_price, discount_percent, category, brand");

  if (prodError) {
    console.error("Failed to seed products:", prodError.message);
    process.exit(1);
  }

  console.log(`  Inserted/updated ${insertedProducts!.length} products`);

  console.log("Seeding deals...");
  const deals = insertedProducts!.map((p: {
    id: string;
    dispensary_id: string;
    discount_percent: number;
    brand: string;
    category: string;
    sale_price: number;
  }) => {
    const discountScore = Math.min((p.discount_percent / 50) * 40, 40);
    const brandBonus = brands.slice(0, 5).includes(p.brand) ? 20 : 0;
    const categoryBonus = ["flower", "vape"].includes(p.category) ? 10 : 0;
    const dealScore = Math.round(discountScore + brandBonus + categoryBonus);

    return {
      product_id: p.id,
      dispensary_id: p.dispensary_id,
      deal_score: dealScore,
      qualified: true,
      tweeted: false,
      detected_at: new Date().toISOString(),
    };
  });

  const { error: dealError } = await supabase.from("deals").upsert(deals, {
    onConflict: "product_id",
  });

  if (dealError) {
    console.error("Failed to seed deals:", dealError.message);
    process.exit(1);
  }

  console.log(`  Inserted/updated ${deals.length} deals`);
  console.log("Seeding complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
