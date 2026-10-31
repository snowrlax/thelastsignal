import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createLinePlayer, type LinePlayerDeps } from "@/libs/voicePlayer";
import type { Playback } from "@/libs/voiceOutput";

interface FakePlayback extends Playback {
  readonly stop: Mock<() => void>;
  finish(): void;
}

function fakePlayback(): FakePlayback {
  let finish = () => undefined as void;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { done, stop: vi.fn(() => finish()), finish: () => finish() };
}

const bytesOf = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const later = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function setup(overrides: Partial<LinePlayerDeps<string>> = {}) {
  const playbacks: { clip: string; playback: FakePlayback }[] = [];
  const deps: LinePlayerDeps<string> = {
    canPlay: () => true,
    enabled: async () => true,
    fetchClip: vi.fn(async (text: string) => bytesOf(text)),
    decode: async (bytes) => new TextDecoder().decode(bytes),
    start: (clip) => {
      const playback = fakePlayback();
      playbacks.push({ clip, playback });
      return playback;
    },
    ...overrides,
  };
  return { player: createLinePlayer(deps, 2_500), deps, playbacks };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("M_VEGA line player", () => {
  it("speaks a line that is ready in time", async () => {
    const { player, deps, playbacks } = setup();
    expect(await player.speak("Hola.", "token-1")).toBe(true);
    expect(deps.fetchClip).toHaveBeenCalledWith("Hola.", "token-1", expect.any(AbortSignal));
    expect(playbacks.map((entry) => entry.clip)).toEqual(["Hola."]);
  });

  it("asks for nothing before the first gesture, while muted, or when the server has no key", async () => {
    const locked = setup({ canPlay: () => false });
    expect(await locked.player.speak("Hola.", null)).toBe(false);
    expect(locked.deps.fetchClip).not.toHaveBeenCalled();

    const disabled = setup({ enabled: async () => false });
    expect(await disabled.player.speak("Hola.", null)).toBe(false);
    expect(disabled.deps.fetchClip).not.toHaveBeenCalled();
  });

  it("stays silent when the clip cannot be fetched, decoded or started", async () => {
    expect(await setup({ fetchClip: async () => null }).player.speak("a", null)).toBe(false);
    expect(await setup({ fetchClip: async () => Promise.reject(new Error("offline")) }).player.speak("a", null)).toBe(false);
    expect(await setup({ decode: async () => null }).player.speak("a", null)).toBe(false);
    expect(await setup({ decode: async () => Promise.reject(new Error("bad mp3")) }).player.speak("a", null)).toBe(false);
    expect(await setup({ start: () => null }).player.speak("a", null)).toBe(false);
  });

  it("drops audio that is not ready within the deadline", async () => {
    const { player, playbacks } = setup({ fetchClip: (text) => later(3_000, bytesOf(text)) });
    const spoken = player.speak("Too late.", null);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await spoken).toBe(false);
    expect(playbacks).toHaveLength(0);
  });

  it("aborts the request at the deadline", async () => {
    let aborted = false;
    const { player } = setup({
      fetchClip: (_text, _token, signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve(null);
          });
        }),
    });
    const spoken = player.speak("Slow.", null);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(aborted).toBe(true);
    expect(await spoken).toBe(false);
  });

  it("drops audio once the next message has appeared", async () => {
    const { player, playbacks } = setup({ fetchClip: (text) => later(1_000, bytesOf(text)) });
    const spoken = player.speak("Old line.", null);
    await vi.advanceTimersByTimeAsync(400);
    player.supersede();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await spoken).toBe(false);
    expect(playbacks).toHaveLength(0);
  });

  it("drops audio if the player muted while it loaded", async () => {
    let audible = true;
    const { player, playbacks } = setup({ canPlay: () => audible, fetchClip: (text) => later(500, bytesOf(text)) });
    const spoken = player.speak("Shh.", null);
    audible = false;
    await vi.advanceTimersByTimeAsync(500);
    expect(await spoken).toBe(false);
    expect(playbacks).toHaveLength(0);
  });

  it("cuts the previous line when a newer one starts", async () => {
    const { player, playbacks } = setup();
    await player.speak("First.", null);
    await player.speak("Second.", null);
    expect(playbacks.map((entry) => entry.clip)).toEqual(["First.", "Second."]);
    expect(playbacks[0].playback.stop).toHaveBeenCalled();
    expect(playbacks[1].playback.stop).not.toHaveBeenCalled();
  });

  it("lets the current line finish if the next one fails", async () => {
    let available = true;
    const { player, playbacks } = setup({ fetchClip: async (text) => (available ? bytesOf(text) : null) });
    await player.speak("First.", null);
    available = false;
    expect(await player.speak("Second.", null)).toBe(false);
    expect(playbacks[0].playback.stop).not.toHaveBeenCalled();
  });

  it("waits for the current line to finish, but never longer than asked", async () => {
    const { player, playbacks } = setup();
    let quiet = false;
    void player.untilQuiet(10_000).then(() => (quiet = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(quiet).toBe(true);

    await player.speak("A long line.", null);
    quiet = false;
    void player.untilQuiet(10_000).then(() => (quiet = true));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(quiet).toBe(false);
    playbacks[0].playback.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(quiet).toBe(true);

    await player.speak("Another long line.", null);
    quiet = false;
    void player.untilQuiet(3_000).then(() => (quiet = true));
    await vi.advanceTimersByTimeAsync(3_000);
    expect(quiet).toBe(true);
  });

  it("stops everything at once", async () => {
    const { player, playbacks } = setup();
    await player.speak("Goodbye.", null);
    player.stop();
    expect(playbacks[0].playback.stop).toHaveBeenCalled();
  });

  it("asks whether voice is on ahead of the first line, but only once audio is unlocked", () => {
    const enabled = vi.fn(async () => true);
    setup({ enabled }).player.prepare();
    expect(enabled).toHaveBeenCalledTimes(1);
    const locked = vi.fn(async () => true);
    setup({ enabled: locked, canPlay: () => false }).player.prepare();
    expect(locked).not.toHaveBeenCalled();
  });
});
