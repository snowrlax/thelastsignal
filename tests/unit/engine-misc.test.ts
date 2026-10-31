import { describe, expect, it } from "vitest";
import { formatClock, formatDate, formatShortClock, isAfterMidnight } from "@/game/clock";
import { complete } from "@/game/completion";
import { createInitialState, promptFor, sanitizeCallsign } from "@/game/engine";
import { finalizeEvents } from "@/game/events";
import { evidenceCount } from "@/game/evidence";
import { contextualHint } from "@/game/hints";
import { pidForName, processName, processRows } from "@/game/processes";
import { columns, formatDuration, padLeft } from "@/game/text";
import { getTree, walk } from "@/game/fs/tree";
import { EVIDENCE_FLAGS } from "@/game/types";
import { newGame, PHASE1_COMMANDS, PHASE2_COMMANDS, runAll, startedGame } from "@/tests/helpers/game";

describe("callsigns", () => {
  it.each([
    ["  Raven  ", "Raven"],
    ["Inés   Vega", "Inés Vega"],
    ["<script>alert(1)</script>", "scriptalert1script"],
    ["a".repeat(30), "a".repeat(18)],
    ["   ", null],
    ["<>{}", null],
  ])("sanitizes %j", (input, expected) => {
    expect(sanitizeCallsign(input)).toBe(expected);
  });

  it("falls back to OPERATOR and starts in the prologue", () => {
    const state = createInitialState({ playerName: "   ", reducedPressure: false });
    expect(state.playerName).toBe("OPERATOR");
    expect(state.phase).toBe("prologue");
    expect(EVIDENCE_FLAGS.every((flag) => state.evidence[flag] === false)).toBe(true);
    expect(promptFor(state)).toBe("operator@ofrenda-01:~$ ");
  });
});

describe("story events", () => {
  it("fires once-only events once and lets repeatable ones through", () => {
    const first = finalizeEvents(newGame(), [{ id: "first_ls" }, { id: "player_reply", text: "hi" }]);
    expect(first.events).toHaveLength(2);
    const second = finalizeEvents(first.state, [{ id: "first_ls" }, { id: "player_reply", text: "again" }]);
    expect(second.events).toEqual([{ id: "player_reply", text: "again" }]);
    expect(finalizeEvents(second.state, []).state).toBe(second.state);
  });
});

describe("tab completion", () => {
  const game = newGame();
  it("completes unique commands and lists ambiguous ones", () => {
    expect(complete(game, "hel")).toEqual({ value: "help ", options: [] });
    expect(complete(game, "c").options).toEqual(expect.arrayContaining(["cd", "cat", "cp", "clear"]));
    expect(complete(game, "zz")).toEqual({ value: "zz", options: [] });
  });

  it("completes paths, folders and hidden files", () => {
    expect(complete(game, "cat REA").value).toBe("cat README.txt ");
    expect(complete(game, "cd /res").value).toMatch(/^cd \/res(earch\/|tricted\/)?$|^cd \/re/);
    expect(complete(game, "cd /rese").value).toBe("cd /research/");
    expect(complete(game, "cat .la").value).toBe("cat .last_session ");
    expect(complete(game, "ls /restricted/").options).toHaveLength(3);
    expect(complete(game, "ls /nope/x").value).toBe("ls /nope/x");
    expect(complete(game, "ls -l").value).toBe("ls -l");
    expect(complete(game, "cat qq").options).toEqual([]);
  });
});

describe("clock and text helpers", () => {
  it("runs from 23:51:30 on 2 November into the 3rd", () => {
    expect(formatClock(0)).toBe("23:51:30");
    expect(formatShortClock(0)).toBe("23:51");
    expect(formatDate(0)).toBe("Mon Nov  2 23:51:30 CST 2026");
    expect(isAfterMidnight(510_000)).toBe(true);
    expect(formatClock(510_000)).toBe("00:00:00");
    expect(formatDate(510_000)).toContain("Tue Nov  3");
  });

  it("formats durations and columns", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(61_001)).toBe("01:02");
    expect(formatDuration(-5)).toBe("00:00");
    expect(columns([])).toEqual([]);
    expect(columns(["a", "b", "c"], 6)).toEqual(["a  b", "c"]);
    expect(padLeft("abc", 2)).toBe("abc");
  });
});

describe("processes and hints", () => {
  it("names processes both ways", () => {
    for (const pid of [1, 118, 218, 404, 1123]) expect(pidForName(processName(pid)!)).toBe(pid);
    expect(processName(9)).toBeNull();
    expect(pidForName("m_vega")).toBe(404);
    expect(pidForName("init")).toBe(1);
    expect(pidForName("nope")).toBeNull();
  });

  it("removes stopped processes from the table", () => {
    const game = newGame();
    const stopped = { ...game, system: { ...game.system, hollowRunning: false, personaRunning: false } };
    expect(processRows(stopped).map((row) => row.pid)).toEqual([1, 118, 1123]);
  });

  it("hints always point at the next missing step", () => {
    const hints = [
      contextualHint(newGame()),
      contextualHint(startedGame()),
      contextualHint(runAll(startedGame(), ["cat README.txt"]).state),
      contextualHint(runAll(startedGame(), PHASE1_COMMANDS.slice(0, 2)).state),
      contextualHint(runAll(startedGame(), PHASE1_COMMANDS).state),
      contextualHint(runAll(startedGame(), [...PHASE1_COMMANDS, "ps aux"]).state),
      contextualHint(runAll(startedGame(), [...PHASE1_COMMANDS, "ps -fp 218"]).state),
      contextualHint(runAll(startedGame(), [...PHASE1_COMMANDS, "ps -fp 218", "cat /restricted/containment_protocol.txt"]).state),
      contextualHint(runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS]).state),
      contextualHint(runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS, "cp -r /archive/vega /recovery/vega_archive"]).state),
    ];
    expect(new Set(hints).size).toBe(hints.length);
    expect(hints[9]).toContain("kill -TERM 404");
    expect(contextualHint(runAll(startedGame(), ["kill -9 218"]).state)).toBe("");
  });
});

describe("content integrity", () => {
  it("every evidence flag can be earned from at least one file or process", () => {
    const files = walk(getTree(null), "/").filter((entry) => entry.node.kind === "file");
    const fileFlags = new Set(files.map((entry) => (entry.node.kind === "file" ? entry.node.flag : undefined)).filter(Boolean));
    const processFlags = ["inspected_processes", "inspected_persona", "inspected_hollow"];
    for (const flag of EVIDENCE_FLAGS) expect(fileFlags.has(flag) || processFlags.includes(flag), flag).toBe(true);
  });

  it("matches the PRD's directory layout", () => {
    const paths = walk(getTree(null), "/").map((entry) => entry.path);
    for (const expected of [
      "/home/operator/README.txt",
      "/home/operator/.last_session",
      "/archive/vega/voice_001.wav",
      "/archive/vega/letters",
      "/archive/vega/photographs",
      "/archive/vega/session_014.log",
      "/research/project_overview.txt",
      "/research/reconstruction_notes.txt",
      "/research/model_test.log",
      "/logs/syslog",
      "/logs/auth.log",
      "/logs/shutdown.log",
      "/restricted/containment_protocol.txt",
      "/restricted/identity_validation.log",
      "/restricted/final_recording.wav",
      "/recovery",
    ]) {
      expect(paths, expected).toContain(expected);
    }
  });

  it("counts gathered evidence", () => {
    expect(evidenceCount(newGame())).toBe(0);
    expect(evidenceCount(runAll(startedGame(), [...PHASE1_COMMANDS, ...PHASE2_COMMANDS]).state)).toBe(7);
  });
});
