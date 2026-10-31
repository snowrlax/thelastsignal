import { describe, expect, it } from "vitest";
import { runCommand } from "@/game/engine";
import { ACCELERATED_BREACH_MS } from "@/game/constants";
import { newGame, PHASE1_COMMANDS, PHASE2_COMMANDS, runAll, startedGame, text } from "@/tests/helpers/game";

const unlocked = () => runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS]).state;

describe("cp", () => {
  it("is locked until the containment truth is exposed", () => {
    const result = runCommand(startedGame(), "cp -r /archive/vega /recovery/vega_archive");
    expect(result.state.system.archiveCopied).toBe(false);
    expect(text(result)).toContain("write lock held by pid 404");
  });

  it("copies the archive once recovery is unlocked", () => {
    const result = runCommand(unlocked(), "cp -r /archive/vega /recovery/vega_archive");
    expect(result.state.system.archiveCopied).toBe(true);
    expect(result.state.system.recoveryName).toBe("vega_archive");
    expect(result.events.map((event) => event.id)).toContain("archive_copied");
    expect(text(runCommand(result.state, "ls /recovery"))).toContain("vega_archive/");
  });

  it("accepts relative paths, -R/-a, and copying into the recovery folder", () => {
    const state = unlocked();
    const fromArchive = runAll(state, ["cd /archive", "cp -R vega /recovery/"]).state;
    expect(fromArchive.system.recoveryName).toBe("vega");
    expect(runCommand(state, "cp -a /archive /recovery/everything").state.system.archiveCopied).toBe(true);
  });

  it("explains every way a copy can go wrong", () => {
    const state = unlocked();
    expect(text(runCommand(state, "cp /archive/vega /recovery/x"))).toContain("-r not specified");
    expect(text(runCommand(state, "cp -r /archive/vega /tmp/x"))).toContain("Read-only");
    expect(text(runCommand(state, "cp -r /research /recovery/r"))).toContain("only the original archive");
    expect(text(runCommand(state, "cp -r /nope /recovery/x"))).toContain("cannot stat");
    expect(text(runCommand(state, "cp -r /archive/vega /recovery/a/b"))).toContain("No such file");
    expect(text(runCommand(state, "cp -r /home/ivega /recovery/x"))).toContain("Permission denied");
    expect(text(runCommand(state, "cp -r /archive/vega /recovery/.partial_20121102.log"))).toContain("cannot overwrite");
    expect(text(runCommand(state, "cp -r /archive/vega"))).toContain("usage");
    const copied = runCommand(state, "cp -r /archive/vega /recovery/vega_archive").state;
    expect(text(runCommand(copied, "cp -r /archive/vega /recovery/again"))).toContain("already verified");
  });
});

describe("destructive commands", () => {
  it("refuses to delete the originals and applies a penalty", () => {
    const game = startedGame();
    const result = runCommand(game, "rm -rf /archive/vega");
    expect(result.state.destructiveAttempts).toBe(1);
    expect(result.state.timer.remainingMs).toBeLessThan(game.timer.remainingMs);
    expect(text(result)).toContain("DESTRUCTIVE COMMAND REFUSED");
  });

  it("accelerates the breach after repeated attempts", () => {
    const { state, results } = runAll(startedGame(), ["rm -rf /", "mv /archive /tmp", "kill 1"]);
    expect(state.destructiveAttempts).toBe(3);
    expect(state.timer.remainingMs).toBeLessThanOrEqual(ACCELERATED_BREACH_MS);
    expect(text(results[2])).toContain("BOUNDARY DEGRADED");
  });

  it("only warns before the timer runs", () => {
    const result = runCommand(newGame(), "rm /archive/vega/session_014.log");
    expect(result.state.destructiveAttempts).toBe(1);
    expect(result.state.timer.remainingMs).toBe(0);
  });

  it("other removals are harmless read-only errors", () => {
    expect(text(runCommand(newGame(), "rm README.txt"))).toContain("Read-only");
    expect(text(runCommand(newGame(), "rm"))).toContain("usage");
    const copied = runCommand(unlocked(), "cp -r /archive/vega /recovery/vega_archive").state;
    expect(text(runCommand(copied, "rm -r /recovery/vega_archive"))).toContain("write-once");
  });
});

describe("help, identity and the rest of the shell", () => {
  it("lists commands and explains one", () => {
    const help = runCommand(newGame(), "help");
    expect(help.lines[1]).toEqual({ kind: "head", text: "OFRENDA SHELL · available commands" });
    expect(text(runCommand(newGame(), "help kill"))).toContain("usage: kill");
    expect(text(runCommand(newGame(), "help nope"))).toContain("no help");
    expect(text(runCommand(newGame(), "man cp"))).toContain("no manual pages");
  });

  it("whoami grows strange as the story progresses", () => {
    expect(text(runCommand(newGame(), "whoami"))).toContain("callsign: RAVEN");
    const inspected = runCommand(newGame(), "ps -fp 404").state;
    expect(text(runCommand(inspected, "whoami"))).toContain("pts/404");
    const recovery = runCommand(unlocked(), "whoami");
    expect(recovery.lines[1]).toEqual({ kind: "glitch", text: "ivega" });
    expect(recovery.events.map((event) => event.id)).toContain("whoami_anomaly");
  });

  it("history includes the suspicious command typed after the system halted", () => {
    const result = text(runCommand(newGame(), "history"));
    expect(result).toContain("2012-11-03 00:14 (system halted)");
    expect(result).toContain("kill -9 218");
    expect(result).toMatch(/6 {2}history/);
  });

  it("clear only clears the screen", () => {
    const game = startedGame();
    const result = runCommand(game, "clear");
    expect(result.effects).toEqual([{ type: "clear" }]);
    expect(result.state.timer.remainingMs).toBe(game.timer.remainingMs);
  });

  it("answers small utilities", () => {
    expect(text(runCommand(newGame(), "date"))).toContain("Mon Nov  2 23:51:30 CST 2026");
    expect(text(runCommand(newGame(), "uname -a"))).toContain("ofrenda-01");
    expect(text(runCommand(newGame(), "uname"))).toBe("operator@ofrenda-01:~$ uname\nLinux");
    expect(text(runCommand(newGame(), "hostname"))).toContain("ofrenda-01");
    expect(text(runCommand(newGame(), "uptime"))).toContain("2 users");
    expect(text(runCommand(newGame(), "echo hello $USER in $HOME"))).toContain("hello operator in /home/operator");
    expect(text(runCommand(newGame(), "sudo kill -9 218"))).toContain("sudoers");
    expect(text(runCommand(newGame(), "su ivega"))).toContain("sealed");
    expect(text(runCommand(newGame(), "shutdown now"))).toContain("refused");
    expect(text(runCommand(newGame(), "ssh lab"))).toContain("network unreachable");
    expect(text(runCommand(newGame(), "vim README.txt"))).toContain("no editors");
    expect(text(runCommand(newGame(), "touch x"))).toContain("Read-only");
    expect(text(runCommand(newGame(), "ll"))).toContain(".last_session");
  });

  it("hint gives a contextual nudge and counts it", () => {
    const result = runCommand(startedGame(), "hint");
    expect(text(result)).toContain("README");
    expect(result.state.hintsShown).toBe(1);
  });

  it("reply talks to M_VEGA, keeps punctuation, and never touches game state", () => {
    const game = startedGame();
    const result = runCommand(game, "reply who are you? don't lie | > ;");
    expect(result.events).toEqual([{ id: "player_reply", text: "who are you? don't lie | > ;" }]);
    expect(result.state.evidence).toEqual(game.evidence);
    expect(result.state.system).toEqual(game.system);
  });

  it("reply handles HOLLOW, empty and over-long messages", () => {
    expect(runCommand(startedGame(), "msg hollow stop").events).toEqual([{ id: "msg_hollow" }]);
    expect(text(runCommand(startedGame(), "reply"))).toContain("usage");
    const long = runCommand(startedGame(), `say ${"a".repeat(260)}`);
    expect(long.events[0].text).toHaveLength(200);
    expect(text(long)).toContain("cut to 200");
  });

  it("unknown commands are friendly and suggest the closest match", () => {
    const result = runCommand(newGame(), "lss");
    expect(text(result)).toContain("command not found");
    expect(text(result)).toContain("did you mean 'ls'");
    expect(text(runCommand(newGame(), "xyzzyplugh"))).toContain("type help");
  });

  it("explains unsupported shell syntax", () => {
    expect(text(runCommand(newGame(), "ls | grep x"))).toContain("not supported");
    expect(text(runCommand(newGame(), `cat "README.txt`))).toContain("quote was never closed");
  });

  it("offers a hint after three mistakes in a row, without any penalty", () => {
    const game = startedGame();
    const { state, results } = runAll(game, ["cat nope", "cd nope", "lss"]);
    expect(results[2].lines.some((line) => line.kind === "hint")).toBe(true);
    expect(state.consecutiveErrors).toBe(0);
    expect(state.hintsShown).toBe(1);
    expect(state.timer.remainingMs).toBe(game.timer.remainingMs);
  });

  it("blank input only echoes the prompt", () => {
    const result = runCommand(newGame(), "   ");
    expect(result.lines).toHaveLength(1);
    expect(result.state.history).toHaveLength(0);
  });
});
