"use client";

import { useEffect } from "react";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { tapeDeck } from "@/libs/voiceTape";

const IDLE_POLL_MS = 40;

/** Prints queued terminal output, honouring per-line delays (sequences, recordings). */
export function usePrinter(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    let waitingSince: number | null = null;
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      try {
        step();
      } catch (error) {
        // Output must never stop: log, skip the entry, keep printing.
        console.error("[printer] failed to print", error);
        waitingSince = null;
        timer = window.setTimeout(loop, IDLE_POLL_MS);
      }
    };

    const step = () => {
      const store = useGameStore.getState();
      const entry = store.queue[0];
      if (!entry) {
        waitingSince = null;
        timer = window.setTimeout(loop, IDLE_POLL_MS);
        return;
      }
      const delay = entry.type === "line" ? entry.line.delayMs ?? 0 : 0;
      const now = performance.now();
      if (waitingSince === null) waitingSince = now;
      const remaining = delay - (now - waitingSince);
      if (remaining > 0) {
        timer = window.setTimeout(loop, Math.min(remaining, 200));
        return;
      }
      waitingSince = null;
      const taken = store.takeQueued();
      if (taken?.type === "line") {
        store.printLine(taken.line);
        tapeDeck().printed(taken.line);
        if (delay > 0 && taken.line.kind === "voice") sound().play("key");
      } else if (taken?.action === "clear") {
        store.clearScreen();
      } else if (taken?.action === "release_recording") {
        tapeDeck().stop();
        store.releaseRecording();
      }
      timer = window.setTimeout(loop, 0);
    };

    loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active]);
}
