"use client";

import { create } from "zustand";
import { formatClock } from "@/game/clock";
import { createInitialState, noteInput, runCommand, setPause, tick } from "@/game/engine";
import { INITIAL_DIALOGUE, mergeQueue, planMessages, type DialogueState, type PlannedMessage } from "@/game/story/director";
import type { Speaker } from "@/game/story/triggers";
import type { Ending, GameState, LineKind, LossCause, OutputLine, StepResult, StoryEvent } from "@/game/types";
import { sound, type Cue } from "@/libs/audio";
import type { ConversationEntry } from "@/libs/dialogueClient";
import { tapeDeck } from "@/libs/voiceTape";

export type Screen = "landing" | "identify" | "cinematic" | "boot" | "terminal" | "ending";

export interface LineItem {
  readonly type: "line";
  readonly id: number;
  readonly kind: LineKind;
  readonly text: string;
}

export interface MessageItem {
  readonly type: "message";
  readonly id: number;
  readonly key: string;
  readonly speaker: Speaker;
  readonly text: string | null;
  readonly source: "ai" | "script" | null;
  readonly clock: string;
}

export type TerminalItem = LineItem | MessageItem;

export type QueueEntry =
  | { readonly type: "line"; readonly line: OutputLine }
  | { readonly type: "action"; readonly action: "clear" | "release_recording" };

export interface EndingInfo {
  readonly ending: Ending;
  readonly cause: LossCause | null;
}

export type EndingStage = "none" | "sequence" | "poweroff" | "epitaph" | "done";

const MAX_ITEMS = 400;

interface GameStore {
  screen: Screen;
  playerName: string;
  reducedPressure: boolean;
  muted: boolean;
  game: GameState | null;
  items: TerminalItem[];
  transcript: string[];
  queue: QueueEntry[];
  messageQueue: PlannedMessage[];
  dialogue: DialogueState;
  conversation: ConversationEntry[];
  aiLines: number;
  unread: boolean;
  ending: EndingInfo | null;
  endingStage: EndingStage;
  glitch: { level: "none" | "low" | "high"; nonce: number };
  helpOpen: boolean;
  runStartedAt: number;
  runDurationMs: number;
  nextId: number;
  runSeed: number;

  setScreen(screen: Screen): void;
  setPlayerName(name: string): void;
  setReducedPressure(value: boolean): void;
  setMuted(value: boolean): void;
  startRun(): void;
  submit(raw: string): void;
  advance(dtMs: number): void;
  keystroke(): void;
  takeQueued(): QueueEntry | undefined;
  printLine(line: OutputLine): void;
  clearScreen(): void;
  releaseRecording(): void;
  takeMessage(): PlannedMessage | undefined;
  openMessage(message: PlannedMessage): number;
  resolveMessage(id: number, text: string, source: "ai" | "script"): void;
  dropMessage(id: number): void;
  markRead(): void;
  setHelp(open: boolean): void;
  setEndingStage(stage: EndingStage): void;
  enqueueLines(lines: readonly OutputLine[]): void;
}

const EVENT_CUES: Partial<Record<StoryEvent["id"], Cue>> = {
  phase2_start: "relay",
  phase3_start: "relay",
  warn_25: "warn",
  warn_10: "warn",
  grace_start: "warn",
};

/** Long output sounds like the drive seeking. */
const FILE_ACCESS_LINES = 10;
const REVEAL_SILENCE_MS = 9_000;

/** The PRD asks for silence during the identity reveal: the hum drops away, then returns. */
function silenceForReveal(game: GameState): void {
  sound().setHumLevel(0.08);
  const level = game.timer.warningsFired.includes(50) ? 1.8 : 1;
  setTimeout(() => sound().setHumLevel(level), REVEAL_SILENCE_MS);
}

/** `play` output is paced to Ines's tape when one is ready (see libs/voiceTape.ts). */
function outputLines(result: StepResult): readonly OutputLine[] {
  const recording = result.effects.find((effect) => effect.type === "recording");
  return recording?.type === "recording" ? tapeDeck().arm(result.lines, recording.id) : result.lines;
}

function lineText(item: OutputLine): string {
  return item.text;
}

export const useGameStore = create<GameStore>()((set, get) => {
  /** Applies one engine step: output, effects, story events, sound. */
  function applyStep(result: StepResult): void {
    const state = get();
    const queue: QueueEntry[] = [...state.queue, ...outputLines(result).map((line): QueueEntry => ({ type: "line", line }))];
    let game = result.state;
    let ending = state.ending;
    let glitch = state.glitch;

    for (const effect of result.effects) {
      switch (effect.type) {
        case "clear":
          queue.push({ type: "action", action: "clear" });
          break;
        case "recording":
          game = setPause(game, "recording", true);
          queue.push({ type: "action", action: "release_recording" });
          break;
        case "sound":
          sound().play(effect.name);
          break;
        case "glitch":
          glitch = { level: effect.intensity, nonce: glitch.nonce + 1 };
          break;
        case "ending":
          ending = { ending: effect.ending, cause: effect.cause };
          break;
        default:
          break;
      }
    }

    for (const event of result.events) {
      const cue = EVENT_CUES[event.id];
      if (cue) sound().play(cue);
      if (event.id === "warn_50") sound().setHumLevel(1.8);
      if (event.id === "warn_25") glitch = { level: "low", nonce: glitch.nonce + 1 };
      if (event.id === "identified_truth") silenceForReveal(game);
    }
    if (result.lines.length >= FILE_ACCESS_LINES) sound().play("hdd");

    const conversation = [...state.conversation];
    for (const event of result.events) {
      if (event.id === "player_reply" && event.text) conversation.push({ speaker: "player", text: event.text });
    }

    const planned = planMessages(
      result.events,
      { phase: game.phase === "ended" ? game.endedInPhase ?? "recovery" : game.phase, evidence: game.evidence, system: game.system, playerName: game.playerName },
      state.dialogue,
      game.clockMs,
      state.runSeed,
    );
    const lost = ending?.ending === "lost";
    const messageQueue = lost ? [] : mergeQueue(state.messageQueue, planned.messages, ending !== null);
    set({
      game,
      queue,
      ending,
      glitch,
      conversation,
      dialogue: planned.dialogue,
      messageQueue,
      runDurationMs: ending && !state.ending ? Date.now() - state.runStartedAt : state.runDurationMs,
    });
  }

  return {
    screen: "landing",
    playerName: "",
    reducedPressure: false,
    muted: false,
    game: null,
    items: [],
    transcript: [],
    queue: [],
    messageQueue: [],
    dialogue: INITIAL_DIALOGUE,
    conversation: [],
    aiLines: 0,
    unread: false,
    ending: null,
    endingStage: "none",
    glitch: { level: "none", nonce: 0 },
    helpOpen: false,
    runStartedAt: 0,
    runDurationMs: 0,
    nextId: 1,
    runSeed: 0,

    setScreen: (screen) => set({ screen }),
    setPlayerName: (playerName) => set({ playerName }),
    setReducedPressure: (reducedPressure) => set({ reducedPressure }),
    setMuted: (muted) => {
      sound().setMuted(muted);
      set({ muted });
    },

    startRun: () => {
      const { playerName, reducedPressure } = get();
      set({
        game: createInitialState({ playerName, reducedPressure }),
        items: [],
        transcript: [],
        queue: [],
        messageQueue: [],
        dialogue: INITIAL_DIALOGUE,
        conversation: [],
        aiLines: 0,
        unread: false,
        ending: null,
        endingStage: "none",
        glitch: { level: "none", nonce: 0 },
        helpOpen: false,
        runStartedAt: Date.now(),
        runDurationMs: 0,
        runSeed: Math.floor(Math.random() * 1_000),
      });
    },

    submit: (raw) => {
      const { game, ending } = get();
      if (!game || ending) return;
      sound().play("enter");
      set({ unread: false });
      applyStep(runCommand(game, raw));
    },

    advance: (dtMs) => {
      const { game, ending, screen } = get();
      if (!game || ending || screen !== "terminal") return;
      const result = tick(game, dtMs);
      if (result.state === game && result.lines.length === 0) return;
      applyStep(result);
    },

    keystroke: () => {
      const { game } = get();
      if (!game) return;
      const touched = noteInput(game);
      if (touched !== game) set({ game: touched });
    },

    takeQueued: () => {
      const [first, ...rest] = get().queue;
      if (first) set({ queue: rest });
      return first;
    },

    printLine: (line) => {
      const { items, transcript, nextId } = get();
      const next: LineItem = { type: "line", id: nextId, kind: line.kind, text: line.text };
      set({
        items: [...items, next].slice(-MAX_ITEMS),
        transcript: [...transcript, lineText(line)],
        nextId: nextId + 1,
      });
    },

    clearScreen: () => set({ items: [] }),

    releaseRecording: () => {
      const { game } = get();
      if (game) set({ game: setPause(game, "recording", false) });
    },

    takeMessage: () => {
      const [first, ...rest] = get().messageQueue;
      if (first) set({ messageQueue: rest });
      return first;
    },

    openMessage: (message) => {
      const { items, nextId, game } = get();
      const item: MessageItem = {
        type: "message",
        id: nextId,
        key: message.key,
        speaker: message.speaker,
        text: null,
        source: null,
        clock: formatClock(game?.clockMs ?? 0),
      };
      set({ items: [...items, item].slice(-MAX_ITEMS), nextId: nextId + 1, unread: true });
      return item.id;
    },

    resolveMessage: (id, text, source) => {
      const { items, transcript, conversation, aiLines } = get();
      const target = items.find((item) => item.id === id);
      const speaker = target?.type === "message" ? target.speaker : "vega";
      set({
        items: items.map((item) => (item.id === id && item.type === "message" ? { ...item, text, source } : item)),
        transcript: [...transcript, `${speaker === "vega" ? "M_VEGA" : "HOLLOW"}: ${text}`],
        conversation: [...conversation, { speaker, text }].slice(-12),
        aiLines: source === "ai" ? aiLines + 1 : aiLines,
      });
    },

    dropMessage: (id) => set({ items: get().items.filter((item) => item.id !== id) }),

    markRead: () => set({ unread: false }),

    setHelp: (open) => {
      const { game } = get();
      set({ helpOpen: open, game: game ? setPause(game, "help", open) : game });
    },

    setEndingStage: (endingStage) => set({ endingStage }),

    enqueueLines: (lines) => set({ queue: [...get().queue, ...lines.map((line): QueueEntry => ({ type: "line", line }))] }),
  };
});
