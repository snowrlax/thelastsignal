import { describe, expect, it } from "vitest";
import { editDistance, parseCommandLine, splitFlags } from "@/game/commands/parse";

describe("command line parsing", () => {
  it("lowercases the command and keeps argument case", () => {
    expect(parseCommandLine("CAT README.txt")).toEqual({ ok: true, command: { name: "cat", args: ["README.txt"] } });
  });

  it("honours quotes, including empty ones", () => {
    expect(parseCommandLine(`grep "kill -9 218" /restricted`)).toEqual({ ok: true, command: { name: "grep", args: ["kill -9 218", "/restricted"] } });
    expect(parseCommandLine(`grep 'a b' ""`)).toEqual({ ok: true, command: { name: "grep", args: ["a b", ""] } });
  });

  it("rejects pipes, redirection, chaining and substitution", () => {
    for (const line of ["ls | grep x", "cat a > b", "ls; ls", "ls && ls", "echo $(whoami)", "echo `id`"]) {
      expect(parseCommandLine(line)).toEqual({ ok: false, reason: "unsupported_operator" });
    }
  });

  it("detects unterminated quotes", () => {
    expect(parseCommandLine(`cat "README.txt`)).toEqual({ ok: false, reason: "unterminated_quote" });
  });

  it("returns an empty name for blank input", () => {
    expect(parseCommandLine("   ")).toEqual({ ok: true, command: { name: "", args: [] } });
  });

  it("splits combined short flags and stops at --", () => {
    const { flags, positional } = splitFlags(["-la", "--recursive", "x", "--", "-y", "-9"]);
    expect([...flags].sort()).toEqual(["a", "l", "recursive"]);
    expect(positional).toEqual(["x", "-y", "-9"]);
  });

  it("measures edit distance", () => {
    expect(editDistance("ls", "ls")).toBe(0);
    expect(editDistance("sl", "ls")).toBe(2);
    expect(editDistance("cta", "cat")).toBe(2);
    expect(editDistance("", "abc")).toBe(3);
  });
});
