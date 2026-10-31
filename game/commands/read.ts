import { fileContext, treeFor } from "@/game/commands/context";
import { splitFlags } from "@/game/commands/parse";
import type { CommandHandler } from "@/game/commands/types";
import { READING_HOLD } from "@/game/constants";
import { recordingLines } from "@/game/content/recordings";
import { grantFlags } from "@/game/evidence";
import { readContent, type FileNode } from "@/game/fs/nodes";
import { lookup } from "@/game/fs/tree";
import { block, dim, err } from "@/game/text";
import type { Effect, EvidenceFlag, GameState, OutputLine, StoryEvent } from "@/game/types";

export function readingHold(lineCount: number): number {
  if (lineCount < READING_HOLD.minLines) return 0;
  return Math.min(READING_HOLD.maxMs, lineCount * READING_HOLD.msPerLine);
}

function withReadingHold(state: GameState, lineCount: number): GameState {
  const hold = readingHold(lineCount);
  if (hold === 0 || !state.timer.running) return state;
  return { ...state, timer: { ...state.timer, readingHoldMs: hold } };
}

type ReadMode = "all" | "head" | "tail";

function selectLines(text: string, mode: ReadMode, count: number): string {
  if (mode === "all") return text;
  const all = text.split("\n");
  return (mode === "head" ? all.slice(0, count) : all.slice(-count)).join("\n");
}

function readFiles(mode: ReadMode, commandName: string): CommandHandler {
  return ({ state, args }) => {
    const { positional } = splitFlags(args);
    const count = 10;
    if (positional.length === 0) {
      return { lines: [err(`usage: ${commandName} <file>     e.g. ${commandName} README.txt`)], error: true };
    }
    let next = state;
    const lines: OutputLine[] = [];
    const flagsToGrant: EvidenceFlag[] = [];
    const events: StoryEvent[] = [];
    let failed = false;

    for (const target of positional) {
      const result = lookup(treeFor(next), next.cwd, target);
      if (!result.ok) {
        failed = true;
        lines.push(err(`${commandName}: ${target}: No such file or directory`));
        continue;
      }
      const { node } = result;
      if (node.kind === "dir") {
        failed = true;
        lines.push(err(node.sealed ? `${commandName}: ${target}: Permission denied` : `${commandName}: ${target}: Is a directory`));
        continue;
      }
      if (node.kind !== "file") continue;
      if (node.binary === "audio") {
        failed = true;
        lines.push(err(`${commandName}: ${target}: binary audio data. listen with: play ${target}`));
        continue;
      }
      lines.push(...block("out", selectLines(readContent(node, fileContext(next)), mode, count)));
      if (node.flag) flagsToGrant.push(node.flag);
      if (node.event) events.push({ id: node.event });
    }

    const granted = grantFlags(next, flagsToGrant);
    next = withReadingHold(granted.state, lines.length);
    return { state: next, lines, events: [...granted.events, ...events], error: failed };
  };
}

export const cat = readFiles("all", "cat");
export const head = readFiles("head", "head");
export const tail = readFiles("tail", "tail");

export const play: CommandHandler = ({ state, args }) => {
  const target = args.find((arg) => !arg.startsWith("-"));
  if (!target) return { lines: [err("usage: play <file.wav>     e.g. play voice_001.wav")], error: true };
  const result = lookup(treeFor(state), state.cwd, target);
  if (!result.ok) return { lines: [err(`play: ${target}: No such file or directory`)], error: true };
  const node = result.node;
  if (node.kind !== "file" || node.binary !== "audio" || !node.recording) {
    return { lines: [err(`play: ${target}: not an audio recording`)], error: true };
  }
  const audio: FileNode = node;
  const granted = grantFlags(state, audio.flag ? [audio.flag] : []);
  const recording = audio.recording!;
  const effects: Effect[] = [{ type: "recording", id: recording }];
  const events: StoryEvent[] = [...granted.events, ...(audio.event ? [{ id: audio.event }] : [])];
  return {
    state: granted.state,
    lines: [dim("(the containment window holds while a recording plays)"), ...recordingLines(recording)],
    effects,
    events,
  };
};
