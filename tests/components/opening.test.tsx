// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { played } = vi.hoisted(() => ({ played: [] as string[] }));
vi.mock("@/libs/audio", () => ({
  sound: () => ({ play: (cue: string) => played.push(cue), setHumLevel: () => undefined }),
}));

import CinematicScreen from "@/components/screens/CinematicScreen";
import { CUT_MS, OPENING_CARDS, PROMPT, cardSeed, openingDurationMs } from "@/components/screens/opening";
import { useGameStore } from "@/hooks/useGameStore";
import { useHumanTyping } from "@/hooks/useHumanTyping";
import { readFlag, STORAGE_KEYS } from "@/libs/storage";
import { humanTypingSchedule, typingDuration } from "@/libs/typing";

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Let React render between small steps, as a browser would, so effect-scheduled timers start on time. */
async function play(ms: number, step = 20): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) await advance(Math.min(step, ms - elapsed));
}

/** Rendering between steps can start each card's timers up to two steps late. */
const SLACK_PER_CARD = 40;

function setReducedMotion(reduce: boolean): void {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
}

const cinema = () => screen.getByTestId("cinematic");
const press = (key: string, repeat = false) => act(() => void fireEvent.keyDown(window, { key, repeat }));
const strokes = () => played.filter((cue) => cue === "type" || cue === "typeSpace");

beforeEach(() => {
  vi.useFakeTimers();
  played.length = 0;
  window.localStorage.clear();
  setReducedMotion(false);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  useGameStore.getState().setScreen("cinematic");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useHumanTyping", () => {
  it("reveals one character per scheduled stroke and reports each one", async () => {
    const typed: string[] = [];
    const text = "AB C";
    const times = humanTypingSchedule(text, 1);
    const { result } = renderHook(() => useHumanTyping(text, { seed: 1, onStroke: (char) => typed.push(char) }));
    expect(result.current).toMatchObject({ count: 0, done: false });
    await advance(times[0]);
    expect(result.current.count).toBe(1);
    await advance(times[1] - times[0]);
    expect(result.current.count).toBe(2);
    await advance(times[3] - times[1]);
    expect(result.current).toMatchObject({ count: 4, done: true });
    expect(typed).toEqual(["A", "B", " ", "C"]);
  });

  it("complete() shows the rest at once and stops the strokes", async () => {
    const typed: string[] = [];
    const { result } = renderHook(() => useHumanTyping("HELLO THERE", { seed: 2, onStroke: (char) => typed.push(char) }));
    await advance(humanTypingSchedule("HELLO THERE", 2)[1]);
    act(() => result.current.complete());
    expect(result.current).toMatchObject({ count: 11, done: true });
    const before = typed.length;
    await advance(5_000);
    expect(typed).toHaveLength(before);
  });

  it("shows everything from the first frame, without strokes, when instant", async () => {
    const typed: string[] = [];
    const { result } = renderHook(() => useHumanTyping("QUIET", { seed: 3, instant: true, onStroke: (char) => typed.push(char) }));
    expect(result.current).toMatchObject({ count: 5, done: true });
    await advance(5_000);
    expect(typed).toEqual([]);
  });

  it("times every key from the start, so a late timer does not delay the rest", async () => {
    const text = "STEADY HANDS ON THE KEYS";
    const lag = 300;
    const times = humanTypingSchedule(text, 6);
    const remaining = times[times.length - 1] - times[1] - lag;
    expect(remaining).toBeGreaterThan(0);
    const { result } = renderHook(() => useHumanTyping(text, { seed: 6 }));
    await advance(times[0]);
    // The wall clock jumps (a busy main thread): the next key fires late, then the schedule catches up.
    vi.setSystemTime(Date.now() + lag);
    await advance(times[1] - times[0]);
    expect(result.current.count).toBe(2);
    await advance(remaining - 1);
    expect(result.current.count).toBeLessThan(text.length);
    await advance(1);
    expect(result.current).toMatchObject({ count: text.length, done: true });
  });

  it("starts over when the text changes", async () => {
    const { result, rerender } = renderHook(({ text }) => useHumanTyping(text, { seed: 4 }), { initialProps: { text: "ONE" } });
    await advance(typingDuration("ONE", 4));
    expect(result.current.done).toBe(true);
    rerender({ text: "TWO WORDS" });
    expect(result.current).toMatchObject({ count: 0, done: false });
    await advance(typingDuration("TWO WORDS", 4));
    expect(result.current).toMatchObject({ count: 9, done: true });
  });

  it("is done at once for empty text", () => {
    const { result } = renderHook(() => useHumanTyping("", { seed: 5 }));
    expect(result.current).toMatchObject({ count: 0, done: true });
  });
});

describe("CinematicScreen", () => {
  const first = OPENING_CARDS[0];

  it("types the first card with a typewriter click per key", async () => {
    render(<CinematicScreen />);
    expect(cinema().getAttribute("data-card")).toBe("0");
    expect(cinema().getAttribute("data-state")).toBe("typing");
    expect(screen.getByText(first.text)).toBeTruthy();
    await play(typingDuration(first.text, cardSeed(0)));
    expect(cinema().getAttribute("data-progress")).toBe(String(first.text.length));
    expect(cinema().getAttribute("data-state")).toBe("holding");
    expect(strokes()).toHaveLength(first.text.length);
    expect(played.filter((cue) => cue === "typeSpace")).toHaveLength(first.text.split(" ").length - 1);
  });

  it("holds the line, cuts with a carriage return, then types the next card", async () => {
    render(<CinematicScreen />);
    await play(typingDuration(first.text, cardSeed(0)) + first.hold + SLACK_PER_CARD);
    expect(cinema().getAttribute("data-state")).toBe("cut");
    expect(played).toContain("carriage");
    await play(CUT_MS);
    expect(cinema().getAttribute("data-card")).toBe("1");
    expect(cinema().getAttribute("data-state")).toBe("typing");
    expect(cinema().getAttribute("data-progress")).toBe("0");
  });

  it("cannot be hurried on the first viewing", async () => {
    render(<CinematicScreen />);
    await advance(humanTypingSchedule(first.text, cardSeed(0))[1]);
    press(" ");
    press("Escape");
    expect(cinema().getAttribute("data-card")).toBe("0");
    expect(cinema().getAttribute("data-state")).toBe("typing");
    expect(Number(cinema().getAttribute("data-progress"))).toBeLessThan(first.text.length);
    expect(useGameStore.getState().screen).toBe("cinematic");
    expect(screen.queryByText(/SPACE · NEXT/)).toBeNull();
  });

  it("on later viewings a key finishes the line, the next moves on, and Escape skips", async () => {
    window.localStorage.setItem("tls:seenOpening", "1");
    render(<CinematicScreen />);
    expect(screen.getByText(/SPACE · NEXT/)).toBeTruthy();
    await advance(humanTypingSchedule(first.text, cardSeed(0))[0]);
    press(" ");
    expect(cinema().getAttribute("data-state")).toBe("holding");
    expect(cinema().getAttribute("data-progress")).toBe(String(first.text.length));
    press(" ");
    await advance(100);
    expect(cinema().getAttribute("data-card")).toBe("1");
    press("Escape");
    expect(useGameStore.getState().screen).toBe("boot");
  });

  it("ignores keys during the cut and held-down keys on later viewings", async () => {
    window.localStorage.setItem("tls:seenOpening", "1");
    render(<CinematicScreen />);
    await play(typingDuration(first.text, cardSeed(0)) + first.hold + SLACK_PER_CARD);
    expect(cinema().getAttribute("data-state")).toBe("cut");
    press(" ");
    press(" ");
    expect(cinema().getAttribute("data-card")).toBe("0");
    expect(played.filter((cue) => cue === "carriage")).toHaveLength(1);
    await play(CUT_MS);
    expect(cinema().getAttribute("data-card")).toBe("1");
    press(" ", true);
    expect(cinema().getAttribute("data-state")).toBe("typing");
    press("Escape");
    expect(useGameStore.getState().screen).toBe("boot");
  });

  it("lets a first-time player continue only once the prompt is fully typed", async () => {
    render(<CinematicScreen />);
    await play(openingDurationMs() + SLACK_PER_CARD * OPENING_CARDS.length);
    expect(cinema().getAttribute("data-state")).toBe("prompt");
    expect(Number(cinema().getAttribute("data-progress"))).toBeLessThan(PROMPT.length);
    press("Enter");
    expect(useGameStore.getState().screen).toBe("cinematic");
  });

  it("ends on a typed prompt that any key answers, and remembers the opening was seen", async () => {
    render(<CinematicScreen />);
    await play(openingDurationMs() + SLACK_PER_CARD * OPENING_CARDS.length);
    expect(cinema().getAttribute("data-state")).toBe("prompt");
    expect(screen.getByText(PROMPT)).toBeTruthy();
    await play(typingDuration(PROMPT, cardSeed(OPENING_CARDS.length)));
    expect(cinema().getAttribute("data-progress")).toBe(String(PROMPT.length));
    press("Enter");
    expect(useGameStore.getState().screen).toBe("boot");
    expect(readFlag(STORAGE_KEYS.seenOpening)).toBe(true);
  });

  it("shows each card whole and silently when motion is reduced", async () => {
    setReducedMotion(true);
    render(<CinematicScreen />);
    expect(cinema().getAttribute("data-progress")).toBe(String(first.text.length));
    expect(cinema().getAttribute("data-state")).toBe("holding");
    expect(strokes()).toEqual([]);
  });
});
