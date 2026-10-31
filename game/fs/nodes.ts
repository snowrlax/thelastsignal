import type { EvidenceFlag, RecordingId, StoryEventId } from "@/game/types";

export interface FileContext {
  readonly playerName: string;
}

export type FileContent = string | ((ctx: FileContext) => string);

export interface FileNode {
  readonly kind: "file";
  readonly name: string;
  readonly content: FileContent;
  readonly mtime: string;
  readonly owner: string;
  readonly binary?: "audio" | "image";
  readonly recording?: RecordingId;
  /** Evidence flag granted when this file is read (cat/play) or a key line is grepped. */
  readonly flag?: EvidenceFlag;
  /** Lines matching this pattern count as "finding the evidence" through grep. */
  readonly grepKey?: RegExp;
  /** Story event emitted when the file is read. */
  readonly event?: StoryEventId;
  /** Declared size for binary files (text files report their real length). */
  readonly size?: number;
}

export interface DirNode {
  readonly kind: "dir";
  readonly name: string;
  readonly mtime: string;
  readonly owner: string;
  readonly children: readonly FsNode[];
  /** Sealed directories exist but refuse every operation. */
  readonly sealed?: boolean;
}

export interface LinkNode {
  readonly kind: "link";
  readonly name: string;
  readonly target: string;
  readonly mtime: string;
  readonly owner: string;
}

export type FsNode = FileNode | DirNode | LinkNode;

type FileOptions = Omit<FileNode, "kind" | "name" | "content" | "mtime" | "owner"> & {
  readonly mtime?: string;
  readonly owner?: string;
};

const DEFAULT_MTIME = "Oct 29  2012";
const DEFAULT_OWNER = "ivega";

export function file(name: string, content: FileContent, options: FileOptions = {}): FileNode {
  return {
    kind: "file",
    name,
    content,
    mtime: options.mtime ?? DEFAULT_MTIME,
    owner: options.owner ?? DEFAULT_OWNER,
    ...options,
  };
}

export function dir(
  name: string,
  children: readonly FsNode[],
  options: { mtime?: string; owner?: string; sealed?: boolean } = {},
): DirNode {
  return {
    kind: "dir",
    name,
    children,
    mtime: options.mtime ?? DEFAULT_MTIME,
    owner: options.owner ?? DEFAULT_OWNER,
    sealed: options.sealed,
  };
}

export function link(name: string, target: string): LinkNode {
  return { kind: "link", name, target, mtime: DEFAULT_MTIME, owner: DEFAULT_OWNER };
}

export function readContent(node: FileNode, ctx: FileContext): string {
  return typeof node.content === "function" ? node.content(ctx) : node.content;
}

export function nodeSize(node: FsNode, ctx: FileContext): number {
  if (node.kind === "dir") return 4096;
  if (node.kind === "link") return node.target.length;
  return node.size ?? readContent(node, ctx).length;
}
