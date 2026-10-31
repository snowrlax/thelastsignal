// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogue } from "@/hooks/useDialogue";
import { useEndingSequence } from "@/hooks/useEndingSequence";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useGameStore } from "@/hooks/useGameStore";
import { usePrinter } from "@/hooks/usePrinter";
import { freshRun, printedText } from "@/tests/helpers/store";

const store = () => useGameStore.getState();

async function run(ms: number, step = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  freshRun();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("usePrinter", () => {
  it("prints immediate lines at once and waits out delays", async () => {
    renderHook(() => usePrinter(true));
    act(() => store().enqueueLines([{ kind: "out", text: "now" }, { kind: "out", text: "later", delayMs: 1_000 }]));
    await run(200);
    expect(printedText()).toBe("now");
    await run(1_000);
    expect(printedText()).toBe("now\nlater");
  });

  it("keeps printing even if one entry fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderHook(() => usePrinter(true));
    const printLine = store().printLine;
    let first = true;
    useGameStore.setState({
      printLine: (line) => {
        if (first) {
          first = false;
          throw new Error("boom");
        }
        printLine(line);
      },
    });
    act(() => store().enqueueLines([{ kind: "out", text: "a" }, { kind: "out", text: "b" }]));
    await run(300);
    expect(printedText()).toBe("b");
    expect(error).toHaveBeenCalled();
    useGameStore.setState({ printLine });
  });

  it("does nothing while inactive", async () => {
    renderHook(() => usePrinter(false));
    act(() => store().enqueueLines([{ kind: "out", text: "x" }]));
    await run(300);
    expect(store().items).toHaveLength(0);
  });
});

describe("useGameLoop", () => {
  it("advances game time on an interval", async () => {
    renderHook(() => useGameLoop(true));
    await run(3_000, 250);
    expect(store().game?.clockMs).toBeGreaterThan(0);
  });
});

describe("useDialogue", () => {
  it("voices messages with the model when it answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { text: "¿Hola? ¿Quién está ahí?" } }))));
    renderHook(() => useDialogue(true));
    act(() => store().advance(3_000));
    await run(2_000);
    expect(printedText()).toContain("[vega] ¿Hola? ¿Quién está ahí?");
    expect(store().aiLines).toBe(1);
  });

  it("falls back to authored lines when the model is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    renderHook(() => useDialogue(true));
    act(() => store().advance(3_000));
    await run(2_000);
    expect(printedText()).toMatch(/\[vega\] (Hello\?|Someone's there)/);
    expect(store().aiLines).toBe(0);
  });

  it("waits for a recording to finish before speaking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    renderHook(() => useDialogue(true));
    act(() => {
      store().advance(3_000);
      store().submit("play /archive/vega/voice_001.wav");
    });
    await run(3_000);
    expect(store().items.some((item) => item.type === "message")).toBe(false);
    act(() => store().releaseRecording());
    await run(3_000);
    expect(store().items.some((item) => item.type === "message")).toBe(true);
  });

  it("drops queued lines that the story has moved past", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    renderHook(() => useDialogue(true));
    act(() => {
      store().advance(3_000);
      useGameStore.setState({ messageQueue: [] });
      for (const command of ["cat README.txt", "cat /research/model_test.log", "cat /archive/vega/session_014.log"]) store().submit(command);
      store().submit("ps aux");
    });
    await run(12_000);
    expect(printedText()).not.toContain("PROCESS TABLE ANOMALY");
  });
});

describe("useEndingSequence", () => {
  it("plays the takeover and lands on the ending screen", async () => {
    renderHook(() => {
      usePrinter(true);
      useEndingSequence();
    });
    act(() => {
      store().advance(3_000);
      store().submit("kill -9 218");
    });
    await run(40_000, 250);
    expect(printedText()).toContain("Thank you, RAVEN.");
    expect(store().screen).toBe("ending");
  });

  it("closes the session quietly on the good ending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    renderHook(() => {
      usePrinter(true);
      useDialogue(true);
      useEndingSequence();
    });
    act(() => {
      store().advance(3_000);
      for (const command of [
        "cat README.txt",
        "cat /research/reconstruction_notes.txt",
        "cat /archive/vega/session_014.log",
        "ps -fp 404",
        "cat /restricted/containment_protocol.txt",
        "cat /restricted/identity_validation.log",
        "cp -r /archive/vega /recovery/vega_archive",
        "kill -TERM 404",
      ]) {
        store().submit(command);
      }
    });
    await run(60_000, 250);
    expect(printedText()).toContain("OFRENDA SYSTEM: SAFE SHUTDOWN");
    expect(printedText()).toContain("[vega] I think I understand now.");
    expect(store().screen).toBe("ending");
  });
});
