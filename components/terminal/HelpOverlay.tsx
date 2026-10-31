"use client";

import { useEffect } from "react";

const ROWS: readonly [string, string][] = [
  ["help", "list every command"],
  ["ls -la", "list files here, including hidden ones (names starting with .)"],
  ["cd <dir>", "move: cd /research · cd .. (up) · cd ~ (home)"],
  ["cat <file>", "read a text file"],
  ["play <file.wav>", "listen to a recording (the window holds while it plays)"],
  ["grep <word> <dir>", "search inside files, e.g. grep containment /restricted"],
  ["find / -name <pattern>", "locate files by name, e.g. find / -name \"*.log\""],
  ["ps aux · top", "see which processes are running, and who they belong to"],
  ["ps -fp <pid>", "inspect one process in detail"],
  ["cp -r <src> <dst>", "copy a folder (only /recovery is writable)"],
  ["kill -TERM <pid>", "ask a process to stop gracefully"],
  ["kill -9 <pid>", "force a process to die immediately. there is no undo."],
  ["reply <message>", "answer the session on pts/404"],
  ["hint", "a nudge toward what to do next"],
];

/** The operator manual. Opening it holds the containment window. */
export default function HelpOverlay({ onClose }: { readonly onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "F1") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Operator manual" data-testid="manual">
      <div className="manual phosphor">
        <h2 className="inverse">OPERATOR MANUAL · the containment window is held while this is open</h2>
        <table>
          <tbody>
            {ROWS.map(([command, description]) => (
              <tr key={command}>
                <td style={{ color: "var(--amber-hi)", whiteSpace: "nowrap" }}>{command}</td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: "var(--amber-dim)" }}>
          Keys: ↑/↓ recall earlier commands · Tab completes names · Ctrl+L clears the screen · F1 or Esc closes this manual.
          <br />
          Reading a long file holds the window until you type again. Mistyped commands cost nothing.
        </p>
        <button type="button" className="button-term" onClick={onClose}>
          CLOSE [ESC]
        </button>
      </div>
    </div>
  );
}
