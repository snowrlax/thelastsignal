import { treeFor } from "@/game/commands/context";
import { destructiveOutcome } from "@/game/commands/destructive";
import { splitFlags } from "@/game/commands/parse";
import type { CommandHandler, CommandOutcome } from "@/game/commands/types";
import { basename, joinPath, normalizePath } from "@/game/fs/paths";
import { lookup, resolveAbsolute } from "@/game/fs/tree";
import { dim, err, line, ok } from "@/game/text";
import type { GameState, OutputLine } from "@/game/types";

function parentOf(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}

type TargetResult = { ok: true; path: string } | { ok: false; outcome: CommandOutcome };

function resolveTarget(state: GameState, sourcePath: string, sourceIsDir: boolean, destination: string): TargetResult {
  const root = treeFor(state);
  const existing = lookup(root, state.cwd, destination);
  if (existing.ok && existing.node.kind === "dir") {
    return { ok: true, path: joinPath(existing.path, basename(sourcePath)) };
  }
  if (existing.ok) {
    if (sourceIsDir) {
      return { ok: false, outcome: { lines: [err(`cp: cannot overwrite non-directory '${destination}' with directory`)], error: true } };
    }
    return { ok: true, path: existing.path };
  }
  const absolute = normalizePath(state.cwd, destination);
  const parent = resolveAbsolute(root, parentOf(absolute));
  if (!parent.ok || parent.node.kind !== "dir") {
    return { ok: false, outcome: { lines: [err(`cp: cannot create '${destination}': No such file or directory`)], error: true } };
  }
  return { ok: true, path: joinPath(parent.path, basename(absolute)) };
}

function copySequence(source: string, target: string): OutputLine[] {
  return [
    line("sys", `cp: ${source} -> ${target}`),
    line("out", "  letters ............ 1,113 / 1,113", 500),
    line("out", "  recordings .........   212 /   212", 450),
    line("out", "  photographs ........    64 /    64", 450),
    line("out", "  session logs .......    14 /    14", 450),
    line("out", "  [##############################] 100%", 600),
    line("dim", "  sha1 verify (archive-indexer, pid 118) ...... OK", 700),
    ok("RECOVERY COPY VERIFIED. ORIGINALS PRESERVED."),
  ];
}

export const cp: CommandHandler = ({ state, args }) => {
  const { flags, positional } = splitFlags(args);
  const recursive = flags.has("r") || flags.has("R") || flags.has("a") || flags.has("recursive");
  if (positional.length !== 2) {
    return { lines: [err("usage: cp -r <source> <destination>     e.g. cp -r notes /recovery/notes")], error: true };
  }
  const [sourceArg, destinationArg] = positional;
  const source = lookup(treeFor(state), state.cwd, sourceArg);
  if (!source.ok) return { lines: [err(`cp: cannot stat '${sourceArg}': No such file or directory`)], error: true };
  if (source.node.kind === "dir" && source.node.sealed) {
    return { lines: [err(`cp: cannot open '${sourceArg}': Permission denied`)], error: true };
  }
  const sourceIsDir = source.node.kind === "dir";
  const target = resolveTarget(state, source.path, sourceIsDir, destinationArg);
  if (!target.ok) return target.outcome;

  const inRecovery = parentOf(target.path) === "/recovery";
  if (!inRecovery) {
    return { lines: [err(`cp: cannot create '${target.path}': Read-only file system (only /recovery is writable)`)], error: true };
  }
  if (sourceIsDir && !recursive) {
    return { lines: [err(`cp: -r not specified; omitting directory '${sourceArg}'`)], error: true };
  }
  if (!state.system.recoveryUnlocked) {
    return {
      lines: [
        err(`cp: cannot create '${target.path}': write lock held by pid 404 (persona-recon)`),
        dim("(hollowd lifts the lock once an operator has reviewed the containment protocol)"),
      ],
      effects: [{ type: "sound", name: "deny" }],
    };
  }
  if (state.system.archiveCopied) {
    return { lines: [dim(`cp: recovery copy already verified at /recovery/${state.system.recoveryName}`)] };
  }
  const isArchive = source.path === "/archive/vega" || source.path === "/archive";
  if (!isArchive) {
    return { lines: [err("cp: refused: only the original archive (/archive/vega) is cleared for recovery.")], error: true };
  }

  const next: GameState = {
    ...state,
    system: { ...state.system, archiveCopied: true, recoveryName: basename(target.path) },
  };
  return {
    state: next,
    lines: copySequence(source.path, target.path),
    events: [{ id: "archive_copied" }],
    effects: [{ type: "sound", name: "copy" }],
  };
};

function touchesOriginals(path: string): boolean {
  return path === "/" || path === "/archive" || path.startsWith("/archive/");
}

function removeLike(command: "rm" | "mv"): CommandHandler {
  return ({ state, args }) => {
    const { positional } = splitFlags(args);
    if (positional.length === 0) {
      return { lines: [err(`usage: ${command} <file>`)], error: true };
    }
    const sources = command === "mv" ? positional.slice(0, -1) : positional;
    for (const target of sources.length > 0 ? sources : positional) {
      const absolute = normalizePath(state.cwd, target);
      const resolved = lookup(treeFor(state), state.cwd, target);
      const real = resolved.ok ? resolved.path : absolute;
      if (touchesOriginals(absolute) || touchesOriginals(real)) {
        return destructiveOutcome(state, [err(`${command}: refusing to touch the original archive ('${target}')`)]);
      }
      if (real.startsWith("/recovery/") && state.system.recoveryName && real.includes(state.system.recoveryName)) {
        return { lines: [err(`${command}: '${target}': the recovery copy is write-once (indexer policy)`)], error: true };
      }
    }
    return { lines: [err(`${command}: cannot ${command === "rm" ? "remove" : "move"} '${positional[0]}': Read-only file system`)], error: true };
  };
}

export const rm = removeLike("rm");
export const mv = removeLike("mv");
