import { fileContext, treeFor } from "@/game/commands/context";
import { splitFlags } from "@/game/commands/parse";
import type { CommandHandler } from "@/game/commands/types";
import { readContent, type FsNode } from "@/game/fs/nodes";
import { globToRegExp, joinPath } from "@/game/fs/paths";
import { lookup, walk } from "@/game/fs/tree";
import { grantFlags } from "@/game/evidence";
import { dim, err, out } from "@/game/text";
import type { EvidenceFlag, GameState, OutputLine } from "@/game/types";
import { readingHold } from "@/game/commands/read";

const MAX_GREP_MATCHES = 40;
const MAX_FIND_RESULTS = 60;

function buildMatcher(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}

interface GrepHit {
  readonly path: string;
  readonly lineNumber: number;
  readonly text: string;
}

function searchNode(state: GameState, node: FsNode, path: string, matcher: RegExp, hits: GrepHit[], flags: EvidenceFlag[]): void {
  for (const entry of walk(node, path)) {
    const candidate = entry.node;
    if (candidate.kind !== "file" || candidate.binary) continue;
    const text = readContent(candidate, fileContext(state));
    text.split("\n").forEach((lineText, index) => {
      if (!matcher.test(lineText)) return;
      hits.push({ path: entry.path, lineNumber: index + 1, text: lineText });
      if (candidate.flag && candidate.grepKey?.test(lineText)) flags.push(candidate.flag);
    });
  }
}

export const grep: CommandHandler = ({ state, args }) => {
  const { flags, positional } = splitFlags(args);
  const [pattern, ...paths] = positional;
  if (!pattern) {
    return { lines: [err("usage: grep <word> [path]     e.g. grep containment /restricted")], error: true };
  }
  const matcher = buildMatcher(pattern);
  const targets = paths.length > 0 ? paths : ["."];
  const root = treeFor(state);
  const hits: GrepHit[] = [];
  const flagsFound: EvidenceFlag[] = [];
  const errors: OutputLine[] = [];
  let singleFile = targets.length === 1;

  for (const target of targets) {
    const result = lookup(root, state.cwd, target);
    if (!result.ok) {
      errors.push(err(`grep: ${target}: No such file or directory`));
      continue;
    }
    if (result.node.kind === "dir") {
      singleFile = false;
      if (result.node.sealed) {
        errors.push(err(`grep: ${target}: Permission denied`));
        continue;
      }
    }
    searchNode(state, result.node, result.path, matcher, hits, flagsFound);
  }

  const showNumbers = flags.has("n");
  const filesOnly = flags.has("l");
  let body: OutputLine[];
  if (filesOnly) {
    body = [...new Set(hits.map((hit) => hit.path))].map(out);
  } else {
    body = hits.slice(0, MAX_GREP_MATCHES).map((hit) => {
      const prefix = singleFile ? "" : `${hit.path}:`;
      const number = showNumbers ? `${hit.lineNumber}:` : "";
      return out(`${prefix}${number}${hit.text.trim()}`);
    });
    if (hits.length > MAX_GREP_MATCHES) body.push(dim(`... ${hits.length - MAX_GREP_MATCHES} more matches. narrow the search with a path.`));
  }
  if (hits.length === 0 && errors.length === 0) body = [dim(`(no matches for "${pattern}")`)];

  const granted = grantFlags(state, flagsFound);
  const hold = readingHold(body.length);
  const next = hold > 0 && granted.state.timer.running
    ? { ...granted.state, timer: { ...granted.state.timer, readingHoldMs: hold } }
    : granted.state;
  return { state: next, lines: [...errors, ...body], events: granted.events, error: errors.length > 0 && hits.length === 0 };
};

/** find prints results relative to the start path exactly as the player typed it. */
function displayFindPath(start: string, startReal: string, entryPath: string): string {
  if (entryPath === startReal) return start;
  const relative = entryPath.slice(startReal === "/" ? 1 : startReal.length + 1);
  const base = start.replace(/\/+$/, "");
  return base === "" ? `/${relative}` : joinPath(base, relative);
}

function findOption(args: readonly string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : undefined;
}

export const find: CommandHandler = ({ state, args }) => {
  const optionStart = args.findIndex((arg) => arg.startsWith("-"));
  const starts = (optionStart === -1 ? args : args.slice(0, optionStart)).filter(Boolean);
  const options = optionStart === -1 ? [] : args.slice(optionStart);
  const name = findOption(options, "-name");
  const iname = findOption(options, "-iname");
  const type = findOption(options, "-type");
  const known = new Set(["-name", "-iname", "-type"]);
  const unknown = options.filter((option, index) => option.startsWith("-") && !known.has(option) && !known.has(options[index - 1]));
  if (unknown.length > 0) {
    return { lines: [err(`find: unknown option '${unknown[0]}'. supported: -name <pattern>, -iname, -type f|d`)], error: true };
  }

  const nameMatcher = name ? globToRegExp(name) : iname ? new RegExp(globToRegExp(iname).source, "i") : null;
  const root = treeFor(state);
  const results: string[] = [];
  const errors: OutputLine[] = [];

  for (const start of starts.length > 0 ? starts : ["."]) {
    const resolved = lookup(root, state.cwd, start);
    if (!resolved.ok) {
      errors.push(err(`find: '${start}': No such file or directory`));
      continue;
    }
    for (const entry of walk(resolved.node, resolved.path)) {
      const shown = displayFindPath(start, resolved.path, entry.path);
      if (entry.node.kind === "dir" && entry.node.sealed) {
        errors.push(err(`find: '${shown}': Permission denied`));
        continue;
      }
      if (type === "f" && entry.node.kind !== "file") continue;
      if (type === "d" && entry.node.kind !== "dir") continue;
      if (nameMatcher && !nameMatcher.test(entry.node.name)) continue;
      results.push(shown);
    }
  }

  const lines: OutputLine[] = [...errors, ...results.slice(0, MAX_FIND_RESULTS).map(out)];
  if (results.length > MAX_FIND_RESULTS) lines.push(dim(`... ${results.length - MAX_FIND_RESULTS} more. add -name <pattern> to narrow it down.`));
  if (results.length === 0 && errors.length === 0) lines.push(dim("(nothing found)"));
  return { lines, error: errors.length > 0 && results.length === 0 };
};
