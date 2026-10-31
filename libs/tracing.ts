import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { ChatMessage } from "@/game/story/prompts";
import type { AttemptRunner, ChatResult } from "@/libs/llm";

/** OpenTelemetry status code for an errored span. */
const SPAN_STATUS_ERROR = 2;

type Span = Parameters<Parameters<typeof Sentry.startSpan>[1]>[0];

export interface DialogueTraceMeta {
  readonly agent: "M_VEGA" | "HOLLOW";
  readonly event: string;
  readonly phase: string;
  readonly evidenceCount: number;
  readonly maxTokens: number;
  readonly temperature: number;
  /** Opaque per-playthrough id: Sentry groups the run's lines into one conversation. */
  readonly conversationId?: string;
}

export interface DialogueOutcome {
  readonly result: ChatResult;
  /** The line after the sanitizer, or null if it was rejected or never generated. */
  readonly text: string | null;
}

/**
 * Prompts and lines are what make Sentry's Agent Tracing transcript useful, so
 * they are attached by default. They include the player's callsign and replies:
 * SENTRY_RECORD_DIALOGUE=false keeps them out of Sentry.
 */
export const recordDialogue = (): boolean => process.env.SENTRY_RECORD_DIALOGUE !== "false";
const recordContent = recordDialogue;

const conversation = (meta: DialogueTraceMeta) => (meta.conversationId ? { "gen_ai.conversation.id": meta.conversationId } : {});

const asJson = (value: unknown): string => JSON.stringify(value);

function outcomeLabel({ result, text }: DialogueOutcome): "voiced" | "rejected" | "unavailable" {
  if (text) return "voiced";
  return result.text ? "rejected" : "unavailable";
}

/** One `gen_ai.chat` span per provider attempt, with usage and failure codes. */
export function tracedAttempts(meta: DialogueTraceMeta, messages: readonly ChatMessage[]): AttemptRunner {
  return (target, run) =>
    Sentry.startSpan(
      {
        op: "gen_ai.chat",
        name: `chat ${target.model}`,
        attributes: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": target.provider,
          "gen_ai.request.model": target.model,
          "gen_ai.request.max_tokens": meta.maxTokens,
          "gen_ai.request.temperature": meta.temperature,
          "gen_ai.agent.name": meta.agent,
          ...conversation(meta),
          ...(recordContent()
            ? {
                "gen_ai.system_instructions": messages.find((m) => m.role === "system")?.content ?? "",
                "gen_ai.input.messages": asJson(messages.filter((m) => m.role !== "system")),
              }
            : {}),
        },
      },
      async (span: Span) => {
        const attempt = await run();
        const reply = attempt.reply;
        span.setAttributes({
          "gen_ai.response.model": reply?.responseModel ?? target.model,
          ...(reply?.inputTokens !== undefined ? { "gen_ai.usage.input_tokens": reply.inputTokens } : {}),
          ...(reply?.outputTokens !== undefined ? { "gen_ai.usage.output_tokens": reply.outputTokens } : {}),
          ...(reply?.finishReason ? { "gen_ai.response.finish_reasons": asJson([reply.finishReason]) } : {}),
          ...(recordContent() && reply?.text ? { "gen_ai.output.messages": asJson([{ role: "assistant", content: reply.text }]) } : {}),
        });
        if (attempt.error) {
          span.setAttribute("error.type", attempt.error);
          span.setStatus({ code: SPAN_STATUS_ERROR, message: attempt.error });
        }
        return attempt;
      },
    );
}

/** The sanitizer is a guardrail: trace its verdict as a `gen_ai.decide` span. */
export function tracedGuardrail(agent: DialogueTraceMeta["agent"], check: () => string | null): string | null {
  return Sentry.startSpan(
    { op: "gen_ai.decide", name: "decide sanitizer", attributes: { "gen_ai.operation.name": "decide", "gen_ai.agent.name": agent } },
    (span: Span) => {
      const verdict = check();
      span.setAttribute("guardrail.verdict", verdict ? "pass" : "reject");
      return verdict;
    },
  );
}

/**
 * Wraps one character line in a `gen_ai.invoke_agent` span. The agent here is
 * a character voice: it has no tools and cannot change game state.
 */
export function traceDialogue(meta: DialogueTraceMeta, work: () => Promise<DialogueOutcome>): Promise<DialogueOutcome> {
  return Sentry.startSpan(
    {
      op: "gen_ai.invoke_agent",
      name: `invoke_agent ${meta.agent}`,
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": meta.agent,
        "gen_ai.pipeline.name": "the-last-signal.dialogue",
        "story.event": meta.event,
        "story.phase": meta.phase,
        "story.evidence_count": meta.evidenceCount,
        ...conversation(meta),
      },
    },
    async (span: Span) => {
      const outcome = await work();
      const winner = outcome.result.target;
      span.setAttributes({
        "dialogue.outcome": outcomeLabel(outcome),
        "dialogue.attempts": outcome.result.attempts.length,
        ...(winner ? { "gen_ai.provider.name": winner.provider, "gen_ai.request.model": winner.model } : {}),
        ...(recordContent() && outcome.text ? { "gen_ai.output.messages": asJson([{ role: "assistant", content: outcome.text }]) } : {}),
      });
      if (!outcome.text) span.setAttribute("error.type", outcomeLabel(outcome));
      return outcome;
    },
  );
}
