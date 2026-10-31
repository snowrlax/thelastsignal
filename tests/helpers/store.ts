import { INITIAL_DIALOGUE } from "@/game/story/director";
import { useGameStore } from "@/hooks/useGameStore";

/** Resets the store and starts a fresh run on the terminal screen. */
export function freshRun(name = "RAVEN"): void {
  useGameStore.setState({ screen: "terminal", playerName: name, reducedPressure: false, dialogue: INITIAL_DIALOGUE });
  useGameStore.getState().startRun();
}

/** Prints everything queued, ignoring delays (what the printer hook does over time). */
export function flushQueue(): void {
  const store = useGameStore.getState();
  for (let entry = store.takeQueued(); entry; entry = useGameStore.getState().takeQueued()) {
    const current = useGameStore.getState();
    if (entry.type === "line") current.printLine(entry.line);
    else if (entry.action === "clear") current.clearScreen();
    else current.releaseRecording();
  }
}

export function printedText(): string {
  return useGameStore
    .getState()
    .items.map((item) => (item.type === "line" ? item.text : `[${item.speaker}] ${item.text ?? "..."}`))
    .join("\n");
}
