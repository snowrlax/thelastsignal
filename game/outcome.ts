import type { Effect, GameState, LossCause } from "@/game/types";

export function loseGame(state: GameState, cause: LossCause): { state: GameState; effects: Effect[] } {
  return {
    state: {
      ...state,
      phase: "ended",
      endedInPhase: state.phase,
      outcome: { ending: "lost", cause },
      timer: { ...state.timer, running: false, grace: null },
      system: {
        ...state.system,
        hollowRunning: cause === "hollow_killed" ? false : state.system.hollowRunning,
        containment: "compromised",
        breach: true,
      },
    },
    effects: [{ type: "ending", ending: "lost", cause }],
  };
}

export function winGame(state: GameState): { state: GameState; effects: Effect[] } {
  return {
    state: {
      ...state,
      phase: "ended",
      endedInPhase: state.phase,
      outcome: { ending: "preserved", cause: null },
      timer: { ...state.timer, running: false, grace: null },
      system: { ...state.system, personaRunning: false },
    },
    effects: [{ type: "ending", ending: "preserved", cause: null }],
  };
}
