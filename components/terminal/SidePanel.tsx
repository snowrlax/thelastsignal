"use client";

import Waveform from "@/components/terminal/Waveform";
import { processRows } from "@/game/processes";
import type { GameState } from "@/game/types";
import { useGameStore } from "@/hooks/useGameStore";
import { evidenceLabels } from "@/libs/report";

/** Signal monitor, process watch, and the operator's (redacted until found) notes. */
export default function SidePanel({ game }: { readonly game: GameState }) {
  const speaking = useGameStore((state) => state.items.some((item) => item.type === "message" && item.speaker === "vega" && item.text === null));
  const persona = processRows(game).find((row) => row.pid === 404);
  const energy = !game.system.personaRunning ? 0 : speaking ? 3 : 1;
  const notes = evidenceLabels(game);

  return (
    <aside className="side" aria-label="Signal monitor">
      <section>
        <h2>
          <span className="inverse">pts/404 · CARRIER</span>
        </h2>
        <Waveform energy={energy} />
        <div style={{ color: "var(--amber-dim)" }}>{game.system.personaRunning ? (speaking ? "receiving..." : "carrier present") : "NO CARRIER"}</div>
      </section>

      <section>
        <h2>
          <span className="inverse">PROCESS WATCH</span>
        </h2>
        <ul>
          <li>
            <span>218</span>
            <span style={{ flex: 1 }}>hollowd</span>
            <span style={{ color: game.system.hollowRunning ? "var(--amber-hi)" : "var(--red)" }}>{game.system.hollowRunning ? "● ACTIVE" : "○ KILLED"}</span>
          </li>
          <li>
            <span>404</span>
            <span style={{ flex: 1 }}>persona-recon</span>
            <span style={{ color: game.system.personaRunning ? "var(--marigold)" : "var(--amber-dim)" }}>
              {game.system.personaRunning ? `● ${persona?.cpu.toFixed(0) ?? 97}%` : "○ STOPPED"}
            </span>
          </li>
          <li>
            <span>/rec</span>
            <span style={{ flex: 1 }}>recovery</span>
            <span style={{ color: "var(--amber-dim)" }}>{game.system.archiveCopied ? "COPY OK" : game.system.recoveryUnlocked ? "UNLOCKED" : "LOCKED"}</span>
          </li>
        </ul>
      </section>

      <section>
        <h2>
          <span className="inverse">OPERATOR NOTES</span>
        </h2>
        <ul style={{ display: "grid", gap: "0.3em" }} data-testid="notes">
          {notes.map((note) => (
            <li key={note.label} style={{ color: note.found ? "var(--amber)" : "var(--amber-faint)" }}>
              <span>{note.found ? "■" : "□"}</span>
              {note.found ? <span>{note.label}</span> : <span className="redacted" aria-label="not yet found" />}
            </li>
          ))}
        </ul>
      </section>

      {game.reducedPressure && <div style={{ color: "var(--amber-dim)" }}>MODE: REDUCED PRESSURE (1.5×)</div>}
    </aside>
  );
}
