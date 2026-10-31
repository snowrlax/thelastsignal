import type { CommandHandler } from "@/game/commands/types";
import { PIDS } from "@/game/constants";
import { grantFlags } from "@/game/evidence";
import { formatPsAux, formatTop, processDetail } from "@/game/processes";
import { dim, err, out } from "@/game/text";
import type { EvidenceFlag, GameState } from "@/game/types";

/** Accepts "ps -fp 218", "ps -p 218 -f", "ps 218", "ps --pid 218" and "ps -fp218". */
function pidArgument(args: readonly string[]): number | null {
  for (const arg of args) {
    if (/^\d+$/.test(arg)) return Number(arg);
    const attached = arg.match(/^-[a-zA-Z]*p(\d+)$/);
    if (attached) return Number(attached[1]);
  }
  return null;
}

export const ps: CommandHandler = ({ state, args }) => {
  const pid = pidArgument(args);
  if (pid !== null) {
    const detail = processDetail(state, pid);
    if (!detail) return { lines: [err(`ps: no process with pid ${pid}`)], error: true };
    const flags: EvidenceFlag[] = ["inspected_processes"];
    if (pid === PIDS.hollow) flags.push("inspected_hollow");
    if (pid === PIDS.persona) flags.push("inspected_persona");
    const granted = grantFlags(state, flags);
    return { state: granted.state, lines: detail, events: granted.events };
  }

  if (args.length === 0) {
    return {
      lines: [
        out("  PID TTY          TIME CMD"),
        out(" 1123 tty1     00:00:00 bash"),
        out(` ${1124 + state.commandsRun} tty1     00:00:00 ps`),
        dim("(only your shell. list every process with: ps aux)"),
      ],
    };
  }

  const granted = grantFlags(state, ["inspected_processes"]);
  return { state: granted.state, lines: formatPsAux(granted.state), events: granted.events };
};

export const top: CommandHandler = ({ state }) => {
  const granted = grantFlags(state, ["inspected_processes"]);
  return { state: granted.state, lines: formatTop(granted.state), events: granted.events };
};

function denialCount(state: GameState): number {
  return 214 + Math.floor(state.clockMs / 9_000);
}

export const dmesg: CommandHandler = ({ state }) => {
  const lines = [
    "[    0.000000] OFRENDA-01 kernel 2.6.32-ofrenda (built 2012-06-11)",
    "[    0.412001] mem: 4096MB  memory module OK",
    "[    1.100231] archive: /archive mounted read-only",
    "[    1.300512] signal: carrier unstable on channel 2",
    "[    2.004118] hollowd[218]: containment supervisor online",
    "[    2.004120] hollowd[218]:   protocol: /restricted/containment_protocol.txt",
    "[    2.004121] hollowd[218]:   boundary: pid 404 -> /archive ro, /recovery locked, tty msg-only",
    "[    2.511877] persona-recon[404]: resumed from checkpoint (age 5113 days)",
    "[    2.512003] persona-recon[404]: identity claim: VEGA, INES",
    "[    3.880412] hollowd[218]: WARN unauthorized persona session on pts/404",
    `[ ${String(1000 + Math.floor(state.clockMs / 1000)).padStart(6, " ")}.204117] hollowd[218]: DENY signal 9 -> 218 from pid 404 (x${denialCount(state)})`,
  ];
  if (state.system.recoveryUnlocked) {
    lines.push(`[ ${String(1001 + Math.floor(state.clockMs / 1000)).padStart(6, " ")}.000001] hollowd[218]: /recovery lock revoked from pid 404 (operator cleared)`);
  }
  return { lines: lines.map(out) };
};

