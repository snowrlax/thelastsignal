import { destructiveOutcome } from "@/game/commands/destructive";
import type { CommandHandler, CommandOutcome } from "@/game/commands/types";
import { PENALTY_MS, PIDS } from "@/game/constants";
import { loseGame, winGame } from "@/game/outcome";
import { pidForName } from "@/game/processes";
import { applyPenalty } from "@/game/timer";
import { dim, err, line, out, sys, warn } from "@/game/text";
import type { Effect, GameState, OutputLine, StoryEvent } from "@/game/types";

type Signal = "TERM" | "KILL";

function parseSignal(token: string): Signal | "unsupported" {
  const name = token.replace(/^-/, "").toUpperCase().replace(/^SIG/, "");
  if (name === "9" || name === "KILL") return "KILL";
  if (name === "15" || name === "TERM") return "TERM";
  return "unsupported";
}

const SIGNAL_LIST = " 1) SIGHUP   2) SIGINT   9) SIGKILL  15) SIGTERM  19) SIGSTOP";

function killHollow(state: GameState, signal: Signal): CommandOutcome {
  if (signal === "TERM") {
    return {
      state: applyPenalty(state, PENALTY_MS.hollowTerm),
      lines: [
        warn("hollowd[218]: SIGTERM from operator: REFUSED"),
        warn("hollowd[218]: containment cannot stop while pid 404 is running."),
        dim(`(-${PENALTY_MS.hollowTerm / 1000}s containment window)`),
      ],
      events: [{ id: "kill_hollow_term" }],
      effects: [{ type: "sound", name: "deny" }, { type: "glitch", intensity: "low" }],
    };
  }
  const lost = loseGame(state, "hollow_killed");
  return {
    state: lost.state,
    lines: [
      line("err", "kill: sending SIGKILL to 218 (hollowd)"),
      line("glitch", "hollowd[218]: contain— ", 500),
      line("err", "[ 218 ] hollowd  KILLED", 300),
    ],
    events: [{ id: "hollow_killed" }],
    effects: [{ type: "glitch", intensity: "high" }, ...lost.effects],
  };
}

function killPersona(state: GameState, signal: Signal): CommandOutcome {
  if (signal === "KILL") {
    return {
      lines: [
        warn("hollowd[218]: SIGKILL to 404 BLOCKED"),
        warn("hollowd[218]: persona-recon holds open handles on /archive/vega."),
        dim("a forced kill would corrupt the originals. stop it gracefully (SIGTERM),"),
        dim("and only after the archive is secured."),
      ],
      events: [{ id: "kill_persona_forced" }],
      effects: [{ type: "sound", name: "deny" }],
    };
  }
  if (!state.system.archiveCopied) {
    const advice: OutputLine[] = state.system.recoveryUnlocked
      ? [dim("back it up first:  cp -r /archive/vega /recovery/vega_archive")]
      : [dim("persona-recon is under containment review by pid 218."), dim("see /restricted/containment_protocol.txt")];
    return {
      lines: [
        warn("kill: (404) - refused: the original archive has not been secured."),
        dim("persona-recon still holds a write handle on /archive/vega."),
        ...advice,
      ],
      events: [{ id: "kill_persona_early" }],
      effects: [{ type: "sound", name: "deny" }],
    };
  }
  const won = winGame(state);
  return {
    state: won.state,
    lines: [
      sys("persona-recon[404]: SIGTERM received"),
      line("dim", "persona-recon[404]: closing session pts/404 ...", 700),
      line("dim", "persona-recon[404]: releasing handles on /archive/vega ... ok", 900),
      line("dim", "persona-recon[404]: checkpoint not saved.", 900),
      line("sys", "persona-recon[404]: exited (0)", 1_100),
    ],
    events: [{ id: "persona_stopped" }],
    effects: won.effects,
  };
}

export function applyKill(state: GameState, pid: number, signal: Signal): CommandOutcome {
  switch (pid) {
    case PIDS.systemd:
      return destructiveOutcome(state, [err("kill: (1) - refusing to signal init. the whole machine would go dark.")]);
    case PIDS.indexer:
      return { lines: [err("kill: (118) - Operation not permitted: archive-indexer verifies recovery copies.")], error: true };
    case PIDS.shell:
      return { lines: [dim("kill: you can't hang up on yourself. not tonight.")] };
    case PIDS.hollow:
      return state.system.hollowRunning ? killHollow(state, signal) : { lines: [err("kill: (218) - No such process")], error: true };
    case PIDS.persona:
      return state.system.personaRunning ? killPersona(state, signal) : { lines: [err("kill: (404) - No such process")], error: true };
    default:
      return { lines: [err(`kill: (${pid}) - No such process`)], error: true };
  }
}

function runKills(state: GameState, pids: readonly number[], signal: Signal): CommandOutcome {
  let current = state;
  const lines: OutputLine[] = [];
  const events: StoryEvent[] = [];
  const effects: Effect[] = [];
  let error = false;
  for (const pid of pids) {
    const outcome = applyKill(current, pid, signal);
    current = outcome.state ?? current;
    lines.push(...(outcome.lines ?? []));
    events.push(...(outcome.events ?? []));
    effects.push(...(outcome.effects ?? []));
    error = error || Boolean(outcome.error);
    if (current.phase === "ended") break;
  }
  return { state: current, lines, events, effects, error };
}

export const kill: CommandHandler = ({ state, args }) => {
  let signal: Signal | "unsupported" = "TERM";
  const pids: number[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-l" || arg === "-L") return { lines: [out(SIGNAL_LIST), dim("this terminal only delivers TERM (15) and KILL (9).")] };
    if (arg === "-s" || arg === "-n") {
      signal = parseSignal(args[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      signal = parseSignal(arg);
      continue;
    }
    if (!/^\d+$/.test(arg)) {
      return { lines: [err(`kill: ${arg}: arguments must be process IDs (see ps aux)`)], error: true };
    }
    pids.push(Number(arg));
  }
  if (signal === "unsupported") {
    return { lines: [err("kill: signal not supported here. use -TERM (graceful) or -9 (force).")], error: true };
  }
  if (pids.length === 0) {
    return { lines: [err("usage: kill [-TERM | -9] <pid>     e.g. kill -TERM 1234")], error: true };
  }
  return runKills(state, pids, signal);
};

/** pkill / killall: the same rules, addressed by process name. */
export const killByName: CommandHandler = ({ state, args }) => {
  let signal: Signal | "unsupported" = "TERM";
  const names: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("-")) signal = parseSignal(arg);
    else names.push(arg);
  }
  if (signal === "unsupported") {
    return { lines: [err("pkill: signal not supported here. use -TERM or -9.")], error: true };
  }
  if (names.length === 0) return { lines: [err("usage: pkill [-TERM | -9] <name>")], error: true };
  const pids: number[] = [];
  for (const name of names) {
    const pid = pidForName(name);
    if (pid === null) return { lines: [err(`pkill: no process found matching '${name}'`)], error: true };
    pids.push(pid);
  }
  return runKills(state, pids, signal);
};
