import { createInitialState, runCommand, tick } from "@/game/engine";
import type { GameState, StepResult } from "@/game/types";

export function newGame(overrides: Partial<{ playerName: string; reducedPressure: boolean }> = {}): GameState {
  return createInitialState({ playerName: overrides.playerName ?? "RAVEN", reducedPressure: overrides.reducedPressure ?? false });
}

/** A game that has passed the prologue: phase 1 timer is running. */
export function startedGame(overrides: Partial<{ playerName: string; reducedPressure: boolean }> = {}): GameState {
  return tick(newGame(overrides), 3_000).state;
}

export function text(result: StepResult): string {
  return result.lines.map((line) => line.text).join("\n");
}

/** Runs several commands in order and returns the final result plus every intermediate one. */
export function runAll(state: GameState, commands: readonly string[]): { state: GameState; results: StepResult[] } {
  let current = state;
  const results: StepResult[] = [];
  for (const command of commands) {
    const result = runCommand(current, command);
    results.push(result);
    current = result.state;
  }
  return { state: current, results };
}

export function eventIds(results: readonly StepResult[]): string[] {
  return results.flatMap((result) => result.events.map((event) => event.id));
}

export const PHASE1_COMMANDS = ["cat README.txt", "cat /research/reconstruction_notes.txt", "cat /archive/vega/session_014.log"];
export const PHASE2_COMMANDS = ["ps aux", "ps -fp 218", "cat /restricted/containment_protocol.txt", "cat /restricted/identity_validation.log"];
export const RECOVERY_COMMANDS = ["cp -r /archive/vega /recovery/vega_archive", "kill -TERM 404"];
