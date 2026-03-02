/**
 * Twitter/X API v2 client for posting deal tweets.
 *
 * Uses OAuth 1.0a User Context (required for posting tweets on behalf
 * of the @CloudedDeals account).  All keys come from environment
 * variables and must NEVER be exposed to the browser.
 *
 * ## Error handling
 *
 * Twitter API v2 returns RFC 7807 Problem Details on errors:
 *   { title, detail, type, status }
 *
 * Common failure modes:
 *  - 401: Bad OAuth signature, expired tokens, wrong credentials
 *  - 403: App lacks "Read and Write" permission, or suspended
 *  - 429: Rate limited (check x-rate-limit-reset header)
 *  - 503: Server unavailable — common on Free tier; retry with backoff
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

  // Build signature base string (body params NOT included for JSON content-type).
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
  const waitSec = Math.min(rateLimitState.resetAt - now, 30); // Cap wait at 30s
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
// Structured error parsing
// ---------------------------------------------------------------------------

export interface TwitterError {
  /** HTTP status from Twitter API */
  httpStatus: number;
  /** Human-readable error category */
  category: "auth" | "permissions" | "rate_limit" | "server" | "network" | "unknown";
  /** Short description of the problem */
  message: string;
  /** Actionable guidance for the operator */
  guidance: string;
  /** Raw response body from Twitter (if available) */
  rawBody?: string;
}

function categorizeError(status: number, body: string): TwitterError {
  if (status === 401) {
    return {
      httpStatus: status,
      category: "auth",
      message: "OAuth authentication failed",
      guidance:
        "Check all 4 Twitter credentials in Netlify env vars. " +
        "If you changed app permissions, you MUST regenerate the Access Token and Secret. " +
        "Verify at https://developer.x.com/en/portal/projects-and-apps",
      rawBody: body,
    };
  }

  if (status === 403) {
    return {
      httpStatus: status,
      category: "permissions",
      message: "Twitter app lacks required permissions",
      guidance:
        "Your X Developer App needs 'Read and Write' permissions under User Authentication Settings. " +
        "After changing permissions, regenerate Access Token + Secret. " +
        "Also check the app is not suspended at https://developer.x.com/en/portal/projects-and-apps",
      rawBody: body,
    };
  }

  if (status === 429) {
    return {
      httpStatus: status,
      category: "rate_limit",
      message: "Twitter rate limit exceeded",
      guidance:
        "Free tier: 1,500 tweets/month, 50 requests per 15-min window for POST /tweets. " +
        "Check x-rate-limit-reset header for when the window resets. " +
        "Consider upgrading to Basic ($100/month) for 3,000 tweets/month.",
      rawBody: body,
    };
  }

  if (status === 503 || status === 502 || status === 500 || status === 504) {
    return {
      httpStatus: status,
      category: "server",
      message: `Twitter API returned ${status} (server error)`,
      guidance:
        "Persistent 503s are common on the Free tier. Possible fixes: " +
        "(1) Wait 15-30 min and retry — may be transient. " +
        "(2) Check https://api.twitterstat.us for outages. " +
        "(3) Verify your app is on a Project (not standalone) at developer.x.com. " +
        "(4) Regenerate all 4 credentials (Consumer Key+Secret, Access Token+Secret). " +
        "(5) If none of the above work, upgrade to Basic tier ($100/month) — it's significantly more reliable.",
      rawBody: body,
    };
  }

  return {
    httpStatus: status,
    category: "unknown",
    message: `Unexpected HTTP ${status} from Twitter API`,
    guidance: `Raw response: ${body.slice(0, 500)}`,
    rawBody: body,
  };
}

// ---------------------------------------------------------------------------
// Credential validation
// ---------------------------------------------------------------------------

export function validateTwitterCredentials(): {
  valid: boolean;
  missing: string[];
} {
  const required = [
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  return { valid: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TweetResult {
  success: boolean;
  tweet_id: string | null;
  error: TwitterError | null;
}

/**
 * Retry config.
 *
 * Exponential backoff: 2s → 4s → 8s (total wait ≈14s, fits within Netlify
 * function timeout of 26s even with network round-trips).
 */
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

function getRetryDelay(attempt: number): number {
  // Exponential backoff with jitter: 2s, 4s, 8s + 0-500ms random
  const base = BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

export async function postTweet(text: string): Promise<TweetResult> {
  const config = getConfig();
  const url = `${TWITTER_API_BASE}/tweets`;

  await waitForRateLimit();

  let lastError: TwitterError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Must regenerate auth header each attempt (nonce + timestamp must be unique)
    const authHeader = await buildAuthHeader("POST", url, config);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "User-Agent": "CloudedDeals/1.0",
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15000), // 15s per request
      });
    } catch (fetchError) {
      // Network error (DNS, timeout, etc.)
      const msg =
        fetchError instanceof Error ? fetchError.message : String(fetchError);
      lastError = {
        httpStatus: 0,
        category: "network",
        message: `Network error: ${msg}`,
        guidance:
          "Could not reach api.twitter.com. Check if Netlify functions can make outbound HTTPS requests. " +
          "This may also be a DNS or TLS issue.",
      };
      console.error(
        `[twitter] Attempt ${attempt}/${MAX_ATTEMPTS} — ${lastError.message}`
      );
      if (attempt < MAX_ATTEMPTS) {
        const delay = getRetryDelay(attempt);
        console.log(`[twitter] Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { success: false, tweet_id: null, error: lastError };
    }

    updateRateLimit(res.headers);

    if (res.ok) {
      const data = await res.json();
      const tweetId: string | null = data?.data?.id ?? null;
      if (attempt > 1) {
        console.log(
          `[twitter] Tweet succeeded on attempt ${attempt}/${MAX_ATTEMPTS}`
        );
      }
      return { success: true, tweet_id: tweetId, error: null };
    }

    // Non-OK response — parse and categorize
    const body = await res.text();
    lastError = categorizeError(res.status, body);

    const rateLimitRemaining = res.headers.get("x-rate-limit-remaining");
    const rateLimitReset = res.headers.get("x-rate-limit-reset");
    console.error(
      `[twitter] Attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
      JSON.stringify({
        status: res.status,
        category: lastError.category,
        message: lastError.message,
        body: body.slice(0, 500),
        rateLimit: { remaining: rateLimitRemaining, reset: rateLimitReset },
      })
    );

    // Only retry on transient server errors
    if (!RETRYABLE_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) {
      return { success: false, tweet_id: null, error: lastError };
    }

    const delay = getRetryDelay(attempt);
    console.log(`[twitter] Retrying in ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  return { success: false, tweet_id: null, error: lastError };
}

// ---------------------------------------------------------------------------
// Connection test (read-only — does not consume tweet rate limit)
// ---------------------------------------------------------------------------

export async function testTwitterConnection(): Promise<{
  ok: boolean;
  username?: string;
  error?: TwitterError;
  status_code?: number;
}> {
  try {
    const config = getConfig();
    const url = `${TWITTER_API_BASE}/users/me`;
    const authHeader = await buildAuthHeader("GET", url, config);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "User-Agent": "CloudedDeals/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const username = data?.data?.username ?? "unknown";
      return { ok: true, username, status_code: res.status };
    }

    const body = await res.text();
    const twitterError = categorizeError(res.status, body);
    console.error(
      `[twitter] Connection test failed (${res.status}): ${body}`
    );
    return { ok: false, error: twitterError, status_code: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: {
        httpStatus: 0,
        category: "network",
        message: `Connection test network error: ${msg}`,
        guidance:
          "Could not reach api.twitter.com. Verify Netlify outbound connectivity.",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Full diagnostic — tests read + write endpoints, reports everything
// ---------------------------------------------------------------------------

export interface DiagnosticResult {
  timestamp: string;
  credentials: {
    present: boolean;
    missing: string[];
    apiKeyPrefix?: string; // first 4 chars for identification
    accessTokenPrefix?: string;
  };
  readEndpoint: {
    tested: boolean;
    ok: boolean;
    username?: string;
    httpStatus?: number;
    error?: string;
    latencyMs?: number;
  };
  rateLimits: {
    remaining: number | null;
    resetAt: string | null;
  };
  guidance: string[];
}

export async function diagnoseTwitter(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    credentials: { present: false, missing: [] },
    readEndpoint: { tested: false, ok: false },
    rateLimits: { remaining: null, resetAt: null },
    guidance: [],
  };

  // Step 1: Check credentials
  const credCheck = validateTwitterCredentials();
  result.credentials.present = credCheck.valid;
  result.credentials.missing = credCheck.missing;

  if (credCheck.valid) {
    // Show prefixes for identification (NOT secrets)
    result.credentials.apiKeyPrefix =
      (process.env.TWITTER_API_KEY ?? "").slice(0, 4) + "...";
    result.credentials.accessTokenPrefix =
      (process.env.TWITTER_ACCESS_TOKEN ?? "").slice(0, 4) + "...";
  } else {
    result.guidance.push(
      `Missing credentials: ${credCheck.missing.join(", ")}. ` +
        "Set these in Netlify environment variables."
    );
    return result;
  }

  // Step 2: Test read endpoint (GET /2/users/me)
  const readStart = Date.now();
  const readResult = await testTwitterConnection();
  const readLatency = Date.now() - readStart;

  result.readEndpoint = {
    tested: true,
    ok: readResult.ok,
    username: readResult.username,
    httpStatus: readResult.status_code,
    latencyMs: readLatency,
  };

  if (!readResult.ok && readResult.error) {
    result.readEndpoint.error = readResult.error.message;
    result.guidance.push(readResult.error.guidance);
  }

  // Step 3: Check rate limits from last known state
  if (rateLimitState.remaining !== Infinity) {
    result.rateLimits.remaining = rateLimitState.remaining;
    result.rateLimits.resetAt = rateLimitState.resetAt
      ? new Date(rateLimitState.resetAt * 1000).toISOString()
      : null;
  }

  // Step 4: Build guidance summary
  if (readResult.ok) {
    result.guidance.push(
      `Read access confirmed for @${readResult.username}. ` +
        "If POST /tweets still fails with 503, the issue is likely: " +
        "(1) Free tier instability — upgrade to Basic ($100/mo), or " +
        "(2) App permissions — ensure 'Read and Write' is set at developer.x.com, " +
        "then regenerate Access Token + Secret."
    );
  } else if (readResult.status_code === 401) {
    result.guidance.push(
      "OAuth credentials are invalid. Go to https://developer.x.com/en/portal/projects-and-apps, " +
        "select your app, and regenerate all 4 credentials: " +
        "API Key, API Secret, Access Token, Access Token Secret. " +
        "Then update them in Netlify env vars and redeploy."
    );
  } else if (readResult.status_code === 403) {
    result.guidance.push(
      "App permissions issue. At developer.x.com: " +
        "(1) Ensure app is inside a Project (not standalone). " +
        "(2) Under User Authentication, set OAuth 1.0a with 'Read and Write'. " +
        "(3) Regenerate Access Token + Secret after changing permissions."
    );
  } else if (
    readResult.status_code &&
    readResult.status_code >= 500
  ) {
    result.guidance.push(
      "Twitter API is returning server errors even for read-only endpoints. " +
        "This is a Twitter-side issue. Check https://api.twitterstat.us for outages. " +
        "If persistent, regenerate credentials and try again. " +
        "If still failing, the Free tier may be degraded — consider Basic ($100/mo)."
    );
  }

  return result;
}
