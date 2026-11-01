"use client";

import { useEffect } from "react";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { isStillRelevant, type PlannedMessage } from "@/game/story/director";
import { buildDialogueRequest, fetchDialogueReply, type DialogueReply } from "@/libs/dialogueClient";
import { vegaVoice } from "@/libs/voicePlayer";

const MIN_RECEIVING_MS = 900;
const TYPE_MS_PER_CHAR = 26;
/** Longest the next message waits for M_VEGA to finish speaking. */
const MAX_VOICE_HOLD_MS = 6_000;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const recordingPlaying = () => Boolean(useGameStore.getState().game?.timer.pausedBy.includes("recording"));

/** Recordings are protected: nobody talks over Ines. */
async function waitForSilence(isCancelled: () => boolean): Promise<void> {
  while (recordingPlaying() && !isCancelled()) await wait(250);
}

/** M_VEGA speaks her line aloud when voice is on; HOLLOW is a system process and stays text. */
function voice(message: PlannedMessage, reply: DialogueReply | null): void {
  if (message.speaker !== "vega") return;
  void vegaVoice().speak(reply?.text ?? message.fallback, reply?.voiceToken ?? null);
}

/**
 * Delivers planned character messages one at a time. The model may voice them;
 * if it is slow or unavailable the authored line is used. Never blocks input.
 */
export function useDialogue(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let running = false;

    const deliver = async (message: PlannedMessage) => {
      if (message.delayMs > 0) await wait(message.delayMs);
      // Re-checked synchronously after every await, so a recording that starts meanwhile still wins.
      do await waitForSilence(() => cancelled);
      while (recordingPlaying() && !cancelled);
      const store = useGameStore.getState();
      if (cancelled || !store.game || store.ending?.ending === "lost") return;
      const { game } = store;
      const ctx = { phase: game.phase === "ended" ? game.endedInPhase ?? "recovery" : game.phase, evidence: game.evidence, system: game.system };
      if (!isStillRelevant(message, ctx)) return;
      if (store.ending && message.event !== "persona_stopped") return;

      sound().play(message.speaker === "vega" ? "message" : "hollow");
      vegaVoice().supersede();
      const id = store.openMessage(message);
      let reply: DialogueReply | null = null;
      try {
        const started = Date.now();
        reply = message.useAi ? await fetchDialogueReply(buildDialogueRequest(game, message, store.conversation, store.runId)) : null;
        const elapsed = Date.now() - started;
        if (elapsed < MIN_RECEIVING_MS) await wait(MIN_RECEIVING_MS - elapsed);
      } finally {
        // A window is never left on "receiving": it resolves, or vanishes if the takeover began meanwhile.
        const latest = useGameStore.getState();
        if (latest.ending?.ending === "lost") latest.dropMessage(id);
        else {
          latest.resolveMessage(id, reply?.text ?? message.fallback, reply ? "ai" : "script");
          voice(message, reply);
        }
      }
      const text = reply?.text ?? message.fallback;
      await wait(Math.min(5_000, text.length * TYPE_MS_PER_CHAR + 400));
      await vegaVoice().untilQuiet(MAX_VOICE_HOLD_MS);
    };

    const run = async () => {
      if (running) return;
      running = true;
      try {
        while (!cancelled) {
          const message = useGameStore.getState().takeMessage();
          if (!message) break;
          try {
            await deliver(message);
          } catch (error) {
            console.error("[dialogue] message failed", error);
          }
        }
      } finally {
        running = false;
      }
    };

    void run();
    const unsubscribe = useGameStore.subscribe((state, previous) => {
      if (state.messageQueue.length > 0 && state.messageQueue !== previous.messageQueue) void run();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [active]);
}
