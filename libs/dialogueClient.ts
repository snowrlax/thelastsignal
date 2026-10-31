import type { PlannedMessage } from "@/game/story/director";
import { MAX_RECENT_MESSAGES, MAX_RECENT_TEXT, type DialogueRequest } from "@/game/story/schema";
import { EVIDENCE_FLAGS, type GameState } from "@/game/types";

export interface ConversationEntry {
  readonly speaker: "vega" | "hollow" | "player";
  readonly text: string;
}

export const CLIENT_DIALOGUE_TIMEOUT_MS = 5_500;

export function buildDialogueRequest(game: GameState, message: PlannedMessage, conversation: readonly ConversationEntry[]): DialogueRequest {
  const remaining = game.timer.running ? Math.round((game.timer.grace?.remainingMs ?? game.timer.remainingMs) / 1000) : null;
  return {
    speaker: message.speaker,
    event: message.event,
    playerName: game.playerName,
    phase: game.phase,
    evidence: EVIDENCE_FLAGS.filter((flag) => game.evidence[flag]),
    system: {
      archiveCopied: game.system.archiveCopied,
      hollowRunning: game.system.hollowRunning,
      personaRunning: game.system.personaRunning,
    },
    remainingSeconds: remaining === null ? null : Math.min(3_600, Math.max(0, remaining)),
    recent: conversation.slice(-MAX_RECENT_MESSAGES).map((entry) => ({ speaker: entry.speaker, text: entry.text.slice(0, MAX_RECENT_TEXT) })),
    ...(message.playerText ? { playerMessage: message.playerText } : {}),
  };
}

export interface DialogueReply {
  readonly text: string;
  /** Present when the server can voice this line (see /api/voice). */
  readonly voiceToken: string | null;
}

/** Never throws and never waits longer than the timeout: null means "use the authored line". */
export async function fetchDialogueReply(request: DialogueRequest, timeoutMs = CLIENT_DIALOGUE_TIMEOUT_MS): Promise<DialogueReply | null> {
  try {
    const response = await fetch("/api/dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { success?: boolean; data?: { text?: unknown; voiceToken?: unknown } };
    if (!json.success || typeof json.data?.text !== "string") return null;
    return { text: json.data.text, voiceToken: typeof json.data.voiceToken === "string" ? json.data.voiceToken : null };
  } catch {
    return null;
  }
}

export async function fetchDialogueLine(request: DialogueRequest, timeoutMs = CLIENT_DIALOGUE_TIMEOUT_MS): Promise<string | null> {
  return (await fetchDialogueReply(request, timeoutMs))?.text ?? null;
}
