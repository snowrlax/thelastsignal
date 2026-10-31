import { cp, mv, rm } from "@/game/commands/copy";
import { kill, killByName } from "@/game/commands/kill";
import {
  clear,
  date,
  editor,
  hintCommand,
  history,
  hostname,
  leave,
  network,
  readOnly,
  su,
  sudo,
  uname,
  uptime,
  whoami,
} from "@/game/commands/misc";
import { cd, ls, pwd } from "@/game/commands/nav";
import { editDistance } from "@/game/commands/parse";
import { dmesg, ps, top } from "@/game/commands/proc";
import { cat, head, play, tail } from "@/game/commands/read";
import { find, grep } from "@/game/commands/search";
import type { CommandHandler, CommandSpec } from "@/game/commands/types";
import { dim, err, out } from "@/game/text";
import type { OutputLine } from "@/game/types";

const HELP_TEXT = `OFRENDA SHELL · available commands
----------------------------------------------------------------
 move     pwd  ·  ls [-la] [path]  ·  cd <dir>  ·  find [path] -name <pattern>
 read     cat <file>  ·  grep <word> [path]  ·  play <file.wav>
 system   ps aux  ·  ps -fp <pid>  ·  top  ·  dmesg  ·  whoami  ·  history
 act      cp -r <source> <dest>  ·  kill -TERM <pid>  ·  kill -9 <pid>
 talk     reply <message>          answer the session on pts/404
 other    clear  ·  date  ·  hint  ·  help <command>
----------------------------------------------------------------
 examples   ls -la     cat README.txt     cd /research     grep vega
 keys       up/down recall commands · Tab completes · F1 opens the manual`;

const helpHandler: CommandHandler = ({ args }) => {
  const topic = args[0]?.toLowerCase();
  if (!topic) return { lines: HELP_TEXT.split("\n").map((text, index) => (index === 0 ? { kind: "head", text } : out(text))) };
  const spec = findCommand(topic);
  if (!spec) return { lines: [err(`help: no help for '${topic}'`)], error: true };
  return { lines: [out(`${spec.name}: ${spec.summary}`), dim(`usage: ${spec.usage}`)] };
};

const manHandler: CommandHandler = (input) => {
  const result = helpHandler(input);
  const note: OutputLine = dim("(no manual pages installed. showing help instead.)");
  return { ...result, lines: [note, ...(result.lines ?? [])] };
};

export const COMMANDS: readonly CommandSpec[] = [
  { name: "help", usage: "help [command]", summary: "list commands, or explain one", handler: helpHandler },
  { name: "pwd", usage: "pwd", summary: "print the current directory", handler: pwd },
  { name: "ls", aliases: ["dir"], usage: "ls [-la] [path]", summary: "list files (-a shows hidden files, -l shows details)", handler: ls },
  { name: "ll", usage: "ll [path]", summary: "same as ls -la", handler: (input) => ls({ ...input, args: ["-la", ...input.args] }), hidden: true },
  { name: "cd", usage: "cd <dir>", summary: "change directory (cd .. goes up, cd ~ goes home)", handler: cd },
  { name: "cat", aliases: ["less", "more", "view"], usage: "cat <file>", summary: "read a text file", handler: cat },
  { name: "head", usage: "head <file>", summary: "first lines of a file", handler: head, hidden: true },
  { name: "tail", usage: "tail <file>", summary: "last lines of a file", handler: tail, hidden: true },
  { name: "play", aliases: ["aplay", "listen"], usage: "play <file.wav>", summary: "play an audio recording (the window holds while it plays)", handler: play },
  { name: "grep", usage: "grep <word> [path]", summary: "search inside files (case-insensitive, folders are searched recursively)", handler: grep },
  { name: "find", usage: "find [path] -name <pattern>", summary: "locate files by name, e.g. find / -name \"*.log\"", handler: find },
  { name: "whoami", usage: "whoami", summary: "show the current operator", handler: whoami },
  { name: "history", usage: "history", summary: "show commands typed on this terminal", handler: history },
  { name: "ps", usage: "ps aux | ps -fp <pid>", summary: "list processes, or inspect one", handler: ps },
  { name: "top", usage: "top", summary: "cpu and memory snapshot", handler: top },
  { name: "dmesg", usage: "dmesg", summary: "kernel and service messages", handler: dmesg },
  { name: "cp", usage: "cp -r <source> <destination>", summary: "copy files or folders (-r for folders)", handler: cp },
  { name: "kill", usage: "kill [-TERM | -9] <pid>", summary: "signal a process: -TERM asks it to stop, -9 forces it", handler: kill },
  { name: "pkill", aliases: ["killall"], usage: "pkill [-TERM | -9] <name>", summary: "signal a process by name", handler: killByName, hidden: true },
  { name: "rm", aliases: ["rmdir", "shred"], usage: "rm <file>", summary: "remove files", handler: rm, hidden: true },
  { name: "mv", usage: "mv <source> <destination>", summary: "move files", handler: mv, hidden: true },
  { name: "clear", aliases: ["cls"], usage: "clear", summary: "clear the screen (nothing else is reset)", handler: clear },
  { name: "date", usage: "date", summary: "show the system date", handler: date },
  { name: "hint", usage: "hint", summary: "a nudge toward what to do next", handler: hintCommand },
  { name: "reply", aliases: ["msg", "say", "write", "talk"], usage: "reply <message>", summary: "answer the session on pts/404", handler: () => ({}) },
  { name: "echo", usage: "echo <text>", summary: "print text", handler: () => ({}), hidden: true },
  { name: "man", usage: "man <command>", summary: "manual (same as help)", handler: manHandler, hidden: true },
  { name: "uname", usage: "uname [-a]", summary: "system information", handler: uname, hidden: true },
  { name: "hostname", usage: "hostname", summary: "machine name", handler: hostname, hidden: true },
  { name: "uptime", usage: "uptime", summary: "time since power was restored", handler: uptime, hidden: true },
  { name: "sudo", usage: "sudo", summary: "no", handler: sudo, hidden: true },
  { name: "su", usage: "su", summary: "no", handler: su, hidden: true },
  { name: "exit", aliases: ["logout", "shutdown", "reboot", "poweroff", "halt"], usage: "exit", summary: "leave", handler: leave, hidden: true },
  { name: "ssh", aliases: ["ping", "curl", "wget", "nc", "telnet", "ftp", "scp"], usage: "ssh", summary: "network", handler: network, hidden: true },
  { name: "nano", aliases: ["vi", "vim", "emacs", "ed"], usage: "nano", summary: "editors", handler: editor, hidden: true },
  { name: "mkdir", aliases: ["touch", "chmod", "chown", "ln"], usage: "mkdir", summary: "write", handler: readOnly, hidden: true },
];

const INDEX = new Map<string, CommandSpec>();
for (const spec of COMMANDS) {
  INDEX.set(spec.name, spec);
  for (const alias of spec.aliases ?? []) INDEX.set(alias, spec);
}

export function findCommand(name: string): CommandSpec | undefined {
  return INDEX.get(name);
}

export const RAW_TEXT_COMMANDS = new Set(["reply", "msg", "say", "write", "talk", "echo"]);

export function visibleCommandNames(): string[] {
  return COMMANDS.filter((spec) => !spec.hidden).map((spec) => spec.name);
}

export function suggestCommand(name: string): string | null {
  let best: { name: string; distance: number } | null = null;
  for (const candidate of INDEX.keys()) {
    const distance = editDistance(name, candidate);
    if (distance <= 2 && (!best || distance < best.distance)) best = { name: candidate, distance };
  }
  return best?.name ?? null;
}

export function unknownCommand(name: string): OutputLine[] {
  const suggestion = suggestCommand(name);
  return [
    err(`bash: ${name}: command not found`),
    dim(suggestion ? `did you mean '${suggestion}'? (type help for every command)` : "(type help for a list of commands)"),
  ];
}
