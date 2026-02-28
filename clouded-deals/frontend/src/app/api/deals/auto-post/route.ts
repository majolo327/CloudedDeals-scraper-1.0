import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { postTweet, validateTwitterCredentials } from "@/lib/twitter";
import { formatCandidateTweet } from "@/lib/tweet-formatter";
import { selectDealsToPost } from "@/lib/auto-post-selector";

/**
 * POST /api/deals/auto-post
 *
 * Called by a scheduled cron (GitHub Actions). Each invocation selects and
 * posts ONE deal to @CloudedDeals. The cron runs up to 4 times/day, spaced
 * out so we tweet 1-4 deals across the day.
 *
 * The selection logic in auto-post-selector.ts enforces:
 *  - Southern NV region only
 *  - 1g disposable vapes, 3.5g/7g flower, 100mg+ edibles,
 *    1g live resin/rosin concentrates, single/2-pack prerolls
 *  - No brand repeats within the same day
 *  - No brand+dispensary combo repeats
 *  - Max 8 posts per day
 *
 * Body (optional): { dry_run?: boolean }
 */
export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pre-validate Twitter credentials before doing any work
  const credCheck = validateTwitterCredentials();
  if (!credCheck.valid) {
    console.error(
      `[auto-post] Missing Twitter credentials: ${credCheck.missing.join(", ")}`
    );
    return NextResponse.json(
      { error: "Twitter credentials not configured", missing: credCheck.missing },
      { status: 503 }
    );
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
  } catch {
    // No body is fine — default to live mode
  }

  const supabase = createServiceClient();

  // Select the best deal to post right now
  const candidates = await selectDealsToPost(supabase, {
    maxPerDay: 8,
    minScore: 50,
    maxPrice: 35,
    region: "southern-nv",
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      success: true,
      posted: false,
      reason: "No eligible deals found or daily limit reached",
    });
  }

  // Post the top candidate (first one returned)
  const deal = candidates[0];
  const tweetText = formatCandidateTweet(deal);

  if (!tweetText) {
    return NextResponse.json(
      { error: "Could not format tweet" },
      { status: 422 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      success: true,
      posted: false,
      dry_run: true,
      would_post: {
        deal_id: deal.deal_id,
        product: deal.product_name,
        brand: deal.brand,
        category: deal.category,
        dispensary: deal.dispensary_name,
        price: deal.sale_price,
        score: deal.deal_score,
        tweet_text: tweetText,
        tweet_length: tweetText.length,
      },
      remaining_candidates: candidates.slice(1).map((c) => ({
        deal_id: c.deal_id,
        product: c.product_name,
        brand: c.brand,
        category: c.category,
        price: c.sale_price,
      })),
    });
  }

  // Post to Twitter
  const result = await postTweet(tweetText);

  if (!result.success) {
    console.error("[auto-post] Tweet failed:", result.error);
    return NextResponse.json(
      { error: "Tweet failed", details: result.error },
      { status: 502 }
    );
  }

  // Mark deal as posted
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      is_posted: true,
      posted_at: new Date().toISOString(),
      tweet_id: result.tweet_id,
    })
    .eq("id", deal.deal_id);

  if (updateError) {
    console.error(
      `[auto-post] Tweet sent but DB update failed: ${updateError.message}`
    );
  }

  return NextResponse.json({
    success: true,
    posted: true,
    tweet_id: result.tweet_id,
    deal: {
      deal_id: deal.deal_id,
      product_id: deal.product_id,
      product: deal.product_name,
      brand: deal.brand,
      category: deal.category,
      dispensary: deal.dispensary_name,
      price: deal.sale_price,
      score: deal.deal_score,
    },
    tweet_text: tweetText,
  });
}
