import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatAttempt, ChatResult, ModelTarget } from "@/libs/llm";

interface FakeSpan {
  readonly op: string;
  readonly name: string;
  attributes: Record<string, unknown>;
  status?: { code: number; message?: string };
}

const spans: FakeSpan[] = [];

vi.mock("@sentry/nextjs", () => ({
  startSpan: (options: { op: string; name: string; attributes?: Record<string, unknown> }, callback: (span: unknown) => unknown) => {
    const record: FakeSpan = { op: options.op, name: options.name, attributes: { ...options.attributes } };
    spans.push(record);
    return callback({
      setAttributes: (attrs: Record<string, unknown>) => {
        record.attributes = { ...record.attributes, ...attrs };
      },
      setAttribute: (key: string, value: unknown) => {
        record.attributes = { ...record.attributes, [key]: value };
      },
      setStatus: (status: { code: number; message?: string }) => {
        record.status = status;
      },
    });
  },
}));

const { traceDialogue, tracedAttempts, tracedGuardrail } = await import("@/libs/tracing");

const meta = { agent: "M_VEGA" as const, event: "first_process_view", phase: "process", evidenceCount: 2, maxTokens: 160, temperature: 0.85 };
const messages = [
  { role: "system" as const, content: "canon for RAVEN" },
  { role: "user" as const, content: "say something" },
];
const gemma: ModelTarget = { provider: "ollama", model: "gemma4:31b" };

const okAttempt: ChatAttempt = {
  target: gemma,
  durationMs: 900,
  error: null,
  reply: { text: "Mija, listen.", responseModel: "gemma4:31b", inputTokens: 512, outputTokens: 14, finishReason: "stop" },
};

beforeEach(() => {
  spans.length = 0;
  vi.stubEnv("SENTRY_RECORD_DIALOGUE", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("chat spans", () => {
  it("records provider, model, usage and finish reason without message content by default", async () => {
    const attempt = await tracedAttempts(meta, messages)(gemma, async () => okAttempt);
    expect(attempt).toBe(okAttempt);
    expect(spans[0]).toMatchObject({
      op: "gen_ai.chat",
      name: "chat gemma4:31b",
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "ollama",
        "gen_ai.request.model": "gemma4:31b",
        "gen_ai.response.model": "gemma4:31b",
        "gen_ai.usage.input_tokens": 512,
        "gen_ai.usage.output_tokens": 14,
        "gen_ai.response.finish_reasons": '["stop"]',
        "gen_ai.agent.name": "M_VEGA",
      },
    });
    expect(spans[0].attributes).not.toHaveProperty("gen_ai.input.messages");
    expect(spans[0].attributes).not.toHaveProperty("gen_ai.output.messages");
    expect(spans[0].status).toBeUndefined();
  });

  it("marks failed attempts as errors with a low-cardinality type", async () => {
    const failed: ChatAttempt = { target: gemma, durationMs: 2500, error: "timeout", reply: null };
    await tracedAttempts(meta, messages)(gemma, async () => failed);
    expect(spans[0].attributes).toMatchObject({ "error.type": "timeout", "gen_ai.response.model": "gemma4:31b" });
    expect(spans[0].attributes).not.toHaveProperty("gen_ai.usage.input_tokens");
    expect(spans[0].status).toEqual({ code: 2, message: "timeout" });
  });

  it("attaches prompts and replies only when SENTRY_RECORD_DIALOGUE=true", async () => {
    vi.stubEnv("SENTRY_RECORD_DIALOGUE", "true");
    await tracedAttempts(meta, messages)(gemma, async () => okAttempt);
    expect(spans[0].attributes["gen_ai.system_instructions"]).toBe("canon for RAVEN");
    expect(JSON.parse(String(spans[0].attributes["gen_ai.input.messages"]))).toEqual([{ role: "user", content: "say something" }]);
    expect(JSON.parse(String(spans[0].attributes["gen_ai.output.messages"]))).toEqual([{ role: "assistant", content: "Mija, listen." }]);
  });
});

describe("guardrail span", () => {
  it("records whether the sanitizer passed or rejected the line", () => {
    expect(tracedGuardrail("HOLLOW", () => "CONTAINMENT ACTIVE")).toBe("CONTAINMENT ACTIVE");
    expect(tracedGuardrail("M_VEGA", () => null)).toBeNull();
    expect(spans.map((s) => [s.op, s.attributes["gen_ai.agent.name"], s.attributes["guardrail.verdict"]])).toEqual([
      ["gen_ai.decide", "HOLLOW", "pass"],
      ["gen_ai.decide", "M_VEGA", "reject"],
    ]);
  });
});

describe("agent span", () => {
  const result = (text: string | null, target: ModelTarget | null): ChatResult => ({ text, target, attempts: [okAttempt] });

  it("summarises the winning provider and outcome", async () => {
    const outcome = await traceDialogue(meta, async () => ({ result: result("Mija.", gemma), text: "Mija." }));
    expect(outcome.text).toBe("Mija.");
    expect(spans[0]).toMatchObject({
      op: "gen_ai.invoke_agent",
      name: "invoke_agent M_VEGA",
      attributes: {
        "gen_ai.agent.name": "M_VEGA",
        "story.event": "first_process_view",
        "story.phase": "process",
        "story.evidence_count": 2,
        "dialogue.outcome": "voiced",
        "dialogue.attempts": 1,
        "gen_ai.provider.name": "ollama",
        "gen_ai.request.model": "gemma4:31b",
      },
    });
  });

  it("labels sanitizer rejections and unavailable models", async () => {
    await traceDialogue(meta, async () => ({ result: result("As an AI...", gemma), text: null }));
    await traceDialogue(meta, async () => ({ result: result(null, null), text: null }));
    expect(spans.map((s) => s.attributes["dialogue.outcome"])).toEqual(["rejected", "unavailable"]);
    expect(spans[1].attributes["error.type"]).toBe("unavailable");
    expect(spans[1].attributes).not.toHaveProperty("gen_ai.provider.name");
  });

  it("records the final line when content recording is on", async () => {
    vi.stubEnv("SENTRY_RECORD_DIALOGUE", "true");
    await traceDialogue(meta, async () => ({ result: result("Mija.", gemma), text: "Mija." }));
    expect(spans[0].attributes["gen_ai.output.messages"]).toBe('[{"role":"assistant","content":"Mija."}]');
  });
});
