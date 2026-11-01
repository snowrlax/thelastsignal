import { NextResponse } from "next/server";
import { buildDialoguePrompt } from "@/game/story/prompts";
import { sanitizeDialogue } from "@/game/story/sanitize";
import { dialogueRequestSchema, type ApiEnvelope } from "@/game/story/schema";
import { aiHintFor } from "@/game/story/triggers";
import { sanitizeCallsign } from "@/game/engine";
import { generateLine } from "@/libs/llm";
import { clientKey, createRateLimiter, GLOBAL_KEY, readLimitedJson } from "@/libs/rateLimit";
import { traceDialogue, tracedAttempts, tracedGuardrail, type DialogueTraceMeta } from "@/libs/tracing";
import { signVoiceLine } from "@/libs/voiceToken";

interface DialogueData {
  readonly text: string;
  readonly source: "ai";
  /** Lets /api/voice speak this exact M_VEGA line. Only present when ElevenLabs is configured. */
  readonly voiceToken?: string;
}

const MAX_BODY_BYTES = 8_192;
const DIALOGUE_TEMPERATURE = 0.85;
const limiter = createRateLimiter({ limit: 40, windowMs: 60_000 });
/** Backstop for the paid model: total calls per minute across every client. */
const globalLimiter = createRateLimiter({ limit: 600, windowMs: 60_000 });

function respond(body: ApiEnvelope<DialogueData>, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

/**
 * Voices one character line with the open-weight model. The response is only
 * ever displayed: it cannot change files, processes, timers or endings.
 */
export async function POST(request: Request) {
  const limit = limiter.check(clientKey(request));
  if (!limit.allowed || !globalLimiter.check(GLOBAL_KEY).allowed) {
    return respond({ success: false, data: null, error: "rate_limited" }, 429, {
      "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
    });
  }

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return respond({ success: false, data: null, error: body.status === 413 ? "too_large" : "invalid_json" }, body.status);

  const parsed = dialogueRequestSchema.safeParse(body.value);
  if (!parsed.success) return respond({ success: false, data: null, error: "invalid_request" }, 400);

  const playerName = sanitizeCallsign(parsed.data.playerName);
  if (!playerName) return respond({ success: false, data: null, error: "invalid_request" }, 400);
  const dialogue = { ...parsed.data, playerName };

  const moment = aiHintFor(dialogue.event, dialogue.speaker);
  if (!moment) return respond({ success: false, data: null, error: "not_voiced" }, 422);

  const messages = buildDialoguePrompt(dialogue, moment);
  const meta: DialogueTraceMeta = {
    agent: dialogue.speaker === "vega" ? "M_VEGA" : "HOLLOW",
    event: dialogue.event,
    phase: dialogue.phase,
    evidenceCount: dialogue.evidence.length,
    maxTokens: dialogue.speaker === "vega" ? 160 : 60,
    temperature: DIALOGUE_TEMPERATURE,
    ...(dialogue.runId ? { conversationId: dialogue.runId } : {}),
  };
  const { text } = await traceDialogue(meta, async () => {
    const result = await generateLine(messages, { maxTokens: meta.maxTokens, temperature: meta.temperature }, tracedAttempts(meta, messages));
    const raw = result.text;
    const sanitized = raw
      ? tracedGuardrail(meta.agent, () =>
          sanitizeDialogue(raw, { speaker: dialogue.speaker, identifiedTruth: dialogue.evidence.includes("identified_truth") }),
        )
      : null;
    return { result, text: sanitized };
  });
  if (!text) return respond({ success: false, data: null, error: "unavailable" }, 503);

  const voiceToken = dialogue.speaker === "vega" ? signVoiceLine("vega", text) : null;
  return respond({ success: true, data: { text, source: "ai", ...(voiceToken ? { voiceToken } : {}) }, error: null }, 200);
}
