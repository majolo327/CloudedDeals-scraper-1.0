/**
 * Formats a qualified deal into a 280-character tweet.
 *
 * Template (auto-post example):
 *   🔥 STIIIZY Pod 1g
 *   💰 $45 → $27 (40% OFF)
 *   🏪 Curaleaf - Western Ave
 *
 *   More deals at cloudeddeals.com
 *   #LasVegasDeals #Cannabis #STIIIZY
 */

import { Deal, CATEGORY_LABELS, Category } from "./types";
import { AutoPostCandidate } from "./auto-post-selector";

const MAX_TWEET_LENGTH = 280;

const CATEGORY_HASHTAGS: Record<string, string> = {
  flower: "#Flower",
  preroll: "#PreRolls",
  vape: "#Vape",
  edible: "#Edibles",
  concentrate: "#Concentrates",
};

const BASE_HASHTAGS = ["#LasVegasDeals", "#Cannabis"];

const SITE_CTA = "More deals at cloudeddeals.com";

export function formatDealTweet(deal: Deal): string {
  const product = deal.product;
  const dispensary = deal.dispensary;

  if (!product) return "";

  // ---- Line 1: product name (truncated if needed) ----
  const name = product.name;

  // ---- Line 2: prices ----
  const salePart = product.sale_price !== null ? `$${product.sale_price}` : "";
  const originalPart =
    product.original_price !== null && product.original_price !== product.sale_price
      ? `$${product.original_price} → `
      : "";
  const discountPart =
    product.discount_percent !== null
      ? ` (${Math.round(product.discount_percent)}% OFF)`
      : "";
  const priceLine = `${originalPart}${salePart}${discountPart}`;

  // ---- Line 3: dispensary ----
  const dispensaryLine = dispensary?.name ?? "";

  // ---- Hashtags ----
  const tags = [...BASE_HASHTAGS];

  if (product.category && CATEGORY_HASHTAGS[product.category]) {
    tags.push(CATEGORY_HASHTAGS[product.category]);
  }
  if (product.brand) {
    // Convert brand to a hashtag-safe string.
    const brandTag = `#${product.brand.replace(/[^a-zA-Z0-9]/g, "")}`;
    if (!tags.includes(brandTag)) tags.push(brandTag);
  }

  const hashtagLine = tags.join(" ");

  // ---- Assemble ----
  const lines = [
    `🔥 ${name}`,
    `💰 ${priceLine}`,
    dispensaryLine ? `🏪 ${dispensaryLine}` : "",
    "",
    SITE_CTA,
    hashtagLine,
  ].filter((line, i) => line !== "" || i === 3); // Keep the blank spacer line

  let tweet = lines.join("\n");

  // ---- Truncate if needed ----
  if (tweet.length > MAX_TWEET_LENGTH) {
    // Shorten product name first.
    const overhead = tweet.length - MAX_TWEET_LENGTH;
    const shortenedName = name.slice(0, Math.max(name.length - overhead - 3, 10)) + "...";
    lines[0] = `🔥 ${shortenedName}`;
    tweet = lines.join("\n");
  }

  // Final safety trim.
  if (tweet.length > MAX_TWEET_LENGTH) {
    tweet = tweet.slice(0, MAX_TWEET_LENGTH - 1) + "…";
  }

  return tweet;
}

/**
 * Format a tweet from an AutoPostCandidate (used by auto-post route).
 * Same template as formatDealTweet but works with the flat candidate shape.
 */
export function formatCandidateTweet(candidate: AutoPostCandidate): string {
  const name = candidate.product_name;

  // Price line
  const salePart =
    candidate.sale_price !== null ? `$${candidate.sale_price}` : "";
  const originalPart =
    candidate.original_price !== null &&
    candidate.original_price !== candidate.sale_price
      ? `$${candidate.original_price} → `
      : "";
  const discountPart =
    candidate.discount_percent !== null
      ? ` (${Math.round(candidate.discount_percent)}% OFF)`
      : "";
  const priceLine = `${originalPart}${salePart}${discountPart}`;

  // Hashtags
  const tags = [...BASE_HASHTAGS];
  if (candidate.category && CATEGORY_HASHTAGS[candidate.category]) {
    tags.push(CATEGORY_HASHTAGS[candidate.category]);
  }
  if (candidate.brand) {
    const brandTag = `#${candidate.brand.replace(/[^a-zA-Z0-9]/g, "")}`;
    if (!tags.includes(brandTag)) tags.push(brandTag);
  }
  const hashtagLine = tags.join(" ");

  const lines = [
    `🔥 ${name}`,
    `💰 ${priceLine}`,
    candidate.dispensary_name ? `🏪 ${candidate.dispensary_name}` : "",
    "",
    SITE_CTA,
    hashtagLine,
  ].filter((line, i) => line !== "" || i === 3);

  let tweet = lines.join("\n");

  if (tweet.length > MAX_TWEET_LENGTH) {
    const overhead = tweet.length - MAX_TWEET_LENGTH;
    const shortenedName =
      name.slice(0, Math.max(name.length - overhead - 3, 10)) + "...";
    lines[0] = `🔥 ${shortenedName}`;
    tweet = lines.join("\n");
  }

  if (tweet.length > MAX_TWEET_LENGTH) {
    tweet = tweet.slice(0, MAX_TWEET_LENGTH - 1) + "…";
  }

  return tweet;
}

export function formatDealPreview(deal: Deal): string {
  const product = deal.product;
  if (!product) return "(no product data)";

  const parts: string[] = [product.name];

  if (product.sale_price !== null) {
    parts.push(`$${product.sale_price}`);
  }
  if (product.discount_percent !== null) {
    parts.push(`${Math.round(product.discount_percent)}% off`);
  }
  if (product.category) {
    parts.push(CATEGORY_LABELS[product.category as Category] ?? product.category);
  }

  return parts.join(" · ");
}
