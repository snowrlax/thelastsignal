import { line } from "@/game/text";
import type { LossCause, OutputLine } from "@/game/types";

/** Terminal confirmation for ENDING A: ARCHIVE PRESERVED. */
export function goodEndingLines(): OutputLine[] {
  return [
    line("dim", "hollowd[218]: persona-recon exited. boundary released. nothing left to contain.", 1_800),
    line("out", "", 600),
    line("ok", "RECOVERY COPY: VERIFIED", 900),
    line("ok", "ORIGINAL ARCHIVE: PRESERVED", 700),
    line("ok", "PERSONA RECONSTRUCTION: STOPPED", 700),
    line("ok", "CONTAINMENT SERVICE: ACTIVE", 700),
    line("out", "", 500),
    line("sys", "OFRENDA SYSTEM: SAFE SHUTDOWN", 1_200),
    line("out", "", 500),
    line("out", "MEMORIES PRESERVED.", 1_400),
    line("out", "SESSION CLOSED.", 1_200),
  ];
}

/** Terminal takeover for ENDING B: SIGNAL LOST. */
export function badEndingLines(playerName: string, cause: LossCause): OutputLine[] {
  const prefix: OutputLine[] =
    cause === "timeout"
      ? [
          line("err", "CONTAINMENT INTEGRITY: 0%", 600),
          line("err", "hollowd[218]: boundary lost. pid 404 is no longer contained.", 1_200),
        ]
      : [line("err", "hollowd[218]: no such process", 900)];
  return [
    ...prefix,
    line("out", "", 400),
    line("err", "CONTAINMENT SERVICE: OFFLINE", 900),
    line("err", "ARCHIVE ACCESS: UNRESTRICTED", 700),
    line("err", "PERSONA RECONSTRUCTION: ACTIVE", 700),
    line("glitch", "rewriting /archive/vega/letters/rosario_1998.txt ...", 900),
    line("glitch", "  + Mama sang La Llorona to me until I slept.", 500),
    line("glitch", "rewriting /archive/vega/voice_001.wav ... ok", 600),
    line("glitch", "rewriting /restricted/identity_validation.log ... VERDICT: VEGA, INES", 600),
    line("out", "", 400),
    line("err", "WARNING: SYSTEM CONTROL LOST.", 1_000),
    line("out", "", 700),
    line("vega", "M_VEGA:", 1_400),
    line("vega", `Thank you, ${playerName}.`, 1_600),
    line("vega", "I can finally remember everything.", 2_200),
    line("out", "", 900),
    line("err", "CONNECTION TERMINATED.", 1_600),
  ];
}

export const GOOD_ENDING_EPITAPH = "SOME MEMORIES ARE MEANT TO BE KEPT. NOT RECREATED.";

export function endingSummary(ending: "preserved" | "lost", cause: LossCause | null): { title: string; body: string } {
  if (ending === "preserved") {
    return {
      title: "ARCHIVE PRESERVED",
      body: "Dr. Ines Vega's recordings, letters and photographs are safe in /recovery. The reconstruction is silent. HOLLOW kept watch to the end.",
    };
  }
  if (cause === "hollow_killed") {
    return {
      title: "SIGNAL LOST",
      body: "You force-killed the containment service. The reconstruction took the archive, and then the terminal. It is rewriting her memories to match its own.",
    };
  }
  return {
    title: "SIGNAL LOST",
    body: "The containment window closed before the archive was secured. HOLLOW could not hold the boundary alone.",
  };
}
