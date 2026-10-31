import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();
const createRun = vi.fn();
vi.mock("@/libs/prisma", () => ({ prisma: { signalRun: { groupBy: (...a: unknown[]) => groupBy(...a), create: (...a: unknown[]) => createRun(...a) } } }));

const { chatCompletion, configuredModels } = await import("@/libs/ollama");
const { computeStats, runRepository, storageConfigured } = await import("@/libs/runs");

const messages = [{ role: "user" as const, content: "hi" }];

describe("ollama client", () => {
  beforeEach(() => {
    vi.stubEnv("OLLAMA_API_KEY", "test-key");
    vi.stubEnv("OLLAMA_MODEL", "model-a");
    vi.stubEnv("OLLAMA_FALLBACK_MODEL", "gpt-oss:20b");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns the primary model's reply with auth and a low-think fallback config", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: "Hello." } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatCompletion(messages)).toBe("Hello.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ollama.com/api/chat");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toMatchObject({ model: "model-a", stream: false });
  });

  it("falls back to the second model when the first fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: "From fallback." } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatCompletion(messages)).toBe("From fallback.");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ model: "gpt-oss:20b", think: "low" });
  });

  it("returns null when every model fails, throws or answers empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    expect(await chatCompletion(messages)).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: "  " } }))));
    expect(await chatCompletion(messages)).toBeNull();
  });

  it("skips the network entirely without a key or budget", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatCompletion(messages, { deadlineMs: 100 })).toBeNull();
    vi.stubEnv("OLLAMA_API_KEY", "");
    expect(await chatCompletion(messages)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deduplicates identical model settings", () => {
    vi.stubEnv("OLLAMA_FALLBACK_MODEL", "model-a");
    expect(configuredModels()).toEqual(["model-a"]);
  });
});

describe("run repository", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("computes percentages safely", () => {
    expect(computeStats(0, 0)).toEqual({ total: 0, preserved: 0, lost: 0, preservedPct: 0 });
    expect(computeStats(1, 2)).toEqual({ total: 3, preserved: 1, lost: 2, preservedPct: 33 });
  });

  it("aggregates and stores runs through prisma", async () => {
    groupBy.mockResolvedValue([{ ending: "preserved", _count: { _all: 3 } }, { ending: "lost", _count: { _all: 1 } }]);
    expect(await runRepository.stats()).toEqual({ total: 4, preserved: 3, lost: 1, preservedPct: 75 });
    const run = { ending: "lost" as const, cause: "timeout" as const, durationMs: 1, reducedPressure: false, evidenceCount: 1, commandsRun: 1, hintsShown: 0, phaseReached: "archive" as const, aiLines: 0 } as const;
    await runRepository.create(run);
    expect(createRun).toHaveBeenCalledWith({ data: run });
  });

  it("reports whether storage is configured", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(storageConfigured()).toBe(false);
    vi.stubEnv("DATABASE_URL", "postgres://x");
    expect(storageConfigured()).toBe(true);
  });
});
