import type { CommandHandler } from "@/game/commands/types";
import { formatClock, formatDate } from "@/game/clock";
import { MAX_REPLY_LENGTH } from "@/game/constants";
import { PRESEEDED_HISTORY } from "@/game/content/home";
import { contextualHint } from "@/game/hints";
import { dim, err, hint, line, out } from "@/game/text";
import type { OutputLine } from "@/game/types";

export const whoami: CommandHandler = ({ state }) => {
  if (state.phase === "recovery" && state.system.personaRunning) {
    return {
      lines: [line("glitch", "ivega"), line("out", "operator", 900), dim("(pts/404 is echoing on this terminal)")],
      events: [{ id: "whoami_anomaly" }],
    };
  }
  if (state.evidence.inspected_persona) {
    return { lines: [out("operator"), dim("(another session is reading this tty: ivega on pts/404)")] };
  }
  return { lines: [out("operator"), dim(`(callsign: ${state.playerName})`)] };
};

export const history: CommandHandler = ({ state }) => {
  const lines: OutputLine[] = [];
  let lastSession = "";
  PRESEEDED_HISTORY.forEach((entry, index) => {
    if (entry.session !== lastSession) {
      lines.push(dim(`  # ${entry.session}`));
      lastSession = entry.session;
    }
    lines.push(out(`  ${String(index + 1).padStart(4, " ")}  ${entry.command}`));
  });
  lines.push(dim(`  # tty1 · operator (${state.playerName}) · 2026-11-02 23:51`));
  state.history.forEach((command, index) => {
    lines.push(out(`  ${String(PRESEEDED_HISTORY.length + index + 1).padStart(4, " ")}  ${command}`));
  });
  return { lines };
};

export const clear: CommandHandler = () => ({ effects: [{ type: "clear" }] });

export const date: CommandHandler = ({ state }) => ({ lines: [out(formatDate(state.clockMs))] });

export const uname: CommandHandler = ({ args }) => ({
  lines: [out(args.includes("-a") ? "Linux ofrenda-01 2.6.32-ofrenda #1 SMP Mon Jun 11 2012 i686 GNU/Linux" : "Linux")],
});

export const hostname: CommandHandler = () => ({ lines: [out("ofrenda-01")] });

export const uptime: CommandHandler = ({ state }) => {
  const minutes = 16 + Math.floor(state.clockMs / 60_000);
  return { lines: [out(` ${formatClock(state.clockMs)} up 0:${String(minutes).padStart(2, "0")},  2 users,  load average: 0.98, 0.97, 0.99`)] };
};

export const hintCommand: CommandHandler = ({ state }) => ({
  state: { ...state, hintsShown: state.hintsShown + 1 },
  lines: [hint(`hint: ${contextualHint(state)}`)],
});

export const sudo: CommandHandler = () => ({
  lines: [err("operator is not in the sudoers file. This incident will be reported."), dim("(there is no one left to report it to.)")],
});

export const su: CommandHandler = () => ({ lines: [err("su: account sealed 2012-11-04. authentication failure.")], error: true });

export const leave: CommandHandler = () => ({
  lines: [err("refused: persona-recon (pid 404) is still running."), dim("a safe shutdown is described in /restricted/containment_protocol.txt")],
});

export const network: CommandHandler = ({ name }) => ({
  lines: [err(`${name}: network unreachable. outbound links are severed by the containment boundary (hollowd).`)],
});

export const editor: CommandHandler = ({ name }) => ({
  lines: [err(`${name}: no editors are installed on this terminal. the archive is read-only.`)],
});

export const readOnly: CommandHandler = ({ name }) => ({
  lines: [err(`${name}: Read-only file system`)],
  error: true,
});

const HOLLOW_ADDRESSES = new Set(["hollow", "hollowd", "218"]);
/** Only these verbs take a recipient; reply and say always answer M_VEGA. */
const ADDRESSED_VERBS = new Set(["msg", "write", "talk"]);

/** reply/echo receive the raw remainder of the line so apostrophes and punctuation survive. */
export function replyHandler(rawText: string, verb = "reply"): CommandHandler {
  return ({ state }) => {
    const text = rawText.trim();
    if (!text) return { lines: [err(`usage: ${verb} <message>     e.g. ${verb} who are you?`)], error: true };
    const [first, ...rest] = text.split(/\s+/);
    if (ADDRESSED_VERBS.has(verb) && HOLLOW_ADDRESSES.has(first.toLowerCase())) {
      return {
        lines: [line("dim", `you → HOLLOW (pid 218): ${rest.join(" ") || "..."}`)],
        events: [{ id: "msg_hollow" }],
      };
    }
    if (!state.system.personaRunning) return { lines: [err("reply: no session on pts/404")], error: true };
    const message = text.slice(0, MAX_REPLY_LENGTH);
    const truncated = text.length > MAX_REPLY_LENGTH ? [dim(`(message cut to ${MAX_REPLY_LENGTH} characters)`)] : [];
    return {
      lines: [line("dim", `you → M_VEGA (pts/404): ${message}`), ...truncated],
      events: [{ id: "player_reply", text: message }],
    };
  };
}

export function echoHandler(rawText: string): CommandHandler {
  return ({ state }) => ({
    lines: [out(rawText.replace(/\$USER|\$\{USER\}/g, "operator").replace(/\$HOME/g, "/home/operator").replace(/\$PWD/g, state.cwd))],
  });
}
