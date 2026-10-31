import type { FileContext } from "@/game/fs/nodes";
import { getTree } from "@/game/fs/tree";
import type { GameState } from "@/game/types";

export function fileContext(state: GameState): FileContext {
  return { playerName: state.playerName };
}

export function treeFor(state: GameState) {
  return getTree(state.system.recoveryName);
}
