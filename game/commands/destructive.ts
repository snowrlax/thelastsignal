import type { CommandOutcome } from "@/game/commands/types";
import { PENALTY_MS } from "@/game/constants";
import { accelerateBreach, applyPenalty } from "@/game/timer";
import { line } from "@/game/text";
import type { GameState, OutputLine } from "@/game/types";

/** Explicitly destructive commands are refused, cost time, and escalate when repeated. */
export function destructiveOutcome(state: GameState, lines: readonly OutputLine[]): CommandOutcome {
  const counted: GameState = { ...state, destructiveAttempts: state.destructiveAttempts + 1 };
  if (!counted.timer.running) {
    return {
      state: counted,
      lines: [...lines, line("warn", "!! DESTRUCTIVE COMMAND REFUSED BY CONTAINMENT POLICY !!")],
      events: [{ id: "destructive" }],
      effects: [{ type: "sound", name: "deny" }],
    };
  }
  const penalized = applyPenalty(counted, PENALTY_MS.destructive);
  const accelerated = accelerateBreach(penalized);
  const extra: OutputLine[] = [
    line("warn", `!! DESTRUCTIVE COMMAND REFUSED · -${PENALTY_MS.destructive / 1000}s CONTAINMENT WINDOW !!`),
  ];
  if (accelerated !== penalized) {
    extra.push(line("warn", "!! BOUNDARY DEGRADED BY REPEATED ATTEMPTS · WINDOW CUT TO 00:15 !!"));
  }
  return {
    state: accelerated,
    lines: [...lines, ...extra],
    events: [{ id: "destructive" }],
    effects: [{ type: "sound", name: "deny" }, { type: "glitch", intensity: "low" }],
  };
}
