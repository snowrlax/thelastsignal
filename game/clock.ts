import { CLOCK_START_SECONDS } from "@/game/constants";

const DAY_SECONDS = 24 * 3600;

function absoluteSeconds(clockMs: number): number {
  return CLOCK_START_SECONDS + Math.floor(clockMs / 1000);
}

export function isAfterMidnight(clockMs: number): boolean {
  return absoluteSeconds(clockMs) >= DAY_SECONDS;
}

/** "23:58:04" style time for the in-game clock. */
export function formatClock(clockMs: number): string {
  const seconds = absoluteSeconds(clockMs) % DAY_SECONDS;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatShortClock(clockMs: number): string {
  return formatClock(clockMs).slice(0, 5);
}

/** Full date string in the style of the date command. */
export function formatDate(clockMs: number): string {
  const day = isAfterMidnight(clockMs) ? "Tue Nov  3" : "Mon Nov  2";
  return `${day} ${formatClock(clockMs)} CST 2026`;
}
