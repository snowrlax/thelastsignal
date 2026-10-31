/** Tunable game configuration. All durations are in milliseconds. */

export const PIDS = {
  systemd: 1,
  indexer: 118,
  hollow: 218,
  persona: 404,
  shell: 1123,
} as const;

export const HOME = "/home/operator";
export const HOSTNAME = "ofrenda-01";
export const MAX_NAME_LENGTH = 18;
export const MAX_REPLY_LENGTH = 200;

export const PHASE_DURATION_MS = {
  archive: 180_000,
  process: 240_000,
  recovery: 120_000,
} as const;

export const REDUCED_PRESSURE_MULTIPLIER = 1.5;

export const GRACE_MS = {
  archive: 30_000,
  process: 20_000,
} as const;

/** Phase 2 allowance when phase 1 was only completed during its grace period. */
export const LATE_PHASE2_ALLOWANCE = 0.75;

export const WARNING_THRESHOLDS = [50, 25, 10] as const;

export const PENALTY_MS = {
  hollowTerm: 15_000,
  destructive: 20_000,
} as const;

export const DESTRUCTIVE_BREACH_LIMIT = 3;
export const ACCELERATED_BREACH_MS = 15_000;

export const READING_HOLD = {
  minLines: 12,
  msPerLine: 900,
  maxMs: 40_000,
} as const;

export const IDLE_HINT_MS = 45_000;
export const ERROR_HINT_THRESHOLD = 3;

/** Scripted beats, measured from session start / phase start. */
export const BEATS = {
  sessionOpenMs: 2_500,
  vegaIntroMs: 9_000,
  hollowWarningMs: 24_000,
  askKillMs: 40_000,
} as const;

/** The in-game clock starts at 23:51:30 on 02 NOV 2026. */
export const CLOCK_START_SECONDS = 23 * 3600 + 51 * 60 + 30;

export const RECORDING_LINE_MS = 2_400;
