"use client";

import { useEffect, useMemo, useState } from "react";
import Monitor from "@/components/crt/Monitor";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";

interface BootLine {
  readonly label: string;
  readonly status?: string;
  readonly tone?: "ok" | "warn" | "live";
  readonly delay: number;
  readonly head?: boolean;
}

function bootLines(name: string): BootLine[] {
  return [
    { label: "OFRENDA SYSTEMS", delay: 500, head: true },
    { label: "MEMORY PRESERVATION TERMINAL", delay: 300 },
    { label: "", delay: 300 },
    { label: "INITIALIZING...", delay: 700 },
    { label: "MEMORY MODULE ............. ", status: "OK", tone: "ok", delay: 650 },
    { label: "ARCHIVE INDEX ............. ", status: "OK", tone: "ok", delay: 600 },
    { label: "SIGNAL INTERFACE .......... ", status: "UNSTABLE", tone: "warn", delay: 900 },
    { label: "CONTAINMENT SERVICE ....... ", status: "ACTIVE", tone: "ok", delay: 650 },
    { label: "PERSONA RECONSTRUCTION .... ", status: "RUNNING", tone: "live", delay: 1_100 },
    { label: "", delay: 300 },
    { label: "LAST SHUTDOWN: 02 NOV 2012", delay: 600 },
    { label: "CURRENT DATE: 02 NOV 2026", delay: 500 },
    { label: "", delay: 400 },
    { label: `WELCOME, ${name.toUpperCase()}.`, delay: 900 },
  ];
}

const STATUS_COLOR = { ok: "var(--amber-hi)", warn: "var(--red)", live: "var(--marigold)" } as const;

/** POST-style diagnostics. The reconstruction is already running. */
export default function BootScreen() {
  const playerName = useGameStore((state) => state.playerName);
  const startRun = useGameStore((state) => state.startRun);
  const setScreen = useGameStore((state) => state.setScreen);
  const [shown, setShown] = useState(0);
  const lines = useMemo(() => bootLines(playerName || "OPERATOR"), [playerName]);
  const done = shown >= lines.length;

  useEffect(() => {
    sound().play("powerOn");
  }, []);

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => {
      setShown((value) => value + 1);
      const line = lines[shown];
      if (line.status) sound().play(line.tone === "warn" ? "deny" : "hdd");
      else if (line.head) sound().play("beep");
    }, lines[shown].delay);
    return () => window.clearTimeout(id);
  }, [shown, done, lines]);

  useEffect(() => {
    if (!done) return;
    const go = () => {
      startRun();
      setScreen("terminal");
    };
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      go();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", go);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", go);
    };
  }, [done, setScreen, startRun]);

  return (
    <Monitor variant="full" tone="phosphor" power="on">
      <div className="term phosphor" style={{ display: "block", padding: "6vh 6vw", lineHeight: 1.3 }} data-testid="boot">
        {lines.slice(0, shown).map((line, index) => (
          <div key={index} className="term-line">
            {line.head ? <span className="inverse">{line.label}</span> : line.label}
            {line.status && (
              <span className={line.tone === "live" ? "blink" : undefined} style={{ color: STATUS_COLOR[line.tone ?? "ok"] }}>
                {line.status}
              </span>
            )}
          </div>
        ))}
        {done && (
          <div className="term-line" style={{ marginTop: "1.4em" }}>
            PRESS ANY KEY<span className="blink">_</span>
          </div>
        )}
      </div>
    </Monitor>
  );
}
