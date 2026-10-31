import {
  LATE_PHASE2_ALLOWANCE,
  PHASE_DURATION_MS,
  REDUCED_PRESSURE_MULTIPLIER,
} from "@/game/constants";
import { phase1Complete, phase2Complete } from "@/game/evidence";
import { line } from "@/game/text";
import type { GameState, OutputLine, StoryEvent } from "@/game/types";

type TimedPhase = keyof typeof PHASE_DURATION_MS;

export function phaseDuration(phase: TimedPhase, reducedPressure: boolean, allowance = 1): number {
  const multiplier = reducedPressure ? REDUCED_PRESSURE_MULTIPLIER : 1;
  return Math.round(PHASE_DURATION_MS[phase] * multiplier * allowance);
}

export function enterPhase(state: GameState, phase: TimedPhase, allowance = 1): GameState {
  const totalMs = phaseDuration(phase, state.reducedPressure, allowance);
  return {
    ...state,
    phase,
    phaseElapsedMs: 0,
    timer: {
      ...state.timer,
      running: true,
      totalMs,
      remainingMs: totalMs,
      grace: null,
      warningsFired: [],
    },
  };
}

export interface PhaseAdvance {
  readonly state: GameState;
  readonly events: readonly StoryEvent[];
  readonly lines: readonly OutputLine[];
}

/** Moves the story forward as far as the gathered evidence allows. */
export function advancePhases(initial: GameState): PhaseAdvance {
  let state = initial;
  const events: StoryEvent[] = [];
  const lines: OutputLine[] = [];

  if (state.phase === "archive" && phase1Complete(state)) {
    const inGrace = state.timer.grace !== null;
    state = {
      ...enterPhase(state, "process", inGrace ? LATE_PHASE2_ALLOWANCE : 1),
      finishedPhase1InGrace: inGrace,
    };
    events.push({ id: "phase2_start" });
    lines.push(line("sys", "*** ARCHIVE REVIEW LOGGED · CONTAINMENT WINDOW RESET · PROCESS AUDIT ***", 400));
  }

  if (state.phase === "process" && phase2Complete(state)) {
    state = {
      ...enterPhase(state, "recovery"),
      system: { ...state.system, recoveryUnlocked: true },
    };
    events.push({ id: "phase3_start" });
    lines.push(line("sys", "*** PROTOCOL ACKNOWLEDGED · /recovery WRITE LOCK REVOKED FROM PID 404 ***", 400));
  }

  return { state, events, lines };
}
