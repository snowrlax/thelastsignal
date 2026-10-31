import type { LineKind, OutputLine } from "@/game/types";

export function line(kind: LineKind, text: string, delayMs?: number): OutputLine {
  return delayMs === undefined ? { kind, text } : { kind, text, delayMs };
}

/** Splits a multi-line block into individual output lines of one kind. */
export function block(kind: LineKind, text: string): OutputLine[] {
  return text.split("\n").map((part) => line(kind, part));
}

export const out = (text: string): OutputLine => line("out", text);
export const dim = (text: string): OutputLine => line("dim", text);
export const err = (text: string): OutputLine => line("err", text);
export const warn = (text: string): OutputLine => line("warn", text);
export const sys = (text: string): OutputLine => line("sys", text);
export const hint = (text: string): OutputLine => line("hint", text);
export const ok = (text: string): OutputLine => line("ok", text);

export function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

export function padLeft(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

/** Lays out names in columns that fit within the given width, like ls. */
export function columns(names: readonly string[], width = 64): string[] {
  if (names.length === 0) return [];
  const cell = Math.max(...names.map((name) => name.length)) + 2;
  const perRow = Math.max(1, Math.floor(width / cell));
  const rows: string[] = [];
  for (let index = 0; index < names.length; index += perRow) {
    rows.push(
      names
        .slice(index, index + perRow)
        .map((name) => padRight(name, cell))
        .join("")
        .trimEnd(),
    );
  }
  return rows;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
