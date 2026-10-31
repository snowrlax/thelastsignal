import { fileContext, treeFor } from "@/game/commands/context";
import { splitFlags } from "@/game/commands/parse";
import type { CommandHandler, CommandOutcome } from "@/game/commands/types";
import { nodeSize, type DirNode, type FsNode } from "@/game/fs/nodes";
import { lookup, sortedChildren } from "@/game/fs/tree";
import { HOME } from "@/game/constants";
import { columns, dim, err, out, padLeft, padRight } from "@/game/text";
import type { GameState, OutputLine } from "@/game/types";

export const pwd: CommandHandler = ({ state }) => ({ lines: [out(state.cwd)] });

function permissions(node: FsNode): string {
  if (node.kind === "dir") return node.sealed ? "d---------" : "drwxr-xr-x";
  if (node.kind === "link") return "lrwxrwxrwx";
  return "-rw-r--r--";
}

function displayName(node: FsNode): string {
  return node.kind === "dir" || node.kind === "link" ? `${node.name}/` : node.name;
}

function longLine(state: GameState, node: FsNode, nameOverride?: string): string {
  const size = nodeSize(node, fileContext(state));
  const name = nameOverride ?? (node.kind === "link" ? `${node.name} -> ${node.target}` : node.name);
  return [
    permissions(node),
    padLeft(node.kind === "dir" ? String(node.children.length + 2) : "1", 2),
    padRight(node.owner, 8),
    padRight("ofrenda", 7),
    padLeft(String(size), 8),
    node.mtime,
    name,
  ].join(" ");
}

function listDirectory(state: GameState, node: DirNode, flags: Set<string>): OutputLine[] {
  const all = flags.has("a");
  const children = sortedChildren(node, all);
  if (flags.has("l")) {
    const header = all ? [longLine(state, node, "."), longLine(state, node, "..")] : [];
    const lines = [...header, ...children.map((child) => longLine(state, child))];
    return [dim(`total ${children.length}`), ...lines.map(out)];
  }
  const names = [...(all ? ["./", "../"] : []), ...children.map(displayName)];
  if (names.length === 0) return [dim("(empty)")];
  return columns(names).map(out);
}

export const ls: CommandHandler = ({ state, args }) => {
  const { flags, positional } = splitFlags(args);
  const targets = positional.length > 0 ? positional : ["."];
  const root = treeFor(state);
  const lines: OutputLine[] = [];
  let failed = false;

  targets.forEach((target, index) => {
    const result = lookup(root, state.cwd, target);
    if (!result.ok) {
      failed = true;
      lines.push(err(`ls: cannot access '${target}': No such file or directory`));
      return;
    }
    const { node } = result;
    if (node.kind === "dir" && node.sealed) {
      failed = true;
      lines.push(err(`ls: cannot open directory '${target}': Permission denied (sealed 2012-11-04)`));
      return;
    }
    if (targets.length > 1) lines.push(out(`${target}:`));
    lines.push(...(node.kind === "dir" ? listDirectory(state, node, flags) : [out(flags.has("l") ? longLine(state, node) : node.name)]));
    if (targets.length > 1 && index < targets.length - 1) lines.push(out(""));
  });

  const outcome: CommandOutcome = { lines, error: failed };
  return failed ? outcome : { ...outcome, events: [{ id: "first_ls" }] };
};

export const cd: CommandHandler = ({ state, args }) => {
  const target = args[0] === "-" ? state.prevCwd : args[0] ?? HOME;
  const result = lookup(treeFor(state), state.cwd, target);
  if (!result.ok) {
    return { lines: [err(`cd: ${target}: No such file or directory`)], error: true };
  }
  if (result.node.kind !== "dir") {
    return { lines: [err(`cd: ${target}: Not a directory`)], error: true };
  }
  if (result.node.sealed) {
    return { lines: [err(`cd: ${target}: Permission denied (home directory sealed 2012-11-04)`)], error: true };
  }
  const lines = args[0] === "-" ? [out(result.path)] : [];
  return { state: { ...state, prevCwd: state.cwd, cwd: result.path }, lines };
};
