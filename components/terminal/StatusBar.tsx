"use client";

import { BatteryIcon, EnvelopeIcon, SignalIcon } from "@/components/crt/PixelIcons";
import { formatShortClock } from "@/game/clock";
import { formatDuration } from "@/game/text";
import type { GameState } from "@/game/types";

const PHASE_LABELS: Record<GameState["phase"], string> = {
  prologue: "SESSION OPENING",
  archive: "PHASE 1/3 · ARCHIVE REVIEW",
  process: "PHASE 2/3 · PROCESS AUDIT",
  recovery: "PHASE 3/3 · RECOVERY",
  ended: "SESSION CLOSED",
};

function windowFraction(game: GameState): number {
  const { timer } = game;
  if (!timer.running || timer.totalMs === 0) return 1;
  if (timer.grace) return 0;
  return timer.remainingMs / timer.totalMs;
}

function TimerReadout({ game }: { readonly game: GameState }) {
  const { timer } = game;
  if (!timer.running) return <span style={{ color: "var(--amber-dim)" }}>CONTAINMENT WINDOW --:--</span>;
  if (timer.pausedBy.length > 0) {
    const reason = timer.pausedBy.includes("recording") ? "RECORDING" : timer.pausedBy.includes("help") ? "MANUAL OPEN" : "SEQUENCE";
    return <span style={{ color: "var(--amber-hi)" }}>⏸ HELD · {reason}</span>;
  }
  if (timer.grace) {
    return (
      <span className="blink" style={{ color: "var(--red)" }} data-testid="timer">
        FINAL GRACE {formatDuration(timer.grace.remainingMs)}
      </span>
    );
  }
  const fraction = windowFraction(game);
  const color = fraction <= 0.25 ? "var(--red)" : fraction <= 0.5 ? "var(--amber-hi)" : "var(--amber)";
  return (
    <span style={{ color }} className={fraction <= 0.1 ? "blink" : undefined} data-testid="timer">
      {timer.readingHoldMs > 0 ? "⏸ READING · " : ""}CONTAINMENT WINDOW {formatDuration(timer.remainingMs)}
    </span>
  );
}

interface StatusBarProps {
  readonly game: GameState;
  readonly unread: boolean;
  readonly takenOver: boolean;
}

/** Handset-style status bar: signal = containment integrity, envelope = unread signal. */
export default function StatusBar({ game, unread, takenOver }: StatusBarProps) {
  const fraction = windowFraction(game);
  const bars = takenOver ? 0 : Math.ceil(fraction * 5);
  return (
    <header className="term-bar" data-testid="status-bar">
      <SignalIcon bars={bars} />
      <EnvelopeIcon className={unread ? "blink" : undefined} />
      <span className="hide-sm" style={{ color: takenOver ? "var(--red)" : undefined }}>{takenOver ? "M_VEGA" : "OFRENDA-01"}</span>
      <span className="inverse hide-sm">{takenOver ? "CONTROL LOST" : PHASE_LABELS[game.phase]}</span>
      <span className="grow" />
      <TimerReadout game={game} />
      <span className="hide-sm">{formatShortClock(game.clockMs)}</span>
      <BatteryIcon className="hide-sm" level={Math.ceil(fraction * 3)} />
    </header>
  );
}
