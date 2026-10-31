import { describe, expect, it } from "vitest";
import { runCommand } from "@/game/engine";
import { PENALTY_MS } from "@/game/constants";
import { newGame, PHASE1_COMMANDS, PHASE2_COMMANDS, runAll, startedGame, text } from "@/tests/helpers/game";

describe("grep", () => {
  it("is case-insensitive and recursive into folders", () => {
    const result = runCommand(newGame(), "grep hollow /restricted");
    expect(text(result)).toContain("/restricted/containment_protocol.txt:");
  });

  it("grants evidence only for key lines", () => {
    expect(runCommand(newGame(), "grep vega /archive").state.evidence.read_session_log).toBe(false);
    expect(runCommand(newGame(), "grep generated /archive").state.evidence.read_session_log).toBe(true);
    expect(runCommand(newGame(), "grep verdict /restricted").state.evidence.identified_truth).toBe(true);
  });

  it("supports -n, -l and single-file output", () => {
    expect(text(runCommand(newGame(), "grep -n VERDICT /restricted/identity_validation.log"))).toMatch(/^\d+:VERDICT/m);
    expect(text(runCommand(newGame(), "grep -l hollow /restricted"))).toContain("/restricted/containment_protocol.txt");
  });

  it("falls back to literal search for invalid patterns", () => {
    expect(text(runCommand(newGame(), "grep ( /research"))).toBeTruthy();
  });

  it("reports nothing found, usage and missing paths", () => {
    expect(text(runCommand(newGame(), "grep zzzzqqq /logs"))).toContain("no matches");
    expect(text(runCommand(newGame(), "grep"))).toContain("usage");
    expect(text(runCommand(newGame(), "grep x /nope"))).toContain("No such file");
    expect(text(runCommand(newGame(), "grep x /home/ivega"))).toContain("Permission denied");
  });

  it("caps very long result lists", () => {
    expect(text(runCommand(newGame(), "grep e /"))).toContain("more matches");
  });
});

describe("find", () => {
  it("finds hidden and misplaced files by name", () => {
    const result = text(runCommand(newGame(), "find / -name *.txt"));
    expect(result).toContain("/tmp/.persona/journal.txt");
    expect(result).toContain("/restricted/containment_protocol.txt");
  });

  it("prints paths relative to the start point", () => {
    expect(text(runCommand(newGame(), "find . -name README.txt"))).toContain("./README.txt");
  });

  it("filters by type and case-insensitive name", () => {
    const dirs = text(runCommand(newGame(), "find /archive -type d"));
    expect(dirs).toContain("/archive/vega/letters");
    expect(dirs).not.toContain(".txt");
    expect(text(runCommand(newGame(), "find /restricted -iname *.LOG"))).toContain("identity_validation.log");
  });

  it("reports sealed folders, unknown options, empty and capped results", () => {
    expect(text(runCommand(newGame(), "find /home"))).toContain("Permission denied");
    expect(text(runCommand(newGame(), "find / -mtime 3"))).toContain("unknown option");
    expect(text(runCommand(newGame(), "find /archive -name nothing_here"))).toContain("nothing found");
    expect(text(runCommand(newGame(), "find /nope"))).toContain("No such file");
  });
});

describe("ps, top, dmesg", () => {
  it("shows only the shell without arguments", () => {
    const result = runCommand(newGame(), "ps");
    expect(text(result)).toContain("bash");
    expect(result.state.evidence.inspected_processes).toBe(false);
  });

  it("lists every process with ps aux / ps -ef", () => {
    for (const command of ["ps aux", "ps -ef", "ps -e"]) {
      const result = runCommand(newGame(), command);
      expect(text(result)).toContain("hollowd --mode=containment");
      expect(text(result)).toContain("persona-recon");
      expect(result.state.evidence.inspected_processes).toBe(true);
    }
  });

  it("inspects single processes in every common form", () => {
    for (const command of ["ps -fp 218", "ps -p 218 -f", "ps 218", "ps -fp218", "ps --pid 218"]) {
      const result = runCommand(newGame(), command);
      expect(result.state.evidence.inspected_hollow).toBe(true);
      expect(text(result)).toContain("containment supervisor");
    }
    const persona = runCommand(newGame(), "ps -fp 404");
    expect(persona.state.evidence.inspected_persona).toBe(true);
    expect(text(persona)).toContain("M_VEGA");
    expect(text(runCommand(newGame(), "ps -fp 1"))).toContain("systemd");
    expect(text(runCommand(newGame(), "ps -fp 118"))).toContain("archive-indexer");
    expect(text(runCommand(newGame(), "ps -fp 1123"))).toContain("bash");
    expect(text(runCommand(newGame(), "ps -fp 999"))).toContain("no process");
  });

  it("top shows the persona burning CPU", () => {
    const result = runCommand(newGame(), "top");
    expect(text(result)).toMatch(/404\s+ivega\s+9\d\.\d/);
    expect(result.state.evidence.inspected_processes).toBe(true);
  });

  it("dmesg points at the containment protocol", () => {
    expect(text(runCommand(newGame(), "dmesg"))).toContain("/restricted/containment_protocol.txt");
  });
});

describe("kill", () => {
  it("kill -TERM 218 is intercepted, costs time and is not fatal", () => {
    const game = startedGame();
    const result = runCommand(game, "kill -TERM 218");
    expect(result.state.phase).toBe("archive");
    expect(result.state.system.hollowRunning).toBe(true);
    expect(result.state.timer.remainingMs).toBe(game.timer.remainingMs - PENALTY_MS.hollowTerm);
    expect(result.events.map((event) => event.id)).toContain("kill_hollow_term");
  });

  it("every spelling of a forced kill of 218 ends the game", () => {
    for (const command of ["kill -9 218", "kill -KILL 218", "kill -SIGKILL 218", "kill -s KILL 218", "pkill -9 hollowd", "killall -9 hollow"]) {
      const result = runCommand(startedGame(), command);
      expect(result.state.outcome).toEqual({ ending: "lost", cause: "hollow_killed" });
    }
  });

  it("a default kill is a graceful TERM", () => {
    expect(runCommand(startedGame(), "kill 218").state.outcome.ending).toBeNull();
  });

  it("protects the persona from forced kills and premature stops", () => {
    const forced = runCommand(startedGame(), "kill -9 404");
    expect(forced.state.system.personaRunning).toBe(true);
    expect(text(forced)).toContain("BLOCKED");
    const early = runCommand(startedGame(), "kill -TERM 404");
    expect(early.state.system.personaRunning).toBe(true);
    expect(text(early)).toContain("not been secured");
    expect(early.events.map((event) => event.id)).toContain("kill_persona_early");
  });

  it("tells the player to back up first once recovery is unlocked", () => {
    const { state } = runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS]);
    expect(text(runCommand(state, "kill -TERM 404"))).toContain("cp -r /archive/vega /recovery/vega_archive");
  });

  it("treats init as destructive and other pids as harmless mistakes", () => {
    const init = runCommand(startedGame(), "kill -9 1");
    expect(init.events.map((event) => event.id)).toContain("destructive");
    expect(init.state.destructiveAttempts).toBe(1);
    expect(text(runCommand(startedGame(), "kill 118"))).toContain("Operation not permitted");
    expect(text(runCommand(startedGame(), "kill 1123"))).toContain("not tonight");
    expect(text(runCommand(startedGame(), "kill 31337"))).toContain("No such process");
  });

  it("validates arguments and signals", () => {
    expect(text(runCommand(newGame(), "kill"))).toContain("usage");
    expect(text(runCommand(newGame(), "kill -HUP 218"))).toContain("not supported");
    expect(text(runCommand(newGame(), "kill hollowd"))).toContain("must be process IDs");
    expect(text(runCommand(newGame(), "kill -l"))).toContain("SIGTERM");
    expect(text(runCommand(newGame(), "pkill"))).toContain("usage");
    expect(text(runCommand(newGame(), "pkill -HUP hollowd"))).toContain("not supported");
    expect(text(runCommand(newGame(), "pkill sshd"))).toContain("no process found");
  });

  it("stops processing further pids once the game has ended", () => {
    const result = runCommand(startedGame(), "kill -9 218 1");
    expect(result.state.destructiveAttempts).toBe(0);
  });
});
