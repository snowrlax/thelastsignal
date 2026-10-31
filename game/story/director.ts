import { TRIGGERS, resolveLines, type Speaker, type TriggerContext } from "@/game/story/triggers";
import type { StoryEvent, StoryEventId } from "@/game/types";

export const DIALOGUE_COOLDOWN_MS = 8_000;

export interface PlannedMessage {
  readonly key: string;
  readonly templateIndex: number;
  readonly speaker: Speaker;
  readonly event: StoryEventId;
  readonly fallback: string;
  readonly useAi: boolean;
  readonly delayMs: number;
  readonly playerText?: string;
}

export interface DialogueState {
  readonly lastBeatAt: number | null;
  readonly sequence: number;
}

export const INITIAL_DIALOGUE: DialogueState = { lastBeatAt: null, sequence: 0 };

function fillName(text: string, name: string): string {
  return text.replaceAll("{name}", name);
}

function pick(lines: readonly string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length];
}

/**
 * Turns story events into character messages. Non-critical beats respect a
 * cooldown so the characters don't interrupt every command.
 */
export function planMessages(
  events: readonly StoryEvent[],
  ctx: TriggerContext & { readonly playerName: string },
  dialogue: DialogueState,
  nowMs: number,
  seed: number,
): { messages: PlannedMessage[]; dialogue: DialogueState } {
  const messages: PlannedMessage[] = [];
  let state = dialogue;

  for (const event of events) {
    const templates = (TRIGGERS[event.id] ?? []).filter((template) => !template.when || template.when(ctx));
    if (templates.length === 0) continue;
    const critical = templates.some((template) => template.critical);
    const cooling = state.lastBeatAt !== null && nowMs - state.lastBeatAt < DIALOGUE_COOLDOWN_MS;
    if (!critical && cooling) continue;

    for (const template of templates) {
      const templateIndex = (TRIGGERS[event.id] ?? []).indexOf(template);
      const lines = resolveLines(template, ctx);
      if (lines.length === 0) continue;
      const sequence = state.sequence + 1;
      state = { ...state, sequence };
      messages.push({
        key: `${event.id}-${sequence}`,
        templateIndex,
        speaker: template.speaker,
        event: event.id,
        fallback: fillName(pick(lines, seed + sequence), ctx.playerName),
        useAi: Boolean(template.ai),
        delayMs: template.delayMs ?? 0,
        playerText: event.text,
      });
    }
    state = { ...state, lastBeatAt: nowMs };
  }
  return { messages, dialogue: state };
}

/** Re-checks a queued message just before it is shown: the story may have moved on. */
export function isStillRelevant(message: PlannedMessage, ctx: TriggerContext): boolean {
  const template = TRIGGERS[message.event]?.[message.templateIndex];
  if (!template?.when) return true;
  return template.when(ctx);
}

/**
 * Merges a new batch into the pending queue. A newer beat from a character
 * replaces that character's older pending lines; an ending clears everything else.
 */
export function mergeQueue(pending: readonly PlannedMessage[], incoming: readonly PlannedMessage[], ended: boolean): PlannedMessage[] {
  if (ended) return [...incoming.filter((message) => message.event === "persona_stopped")];
  if (incoming.length === 0) return [...pending];
  const speakers = new Set(incoming.map((message) => message.speaker));
  return [...pending.filter((message) => !speakers.has(message.speaker)), ...incoming];
}
