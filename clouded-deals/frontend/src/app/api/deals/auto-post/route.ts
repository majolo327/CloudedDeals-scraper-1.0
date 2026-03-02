import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  postTweet,
  validateTwitterCredentials,
  testTwitterConnection,
  diagnoseTwitter,
  TwitterError,
} from "@/lib/twitter";
import { formatCandidateTweet } from "@/lib/tweet-formatter";
import { selectDealsToPost } from "@/lib/auto-post-selector";

/**
 * POST /api/deals/auto-post
 *
 * Called by a scheduled cron (GitHub Actions). Each invocation selects and
 * posts ONE deal to @CloudedDeals. The cron runs up to 8 times/day, spaced
 * out so we tweet 4-8 deals across the day.
 *
 * The selection logic in auto-post-selector.ts enforces:
 *  - Southern NV region only
 *  - 1g disposable vapes, 3.5g/7g flower, 100mg+ edibles,
 *    1g live resin/rosin concentrates, single/2-pack prerolls
 *  - No brand repeats within the same day
 *  - No brand+dispensary combo repeats
 *  - Max 8 posts per day
 *
 * Body (optional):
 *   { dry_run?: boolean }           — select deal but don't tweet
 *   { test_connection?: boolean }   — verify Twitter credentials only
 *   { diagnose?: boolean }          — full diagnostic report
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
      {
        error: "Twitter credentials not configured",
        missing: credCheck.missing,
        guidance:
          "Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, " +
          "and TWITTER_ACCESS_SECRET in Netlify environment variables, then redeploy.",
      },
      { status: 503 }
    );
  }

  let dryRun = false;
  let testConnection = false;
  let diagnose = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
    testConnection = body?.test_connection === true;
    diagnose = body?.diagnose === true;
  } catch {
    // No body is fine — default to live mode
  }

  // Diagnostic mode: comprehensive health check of Twitter integration.
  if (diagnose) {
    const report = await diagnoseTwitter();
    return NextResponse.json(report, {
      status: report.readEndpoint.ok ? 200 : 502,
    });
  }

  // Test-connection mode: verify Twitter credentials without posting.
  // Calls GET /2/users/me to confirm the OAuth tokens are valid and
  // have the right permissions.
  if (testConnection) {
    const result = await testTwitterConnection();
    if (result.ok) {
      return NextResponse.json({
        ok: true,
        username: result.username,
        message: `Authenticated as @${result.username}`,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        status_code: result.status_code,
      },
      { status: 502 }
    );
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
    const err = result.error as TwitterError;
    console.error(
      "[auto-post] Tweet failed:",
      JSON.stringify({
        category: err?.category,
        message: err?.message,
        httpStatus: err?.httpStatus,
      })
    );
    return NextResponse.json(
      {
        error: "Tweet failed",
        category: err?.category ?? "unknown",
        message: err?.message ?? "Unknown error",
        guidance: err?.guidance ?? null,
        details: err?.rawBody ?? null,
      },
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
