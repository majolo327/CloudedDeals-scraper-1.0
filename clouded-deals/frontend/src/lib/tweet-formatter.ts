/**
 * Formats a qualified deal into a 280-character tweet.
 *
 * Template (auto-post example):
 *   🔥 STIIIZY Pod 1g
 *   💰 $45 → $27 (40% OFF)
 *   🏪 Curaleaf - Western Ave
 *
 *   https://cloudeddeals.com/deal/{product_id}
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

const SITE_URL = "https://cloudeddeals.com";

// Twitter wraps every URL to 23 characters via t.co, regardless of raw length.
const TCO_URL_LENGTH = 23;
const URL_REGEX = /https?:\/\/\S+/g;

/** Count characters the way Twitter does (URLs = 23 chars each via t.co). */
function twitterCharCount(text: string): number {
  return text.replace(URL_REGEX, "x".repeat(TCO_URL_LENGTH)).length;
}

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

  // ---- Deal-specific link (enables Twitter Card preview) ----
  const dealUrl = deal.product_id
    ? `${SITE_URL}/deal/${deal.product_id}`
    : SITE_URL;

  // ---- Assemble ----
  const lines = [
    `🔥 ${name}`,
    `💰 ${priceLine}`,
    dispensaryLine ? `🏪 ${dispensaryLine}` : "",
    "",
    dealUrl,
    hashtagLine,
  ].filter((line, i) => line !== "" || i === 3); // Keep the blank spacer line

  let tweet = lines.join("\n");

  // ---- Truncate if needed (t.co-aware) ----
  if (twitterCharCount(tweet) > MAX_TWEET_LENGTH) {
    const overhead = twitterCharCount(tweet) - MAX_TWEET_LENGTH;
    const shortenedName = name.slice(0, Math.max(name.length - overhead - 3, 10)) + "...";
    lines[0] = `🔥 ${shortenedName}`;
    tweet = lines.join("\n");
  }

  // Final safety trim.
  if (twitterCharCount(tweet) > MAX_TWEET_LENGTH) {
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

  // Deal-specific link (enables Twitter Card preview)
  const dealUrl = candidate.product_id
    ? `${SITE_URL}/deal/${candidate.product_id}`
    : SITE_URL;

  const lines = [
    `🔥 ${name}`,
    `💰 ${priceLine}`,
    candidate.dispensary_name ? `🏪 ${candidate.dispensary_name}` : "",
    "",
    dealUrl,
    hashtagLine,
  ].filter((line, i) => line !== "" || i === 3);

  let tweet = lines.join("\n");

  if (twitterCharCount(tweet) > MAX_TWEET_LENGTH) {
    const overhead = twitterCharCount(tweet) - MAX_TWEET_LENGTH;
    const shortenedName =
      name.slice(0, Math.max(name.length - overhead - 3, 10)) + "...";
    lines[0] = `🔥 ${shortenedName}`;
    tweet = lines.join("\n");
  }

  if (twitterCharCount(tweet) > MAX_TWEET_LENGTH) {
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
