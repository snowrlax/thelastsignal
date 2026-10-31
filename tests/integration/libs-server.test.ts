import { afterEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();
const createRun = vi.fn();
vi.mock("@/libs/prisma", () => ({ prisma: { signalRun: { groupBy: (...a: unknown[]) => groupBy(...a), create: (...a: unknown[]) => createRun(...a) } } }));

const { computeStats, runRepository, storageConfigured } = await import("@/libs/runs");

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
