import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry: errors plus agent tracing for the dialogue pipeline
 * (see libs/tracing.ts). Without SENTRY_DSN nothing is initialised and every
 * span call is a no-op.
 */
const dsn = process.env.SENTRY_DSN;
const recordDialogue = process.env.SENTRY_RECORD_DIALOGUE !== "false";

if (dsn) {
  const sampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "1");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number.isFinite(sampleRate) ? Math.min(1, Math.max(0, sampleRate)) : 1,
    debug: process.env.SENTRY_DEBUG === "true",
    // Never attach IPs, cookies, headers or bodies. Prompts and lines are kept (Agent Tracing
    // transcripts need them) unless SENTRY_RECORD_DIALOGUE=false.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: recordDialogue, outputs: recordDialogue },
    },
  });
}
