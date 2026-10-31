import { describe, expect, it } from "vitest";
import { noteInput, runCommand, setPause, tick } from "@/game/engine";
import { BEATS, GRACE_MS, IDLE_HINT_MS, PENALTY_MS, PHASE_DURATION_MS } from "@/game/constants";
import { applyPenalty } from "@/game/timer";
import type { GameState, StepResult } from "@/game/types";
import { newGame, PHASE1_COMMANDS, PHASE2_COMMANDS, runAll, startedGame } from "@/tests/helpers/game";

/** Ticks in small steps, like the real loop, collecting every event. */
function advance(state: GameState, ms: number, step = 250): { state: GameState; events: string[]; results: StepResult[] } {
  let current = state;
  const events: string[] = [];
  const results: StepResult[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    const result = tick(current, Math.min(step, ms - elapsed));
    current = result.state;
    events.push(...result.events.map((event) => event.id));
    results.push(result);
  }
  return { state: current, events, results };
}

describe("phase timers", () => {
  it("does not tick an ended game or a zero step", () => {
    const ended = runCommand(startedGame(), "kill -9 218").state;
    expect(tick(ended, 1000).state).toBe(ended);
    const game = startedGame();
    expect(tick(game, 0).state).toBe(game);
  });

  it("fires warnings at 50%, 25% and 10%", () => {
    const { events } = advance(startedGame(), PHASE_DURATION_MS.archive * 0.95);
    expect(events).toEqual(expect.arrayContaining(["warn_50", "warn_25", "warn_10"]));
  });

  it("announces only the most severe threshold crossed in one step", () => {
    const result = tick(startedGame(), PHASE_DURATION_MS.archive * 0.95);
    const warnings = result.events.filter((event) => event.id.startsWith("warn_"));
    expect(warnings).toEqual([{ id: "warn_10" }]);
  });

  it("phase 1 expiry opens a 30 second grace, then takeover", () => {
    const expired = advance(startedGame(), PHASE_DURATION_MS.archive);
    expect(expired.events).toContain("grace_start");
    expect(expired.state.timer.grace).toEqual({ remainingMs: GRACE_MS.archive, totalMs: GRACE_MS.archive });
    const lost = advance(expired.state, GRACE_MS.archive + 250);
    expect(lost.state.outcome).toEqual({ ending: "lost", cause: "timeout" });
    expect(lost.state.endedInPhase).toBe("archive");
    expect(lost.events).toContain("timeout");
    expect(lost.results.some((result) => result.effects.some((effect) => effect.type === "ending"))).toBe(true);
  });

  it("finishing phase 1 during grace gives a reduced phase 2 allowance", () => {
    const inGrace = advance(startedGame(), PHASE_DURATION_MS.archive).state;
    const { state } = runAll(inGrace, PHASE1_COMMANDS);
    expect(state.phase).toBe("process");
    expect(state.finishedPhase1InGrace).toBe(true);
    expect(state.timer.totalMs).toBe(PHASE_DURATION_MS.process * 0.75);
    expect(state.timer.grace).toBeNull();
  });

  it("phase 2 expiry without the decisive evidence is an immediate takeover", () => {
    const process = noteInput(runAll(startedGame(), PHASE1_COMMANDS).state);
    const { state } = advance(process, PHASE_DURATION_MS.process + 250);
    expect(state.outcome.cause).toBe("timeout");
  });

  it("phase 2 expiry with process and containment evidence grants 20 seconds", () => {
    const process = noteInput(runAll(startedGame(), [...PHASE1_COMMANDS, "ps -fp 218", "cat /restricted/containment_protocol.txt", "ls"]).state);
    const expired = advance(process, PHASE_DURATION_MS.process);
    expect(expired.state.timer.grace?.totalMs).toBe(GRACE_MS.process);
    const { state } = runAll(expired.state, ["cat /restricted/identity_validation.log"]);
    expect(state.phase).toBe("recovery");
  });

  it("phase 3 has no grace period", () => {
    const recovery = noteInput(runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS, "ls"]).state);
    expect(recovery.phase).toBe("recovery");
    const { state } = advance(recovery, PHASE_DURATION_MS.recovery + 250);
    expect(state.outcome).toEqual({ ending: "lost", cause: "timeout" });
    expect(state.endedInPhase).toBe("recovery");
  });

  it("reduced-pressure mode lengthens every window by 1.5x", () => {
    const game = startedGame({ reducedPressure: true });
    expect(game.timer.totalMs).toBe(PHASE_DURATION_MS.archive * 1.5);
    const { state } = runAll(game, [...PHASE1_COMMANDS, ...PHASE2_COMMANDS]);
    expect(state.timer.totalMs).toBe(PHASE_DURATION_MS.recovery * 1.5);
  });
});

describe("prologue", () => {
  it("evidence found before the session opens still advances the story", () => {
    const early = runAll(newGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS]).state;
    expect(early.phase).toBe("prologue");
    const opened = advance(early, BEATS.sessionOpenMs);
    expect(opened.state.phase).toBe("recovery");
    expect(opened.events).toEqual(expect.arrayContaining(["session_open", "phase2_start", "phase3_start"]));
  });
});

describe("pauses and fairness", () => {
  it("the manual and recordings hold the timer", () => {
    const paused = setPause(startedGame(), "help", true);
    expect(setPause(paused, "help", true)).toBe(paused);
    const { state } = advance(paused, 20_000);
    expect(state.timer.remainingMs).toBe(paused.timer.remainingMs);
    expect(state.clockMs).toBeGreaterThan(paused.clockMs);
    const resumed = setPause(state, "help", false);
    expect(advance(resumed, 1_000).state.timer.remainingMs).toBe(paused.timer.remainingMs - 1_000);
  });

  it("reading a long file holds the timer until the player types again", () => {
    const reading = runCommand(startedGame(), "cat /research/reconstruction_notes.txt").state;
    const held = advance(reading, 5_000).state;
    expect(held.timer.remainingMs).toBe(reading.timer.remainingMs);
    const typing = noteInput(held);
    expect(typing.timer.readingHoldMs).toBe(0);
    expect(noteInput(typing)).toBe(typing);
    expect(advance(typing, 1_000).state.timer.remainingMs).toBe(reading.timer.remainingMs - 1_000);
  });

  it("the reading hold eventually runs out", () => {
    const reading = runCommand(startedGame(), "cat /restricted/containment_protocol.txt").state;
    const { state } = advance(reading, reading.timer.readingHoldMs + 2_000);
    expect(state.timer.remainingMs).toBeLessThan(reading.timer.remainingMs);
  });

  it("penalties never end the game directly and respect grace periods", () => {
    const game = startedGame();
    expect(applyPenalty(newGame(), 5_000)).toEqual(newGame());
    const nearlyOut = { ...game, timer: { ...game.timer, remainingMs: 3_000 } };
    expect(applyPenalty(nearlyOut, PENALTY_MS.hollowTerm).timer.remainingMs).toBe(0);
    const grace = { ...game, timer: { ...game.timer, grace: { remainingMs: 5_000, totalMs: 30_000 } } };
    expect(applyPenalty(grace, 20_000).timer.grace?.remainingMs).toBe(1_000);
  });

  it("shows an idle hint after sustained inactivity", () => {
    const { results, state } = advance(startedGame(), IDLE_HINT_MS + 500);
    expect(results.some((result) => result.lines.some((line) => line.kind === "hint"))).toBe(true);
    expect(state.hintsShown).toBe(1);
  });
});

describe("scripted beats", () => {
  it("opens the session, introduces M_VEGA, then HOLLOW warns", () => {
    const { events } = advance(newGame(), BEATS.sessionOpenMs + BEATS.hollowWarningMs + 1_000);
    expect(events.indexOf("session_open")).toBeLessThan(events.indexOf("vega_intro"));
    expect(events.indexOf("vega_intro")).toBeLessThan(events.indexOf("hollow_first_warning"));
  });

  it("M_VEGA asks for kill -9 218 once phase 2 has been running a while", () => {
    const process = noteInput(runAll(startedGame(), PHASE1_COMMANDS).state);
    const { events } = advance(process, BEATS.askKillMs + 500);
    expect(events.filter((id) => id === "ask_kill")).toHaveLength(1);
  });

  it("marks midnight once, the hour Dr. Vega was found", () => {
    const held = setPause(startedGame(), "help", true);
    const { events } = advance(held, 9 * 60_000, 1_000);
    expect(events.filter((id) => id === "midnight")).toHaveLength(1);
  });
});
