import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDialogueRequest, fetchDialogueReply } from "@/libs/dialogueClient";
import { createAudioCache } from "@/libs/voiceCache";
import { fetchVoiceClip, resetVoiceProbe, voiceEnabled } from "@/libs/voiceClient";
import { newGame } from "@/tests/helpers/game";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const mp3 = (bytes = 4) => new Response(new Uint8Array(bytes), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
const signal = () => new AbortController().signal;

beforeEach(() => resetVoiceProbe());
afterEach(() => vi.unstubAllGlobals());

describe("voice probe", () => {
  it("asks the server once and remembers the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, data: { enabled: true }, error: null }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await voiceEnabled()).toBe(true);
    expect(await voiceEnabled()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/voice");
  });

  it("treats errors and odd answers as off", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: true, data: { enabled: false }, error: null })));
    expect(await voiceEnabled()).toBe(false);
    resetVoiceProbe();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    expect(await voiceEnabled()).toBe(false);
    resetVoiceProbe();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await voiceEnabled()).toBe(false);
  });
});

describe("fetchVoiceClip", () => {
  it("returns mp3 bytes and sends the token only when there is one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mp3(8));
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchVoiceClip("Hola.", "tok", signal()))?.byteLength).toBe(8);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "Hola.", token: "tok" });
    await fetchVoiceClip("Hola.", null, signal());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ text: "Hola." });
  });

  it("returns null for errors, empty bodies and anything that is not audio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: false, data: null, error: "unverified" }, 403)));
    expect(await fetchVoiceClip("x", null, signal())).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ ok: true })));
    expect(await fetchVoiceClip("x", null, signal())).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mp3(0)));
    expect(await fetchVoiceClip("x", null, signal())).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    expect(await fetchVoiceClip("x", null, signal())).toBeNull();
  });

  it("stops asking once the server says voice is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: true, data: { enabled: true }, error: null })));
    expect(await voiceEnabled()).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: false, data: null, error: "disabled" }, 503)));
    expect(await fetchVoiceClip("x", null, signal())).toBeNull();
    expect(await voiceEnabled()).toBe(false);
  });

  it("keeps voice on after a passing upstream failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: true, data: { enabled: true }, error: null })));
    await voiceEnabled();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 503 })));
    expect(await fetchVoiceClip("x", null, signal())).toBeNull();
    expect(await voiceEnabled()).toBe(true);
  });
});

describe("dialogue replies carry the voice token", () => {
  const game = newGame();
  const request = buildDialogueRequest(game, { key: "k", templateIndex: 0, speaker: "vega", event: "session_open", fallback: "x", useAi: true, delayMs: 0 }, []);

  it("returns the token with the text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: true, data: { text: "Hola.", source: "ai", voiceToken: "abc" }, error: null })));
    expect(await fetchDialogueReply(request)).toEqual({ text: "Hola.", voiceToken: "abc" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ success: true, data: { text: "Hola.", source: "ai" }, error: null })));
    expect(await fetchDialogueReply(request)).toEqual({ text: "Hola.", voiceToken: null });
  });
});

describe("audio cache", () => {
  const buffer = (size: number) => new ArrayBuffer(size);

  it("evicts the least recently used entry", () => {
    const cache = createAudioCache({ maxEntries: 2, maxBytes: 1_000 });
    cache.set("a", buffer(1));
    cache.set("b", buffer(1));
    expect(cache.get("a")).toBeDefined();
    cache.set("c", buffer(1));
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("c")).toBeDefined();
  });

  it("stays under its byte budget and skips oversized audio", () => {
    const cache = createAudioCache({ maxEntries: 10, maxBytes: 100 });
    cache.set("big", buffer(101));
    expect(cache.get("big")).toBeUndefined();
    cache.set("a", buffer(60));
    cache.set("b", buffer(60));
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeDefined();
    cache.set("b", buffer(30));
    cache.set("c", buffer(60));
    expect(cache.get("b")?.byteLength).toBe(30);
    expect(cache.get("c")).toBeDefined();
  });
});
