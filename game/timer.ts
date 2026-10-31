import {
  ACCELERATED_BREACH_MS,
  BEATS,
  DESTRUCTIVE_BREACH_LIMIT,
  GRACE_MS,
  IDLE_HINT_MS,
  WARNING_THRESHOLDS,
} from "@/game/constants";
import { isAfterMidnight } from "@/game/clock";
import { phase2GraceEligible } from "@/game/evidence";
import { finalizeEvents } from "@/game/events";
import { contextualHint } from "@/game/hints";
import { loseGame } from "@/game/outcome";
import { advancePhases, enterPhase } from "@/game/phases";
import { hint, line } from "@/game/text";
import type { Effect, GameState, OutputLine, StepResult, StoryEvent, TimerState } from "@/game/types";

interface Accumulator {
  state: GameState;
  events: StoryEvent[];
  lines: OutputLine[];
  effects: Effect[];
}

function scheduledBeats(acc: Accumulator): void {
  const { state } = acc;
  if (state.phase === "archive") {
    if (state.phaseElapsedMs >= BEATS.vegaIntroMs) acc.events.push({ id: "vega_intro" });
    if (state.phaseElapsedMs >= BEATS.hollowWarningMs) acc.events.push({ id: "hollow_first_warning" });
  }
  if (state.phase === "process" && state.phaseElapsedMs >= BEATS.askKillMs) {
    acc.events.push({ id: "ask_kill" });
  }
}

function idleHint(acc: Accumulator, dtMs: number): void {
  const idleMs = acc.state.idleMs + dtMs;
  if (idleMs < IDLE_HINT_MS) {
    acc.state = { ...acc.state, idleMs };
    return;
  }
  acc.state = { ...acc.state, idleMs: 0, hintsShown: acc.state.hintsShown + 1 };
  acc.lines.push(hint(`hint: ${contextualHint(acc.state)}`));
}

function fireWarnings(acc: Accumulator): void {
  const { timer } = acc.state;
  const percent = (timer.remainingMs / timer.totalMs) * 100;
  const due = WARNING_THRESHOLDS.filter((threshold) => percent <= threshold && !timer.warningsFired.includes(threshold));
  if (due.length === 0) return;
  acc.state = { ...acc.state, timer: { ...timer, warningsFired: [...timer.warningsFired, ...due] } };
  // Only the most severe threshold crossed in this tick is announced.
  const worst = Math.min(...due);
  acc.events.push({ id: `warn_${worst}` as StoryEvent["id"] });
}

function expire(acc: Accumulator): void {
  const { state } = acc;
  const startGrace = (totalMs: number) => {
    acc.state = { ...state, timer: { ...state.timer, remainingMs: 0, grace: { remainingMs: totalMs, totalMs } } };
    acc.events.push({ id: "grace_start" });
    acc.lines.push(line("warn", `!! CONTAINMENT WINDOW EXPIRED · FINAL GRACE ${Math.round(totalMs / 1000)}s !!`));
  };

  if (state.phase === "archive") return startGrace(GRACE_MS.archive);
  if (state.phase === "process" && phase2GraceEligible(state)) return startGrace(GRACE_MS.process);
  timeout(acc);
}

function timeout(acc: Accumulator): void {
  const lost = loseGame(acc.state, "timeout");
  acc.state = lost.state;
  acc.effects.push(...lost.effects);
  acc.events.push({ id: "timeout" });
}

function countDown(acc: Accumulator, dtMs: number): void {
  const timer: TimerState = acc.state.timer;
  if (!timer.running) return;

  if (timer.readingHoldMs > 0) {
    acc.state = { ...acc.state, timer: { ...timer, readingHoldMs: Math.max(0, timer.readingHoldMs - dtMs) } };
    return;
  }
  if (timer.grace) {
    const remainingMs = timer.grace.remainingMs - dtMs;
    if (remainingMs <= 0) return timeout(acc);
    acc.state = { ...acc.state, timer: { ...timer, grace: { ...timer.grace, remainingMs } } };
    return;
  }
  const remainingMs = Math.max(0, timer.remainingMs - dtMs);
  acc.state = { ...acc.state, timer: { ...timer, remainingMs } };
  fireWarnings(acc);
  if (remainingMs === 0) expire(acc);
}

/** Advances time. Deterministic: the same sequence of ticks yields the same state. */
export function tick(initial: GameState, dtMs: number): StepResult {
  if (initial.phase === "ended" || dtMs <= 0) {
    return { state: initial, lines: [], events: [], effects: [] };
  }
  const acc: Accumulator = {
    state: { ...initial, clockMs: initial.clockMs + dtMs, tickCount: initial.tickCount + 1 },
    events: [],
    lines: [],
    effects: [],
  };

  if (isAfterMidnight(acc.state.clockMs)) acc.events.push({ id: "midnight" });

  if (acc.state.phase === "prologue") {
    if (acc.state.clockMs >= BEATS.sessionOpenMs) {
      acc.state = enterPhase(acc.state, "archive");
      acc.events.push({ id: "session_open" });
      // Evidence gathered during the untimed prologue still counts.
      const advanced = advancePhases(acc.state);
      acc.state = advanced.state;
      acc.events.push(...advanced.events);
      acc.lines.push(...advanced.lines);
    }
  } else if (acc.state.timer.pausedBy.length === 0) {
    acc.state = { ...acc.state, phaseElapsedMs: acc.state.phaseElapsedMs + dtMs };
    scheduledBeats(acc);
    idleHint(acc, dtMs);
    countDown(acc, dtMs);
  }

  const finalized = finalizeEvents(acc.state, acc.events);
  return { state: finalized.state, lines: acc.lines, events: finalized.events, effects: acc.effects };
}

/** Removes time from the current window (or grace period). Never ends the game by itself. */
export function applyPenalty(state: GameState, ms: number): GameState {
  const { timer } = state;
  if (!timer.running) return state;
  if (timer.grace) {
    const current = timer.grace.remainingMs;
    return { ...state, timer: { ...timer, grace: { ...timer.grace, remainingMs: Math.min(current, Math.max(1_000, current - ms)) } } };
  }
  return { ...state, timer: { ...timer, remainingMs: Math.max(0, timer.remainingMs - ms) } };
}

/** Repeated destructive commands collapse the window to a few seconds. */
export function accelerateBreach(state: GameState): GameState {
  if (state.destructiveAttempts < DESTRUCTIVE_BREACH_LIMIT || !state.timer.running || state.timer.grace) return state;
  if (state.timer.remainingMs <= ACCELERATED_BREACH_MS) return state;
  return {
    ...state,
    timer: { ...state.timer, remainingMs: Math.min(state.timer.remainingMs, ACCELERATED_BREACH_MS) },
  };
}
