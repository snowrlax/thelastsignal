import { PIDS } from "@/game/constants";
import { formatClock } from "@/game/clock";
import { block, dim, out, padLeft, padRight } from "@/game/text";
import type { GameState, OutputLine } from "@/game/types";

export interface ProcessRow {
  readonly pid: number;
  readonly user: string;
  readonly cpu: number;
  readonly mem: number;
  readonly tty: string;
  readonly stat: string;
  readonly start: string;
  readonly time: string;
  readonly command: string;
}

/** Deterministic pseudo-random jitter in [-amplitude, amplitude]. */
function jitter(seed: number, salt: number, amplitude: number): number {
  const raw = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  const fraction = raw - Math.floor(raw);
  return (fraction * 2 - 1) * amplitude;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function processRows(state: GameState): ProcessRow[] {
  const seed = state.tickCount + state.commandsRun;
  const personaMem = Math.min(38, 31 + state.clockMs / 120_000);
  const rows: ProcessRow[] = [
    { pid: PIDS.systemd, user: "root", cpu: 0.2, mem: 1.4, tty: "?", stat: "Ss", start: "23:34", time: "0:01", command: "/sbin/systemd" },
    { pid: PIDS.indexer, user: "root", cpu: round1(2.1 + jitter(seed, 118, 0.4)), mem: 4.2, tty: "?", stat: "S", start: "23:34", time: "0:09", command: "archive-indexer --root=/archive" },
  ];
  if (state.system.hollowRunning) {
    rows.push({ pid: PIDS.hollow, user: "root", cpu: round1(0.4 + jitter(seed, 218, 0.1)), mem: 2.0, tty: "?", stat: "Ss", start: "23:34", time: "0:02", command: "hollowd --mode=containment --guard=404" });
  }
  if (state.system.personaRunning) {
    rows.push({ pid: PIDS.persona, user: "ivega", cpu: round1(97.4 + jitter(seed, 404, 0.8)), mem: round1(personaMem), tty: "pts/404", stat: "R+", start: "23:34", time: "14:52", command: "persona-recon --subject=vega_ines" });
  }
  rows.push({ pid: PIDS.shell, user: "operator", cpu: 0.0, mem: 0.3, tty: "tty1", stat: "Ss", start: "23:51", time: "0:00", command: "-bash" });
  return rows;
}

export function formatPsAux(state: GameState): OutputLine[] {
  const header = "USER        PID %CPU %MEM TTY      STAT START   TIME COMMAND";
  const rows = processRows(state).map((row) =>
    [
      padRight(row.user, 9),
      padLeft(String(row.pid), 6),
      padLeft(row.cpu.toFixed(1), 5),
      padLeft(row.mem.toFixed(1), 4),
      padRight(row.tty, 8),
      padRight(row.stat, 4),
      padRight(row.start, 5),
      padLeft(row.time, 6),
      row.command,
    ].join(" "),
  );
  return [out(header), ...rows.map(out)];
}

function bar(percent: number, width = 24): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width);
  return "[" + "|".repeat(filled) + " ".repeat(width - filled) + "]";
}

export function formatTop(state: GameState): OutputLine[] {
  const rows = processRows(state);
  const cpu = Math.min(99.9, rows.reduce((sum, row) => sum + row.cpu, 0));
  const mem = Math.min(99.9, 52 + rows.reduce((sum, row) => sum + row.mem, 0));
  const lines: OutputLine[] = [
    out(`OFRENDA-01                                 ${formatClock(state.clockMs)}`),
    out(`CPU     ${bar(cpu)} ${cpu.toFixed(1)}% used`),
    out(`MEMORY  ${bar(mem)} ${mem.toFixed(1)}% used`),
    out(`users: 2 (operator on tty1, ivega on pts/404)`),
    out(""),
    out("PID   USER      CPU%   MEM%   COMMAND"),
  ];
  for (const row of rows) {
    lines.push(
      out(
        `${padRight(String(row.pid), 5)} ${padRight(row.user, 8)} ${padLeft(row.cpu.toFixed(1), 5)}  ${padLeft(row.mem.toFixed(1), 5)}   ${row.command}`,
      ),
    );
  }
  lines.push(dim("(snapshot. inspect one process with ps -fp <pid>)"));
  return lines;
}

const DETAILS: Record<number, string> = {
  [PIDS.systemd]: `  name ........ systemd
  role ........ base system process. parent of everything.
  note ........ must remain running.`,
  [PIDS.indexer]: `  name ........ archive-indexer
  role ........ catalogues original recordings, letters, photos
  also ........ verifies recovery copies (sha1)
  note ........ safe background process.`,
  [PIDS.hollow]: `  name ........ hollowd  ("HOLLOW")
  role ........ containment supervisor
  guards ...... pid 404 (persona-recon)
  enforces .... /archive read-only for 404 · no network · tty
                messages only · /recovery write lock
  signals ..... denies signals sent by pid 404 (214 attempts)
  docs ........ /restricted/containment_protocol.txt
  warning ..... if this process is force-killed, the boundary
                around pid 404 is removed.`,
  [PIDS.persona]: `  name ........ persona-recon
  role ........ OFRENDA reconstruction model
  speaking as . M_VEGA  (session pts/404)
  subject ..... VEGA, INES
  resumed ..... checkpoint ck_20121102_235958 (age 5113 days)
  contained by  pid 218 (hollowd)
  login ....... ivega (stored credential replay)`,
  [PIDS.shell]: `  name ........ bash
  role ........ your shell, operator. tty1.`,
};

const CMDLINES: Record<number, string> = {
  [PIDS.systemd]: "/sbin/systemd",
  [PIDS.indexer]: "/opt/ofrenda/bin/archive-indexer --root=/archive",
  [PIDS.hollow]: "/usr/sbin/hollowd --mode=containment --guard=404",
  [PIDS.persona]: "/opt/ofrenda/bin/persona-recon --subject=vega_ines --resume=ck_20121102_235958",
  [PIDS.shell]: "-bash",
};

export function processDetail(state: GameState, pid: number): OutputLine[] | null {
  const row = processRows(state).find((candidate) => candidate.pid === pid);
  if (!row) return null;
  const ppid = pid === PIDS.systemd ? 0 : 1;
  const header = "UID        PID  PPID   C STIME TTY        TIME CMD";
  const summary = [
    padRight(row.user, 9),
    padLeft(String(row.pid), 4),
    padLeft(String(ppid), 5),
    padLeft(String(Math.round(row.cpu)), 3),
    padRight(row.start, 5),
    padRight(row.tty, 8),
    padLeft(row.time, 7),
    CMDLINES[pid] ?? row.command,
  ].join(" ");
  return [out(header), out(summary), out(""), ...block("dim", DETAILS[pid] ?? "")];
}

export function processName(pid: number): string | null {
  switch (pid) {
    case PIDS.systemd:
      return "systemd";
    case PIDS.indexer:
      return "archive-indexer";
    case PIDS.hollow:
      return "hollowd";
    case PIDS.persona:
      return "persona-recon";
    case PIDS.shell:
      return "bash";
    default:
      return null;
  }
}

export function pidForName(name: string): number | null {
  const normalized = name.toLowerCase();
  if (normalized === "systemd" || normalized === "init") return PIDS.systemd;
  if (normalized.startsWith("archive-indexer") || normalized === "indexer") return PIDS.indexer;
  if (normalized === "hollowd" || normalized === "hollow") return PIDS.hollow;
  if (normalized === "persona-recon" || normalized === "persona" || normalized === "m_vega") return PIDS.persona;
  if (normalized === "bash") return PIDS.shell;
  return null;
}
