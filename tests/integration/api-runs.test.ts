import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const stats = vi.fn();
const configured = vi.fn();
vi.mock("@/libs/runs", () => ({
  runRepository: { create: (...args: unknown[]) => create(...args), stats: () => stats() },
  storageConfigured: () => configured(),
}));

const { GET, POST } = await import("@/app/api/runs/route");

let ip = 0;
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/runs", { method: "POST", headers: { "x-forwarded-for": `198.51.100.${++ip}` }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const get = () => GET(new Request("http://localhost/api/runs", { headers: { "x-forwarded-for": `198.51.101.${++ip}` } }));

const run = { ending: "preserved", cause: null, durationMs: 600_000, reducedPressure: false, evidenceCount: 8, commandsRun: 30, hintsShown: 1, phaseReached: "recovery", aiLines: 12 };
const totals = { total: 3, preserved: 2, lost: 1, preservedPct: 67 };

describe("/api/runs", () => {
  beforeEach(() => {
    configured.mockReturnValue(true);
    stats.mockResolvedValue(totals);
    create.mockResolvedValue(undefined);
  });
  afterEach(() => vi.clearAllMocks());

  it("records an anonymous run and returns the totals", async () => {
    const response = await post({ ...run, callsign: "RAVEN" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: totals, error: null });
    expect(create).toHaveBeenCalledWith(run);
  });

  it("serves aggregate stats", async () => {
    expect(await (await get()).json()).toEqual({ success: true, data: totals, error: null });
  });

  it("rejects invalid runs", async () => {
    expect((await post("nope")).status).toBe(400);
    expect((await post({ ...run, ending: "won" })).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("degrades gracefully without storage", async () => {
    configured.mockReturnValue(false);
    expect((await get()).status).toBe(503);
    expect((await post(run)).status).toBe(503);
    configured.mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stats.mockRejectedValue(new Error("db down"));
    expect((await get()).status).toBe(503);
    create.mockRejectedValue(new Error("db down"));
    expect((await post(run)).status).toBe(503);
  });

  it("rate limits writes per client", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await POST(new Request("http://localhost/api/runs", { method: "POST", headers: { "x-forwarded-for": "192.0.2.1" }, body: JSON.stringify(run) }))).status);
    }
    expect(statuses[10]).toBe(429);
  });
});
