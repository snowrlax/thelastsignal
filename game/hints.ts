import type { GameState } from "@/game/types";

/** A contextual nudge toward the next objective. Never reveals more than one step. */
export function contextualHint(state: GameState): string {
  const e = state.evidence;
  switch (state.phase) {
    case "prologue":
      return "Type help and press Enter to see what this terminal can do.";
    case "archive":
      if (!e.read_readme) return "Try ls -la to see your home folder, then cat README.txt";
      if (!e.read_research) return "The README mentions /research. Try cd /research, then ls and cat.";
      if (!e.read_session_log) return "Vega's notes point at /archive/vega/session_014.log. Read it with cat.";
      return "Keep reading. The archive explains what the reconstruction does.";
    case "process":
      if (!e.inspected_processes) return "See what is running on this machine: ps aux (or top).";
      if (!e.inspected_hollow && !e.inspected_persona) return "Inspect one process in detail: ps -fp 218 or ps -fp 404";
      if (!e.read_containment) return "ps -fp 218 names a document in /restricted. Go and read it.";
      if (!e.identified_truth) return "The protocol says: confirm what you are talking to. cat /restricted/identity_validation.log";
      return "You have what you need. Follow the containment protocol.";
    case "recovery":
      if (!state.system.archiveCopied) return "Step 2 of the protocol: cp -r /archive/vega /recovery/vega_archive";
      return "Step 3: stop the reconstruction gracefully with kill -TERM 404. Leave 218 alone.";
    default:
      return "";
  }
}
