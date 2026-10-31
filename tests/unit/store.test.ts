import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/hooks/useGameStore";
import { flushQueue, freshRun, printedText } from "@/tests/helpers/store";

const store = () => useGameStore.getState();

describe("game store", () => {
  beforeEach(() => freshRun());

  it("starts a clean run from the chosen settings", () => {
    useGameStore.setState({ reducedPressure: true });
    store().startRun();
    expect(store().game?.playerName).toBe("RAVEN");
    expect(store().game?.reducedPressure).toBe(true);
    expect(store().items).toEqual([]);
    expect(store().ending).toBeNull();
  });

  it("queues command output and prints it in order", () => {
    store().submit("pwd");
    expect(store().queue).toHaveLength(2);
    flushQueue();
    expect(printedText()).toBe("operator@ofrenda-01:~$ pwd\n/home/operator");
    expect(store().transcript).toHaveLength(2);
  });

  it("clear empties the screen after the echo prints", () => {
    store().submit("pwd");
    store().submit("clear");
    flushQueue();
    expect(store().items).toEqual([]);
  });

  it("holds the timer for the whole recording and releases it at the end", () => {
    store().advance(3_000);
    store().submit("play /archive/vega/voice_001.wav");
    expect(store().game?.timer.pausedBy).toContain("recording");
    flushQueue();
    expect(store().game?.timer.pausedBy).not.toContain("recording");
    expect(printedText()).toContain("This is Ines Vega. Recording one.");
  });

  it("only advances time on the terminal screen and before an ending", () => {
    useGameStore.setState({ screen: "boot" });
    store().advance(5_000);
    expect(store().game?.clockMs).toBe(0);
    useGameStore.setState({ screen: "terminal" });
    store().advance(5_000);
    expect(store().game?.phase).toBe("archive");
  });

  it("plans character messages from story events", () => {
    store().advance(3_000);
    expect(store().messageQueue.map((message) => message.event)).toContain("session_open");
  });

  it("newer beats replace a character's stale pending lines", () => {
    store().advance(3_000);
    store().submit("reply hello?");
    const vega = store().messageQueue.filter((message) => message.speaker === "vega");
    expect(vega.map((message) => message.event)).toEqual(["player_reply"]);
    expect(store().conversation.at(-1)).toEqual({ speaker: "player", text: "hello?" });
  });

  it("opens, resolves and drops message windows", () => {
    store().advance(3_000);
    const message = store().takeMessage()!;
    const id = store().openMessage(message);
    expect(store().unread).toBe(true);
    expect(store().items.at(-1)).toMatchObject({ type: "message", text: null });
    store().resolveMessage(id, "Hola.", "ai");
    expect(store().items.at(-1)).toMatchObject({ text: "Hola.", source: "ai" });
    expect(store().aiLines).toBe(1);
    expect(store().transcript.at(-1)).toBe("M_VEGA: Hola.");
    const second = store().openMessage(message);
    store().dropMessage(second);
    expect(store().items.some((item) => item.id === second)).toBe(false);
    store().submit("ls");
    expect(store().unread).toBe(false);
  });

  it("a loss records the ending, clears pending dialogue and ignores further input", () => {
    store().advance(3_000);
    store().submit("kill -9 218");
    expect(store().ending).toEqual({ ending: "lost", cause: "hollow_killed" });
    expect(store().messageQueue).toEqual([]);
    const queued = store().queue.length;
    store().submit("ls");
    expect(store().queue.length).toBe(queued);
    store().advance(10_000);
    expect(store().game?.phase).toBe("ended");
  });

  it("the manual pauses the timer and keystrokes release reading holds", () => {
    store().advance(3_000);
    store().setHelp(true);
    const remaining = store().game!.timer.remainingMs;
    store().advance(5_000);
    expect(store().game!.timer.remainingMs).toBe(remaining);
    store().setHelp(false);
    store().submit("cat /research/reconstruction_notes.txt");
    expect(store().game!.timer.readingHoldMs).toBeGreaterThan(0);
    store().keystroke();
    expect(store().game!.timer.readingHoldMs).toBe(0);
    const unchanged = store().game;
    store().keystroke();
    expect(store().game).toBe(unchanged);
  });

  it("applies glitch and sound effects without breaking", () => {
    store().advance(3_000);
    const before = store().glitch.nonce;
    store().submit("kill -TERM 218");
    expect(store().glitch.nonce).toBeGreaterThan(before);
  });

  it("enqueues extra lines and tracks ending stages and settings", () => {
    store().enqueueLines([{ kind: "dim", text: "x" }]);
    expect(store().queue.at(-1)).toEqual({ type: "line", line: { kind: "dim", text: "x" } });
    store().setEndingStage("poweroff");
    expect(store().endingStage).toBe("poweroff");
    store().setMuted(true);
    expect(store().muted).toBe(true);
    store().setPlayerName("ECHO");
    expect(store().playerName).toBe("ECHO");
  });
});
