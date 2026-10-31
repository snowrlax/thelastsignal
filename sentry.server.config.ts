import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry: errors plus agent tracing for the dialogue pipeline
 * (see libs/tracing.ts). Without SENTRY_DSN nothing is initialised and every
 * span call is a no-op.
 */
const dsn = process.env.SENTRY_DSN;
const recordDialogue = process.env.SENTRY_RECORD_DIALOGUE === "true";

if (dsn) {
  const sampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "1");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number.isFinite(sampleRate) ? Math.min(1, Math.max(0, sampleRate)) : 1,
    // Never attach IPs, cookies, headers or bodies; prompts are opt-in via SENTRY_RECORD_DIALOGUE.
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
