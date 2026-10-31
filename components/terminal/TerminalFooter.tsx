"use client";

import type { GameState } from "@/game/types";

const PHASE_NUMBER: Record<GameState["phase"], string> = {
  prologue: "0/3",
  archive: "1/3",
  process: "2/3",
  recovery: "3/3",
  ended: "-",
};

interface FooterProps {
  readonly phase: GameState["phase"];
  readonly muted: boolean;
  readonly onSound: () => void;
  readonly onHelp: () => void;
  readonly onHint: () => void;
  readonly onReply: () => void;
}

/** Gopher-style footer: the keys you need, always visible. */
export default function TerminalFooter({ phase, muted, onSound, onHelp, onHint, onReply }: FooterProps) {
  return (
    <footer className="term-foot">
      <span className="hide-sm">
        Press <span className="key">F1</span> for Help, <span className="key">↑</span> history, <span className="key">Tab</span> complete
      </span>
      <span style={{ display: "flex", gap: "1.1em" }}>
        <button type="button" className="foot-button" onClick={onReply}>
          [reply]
        </button>
        <button type="button" className="foot-button" onClick={onHint} data-testid="hint-button">
          [hint]
        </button>
        <button type="button" className="foot-button" onClick={onHelp} data-testid="help-button">
          [manual]
        </button>
        <button type="button" className="foot-button" onClick={onSound} aria-pressed={!muted}>
          [sound {muted ? "off" : "on"}]
        </button>
        <span className="hide-sm">Phase: {PHASE_NUMBER[phase]}</span>
      </span>
    </footer>
  );
}
