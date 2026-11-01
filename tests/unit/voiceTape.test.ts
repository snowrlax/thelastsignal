import { describe, expect, it, vi } from "vitest";
import { recordingLines } from "@/game/content/recordings";
import { createTapeDeck, type TapeDeckDeps } from "@/libs/voiceTape";
import { recordingTranscript, transcriptHash, type RecordingTapes } from "@/libs/voiceText";

const transcript = recordingTranscript("final_recording");
const tapes: RecordingTapes = {
  final_recording: {
    src: "/voice/final_recording.mp3",
    durationMs: 60_000,
    cuesMs: transcript.map((_, index) => index * 4_000),
    transcriptHash: transcriptHash(transcript),
  },
};

function setup(overrides: Partial<TapeDeckDeps<string>> = {}, available: RecordingTapes = tapes) {
  const stop = vi.fn();
  const deps: TapeDeckDeps<string> = {
    load: vi.fn(async (src: string) => `clip:${src}`),
    start: vi.fn(() => ({ done: Promise.resolve(), stop })),
    ...overrides,
  };
  return { deck: createTapeDeck(deps, available), deps, stop };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("tape deck", () => {
  it("does nothing at all when no tapes were rendered", () => {
    const { deck, deps } = setup({}, {});
    deck.preload();
    const lines = recordingLines("voice_001");
    expect(deck.arm(lines, "voice_001")).toBe(lines);
    expect(deps.load).not.toHaveBeenCalled();
  });

  it("keeps today's pacing if the tape is not loaded yet, and loads it for next time", async () => {
    const { deck, deps } = setup();
    const lines = recordingLines("final_recording");
    expect(deck.arm(lines, "final_recording")).toBe(lines);
    expect(deps.load).toHaveBeenCalledWith("/voice/final_recording.mp3");
    await flush();
    expect(deck.arm(lines, "final_recording")).not.toBe(lines);
  });

  it("loads each tape once", async () => {
    const { deck, deps } = setup();
    deck.preload();
    deck.preload();
    await flush();
    deck.preload();
    expect(deps.load).toHaveBeenCalledTimes(1);
  });

  it("retries a tape that failed to load", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("404")).mockResolvedValueOnce(null).mockResolvedValue("clip");
    const { deck } = setup({ load });
    deck.preload();
    await flush();
    deck.preload();
    await flush();
    deck.preload();
    await flush();
    expect(load).toHaveBeenCalledTimes(3);
    expect(deck.arm(recordingLines("final_recording"), "final_recording")).not.toEqual(recordingLines("final_recording"));
  });

  it("starts the tape with the first transcript line and stops it on release", async () => {
    const { deck, deps, stop } = setup();
    deck.preload();
    await flush();
    const lines = deck.arm(recordingLines("final_recording"), "final_recording");
    const first = lines.find((line) => line.kind === "voice")!;

    deck.printed(lines[0]);
    expect(deps.start).not.toHaveBeenCalled();
    deck.printed(first);
    expect(deps.start).toHaveBeenCalledWith("clip:/voice/final_recording.mp3");
    deck.printed(first);
    expect(deps.start).toHaveBeenCalledTimes(1);

    deck.stop();
    expect(stop).toHaveBeenCalled();
  });

  it("ignores a stale tape", async () => {
    const stale: RecordingTapes = { final_recording: { ...tapes.final_recording!, transcriptHash: "deadbeef" } };
    const { deck, deps } = setup({}, stale);
    deck.preload();
    await flush();
    const lines = recordingLines("final_recording");
    expect(deck.arm(lines, "final_recording")).toBe(lines);
    lines.forEach((line) => deck.printed(line));
    expect(deps.start).not.toHaveBeenCalled();
  });

  it("disarms on stop, so a cancelled recording never starts", async () => {
    const { deck, deps } = setup();
    deck.preload();
    await flush();
    const lines = deck.arm(recordingLines("final_recording"), "final_recording");
    deck.stop();
    lines.forEach((line) => deck.printed(line));
    expect(deps.start).not.toHaveBeenCalled();
  });
});
