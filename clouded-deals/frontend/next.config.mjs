import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  productionBrowserSourceMaps: false,
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI logs during build
  silent: true,

  // Upload source maps to Sentry for readable stack traces.
  // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars at build time.
  // If these are not set, the build still succeeds — source maps just won't be uploaded.
  widenClientFileUpload: true,

  // Hide source maps from the browser (security: don't expose source code)
  hideSourceMaps: true,

  // Disable Sentry telemetry
  disableLogger: true,
});
