// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputLine } from "@/game/types";

const voice = vi.hoisted(() => ({
  prepare: vi.fn(),
  speak: vi.fn(async () => true),
  supersede: vi.fn(),
  untilQuiet: vi.fn(async () => undefined),
  stop: vi.fn(),
}));
const deck = vi.hoisted(() => ({
  preload: vi.fn(),
  arm: vi.fn((lines: readonly OutputLine[]) => lines),
  printed: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/libs/voicePlayer", () => ({ vegaVoice: () => voice }));
vi.mock("@/libs/voiceTape", () => ({ tapeDeck: () => deck }));

const { useDialogue } = await import("@/hooks/useDialogue");
const { useEndingSequence } = await import("@/hooks/useEndingSequence");
const { useGameStore } = await import("@/hooks/useGameStore");
const { usePrinter } = await import("@/hooks/usePrinter");
const { useVoice } = await import("@/hooks/useVoice");
const { freshRun } = await import("@/tests/helpers/store");

const store = () => useGameStore.getState();

async function run(ms: number, step = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

const reply = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }));

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(voice).forEach((mock) => mock.mockClear());
  Object.values(deck).forEach((mock) => mock.mockClear());
  freshRun();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("M_VEGA's voice in the dialogue loop", () => {
  it("speaks a model line with the token the server signed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ text: "¿Hola? ¿Quién está ahí?", source: "ai", voiceToken: "signed" })));
    renderHook(() => useDialogue(true));
    act(() => store().advance(3_000));
    await run(2_000);
    expect(voice.supersede).toHaveBeenCalled();
    expect(voice.speak).toHaveBeenCalledWith("¿Hola? ¿Quién está ahí?", "signed");
  });

  it("speaks the authored line, unsigned, when the model is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    renderHook(() => useDialogue(true));
    act(() => store().advance(3_000));
    await run(2_000);
    const [text, token] = voice.speak.mock.calls[0] as unknown as [string, string | null];
    expect(text).toMatch(/^(Hello\?|Someone's there)/);
    expect(token).toBeNull();
  });

  it("never voices HOLLOW and waits for M_VEGA to finish before the next message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    renderHook(() => useDialogue(true));
    act(() => store().advance(3_000));
    await run(10_000, 250);
    act(() => store().submit("kill -TERM 218"));
    await run(10_000, 250);
    const messages = store().items.filter((item) => item.type === "message");
    expect(messages.some((item) => item.type === "message" && item.speaker === "hollow")).toBe(true);
    const vegaLines = messages.flatMap((item) => (item.type === "message" && item.speaker === "vega" ? [item.text] : []));
    expect(voice.speak.mock.calls.map((call) => (call as unknown[])[0])).toEqual(vegaLines);
    expect(voice.untilQuiet).toHaveBeenCalledTimes(messages.length);
    expect(voice.supersede).toHaveBeenCalledTimes(messages.length);
  });
});

describe("the takeover", () => {
  it("ends in M_VEGA's voice once her first line prints", async () => {
    renderHook(() => {
      usePrinter(true);
      useEndingSequence();
    });
    act(() => {
      store().advance(3_000);
      store().submit("kill -9 218");
    });
    await run(8_000, 250);
    expect(voice.speak).not.toHaveBeenCalled();
    await run(10_000, 250);
    expect(store().transcript).toContain("Thank you, RAVEN.");
    expect(voice.speak).toHaveBeenCalledWith("Thank you, RAVEN. I can finally remember everything.", null);
  });
});

describe("Ines's tapes in the output path", () => {
  it("lets the tape deck pace `play` output and starts it as lines print", async () => {
    const paced: OutputLine = { kind: "voice", text: "[00:00]  paced by the tape" };
    deck.arm.mockImplementationOnce(() => [paced]);
    renderHook(() => usePrinter(true));
    act(() => {
      store().advance(3_000);
      store().submit("play /archive/vega/voice_001.wav");
    });
    expect(deck.arm).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ kind: "voice" })]), "voice_001");
    await run(500);
    expect(deck.printed).toHaveBeenCalledWith(paced);
    expect(deck.stop).toHaveBeenCalled();
    expect(store().game?.timer.pausedBy).not.toContain("recording");
  });

  it("leaves every other command alone", () => {
    act(() => {
      store().advance(3_000);
      store().submit("ls -la");
    });
    expect(deck.arm).not.toHaveBeenCalled();
  });
});

describe("useVoice", () => {
  it("readies the tapes on mount and silences every voice on unmount", () => {
    const { unmount } = renderHook(() => useVoice(true));
    expect(deck.preload).toHaveBeenCalledTimes(1);
    expect(voice.prepare).toHaveBeenCalledTimes(1);
    unmount();
    expect(deck.stop).toHaveBeenCalled();
    expect(voice.stop).toHaveBeenCalled();
  });

  it("does nothing while inactive", () => {
    const { unmount } = renderHook(() => useVoice(false));
    unmount();
    expect(deck.preload).not.toHaveBeenCalled();
    expect(voice.stop).not.toHaveBeenCalled();
  });
});
