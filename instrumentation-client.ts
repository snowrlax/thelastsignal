import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry: uncaught errors plus page and fetch tracing. Calls to
 * /api/dialogue carry the trace headers, so a player's command and the
 * server's model calls land in one trace. NEXT_PUBLIC_SENTRY_DSN is inlined at
 * build time from SENTRY_DSN (next.config.ts); without it nothing starts.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: 1,
      // Nothing about the player leaves the browser beyond what the game already sends.
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    });
  } catch {
    // Monitoring must never stop the game from starting.
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
