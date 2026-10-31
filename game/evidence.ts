import type { EvidenceFlag, GameState, StoryEvent, StoryEventId } from "@/game/types";

/** First time a flag is set, the matching story event fires. */
const FLAG_EVENTS: Record<EvidenceFlag, StoryEventId> = {
  read_readme: "read_readme",
  read_research: "read_research",
  read_session_log: "read_session_log",
  inspected_processes: "first_process_view",
  inspected_persona: "inspect_persona",
  inspected_hollow: "inspect_hollow",
  read_containment: "read_containment",
  identified_truth: "identified_truth",
};

export interface FlagGrant {
  readonly state: GameState;
  readonly events: readonly StoryEvent[];
}

export function grantFlags(state: GameState, flags: readonly EvidenceFlag[]): FlagGrant {
  const newlySet = [...new Set(flags)].filter((flag) => !state.evidence[flag]);
  if (newlySet.length === 0) return { state, events: [] };
  const evidence = { ...state.evidence };
  for (const flag of newlySet) evidence[flag] = true;
  return {
    state: { ...state, evidence },
    events: newlySet.map((flag) => ({ id: FLAG_EVENTS[flag] })),
  };
}

export function phase1Complete(state: GameState): boolean {
  const e = state.evidence;
  return e.read_readme && e.read_research && e.read_session_log;
}

export function processKnown(state: GameState): boolean {
  const e = state.evidence;
  return e.inspected_processes && (e.inspected_persona || e.inspected_hollow);
}

/** The containment truth is exposed: recovery unlocks. */
export function phase2Complete(state: GameState): boolean {
  return processKnown(state) && state.evidence.read_containment && state.evidence.identified_truth;
}

/** Phase 2 grace is only granted when the decisive evidence is already in hand. */
export function phase2GraceEligible(state: GameState): boolean {
  return processKnown(state) && state.evidence.read_containment;
}

export function evidenceCount(state: GameState): number {
  return Object.values(state.evidence).filter(Boolean).length;
}
