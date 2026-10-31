import { describe, expect, it } from "vitest";
import { runCommand } from "@/game/engine";
import { READING_HOLD } from "@/game/constants";
import { newGame, runAll, startedGame, text } from "@/tests/helpers/game";

describe("pwd, ls, cd", () => {
  it("starts in the operator home", () => {
    expect(text(runCommand(newGame(), "pwd"))).toContain("/home/operator");
  });

  it("lists visible files, and hidden ones with -a", () => {
    const plain = text(runCommand(newGame(), "ls"));
    expect(plain).toContain("README.txt");
    expect(plain).toContain("archive/");
    expect(plain).not.toContain(".last_session");
    const all = text(runCommand(newGame(), "ls -la"));
    expect(all).toContain(".last_session");
    expect(all).toContain("archive -> /archive/vega");
    expect(all).toMatch(/^total/m);
  });

  it("emits first_ls only on a successful listing", () => {
    expect(runCommand(newGame(), "ls /nope").events).toHaveLength(0);
    expect(runCommand(newGame(), "ls").events.map((event) => event.id)).toContain("first_ls");
  });

  it("lists several targets, single files and empty folders", () => {
    const many = text(runCommand(newGame(), "ls /research /logs"));
    expect(many).toContain("/research:");
    expect(many).toContain("/logs:");
    expect(text(runCommand(newGame(), "ls -l README.txt"))).toMatch(/-rw-r--r-- .*README\.txt/);
    expect(text(runCommand(newGame(), "ls /recovery"))).toContain("(empty)");
  });

  it("refuses the sealed home of ivega", () => {
    const result = runCommand(newGame(), "ls /home/ivega");
    expect(text(result)).toContain("Permission denied");
    expect(text(runCommand(newGame(), "cd /home/ivega"))).toContain("Permission denied");
  });

  it("changes directory through links, parents, home and back", () => {
    const { state, results } = runAll(newGame(), ["cd archive", "pwd", "cd ..", "pwd", "cd -", "cd", "pwd"]);
    expect(text(results[1])).toContain("/archive/vega");
    expect(text(results[3])).toContain("/archive");
    expect(text(results[4])).toContain("/archive/vega");
    expect(state.cwd).toBe("/home/operator");
  });

  it("explains cd mistakes without changing directory", () => {
    const missing = runCommand(newGame(), "cd /nowhere");
    expect(text(missing)).toContain("No such file or directory");
    expect(missing.state.cwd).toBe("/home/operator");
    expect(text(runCommand(newGame(), "cd README.txt"))).toContain("Not a directory");
  });

  it("shows the current directory in the prompt echo", () => {
    const { results } = runAll(newGame(), ["cd /logs", "ls"]);
    expect(results[1].lines[0].text).toBe("operator@ofrenda-01:/logs$ ls");
  });
});

describe("cat, head, tail, play", () => {
  it("grants evidence and story events when reading", () => {
    const result = runCommand(startedGame(), "cat README.txt");
    expect(result.state.evidence.read_readme).toBe(true);
    expect(result.events.map((event) => event.id)).toContain("read_readme");
    expect(text(result)).toContain("THE CONTAINMENT SERVICE MUST STAY ACTIVE");
  });

  it("holds the timer while a long file is read", () => {
    const result = runCommand(startedGame(), "cat /restricted/containment_protocol.txt");
    expect(result.state.timer.readingHoldMs).toBeGreaterThan(0);
    expect(result.state.timer.readingHoldMs).toBeLessThanOrEqual(READING_HOLD.maxMs);
    expect(runCommand(startedGame(), "cat /etc/hostname").state.timer.readingHoldMs).toBe(0);
  });

  it("does not hold the timer before it is running", () => {
    expect(runCommand(newGame(), "cat README.txt").state.timer.readingHoldMs).toBe(0);
  });

  it("explains directories, audio and missing files", () => {
    expect(text(runCommand(newGame(), "cat /logs"))).toContain("Is a directory");
    expect(text(runCommand(newGame(), "cat /archive/vega/voice_001.wav"))).toContain("play");
    expect(text(runCommand(newGame(), "cat nope.txt"))).toContain("No such file");
    expect(text(runCommand(newGame(), "cat"))).toContain("usage");
    expect(text(runCommand(newGame(), "cat /home/ivega"))).toContain("Permission denied");
  });

  it("shows indexed captions for photographs", () => {
    expect(text(runCommand(newGame(), "cat /archive/vega/photographs/altar_2011.jpg"))).toContain("ROSARIO");
  });

  it("reads multiple files and emits their events", () => {
    const result = runCommand(newGame(), "cat /archive/vega/letters/rosario_1998.txt /logs/shutdown.log");
    const ids = result.events.map((event) => event.id);
    expect(ids).toContain("read_letter");
    expect(ids).toContain("read_shutdown_log");
  });

  it("head and tail show the edges of a file", () => {
    const head = runCommand(newGame(), "head /logs/syslog");
    expect(head.lines).toHaveLength(11);
    expect(text(runCommand(newGame(), "tail /logs/syslog"))).toContain("session opened for operator");
  });

  it("plays recordings as a held, protected sequence", () => {
    const result = runCommand(startedGame(), "play /restricted/final_recording.wav");
    expect(result.effects).toContainEqual({ type: "recording", id: "final_recording" });
    expect(result.state.evidence.identified_truth).toBe(true);
    expect(result.lines.some((line) => line.kind === "voice" && line.text.includes("Keep the memories"))).toBe(true);
    expect(result.events.map((event) => event.id)).toEqual(expect.arrayContaining(["identified_truth", "play_final"]));
  });

  it("refuses to play non-audio", () => {
    expect(text(runCommand(newGame(), "play README.txt"))).toContain("not an audio recording");
    expect(text(runCommand(newGame(), "play"))).toContain("usage");
    expect(text(runCommand(newGame(), "play nope.wav"))).toContain("No such file");
  });
});
