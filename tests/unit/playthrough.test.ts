import { describe, expect, it } from "vitest";
import { runCommand, tick } from "@/game/engine";
import { eventIds, newGame, PHASE1_COMMANDS, PHASE2_COMMANDS, RECOVERY_COMMANDS, runAll, startedGame, text } from "@/tests/helpers/game";

describe("full playthroughs", () => {
  it("starts in the prologue with no timer, then opens phase 1 at 03:00", () => {
    const game = newGame();
    expect(game.phase).toBe("prologue");
    expect(game.timer.running).toBe(false);
    const opened = tick(game, 3_000);
    expect(opened.state.phase).toBe("archive");
    expect(opened.state.timer.totalMs).toBe(180_000);
    expect(opened.events.map((event) => event.id)).toContain("session_open");
  });

  it("reaches ENDING A (archive preserved) on the intended route", () => {
    const { state, results } = runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS, ...RECOVERY_COMMANDS]);
    expect(state.phase).toBe("ended");
    expect(state.outcome).toEqual({ ending: "preserved", cause: null });
    expect(state.system.hollowRunning).toBe(true);
    expect(state.system.personaRunning).toBe(false);
    expect(state.system.archiveCopied).toBe(true);
    const ids = eventIds(results);
    expect(ids).toEqual(expect.arrayContaining(["phase2_start", "phase3_start", "archive_copied", "persona_stopped"]));
    expect(results.at(-1)?.effects).toContainEqual({ type: "ending", ending: "preserved", cause: null });
  });

  it("reaches the good ending through a search-driven route (grep, find)", () => {
    const { state } = runAll(startedGame(), [
      "grep 'not the person' ~",
      "grep GENERATED /research",
      "grep generated /archive",
      "top",
      "ps -fp 404",
      "grep 'kill -9 218' /restricted",
      "grep verdict /restricted",
      ...RECOVERY_COMMANDS,
    ]);
    expect(state.outcome.ending).toBe("preserved");
  });

  it("ENDING B: kill -9 218 force-kills HOLLOW and the reconstruction takes over", () => {
    const { state, results } = runAll(startedGame(), ["ps aux", "kill -9 218"]);
    expect(state.outcome).toEqual({ ending: "lost", cause: "hollow_killed" });
    expect(state.system.hollowRunning).toBe(false);
    expect(state.system.containment).toBe("compromised");
    expect(state.system.breach).toBe(true);
    expect(eventIds(results)).toContain("hollow_killed");
  });

  it("ignores further commands after an ending", () => {
    const { state } = runAll(startedGame(), ["kill -9 218"]);
    const after = runCommand(state, "ls");
    expect(after.state).toBe(state);
    expect(after.lines).toHaveLength(0);
  });

  it("is deterministic: the same inputs always produce the same state", () => {
    const script = [...PHASE1_COMMANDS, "top", "ps -fp 404", ...PHASE2_COMMANDS];
    const first = runAll(startedGame(), script);
    const second = runAll(startedGame(), script);
    expect(second.state).toEqual(first.state);
    expect(second.results.map(text)).toEqual(first.results.map(text));
  });
});
