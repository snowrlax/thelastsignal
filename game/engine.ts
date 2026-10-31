import { echoHandler, replyHandler } from "@/game/commands/misc";
import { parseCommandLine } from "@/game/commands/parse";
import { findCommand, RAW_TEXT_COMMANDS, unknownCommand } from "@/game/commands/registry";
import type { CommandOutcome } from "@/game/commands/types";
import { ERROR_HINT_THRESHOLD, HOME, HOSTNAME, MAX_NAME_LENGTH } from "@/game/constants";
import { finalizeEvents } from "@/game/events";
import { displayPath } from "@/game/fs/paths";
import { contextualHint } from "@/game/hints";
import { advancePhases } from "@/game/phases";
import { dim, err, hint, line } from "@/game/text";
import { EVIDENCE_FLAGS, type Evidence, type GameState, type PauseReason, type StepResult } from "@/game/types";

export { tick } from "@/game/timer";

export interface NewGameOptions {
  readonly playerName: string;
  readonly reducedPressure: boolean;
}

/** Callsigns are trimmed, collapsed and capped. Returns null when nothing usable remains. */
export function sanitizeCallsign(input: string): string | null {
  const cleaned = input
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} _.\-']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function createInitialState(options: NewGameOptions): GameState {
  const evidence = Object.fromEntries(EVIDENCE_FLAGS.map((flag) => [flag, false])) as unknown as Evidence;
  return {
    playerName: sanitizeCallsign(options.playerName) ?? "OPERATOR",
    reducedPressure: options.reducedPressure,
    phase: "prologue",
    cwd: HOME,
    prevCwd: HOME,
    history: [],
    evidence,
    system: {
      hollowRunning: true,
      personaRunning: true,
      archiveCopied: false,
      recoveryName: null,
      recoveryUnlocked: false,
      containment: "active",
      breach: false,
    },
    timer: {
      running: false,
      totalMs: 0,
      remainingMs: 0,
      grace: null,
      warningsFired: [],
      pausedBy: [],
      readingHoldMs: 0,
    },
    outcome: { ending: null, cause: null },
    destructiveAttempts: 0,
    consecutiveErrors: 0,
    idleMs: 0,
    hintsShown: 0,
    clockMs: 0,
    phaseElapsedMs: 0,
    tickCount: 0,
    firedEvents: [],
    finishedPhase1InGrace: false,
    commandsRun: 0,
    endedInPhase: null,
  };
}

export function promptFor(state: GameState): string {
  return `operator@${HOSTNAME}:${displayPath(state.cwd)}$ `;
}

/** The player touched the keyboard: reading holds release and the idle clock resets. */
export function noteInput(state: GameState): GameState {
  if (state.idleMs === 0 && state.timer.readingHoldMs === 0) return state;
  return { ...state, idleMs: 0, timer: { ...state.timer, readingHoldMs: 0 } };
}

export function setPause(state: GameState, reason: PauseReason, paused: boolean): GameState {
  const has = state.timer.pausedBy.includes(reason);
  if (paused === has) return state;
  const pausedBy = paused ? [...state.timer.pausedBy, reason] : state.timer.pausedBy.filter((item) => item !== reason);
  return { ...state, timer: { ...state.timer, pausedBy } };
}

function execute(state: GameState, input: string): CommandOutcome {
  const [typedWord] = input.split(/\s+/);
  const firstWord = typedWord.toLowerCase();
  if (RAW_TEXT_COMMANDS.has(firstWord)) {
    const rest = input.slice(typedWord.length).replace(/^\s+/, "");
    const handler = firstWord === "echo" ? echoHandler(rest) : replyHandler(rest, firstWord);
    return handler({ state, name: firstWord, args: rest.split(/\s+/).filter(Boolean), raw: input });
  }
  const parsed = parseCommandLine(input);
  if (!parsed.ok) {
    const message =
      parsed.reason === "unterminated_quote"
        ? "bash: unexpected end of line: a quote was never closed"
        : "bash: pipes, redirection and chaining are not supported on this terminal";
    return { lines: [err(message), dim("(one command per line)")], error: true };
  }
  const { name, args } = parsed.command;
  const spec = findCommand(name);
  if (!spec) return { lines: unknownCommand(name), error: true };
  return spec.handler({ state, name, args, raw: input });
}

/** Runs one line typed at the prompt. Pure: same state + same input = same result. */
export function runCommand(initial: GameState, rawInput: string): StepResult {
  if (initial.phase === "ended") return { state: initial, lines: [], events: [], effects: [] };
  const input = rawInput.trim();
  const echo = line("input", `${promptFor(initial)}${rawInput}`);
  const touched = noteInput(initial);
  if (!input) return { state: touched, lines: [echo], events: [], effects: [] };

  const withHistory: GameState = { ...touched, history: [...touched.history, input], commandsRun: touched.commandsRun + 1 };
  const outcome = execute(withHistory, input);
  let state = outcome.state ?? withHistory;
  const lines = [echo, ...(outcome.lines ?? [])];
  const events = [...(outcome.events ?? [])];

  if (outcome.error) {
    const errors = state.consecutiveErrors + 1;
    if (errors >= ERROR_HINT_THRESHOLD && state.phase !== "ended") {
      lines.push(hint(`hint: ${contextualHint(state)}`));
      state = { ...state, consecutiveErrors: 0, hintsShown: state.hintsShown + 1 };
    } else {
      state = { ...state, consecutiveErrors: errors };
    }
  } else if (state.consecutiveErrors !== 0) {
    state = { ...state, consecutiveErrors: 0 };
  }

  if (state.phase !== "ended") {
    const advanced = advancePhases(state);
    state = advanced.state;
    lines.push(...advanced.lines);
    events.push(...advanced.events);
  }

  const finalized = finalizeEvents(state, events);
  return { state: finalized.state, lines, events: finalized.events, effects: outcome.effects ?? [] };
}
