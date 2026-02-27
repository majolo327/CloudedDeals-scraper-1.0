import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Sample 100% of errors (free tier: 5k events/month — plenty for beta)
  sampleRate: 1.0,

  // Performance monitoring — sample 20% of transactions to stay within limits
  tracesSampleRate: 0.2,

  // Filter out noisy browser errors that aren't actionable
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "ResizeObserver loop",
    // Network errors (user's connection, not our bug)
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // Safari-specific noise
    "cancelled",
  ],
});
