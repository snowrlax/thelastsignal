import { NextResponse } from "next/server";
import { runRecordSchema, type ApiEnvelope } from "@/game/story/schema";
import { clientKey, createRateLimiter, GLOBAL_KEY, readLimitedJson } from "@/libs/rateLimit";
import { runRepository, storageConfigured, type RunStats } from "@/libs/runs";

const MAX_BODY_BYTES = 2_048;
const writeLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const globalWriteLimiter = createRateLimiter({ limit: 300, windowMs: 60_000 });
const readLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

function respond(body: ApiEnvelope<RunStats>, status: number) {
  return NextResponse.json(body, { status });
}

/** Aggregate, anonymous outcome counts ("operators who preserved the archive"). */
export async function GET(request: Request) {
  if (!readLimiter.check(clientKey(request)).allowed) return respond({ success: false, data: null, error: "rate_limited" }, 429);
  if (!storageConfigured()) return respond({ success: false, data: null, error: "storage_unavailable" }, 503);
  try {
    return respond({ success: true, data: await runRepository.stats(), error: null }, 200);
  } catch (error) {
    console.error("[runs] stats failed", error instanceof Error ? error.message : error);
    return respond({ success: false, data: null, error: "storage_error" }, 503);
  }
}

/** Records one finished run. No personal data is accepted or stored. */
export async function POST(request: Request) {
  if (!writeLimiter.check(clientKey(request)).allowed || !globalWriteLimiter.check(GLOBAL_KEY).allowed) {
    return respond({ success: false, data: null, error: "rate_limited" }, 429);
  }
  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return respond({ success: false, data: null, error: body.status === 413 ? "too_large" : "invalid_json" }, body.status);
  const parsed = runRecordSchema.safeParse(body.value);
  if (!parsed.success) return respond({ success: false, data: null, error: "invalid_request" }, 400);
  if (!storageConfigured()) return respond({ success: false, data: null, error: "storage_unavailable" }, 503);
  try {
    await runRepository.create(parsed.data);
    return respond({ success: true, data: await runRepository.stats(), error: null }, 201);
  } catch (error) {
    console.error("[runs] create failed", error instanceof Error ? error.message : error);
    return respond({ success: false, data: null, error: "storage_error" }, 503);
  }
}
