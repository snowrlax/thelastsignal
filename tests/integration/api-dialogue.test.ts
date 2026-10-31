import { beforeEach, describe, expect, it, vi } from "vitest";

const chatCompletion = vi.fn();
vi.mock("@/libs/llm", () => ({ chatCompletion: (...args: unknown[]) => chatCompletion(...args) }));

const { POST } = await import("@/app/api/dialogue/route");

let ip = 0;
function request(body: unknown, address = `10.0.0.${++ip}`): Request {
  return new Request("http://localhost/api/dialogue", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": address },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  speaker: "vega",
  event: "first_process_view",
  playerName: "RAVEN",
  phase: "process",
  evidence: ["inspected_processes"],
  system: { archiveCopied: false, hollowRunning: true, personaRunning: true },
  remainingSeconds: 140,
  recent: [],
};

describe("POST /api/dialogue", () => {
  beforeEach(() => chatCompletion.mockReset());

  it("returns a sanitized in-character line", async () => {
    chatCompletion.mockResolvedValue('M_VEGA: "There. 218. It is eating my memories, Raven."');
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { text: "There. 218. It is eating my memories, Raven.", source: "ai" }, error: null });
    const [messages, options] = chatCompletion.mock.calls[0];
    expect(messages[0].content).toContain("M_VEGA");
    expect(options).toEqual({ maxTokens: 160 });
  });

  it("asks HOLLOW for short alerts", async () => {
    chatCompletion.mockResolvedValue("process 404 statements are not evidence");
    const response = await POST(request({ ...valid, speaker: "hollow", event: "inspect_persona" }));
    expect((await response.json()).data.text).toBe("PROCESS 404 STATEMENTS ARE NOT EVIDENCE");
    expect(chatCompletion.mock.calls[0][1]).toEqual({ maxTokens: 60 });
  });

  it("falls back (503) when the model is unavailable or breaks character", async () => {
    chatCompletion.mockResolvedValue(null);
    expect((await POST(request(valid))).status).toBe(503);
    chatCompletion.mockResolvedValue("As an AI language model, I cannot.");
    expect((await POST(request(valid))).status).toBe(503);
  });

  it("rejects malformed bodies without calling the model", async () => {
    expect((await POST(request("{not json"))).status).toBe(400);
    expect((await POST(request({ ...valid, event: "made_up" }))).status).toBe(400);
    expect((await POST(request({ ...valid, playerName: "<>" }))).status).toBe(400);
    expect((await POST(request({ ...valid, event: "ask_kill" }))).status).toBe(422);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("rate limits each client", async () => {
    chatCompletion.mockResolvedValue("Hello.");
    const statuses: number[] = [];
    for (let i = 0; i < 41; i += 1) statuses.push((await POST(request(valid, "203.0.113.7"))).status);
    expect(statuses.slice(0, 40).every((status) => status === 200)).toBe(true);
    expect(statuses[40]).toBe(429);
  });
});
