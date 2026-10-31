import { buildRootTree } from "@/game/content";
import type { DirNode, FileNode, FsNode } from "@/game/fs/nodes";
import { joinPath, normalizePath } from "@/game/fs/paths";

const treeCache = new Map<string, DirNode>();

/** The filesystem is fixed; only /recovery changes once the archive has been copied. */
export function getTree(recoveryName: string | null): DirNode {
  const key = recoveryName ?? "";
  const cached = treeCache.get(key);
  if (cached) return cached;
  const tree = buildRootTree(recoveryName);
  treeCache.set(key, tree);
  return tree;
}

export type LookupError = "ENOENT" | "ENOTDIR";

export interface LookupHit {
  readonly ok: true;
  readonly node: FsNode;
  /** Real path with symlinks resolved. */
  readonly path: string;
}

export interface LookupMiss {
  readonly ok: false;
  readonly error: LookupError;
}

export type LookupResult = LookupHit | LookupMiss;

const MAX_LINK_DEPTH = 8;

function findChild(dirNode: DirNode, name: string): FsNode | undefined {
  return dirNode.children.find((child) => child.name === name);
}

/**
 * Resolves an absolute, normalized path. Intermediate symlinks are always
 * followed; the final component is followed unless followFinal is false.
 */
export function resolveAbsolute(
  root: DirNode,
  absolutePath: string,
  followFinal = true,
  depth = 0,
): LookupResult {
  if (depth > MAX_LINK_DEPTH) return { ok: false, error: "ENOENT" };
  const segments = absolutePath.split("/").filter(Boolean);
  let current: FsNode = root;
  let currentPath = "/";

  for (let index = 0; index < segments.length; index += 1) {
    if (current.kind !== "dir") return { ok: false, error: "ENOTDIR" };
    const child = findChild(current, segments[index]);
    if (!child) return { ok: false, error: "ENOENT" };
    const isLast = index === segments.length - 1;

    if (child.kind === "link" && (!isLast || followFinal)) {
      const remainder = segments.slice(index + 1).join("/");
      const target = remainder ? joinPath(child.target, remainder) : child.target;
      return resolveAbsolute(root, normalizePath("/", target), followFinal, depth + 1);
    }
    current = child;
    currentPath = joinPath(currentPath, child.name);
  }
  return { ok: true, node: current, path: currentPath };
}

export function lookup(
  root: DirNode,
  cwd: string,
  input: string,
  followFinal = true,
): LookupResult {
  return resolveAbsolute(root, normalizePath(cwd, input), followFinal);
}

export function sortedChildren(node: DirNode, includeHidden: boolean): readonly FsNode[] {
  return [...node.children]
    .filter((child) => includeHidden || !child.name.startsWith("."))
    .sort((a, b) => a.name.replace(/^\./, "").localeCompare(b.name.replace(/^\./, "")));
}

export interface WalkEntry {
  readonly path: string;
  readonly node: FsNode;
}

/** Depth-first walk that does not follow symlinks (like find without -L). */
export function walk(node: FsNode, path: string): WalkEntry[] {
  const entries: WalkEntry[] = [{ path, node }];
  if (node.kind !== "dir") return entries;
  for (const child of sortedChildren(node, true)) {
    entries.push(...walk(child, joinPath(path, child.name)));
  }
  return entries;
}

export function isTextFile(node: FsNode): node is FileNode {
  return node.kind === "file" && !node.binary;
}
