import { formatDuration } from "@/game/text";
import { endingSummary } from "@/game/story/endings";
import { EVIDENCE_FLAGS, type GameState } from "@/game/types";

const FLAG_LABELS: Record<(typeof EVIDENCE_FLAGS)[number], string> = {
  read_readme: "README: the reconstruction is not the person",
  read_research: "Research notes: the model fills gaps and lies",
  read_session_log: "Session 014: answers marked GENERATED",
  inspected_processes: "Process table inspected",
  inspected_persona: "PID 404: persona-recon speaks as M_VEGA",
  inspected_hollow: "PID 218: hollowd is the containment supervisor",
  read_containment: "Containment protocol read",
  identified_truth: "Identity validation: M_VEGA is not Ines Vega",
};

export function evidenceLabels(game: GameState): { label: string; found: boolean }[] {
  return EVIDENCE_FLAGS.map((flag) => ({ label: FLAG_LABELS[flag], found: game.evidence[flag] }));
}

/** Plain-text "recovered archive report" the player can download after an ending. */
export function buildReport(game: GameState, transcript: readonly string[], durationMs: number): string {
  const summary = endingSummary(game.outcome.ending ?? "lost", game.outcome.cause);
  const evidence = evidenceLabels(game).map((item) => `  [${item.found ? "x" : " "}] ${item.label}`);
  return [
    "OFRENDA · RECOVERED SESSION REPORT",
    "================================================================",
    `operator ......... ${game.playerName}`,
    `outcome .......... ${summary.title}`,
    `session length ... ${formatDuration(durationMs)}`,
    `commands ......... ${game.commandsRun}`,
    `mode ............. ${game.reducedPressure ? "reduced pressure (1.5x timers)" : "standard"}`,
    "",
    summary.body,
    "",
    "EVIDENCE",
    ...evidence,
    "",
    "TRANSCRIPT",
    "----------------------------------------------------------------",
    ...transcript,
    "",
    "Some memories are meant to be kept. Not recreated.",
  ].join("\n");
}
