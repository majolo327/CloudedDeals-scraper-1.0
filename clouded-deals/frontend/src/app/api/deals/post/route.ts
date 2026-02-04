import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { postTweet } from "@/lib/twitter";
import { formatDealTweet } from "@/lib/tweet-formatter";
import { Deal } from "@/lib/types";

/**
 * POST /api/deals/post
 *
 * Publishes a deal as a tweet and marks it as posted in the database.
 *
 * Body: { deal_id: string }
 */
export async function POST(req: NextRequest) {
  // ---- Auth check (service key required) ----
  const authHeader = req.headers.get("authorization");
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- Parse body ----
  let body: { deal_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.deal_id;
  if (!dealId) {
    return NextResponse.json(
      { error: "deal_id is required" },
      { status: 400 }
    );
  }

  // ---- Fetch the deal with product + dispensary joins ----
  const supabase = createServiceClient();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select(
      `
      *,
      product:products(*),
      dispensary:dispensaries(*)
    `
    )
    .eq("id", dealId)
    .single();

  if (fetchError || !deal) {
    return NextResponse.json(
      { error: `Deal not found: ${fetchError?.message ?? "no rows"}` },
      { status: 404 }
    );
  }

  const typedDeal = deal as Deal;

  if (typedDeal.is_posted) {
    return NextResponse.json(
      { error: "Deal already posted", tweet_id: typedDeal.posted_at },
      { status: 409 }
    );
  }

  // ---- Format and post tweet ----
  const tweetText = formatDealTweet(typedDeal);
  if (!tweetText) {
    return NextResponse.json(
      { error: "Could not format tweet — product data missing" },
      { status: 422 }
    );
  }

  const result = await postTweet(tweetText);

  if (!result.success) {
    return NextResponse.json(
      { error: "Tweet failed", details: result.error },
      { status: 502 }
    );
  }

  // ---- Mark deal as posted ----
  const { error: updateError } = await supabase
    .from("deals")
    .update({
      is_posted: true,
      posted_at: new Date().toISOString(),
      tweet_id: result.tweet_id,
    })
    .eq("id", dealId);

  if (updateError) {
    // Tweet was sent but DB update failed — log but still return success
    // so the caller knows the tweet went out.
    console.error(
      `[post-deal] Tweet sent but DB update failed: ${updateError.message}`
    );
  }

  return NextResponse.json({
    success: true,
    tweet_id: result.tweet_id,
    tweet_text: tweetText,
  });
}
