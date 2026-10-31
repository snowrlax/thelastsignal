import { describe, expect, it } from "vitest";
import { basename, displayPath, globToRegExp, joinPath, normalizePath } from "@/game/fs/paths";
import { getTree, lookup, resolveAbsolute, sortedChildren, walk } from "@/game/fs/tree";
import { nodeSize, readContent } from "@/game/fs/nodes";

describe("paths", () => {
  it.each([
    ["/home/operator", "", "/home/operator"],
    ["/research", "~", "/home/operator"],
    ["/research", "~/README.txt", "/home/operator/README.txt"],
    ["/research", "..", "/"],
    ["/", "..", "/"],
    ["/archive/vega", "../../logs/./syslog", "/logs/syslog"],
    ["/home/operator", "archive/letters/", "/home/operator/archive/letters"],
    ["/home/operator", "//research//", "/research"],
  ])("normalizes %s + %s", (cwd, input, expected) => {
    expect(normalizePath(cwd, input)).toBe(expected);
  });

  it("joins, names and displays paths", () => {
    expect(joinPath("/", "logs")).toBe("/logs");
    expect(joinPath("/logs", "syslog")).toBe("/logs/syslog");
    expect(basename("/archive/vega/")).toBe("vega");
    expect(basename("/")).toBe("/");
    expect(displayPath("/home/operator")).toBe("~");
    expect(displayPath("/home/operator/x")).toBe("~/x");
    expect(displayPath("/logs")).toBe("/logs");
  });

  it("turns globs into anchored expressions", () => {
    expect(globToRegExp("*.log").test("session_014.log")).toBe(true);
    expect(globToRegExp("*.log").test("session_014.log.bak")).toBe(false);
    expect(globToRegExp("voice_00?.wav").test("voice_001.wav")).toBe(true);
    expect(globToRegExp("a+b").test("a+b")).toBe(true);
  });
});

describe("virtual filesystem tree", () => {
  const root = getTree(null);

  it("caches trees per recovery state", () => {
    expect(getTree(null)).toBe(root);
    expect(getTree("vega_archive")).not.toBe(root);
  });

  it("resolves files, directories and symlinks", () => {
    const readme = lookup(root, "/home/operator", "README.txt");
    expect(readme.ok && readme.node.kind).toBe("file");
    const viaLink = lookup(root, "/home/operator", "archive/session_014.log");
    expect(viaLink.ok && viaLink.path).toBe("/archive/vega/session_014.log");
    const linkItself = lookup(root, "/home/operator", "archive", false);
    expect(linkItself.ok && linkItself.node.kind).toBe("link");
  });

  it("reports missing paths and files used as directories", () => {
    expect(lookup(root, "/", "/nope")).toEqual({ ok: false, error: "ENOENT" });
    expect(lookup(root, "/", "/home/operator/README.txt/x")).toEqual({ ok: false, error: "ENOTDIR" });
    expect(resolveAbsolute(root, "/home/operator/nope/deeper")).toEqual({ ok: false, error: "ENOENT" });
  });

  it("hides dotfiles unless asked", () => {
    const home = lookup(root, "/", "/home/operator");
    if (!home.ok || home.node.kind !== "dir") throw new Error("home missing");
    expect(sortedChildren(home.node, false).map((child) => child.name)).not.toContain(".last_session");
    expect(sortedChildren(home.node, true).map((child) => child.name)).toContain(".last_session");
  });

  it("walks without following links", () => {
    const paths = walk(root, "/").map((entry) => entry.path);
    expect(paths).toContain("/restricted/containment_protocol.txt");
    expect(paths).toContain("/tmp/.persona/journal.txt");
    expect(paths.filter((path) => path.startsWith("/home/operator/archive/"))).toHaveLength(0);
  });

  it("adds the recovered copy under the chosen name", () => {
    const copied = getTree("vega_archive");
    const found = lookup(copied, "/", "/recovery/vega_archive/letters/rosario_1998.txt");
    expect(found.ok).toBe(true);
    expect(lookup(root, "/", "/recovery/vega_archive").ok).toBe(false);
  });

  it("injects the player's callsign into dynamic files and sizes them", () => {
    const auth = lookup(root, "/", "/logs/auth.log");
    if (!auth.ok || auth.node.kind !== "file") throw new Error("auth.log missing");
    expect(readContent(auth.node, { playerName: "RAVEN" })).toContain("callsign: RAVEN");
    expect(nodeSize(auth.node, { playerName: "RAVEN" })).toBeGreaterThan(100);
  });
});
