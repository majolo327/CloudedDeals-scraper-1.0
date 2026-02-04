/**
 * Twitter API v2 client for posting deal tweets.
 *
 * Uses OAuth 1.0a User Context (required for posting tweets on behalf
 * of the @CloudedDeals account).  All keys come from environment
 * variables and must NEVER be exposed to the browser.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TWITTER_API_BASE = "https://api.twitter.com/2";

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function getConfig(): TwitterConfig {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error("Twitter API credentials are not fully configured");
  }

  return { apiKey, apiSecret, accessToken, accessSecret };
}

// ---------------------------------------------------------------------------
// OAuth 1.0a signature helpers
// ---------------------------------------------------------------------------

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const bytes = Array.from(new Uint8Array(sig));
  return btoa(String.fromCharCode(...bytes));
}

async function buildAuthHeader(
  method: string,
  url: string,
  config: TwitterConfig
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const params: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };

  // Build signature base string.
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  params["oauth_signature"] = signature;

  const header = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

// ---------------------------------------------------------------------------
// Rate-limit handling
// ---------------------------------------------------------------------------

interface RateLimitState {
  remaining: number;
  resetAt: number; // Unix timestamp (seconds)
}

const rateLimitState: RateLimitState = { remaining: Infinity, resetAt: 0 };

async function waitForRateLimit(): Promise<void> {
  if (rateLimitState.remaining > 0) return;

  const now = Math.floor(Date.now() / 1000);
  const waitSec = rateLimitState.resetAt - now;
  if (waitSec > 0) {
    console.log(`[twitter] Rate limited — waiting ${waitSec}s`);
    await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
  }
}

function updateRateLimit(headers: Headers): void {
  const remaining = headers.get("x-rate-limit-remaining");
  const reset = headers.get("x-rate-limit-reset");
  if (remaining !== null) rateLimitState.remaining = Number(remaining);
  if (reset !== null) rateLimitState.resetAt = Number(reset);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TweetResult {
  success: boolean;
  tweet_id: string | null;
  error: string | null;
}

export async function postTweet(text: string): Promise<TweetResult> {
  const config = getConfig();
  const url = `${TWITTER_API_BASE}/tweets`;

  await waitForRateLimit();

  const authHeader = await buildAuthHeader("POST", url, config);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  updateRateLimit(res.headers);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[twitter] Tweet failed (${res.status}): ${body}`);
    return { success: false, tweet_id: null, error: body };
  }

  const data = await res.json();
  const tweetId: string | null = data?.data?.id ?? null;

  return { success: true, tweet_id: tweetId, error: null };
}
