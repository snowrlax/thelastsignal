"use client";

import { useEffect, useRef, useState } from "react";
import DotMatrix from "@/components/crt/DotMatrix";
import Monitor from "@/components/crt/Monitor";
import { evidenceCount } from "@/game/evidence";
import { endingSummary } from "@/game/story/endings";
import type { RunRecord } from "@/game/story/schema";
import { formatDuration } from "@/game/text";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { buildReport } from "@/libs/report";

interface RunStats {
  readonly total: number;
  readonly preservedPct: number;
}

async function recordRun(record: RunRecord): Promise<RunStats | null> {
  try {
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(6_000),
    });
    const json = (await response.json()) as { success?: boolean; data?: RunStats };
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

/** ARCHIVE PRESERVED or SIGNAL LOST, with a way back in. */
export default function EndingScreen() {
  const game = useGameStore((state) => state.game);
  const transcript = useGameStore((state) => state.transcript);
  const durationMs = useGameStore((state) => state.runDurationMs);
  const aiLines = useGameStore((state) => state.aiLines);
  const setScreen = useGameStore((state) => state.setScreen);
  const [stats, setStats] = useState<RunStats | null>(null);
  const recorded = useRef(false);

  useEffect(() => {
    if (!game || recorded.current) return;
    recorded.current = true;
    void recordRun({
      ending: game.outcome.ending ?? "lost",
      cause: game.outcome.cause,
      durationMs: Math.min(durationMs, 4 * 3_600_000),
      reducedPressure: game.reducedPressure,
      evidenceCount: evidenceCount(game),
      commandsRun: game.commandsRun,
      hintsShown: game.hintsShown,
      phaseReached: game.endedInPhase ?? "archive",
      aiLines,
    }).then(setStats);
  }, [game, durationMs, aiLines]);

  const restart = () => {
    sound().play("relay");
    setScreen("boot");
  };
  const toTitle = () => {
    sound().stopHum(0.5);
    setScreen("landing");
  };
  const download = () => {
    if (!game) return;
    const blob = new Blob([buildReport(game, transcript, durationMs)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ofrenda-session-${game.playerName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "r" || key === "enter") restart();
      if (key === "t" || key === "escape") toTitle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!game) return null;
  const preserved = game.outcome.ending === "preserved";
  const summary = endingSummary(preserved ? "preserved" : "lost", game.outcome.cause);
  const ink = preserved ? "var(--amber)" : "#eef6ff";
  const buttonVars = preserved ? {} : ({ "--btn-hover-bg": "#eef6ff", "--btn-hover-ink": "#1d47c4" } as React.CSSProperties);

  return (
    <Monitor variant="full" tone={preserved ? "black" : "blue"} power="on">
      <div
        className="term"
        style={{ display: "grid", gridTemplateRows: "1fr", placeItems: "center", color: ink, padding: "8vh 7vw" }} data-testid="ending" data-ending={preserved ? "preserved" : "lost"}>
        <div className="vhs-osd" style={{ position: "absolute", top: "5vh", left: "5vw", fontSize: "clamp(26px, 3.4vw, 48px)", zIndex: 4 }}>
          {preserved ? "■ STOP" : "PLAY ▶"}
        </div>
        <div className="vhs-osd" style={{ position: "absolute", bottom: "5vh", left: "5vw", fontSize: "clamp(20px, 2.4vw, 34px)", zIndex: 4 }}>
          SP {formatDuration(durationMs)}
        </div>
        <div style={{ width: "min(980px, 100%)", display: "grid", gap: "2.4vh", textAlign: "center" }} className={preserved ? "phosphor fade-in" : "fade-in"}>
          <DotMatrix
            text={summary.title}
            dot={7}
            gap={2}
           
            color={preserved ? "#ffb03b" : "#f2f8ff"}
            glow={preserved ? "rgba(255, 140, 30, 0.7)" : "rgba(200, 230, 255, 0.8)"}
          />
          <p style={{ margin: 0, fontSize: "1.1em", lineHeight: 1.3 }}>{summary.body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em 2.2em", justifyContent: "center", opacity: 0.85 }}>
            <span>OPERATOR {game.playerName}</span>
            <span>TIME {formatDuration(durationMs)}</span>
            <span>EVIDENCE {evidenceCount(game)}/8</span>
            <span>COMMANDS {game.commandsRun}</span>
            {game.reducedPressure && <span>REDUCED PRESSURE</span>}
          </div>
          <div style={{ minHeight: "1.2em", opacity: 0.75 }} data-testid="global-stats">
            {stats && stats.total > 0
              ? `${stats.total} ${stats.total === 1 ? "operator has" : "operators have"} powered on OFRENDA. ${stats.preservedPct}% preserved the archive.`
              : ""}
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: "1em", justifyContent: "center", marginTop: "1vh", ...buttonVars }} aria-label="After the session">
            <button type="button" className="button-term" onClick={restart} autoFocus data-testid="restart">
              [R] RESTART
            </button>
            <button type="button" className="button-term" onClick={toTitle} data-testid="title">
              [T] TITLE
            </button>
            <button type="button" className="button-term" onClick={download} data-testid="report">
              DOWNLOAD SESSION REPORT
            </button>
          </nav>
        </div>
      </div>
    </Monitor>
  );
}
