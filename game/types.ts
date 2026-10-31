/**
 * Core types for THE LAST SIGNAL game engine.
 * The engine is pure and deterministic: every function takes a state and
 * returns a new state. Nothing here touches the DOM, the network or the LLM.
 */

export const PHASES = ["prologue", "archive", "process", "recovery", "ended"] as const;
export type Phase = (typeof PHASES)[number];

export const EVIDENCE_FLAGS = [
  "read_readme",
  "read_research",
  "read_session_log",
  "inspected_processes",
  "inspected_persona",
  "inspected_hollow",
  "read_containment",
  "identified_truth",
] as const;
export type EvidenceFlag = (typeof EVIDENCE_FLAGS)[number];
export type Evidence = Readonly<Record<EvidenceFlag, boolean>>;

export const STORY_EVENTS = [
  "session_open",
  "vega_intro",
  "hollow_first_warning",
  "first_ls",
  "read_readme",
  "read_research",
  "read_session_log",
  "read_letter",
  "read_shutdown_log",
  "read_last_session",
  "read_journal",
  "play_voice",
  "play_final",
  "phase2_start",
  "first_process_view",
  "inspect_hollow",
  "inspect_persona",
  "ask_kill",
  "kill_hollow_term",
  "kill_persona_forced",
  "kill_persona_early",
  "destructive",
  "read_containment",
  "identified_truth",
  "phase3_start",
  "archive_copied",
  "persona_stopped",
  "hollow_killed",
  "warn_50",
  "warn_25",
  "warn_10",
  "grace_start",
  "timeout",
  "midnight",
  "whoami_anomaly",
  "msg_hollow",
  "player_reply",
] as const;
export type StoryEventId = (typeof STORY_EVENTS)[number];

export interface StoryEvent {
  readonly id: StoryEventId;
  readonly text?: string;
}

export type LineKind =
  | "input"
  | "out"
  | "dim"
  | "err"
  | "warn"
  | "sys"
  | "head"
  | "hint"
  | "ok"
  | "vega"
  | "hollow"
  | "glitch"
  | "voice";

export interface OutputLine {
  readonly kind: LineKind;
  readonly text: string;
  /** Optional delay before this line prints (used for sequences and recordings). */
  readonly delayMs?: number;
}

export type Ending = "preserved" | "lost";
export type LossCause = "hollow_killed" | "timeout" | "destructive";

export interface SystemState {
  readonly hollowRunning: boolean;
  readonly personaRunning: boolean;
  readonly archiveCopied: boolean;
  /** Name of the recovered copy inside /recovery (e.g. "vega_archive"). */
  readonly recoveryName: string | null;
  readonly recoveryUnlocked: boolean;
  readonly containment: "active" | "compromised";
  readonly breach: boolean;
}

export type PauseReason = "recording" | "help" | "sequence";

export interface GraceState {
  readonly remainingMs: number;
  readonly totalMs: number;
}

export interface TimerState {
  readonly running: boolean;
  readonly totalMs: number;
  readonly remainingMs: number;
  readonly grace: GraceState | null;
  readonly warningsFired: readonly number[];
  readonly pausedBy: readonly PauseReason[];
  /** Reading allowance: the timer holds while the player reads a long file, until they type again. */
  readonly readingHoldMs: number;
}

export interface Outcome {
  readonly ending: Ending | null;
  readonly cause: LossCause | null;
}

export interface GameState {
  readonly playerName: string;
  readonly reducedPressure: boolean;
  readonly phase: Phase;
  readonly cwd: string;
  readonly prevCwd: string;
  readonly history: readonly string[];
  readonly evidence: Evidence;
  readonly system: SystemState;
  readonly timer: TimerState;
  readonly outcome: Outcome;
  readonly destructiveAttempts: number;
  readonly consecutiveErrors: number;
  readonly idleMs: number;
  readonly hintsShown: number;
  /** Wall-clock ms since the terminal session started (never pauses). */
  readonly clockMs: number;
  /** Active ms spent in the current phase (pauses with the timer). */
  readonly phaseElapsedMs: number;
  readonly tickCount: number;
  readonly firedEvents: readonly StoryEventId[];
  readonly finishedPhase1InGrace: boolean;
  readonly commandsRun: number;
  /** The phase the run was in when it ended (for stats and the ending card). */
  readonly endedInPhase: Phase | null;
}

export type RecordingId = "voice_001" | "final_recording";

export type SoundName = "hdd" | "relay" | "warn" | "deny" | "copy";

export type Effect =
  | { readonly type: "clear" }
  | { readonly type: "recording"; readonly id: RecordingId }
  | { readonly type: "sound"; readonly name: SoundName }
  | { readonly type: "glitch"; readonly intensity: "low" | "high" }
  | { readonly type: "ending"; readonly ending: Ending; readonly cause: LossCause | null }
  | { readonly type: "help_overlay" }
  | { readonly type: "prefill"; readonly text: string };

export interface StepResult {
  readonly state: GameState;
  readonly lines: readonly OutputLine[];
  readonly events: readonly StoryEvent[];
  readonly effects: readonly Effect[];
}
