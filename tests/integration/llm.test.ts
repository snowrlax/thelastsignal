import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, configuredTargets, generateLine, type AttemptRunner } from "@/libs/llm";

const messages = [{ role: "user" as const, content: "hi" }];

const ollamaReply = (content: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ model: "model-a", message: { content }, prompt_eval_count: 120, eval_count: 18, done_reason: "stop", ...extra }));

const openAiReply = (content: string) =>
  new Response(
    JSON.stringify({
      model: "gemma-4-31B-it",
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 130, completion_tokens: 22 },
    }),
  );

beforeEach(() => {
  vi.stubEnv("OLLAMA_API_KEY", "test-key");
  vi.stubEnv("OLLAMA_MODEL", "model-a");
  vi.stubEnv("OLLAMA_FALLBACK_MODEL", "gpt-oss:20b");
  vi.stubEnv("OLLAMA_HOST", "");
  vi.stubEnv("DIGITALOCEAN_INFERENCE_KEY", "");
  vi.stubEnv("DIGITALOCEAN_MODEL", "");
  vi.stubEnv("DIGITALOCEAN_INFERENCE_HOST", "");
  vi.stubEnv("DIALOGUE_PRIMARY_PROVIDER", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("provider order", () => {
  it("uses Ollama only when DigitalOcean has no key, deduplicating identical models", () => {
    expect(configuredTargets()).toEqual([
      { provider: "ollama", model: "model-a" },
      { provider: "ollama", model: "gpt-oss:20b" },
    ]);
    vi.stubEnv("OLLAMA_FALLBACK_MODEL", "model-a");
    expect(configuredTargets()).toEqual([{ provider: "ollama", model: "model-a" }]);
  });

  it("puts the same Gemma weights on DigitalOcean between the Ollama primary and fallback", () => {
    vi.stubEnv("DIGITALOCEAN_INFERENCE_KEY", "do-key");
    expect(configuredTargets()).toEqual([
      { provider: "ollama", model: "model-a" },
      { provider: "digitalocean", model: "gemma-4-31B-it" },
      { provider: "ollama", model: "gpt-oss:20b" },
    ]);
  });

  it("can make DigitalOcean the primary, or the only provider", () => {
    vi.stubEnv("DIGITALOCEAN_INFERENCE_KEY", "do-key");
    vi.stubEnv("DIGITALOCEAN_MODEL", "openai-gpt-oss-120b");
    vi.stubEnv("DIALOGUE_PRIMARY_PROVIDER", "digitalocean");
    expect(configuredTargets().map((t) => `${t.provider}:${t.model}`)).toEqual(["digitalocean:openai-gpt-oss-120b", "ollama:model-a", "ollama:gpt-oss:20b"]);
    vi.stubEnv("OLLAMA_API_KEY", "");
    expect(configuredTargets()).toEqual([{ provider: "digitalocean", model: "openai-gpt-oss-120b" }]);
  });

  it("has nothing to try without any key", () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    expect(configuredTargets()).toEqual([]);
  });
});

describe("ollama provider", () => {
  it("returns the primary model's reply with auth, usage and a low-think fallback config", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ollamaReply("Hello."));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateLine(messages);
    expect(result.text).toBe("Hello.");
    expect(result.target).toEqual({ provider: "ollama", model: "model-a" });
    expect(result.attempts[0].reply).toMatchObject({ responseModel: "model-a", inputTokens: 120, outputTokens: 18, finishReason: "stop" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ollama.com/api/chat");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toMatchObject({ model: "model-a", stream: false, options: { num_predict: 160 } });
  });

  it("talks to a local Ollama when OLLAMA_HOST is set", async () => {
    vi.stubEnv("OLLAMA_HOST", "http://localhost:11434/");
    const fetchMock = vi.fn().mockResolvedValue(ollamaReply("Local.", { model: undefined, eval_count: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateLine(messages);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/api/chat");
    expect(result.attempts[0].reply).toMatchObject({ responseModel: "model-a", outputTokens: undefined });
  });

  it("falls back to the second model when the first fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(ollamaReply("From fallback."));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateLine(messages);
    expect(result.text).toBe("From fallback.");
    expect(result.attempts.map((a) => a.error)).toEqual(["http_500", null]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ model: "gpt-oss:20b", think: "low" });
  });

  it("returns null when every model fails, throws or answers empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    const timedOut = await generateLine(messages);
    expect(timedOut.text).toBeNull();
    expect(timedOut.attempts.map((a) => a.error)).toEqual(["timeout", "timeout"]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect((await generateLine(messages)).attempts[0].error).toBe("network");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ollamaReply("  ")));
    const empty = await generateLine(messages);
    expect(empty.text).toBeNull();
    expect(empty.attempts[0].error).toBe("empty");
  });

  it("skips the network entirely without a key or budget", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatCompletion(messages, { deadlineMs: 100 })).toBeNull();
    vi.stubEnv("OLLAMA_API_KEY", "");
    expect(await chatCompletion(messages)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps early attempts so a hung provider leaves time for the next one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ollamaReply("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await chatCompletion(messages, { deadlineMs: 4_500 });
    expect(timeout.mock.calls[0][0]).toBeLessThanOrEqual(2_500);
  });
});

describe("digitalocean provider", () => {
  beforeEach(() => vi.stubEnv("DIGITALOCEAN_INFERENCE_KEY", "do-key"));

  it("calls the OpenAI-compatible endpoint after the Ollama primary fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(openAiReply("From DigitalOcean."));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateLine(messages, { temperature: 1.4, maxTokens: 60 });
    expect(result.text).toBe("From DigitalOcean.");
    expect(result.target).toEqual({ provider: "digitalocean", model: "gemma-4-31B-it" });
    expect(result.attempts[1].reply).toMatchObject({ inputTokens: 130, outputTokens: 22, finishReason: "stop" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://inference.do-ai.run/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer do-key");
    expect(JSON.parse(init.body)).toEqual({ model: "gemma-4-31B-it", messages, stream: false, temperature: 1, max_completion_tokens: 60 });
  });

  it("reports HTTP errors and malformed bodies as failed attempts", async () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
    expect((await generateLine(messages)).attempts[0].error).toBe("http_401");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }))));
    const empty = await generateLine(messages);
    expect(empty.attempts[0]).toMatchObject({ error: "empty", reply: { text: null, responseModel: "gemma-4-31B-it" } });
  });
});

describe("attempt runner", () => {
  it("wraps every attempt so tracing can observe it", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("x", { status: 500 }))
        .mockResolvedValueOnce(ollamaReply("ok")),
    );
    const seen: string[] = [];
    const runner: AttemptRunner = async (target, run) => {
      seen.push(target.model);
      return run();
    };
    await generateLine(messages, {}, runner);
    expect(seen).toEqual(["model-a", "gpt-oss:20b"]);
  });
});
