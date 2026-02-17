import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware — runs on every request before it hits API routes.
 *
 * Provides:
 *  1. Per-IP rate limiting on public API routes (sliding window)
 *  2. Security headers on all responses
 */

// ---------------------------------------------------------------------------
// Rate limiter — sliding-window counter stored in a Map.
// Resets on redeploy (acceptable for Netlify/Vercel edge functions).
// For higher traffic, swap for Upstash Redis or similar.
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateBucket>();

const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  // Search endpoint — most abusable (arbitrary user input, broad queries)
  "/api/search": { windowMs: 60_000, maxRequests: 20 },
  // Public health endpoint — generous but capped (returns status only, no metrics)
  "/api/health": { windowMs: 60_000, maxRequests: 30 },
  // Admin endpoints — tighter limits (already has auth, this is defense-in-depth)
  "/api/admin": { windowMs: 60_000, maxRequests: 20 },
  // Deal posting endpoints — very tight (only called by cron)
  "/api/deals": { windowMs: 60_000, maxRequests: 10 },
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.ip ||
    "unknown"
  );
}

function getRateLimit(
  pathname: string
): { windowMs: number; maxRequests: number } | null {
  // Match most specific prefix first
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) {
      return config;
    }
  }
  return null;
}

function checkRateLimit(
  ip: string,
  pathname: string
): { limited: boolean; remaining: number; resetMs: number } {
  const config = getRateLimit(pathname);
  if (!config) return { limited: false, remaining: -1, resetMs: 0 };

  const key = `${ip}:${pathname.split("/").slice(0, 3).join("/")}`;
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now - bucket.windowStart > config.windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetMs: config.windowMs,
    };
  }

  bucket.count++;
  const remaining = Math.max(0, config.maxRequests - bucket.count);
  const resetMs = config.windowMs - (now - bucket.windowStart);

  if (bucket.count > config.maxRequests) {
    return { limited: true, remaining: 0, resetMs };
  }

  return { limited: false, remaining, resetMs };
}

// Periodic cleanup to prevent memory leaks (every 5 min)
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;

  for (const [key, bucket] of Array.from(rateLimitStore.entries())) {
    if (now - bucket.windowStart > 120_000) {
      rateLimitStore.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (pathname.startsWith("/api")) {
    cleanupStaleEntries();

    const ip = getClientIp(request);
    const { limited, remaining, resetMs } = checkRateLimit(ip, pathname);

    if (limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(resetMs / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Pass through with rate limit headers
    const response = NextResponse.next();
    if (remaining >= 0) {
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
    }

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return response;
  }

  // Security headers for non-API routes
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match page routes (for security headers) but exclude static files
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|og-image).*)",
  ],
};
