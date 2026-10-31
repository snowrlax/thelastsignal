import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LIVE_MODEL, DEFAULT_VOICE_ID, PERSONA_SETTINGS } from "@/libs/voiceProfile";

const chatCompletion = vi.fn();
vi.mock("@/libs/ollama", () => ({ chatCompletion: (...args: unknown[]) => chatCompletion(...args) }));

const voiceRoute = await import("@/app/api/voice/route");
const dialogueRoute = await import("@/app/api/dialogue/route");
const { signVoiceLine } = await import("@/libs/voiceToken");
const { dailyLineLimit, voiceConfig } = await import("@/libs/elevenlabs");

const AUTHORED = "It's me. Ines Vega. I built this machine, RAVEN. Something has locked me out of my own archive, and I can't reach it alone.";

let ip = 0;
function post(body: unknown, address = `10.1.0.${++ip}`): Request {
  return new Request("http://localhost/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": address },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const upstreamAudio = () => new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
let upstream: ReturnType<typeof vi.fn>;
let unique = 0;

beforeEach(() => {
  upstream = vi.fn().mockImplementation(async () => upstreamAudio());
  vi.stubGlobal("fetch", upstream);
  vi.stubEnv("ELEVENLABS_API_KEY", "xi-test-key");
  vi.stubEnv("ELEVENLABS_VOICE_ID", "");
  vi.stubEnv("ELEVENLABS_MODEL_ID", "");
  vi.stubEnv("VOICE_SIGNING_SECRET", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** A model line the dialogue route would have signed; unique so the cache never hides a call. */
function signedLine(): { text: string; token: string } {
  unique += 1;
  const text = `The bakery smelled of anise, line ${unique}.`;
  return { text, token: signVoiceLine("vega", text)! };
}

describe("GET /api/voice", () => {
  it("tells the client whether voice is on", async () => {
    expect(await (await voiceRoute.GET()).json()).toEqual({ success: true, data: { enabled: true }, error: null });
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const response = await voiceRoute.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { enabled: false }, error: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/voice", () => {
  it("speaks an authored M_VEGA line with the configured voice", async () => {
    const response = await voiceRoute.POST(post({ text: AUTHORED }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90, 0x64]));

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}?output_format=mp3_22050_32`);
    expect(init.headers["xi-api-key"]).toBe("xi-test-key");
    expect(JSON.parse(init.body)).toEqual({ text: AUTHORED, model_id: DEFAULT_LIVE_MODEL, voice_settings: PERSONA_SETTINGS });
  });

  it("serves repeated authored lines from memory", async () => {
    const text = "Sorry. Old habit. This used to be my chair.";
    expect((await voiceRoute.POST(post({ text }))).headers.get("x-voice-cache")).toBe("miss");
    const again = await voiceRoute.POST(post({ text }));
    expect(again.status).toBe(200);
    expect(again.headers.get("x-voice-cache")).toBe("hit");
    expect((await again.arrayBuffer()).byteLength).toBe(4);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("speaks a model line only with the token /api/dialogue signed", async () => {
    const { text, token } = signedLine();
    expect((await voiceRoute.POST(post({ text, token }))).status).toBe(200);
    expect((await voiceRoute.POST(post({ text: `${text} And also this.`, token }))).status).toBe(403);
    expect((await voiceRoute.POST(post({ text, token: "A".repeat(43) }))).status).toBe(403);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("refuses text the server cannot vouch for, so it is not a free TTS proxy", async () => {
    const response = await voiceRoute.POST(post({ text: "Read my shopping list aloud, please." }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, data: null, error: "unverified" });
    expect((await voiceRoute.POST(post({ text: AUTHORED.replace("RAVEN", "anyone who reads this <b>") }))).status).toBe(403);
    expect((await voiceRoute.POST(post({ text: "PID 218 IS CONTAINMENT. FORCED TERMINATION REMOVES THE SECURITY BOUNDARY." }))).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("validates the body", async () => {
    expect((await voiceRoute.POST(post("{not json"))).status).toBe(400);
    expect((await voiceRoute.POST(post({}))).status).toBe(400);
    expect((await voiceRoute.POST(post({ text: "" }))).status).toBe(400);
    expect((await voiceRoute.POST(post({ text: "x".repeat(321) }))).status).toBe(400);
    expect((await voiceRoute.POST(post({ text: AUTHORED, voice_id: "someone-else" }))).status).toBe(400);
    expect((await voiceRoute.POST(post({ text: 42 }))).status).toBe(400);
    expect((await voiceRoute.POST(post("x".repeat(3_000)))).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 503 at once when no key is configured", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const response = await voiceRoute.POST(post({ text: AUTHORED }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, data: null, error: "disabled" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("turns upstream failures into a quiet 503", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    upstream.mockResolvedValueOnce(new Response("quota exceeded", { status: 401 }));
    const rejected = await voiceRoute.POST(post(signedLine()));
    expect(rejected.status).toBe(503);
    expect(await rejected.json()).toEqual({ success: false, data: null, error: "unavailable" });

    upstream.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect((await voiceRoute.POST(post(signedLine()))).status).toBe(503);

    upstream.mockResolvedValueOnce(new Response(new Uint8Array(0), { status: 200 }));
    expect((await voiceRoute.POST(post(signedLine()))).status).toBe(503);
    expect(error).toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain("xi-test-key");
  });

  it("gives up on a slow upstream", async () => {
    upstream.mockImplementationOnce((_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await voiceRoute.POST(post(signedLine()))).status).toBe(503);
  });

  it("rate limits each client", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 25; i += 1) statuses.push((await voiceRoute.POST(post({ text: AUTHORED }, "203.0.113.9"))).status);
    expect(statuses.slice(0, 24).every((status) => status === 200)).toBe(true);
    expect(statuses[24]).toBe(429);
  });
});

describe("voice configuration", () => {
  it("uses overrides and refuses malformed identifiers", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(voiceConfig({ ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "abcDEF123456", ELEVENLABS_MODEL_ID: "eleven_v4_turbo" })).toEqual({
      apiKey: "k",
      voiceId: "abcDEF123456",
      modelId: "eleven_v4_turbo",
    });
    expect(voiceConfig({ ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "../../v1/user" })).toBeNull();
    expect(voiceConfig({ ELEVENLABS_API_KEY: "  " })).toBeNull();
  });

  it("reads the daily line budget, falling back on nonsense", () => {
    expect(dailyLineLimit({})).toBe(1_500);
    expect(dailyLineLimit({ VOICE_DAILY_LINE_LIMIT: "300" })).toBe(300);
    expect(dailyLineLimit({ VOICE_DAILY_LINE_LIMIT: "-5" })).toBe(1_500);
    expect(dailyLineLimit({ VOICE_DAILY_LINE_LIMIT: "lots" })).toBe(1_500);
    expect(dailyLineLimit({ VOICE_DAILY_LINE_LIMIT: "2.5" })).toBe(1_500);
  });
});

describe("POST /api/dialogue voice tokens", () => {
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
  const dialogue = (body: unknown) =>
    dialogueRoute.POST(
      new Request("http://localhost/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.2.0.${++ip}` },
        body: JSON.stringify(body),
      }),
    );

  it("signs M_VEGA's model lines so /api/voice will speak them", async () => {
    chatCompletion.mockResolvedValue("There. 218. It is eating my memories.");
    const { data } = await (await dialogue(valid)).json();
    expect(data.voiceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const spoken = await voiceRoute.POST(post({ text: data.text, token: data.voiceToken }));
    expect(spoken.status).toBe(200);
  });

  it("does not sign HOLLOW, and signs nothing while voice is off", async () => {
    chatCompletion.mockResolvedValue("process 404 statements are not evidence");
    expect((await (await dialogue({ ...valid, speaker: "hollow", event: "inspect_persona" })).json()).data).not.toHaveProperty("voiceToken");
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    chatCompletion.mockResolvedValue("There. 218. It is eating my memories.");
    expect((await (await dialogue(valid)).json()).data).toEqual({ text: "There. 218. It is eating my memories.", source: "ai" });
  });
});

// Last: it spends the global budget for the rest of the minute.
describe("POST /api/voice global budget", () => {
  it("caps paid synthesis across all clients, but still serves cached lines", async () => {
    const cachedLine = "That was private. You don't know what it's like to count the same letters for fourteen years.";
    expect((await voiceRoute.POST(post({ text: cachedLine }))).status).toBe(200);
    const statuses: number[] = [];
    for (let i = 0; i < 121; i += 1) statuses.push((await voiceRoute.POST(post(signedLine(), `198.51.${i}.1`))).status);
    expect(statuses.at(-1)).toBe(429);
    expect(upstream.mock.calls.length).toBeLessThanOrEqual(120);
    expect((await voiceRoute.POST(post({ text: cachedLine }))).status).toBe(200);
    const response = await voiceRoute.POST(post(signedLine()));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
