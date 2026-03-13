import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Only enable source map upload when running in an environment that has
// the Sentry auth token (e.g. CI). Runtime error reporting is configured
// via sentry.*.config.ts files.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default sentryAuthToken
  ? withSentryConfig(
      nextConfig,
      {
        authToken: sentryAuthToken,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        silent: true,
        sourcemaps: {
          // Upload source maps to Sentry in CI and then remove them from the build output.
          deleteSourcemapsAfterUpload: true,
        },
      },
    )
  : nextConfig;
