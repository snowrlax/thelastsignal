import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApiEnvelope } from "@/game/story/schema";
import { synthesizeSpeech, voiceConfig, type VoiceConfig } from "@/libs/elevenlabs";
import { clientKey, createRateLimiter, GLOBAL_KEY, readLimitedJson } from "@/libs/rateLimit";
import { createAudioCache } from "@/libs/voiceCache";
import { isAuthoredVegaLine } from "@/libs/voiceLines";
import { MAX_VOICE_TEXT } from "@/libs/voiceProfile";
import { verifyVoiceLine } from "@/libs/voiceToken";

const MAX_BODY_BYTES = 2_048;
const UPSTREAM_TIMEOUT_MS = 4_000;
const limiter = createRateLimiter({ limit: 24, windowMs: 60_000 });
/** Backstops for the paid API: synthesized (uncached) lines across every client, per minute and per hour. */
const globalLimiters = [createRateLimiter({ limit: 120, windowMs: 60_000 }), createRateLimiter({ limit: 1_200, windowMs: 3_600_000 })];
const cache = createAudioCache({ maxEntries: 160, maxBytes: 12 * 1024 * 1024 });

/** One M_VEGA line. `token` vouches for a model line; authored lines are checked against the script. */
const voiceRequestSchema = z
  .object({
    text: z.string().min(1).max(MAX_VOICE_TEXT),
    token: z.string().min(1).max(64).optional(),
  })
  .strict();

function fail(error: string, status: number, headers?: HeadersInit) {
  const body: ApiEnvelope<null> = { success: false, data: null, error };
  return NextResponse.json(body, { status, headers });
}

function audio(bytes: ArrayBuffer, cached: boolean) {
  return new NextResponse(bytes.slice(0), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Voice-Cache": cached ? "hit" : "miss" },
  });
}

function retryAfter(ms: number): HeadersInit {
  return { "Retry-After": String(Math.max(1, Math.ceil(ms / 1000))) };
}

async function speak(config: VoiceConfig, text: string) {
  const key = `${config.voiceId}|${config.modelId}|${text}`;
  const cached = cache.get(key);
  if (cached) return audio(cached, true);
  const spent = globalLimiters.map((budget) => budget.check(GLOBAL_KEY)).find((budget) => !budget.allowed);
  if (spent) return fail("rate_limited", 429, retryAfter(spent.retryAfterMs));
  const speech = await synthesizeSpeech(config, text, { timeoutMs: UPSTREAM_TIMEOUT_MS });
  if (!speech) return fail("unavailable", 503);
  cache.set(key, speech);
  return audio(speech, false);
}

/**
 * Lets the client ask once whether voice is on, instead of failing on every
 * line. GET handlers are dynamic by default since Next.js 15, so this reads the
 * environment at request time.
 */
export async function GET() {
  const body: ApiEnvelope<{ enabled: boolean }> = { success: true, data: { enabled: voiceConfig() !== null }, error: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Speaks one M_VEGA line with ElevenLabs. Only text the server can vouch for
 * is spoken: a signed model line from /api/dialogue, or an authored line.
 */
export async function POST(request: Request) {
  const config = voiceConfig();
  if (!config) return fail("disabled", 503);

  const limit = limiter.check(clientKey(request));
  if (!limit.allowed) return fail("rate_limited", 429, retryAfter(limit.retryAfterMs));

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.status === 413 ? "too_large" : "invalid_json", body.status);

  const parsed = voiceRequestSchema.safeParse(body.value);
  if (!parsed.success) return fail("invalid_request", 400);

  const { text, token } = parsed.data;
  const vouched = token ? verifyVoiceLine("vega", text, token) : isAuthoredVegaLine(text);
  if (!vouched) return fail("unverified", 403);

  return speak(config, text);
}
