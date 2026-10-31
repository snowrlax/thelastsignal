"use client";

import { useEffect } from "react";
import { useGameStore } from "@/hooks/useGameStore";

const TICK_MS = 250;
const MAX_STEP_MS = 1_000;
const MAX_TIME_SCALE = 60;

/** Development and end-to-end tests may speed time up with ?timescale=N. Production ignores it. */
function timeScale(): number {
  if (process.env.NODE_ENV === "production") return 1;
  const value = Number(new URLSearchParams(window.location.search).get("timescale"));
  return Number.isFinite(value) && value > 0 && value <= MAX_TIME_SCALE ? value : 1;
}

/** Advances game time while the terminal is visible. Hidden tabs do not burn the timer. */
export function useGameLoop(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    const scale = timeScale();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(MAX_STEP_MS, now - last) * scale;
      last = now;
      if (!document.hidden) useGameStore.getState().advance(dt);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);
}
