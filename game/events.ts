import type { GameState, StoryEvent, StoryEventId } from "@/game/types";

/** Events that may fire more than once per run. Everything else fires once. */
const REPEATABLE: ReadonlySet<StoryEventId> = new Set<StoryEventId>([
  "player_reply",
  "msg_hollow",
  "destructive",
  "kill_hollow_term",
  "kill_persona_forced",
  "kill_persona_early",
  "warn_50",
  "warn_25",
  "warn_10",
  "grace_start",
]);

export interface FinalizedEvents {
  readonly state: GameState;
  readonly events: readonly StoryEvent[];
}

/** Drops once-only events that already fired and records the new ones. */
export function finalizeEvents(state: GameState, events: readonly StoryEvent[]): FinalizedEvents {
  const fired = new Set(state.firedEvents);
  const kept: StoryEvent[] = [];
  for (const event of events) {
    if (REPEATABLE.has(event.id)) {
      kept.push(event);
      continue;
    }
    if (fired.has(event.id)) continue;
    fired.add(event.id);
    kept.push(event);
  }
  if (fired.size === state.firedEvents.length) return { state, events: kept };
  return { state: { ...state, firedEvents: [...fired] }, events: kept };
}
