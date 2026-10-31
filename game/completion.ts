import { visibleCommandNames } from "@/game/commands/registry";
import { treeFor } from "@/game/commands/context";
import { normalizePath } from "@/game/fs/paths";
import { resolveAbsolute, sortedChildren } from "@/game/fs/tree";
import type { GameState } from "@/game/types";

export interface Completion {
  /** The input with the longest unambiguous completion applied. */
  readonly value: string;
  /** All candidates when the completion is ambiguous. */
  readonly options: readonly string[];
}

function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

function completeCommand(partial: string): Completion {
  const matches = visibleCommandNames().filter((name) => name.startsWith(partial.toLowerCase()));
  if (matches.length === 1) return { value: `${matches[0]} `, options: [] };
  const prefix = commonPrefix(matches);
  return { value: prefix.length > partial.length ? prefix : partial, options: matches.length > 1 ? matches : [] };
}

function completePath(state: GameState, before: string, partial: string): Completion {
  const slash = partial.lastIndexOf("/");
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const namePart = slash >= 0 ? partial.slice(slash + 1) : partial;
  const directory = resolveAbsolute(treeFor(state), normalizePath(state.cwd, dirPart || "."));
  if (!directory.ok || directory.node.kind !== "dir" || directory.node.sealed) return { value: before + partial, options: [] };

  const candidates = sortedChildren(directory.node, namePart.startsWith("."))
    .filter((child) => child.name.startsWith(namePart))
    .map((child) => (child.kind === "file" ? child.name : `${child.name}/`));
  if (candidates.length === 0) return { value: before + partial, options: [] };
  if (candidates.length === 1) {
    const done = candidates[0];
    return { value: `${before}${dirPart}${done}${done.endsWith("/") ? "" : " "}`, options: [] };
  }
  const prefix = commonPrefix(candidates);
  return { value: `${before}${dirPart}${prefix.length > namePart.length ? prefix : namePart}`, options: candidates };
}

export function complete(state: GameState, input: string): Completion {
  const lastSpace = input.lastIndexOf(" ");
  if (lastSpace === -1) return completeCommand(input);
  const before = input.slice(0, lastSpace + 1);
  const partial = input.slice(lastSpace + 1);
  if (partial.startsWith("-")) return { value: input, options: [] };
  return completePath(state, before, partial);
}
