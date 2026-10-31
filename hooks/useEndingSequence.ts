"use client";

import { useEffect } from "react";
import { badEndingLines, goodEndingLines } from "@/game/story/endings";
import type { OutputLine } from "@/game/types";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { vegaVoice } from "@/libs/voicePlayer";
import { vegaSpeech } from "@/libs/voiceText";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function until(condition: () => boolean, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (!condition() && Date.now() - started < timeoutMs) await wait(100);
}

/** The takeover ends in M_VEGA's own voice, from the moment her first line prints. */
async function speakTakeover(lines: readonly OutputLine[], isCancelled: () => boolean): Promise<void> {
  const speech = vegaSpeech(lines);
  const first = lines.find((line) => line.kind === "vega" && speech?.startsWith(line.text.trim()));
  if (!speech || !first) return;
  await until(() => isCancelled() || useGameStore.getState().transcript.includes(first.text), 40_000);
  if (!isCancelled()) void vegaVoice().speak(speech, null);
}

const queueEmpty = () => useGameStore.getState().queue.length === 0;
const dialogueSettled = () => {
  const state = useGameStore.getState();
  return state.messageQueue.length === 0 && !state.items.some((item) => item.type === "message" && item.text === null);
};

/** Plays the ending once the decisive command's output has printed. */
export function useEndingSequence(): void {
  const ending = useGameStore((state) => state.ending);

  useEffect(() => {
    if (!ending) return;
    let cancelled = false;
    const store = useGameStore.getState();
    store.setEndingStage("sequence");

    const runGood = async () => {
      await until(queueEmpty, 15_000);
      await until(dialogueSettled, 14_000);
      await wait(2_800);
      if (cancelled) return;
      sound().stopHum(5);
      useGameStore.getState().enqueueLines(goodEndingLines());
      await until(queueEmpty, 30_000);
      await wait(2_200);
      if (cancelled) return;
      useGameStore.getState().setEndingStage("poweroff");
      sound().play("powerOff");
      await wait(1_300);
      useGameStore.getState().setEndingStage("epitaph");
      await wait(7_000);
      if (!cancelled) useGameStore.getState().setScreen("ending");
    };

    const runBad = async () => {
      await until(queueEmpty, 10_000);
      if (cancelled) return;
      sound().play("takeover");
      const state = useGameStore.getState();
      useGameStore.setState({ glitch: { level: "high", nonce: state.glitch.nonce + 1 } });
      const lines = badEndingLines(state.game?.playerName ?? "OPERATOR", ending.cause ?? "timeout");
      state.enqueueLines(lines);
      void speakTakeover(lines, () => cancelled);
      await until(queueEmpty, 40_000);
      await wait(1_600);
      if (cancelled) return;
      useGameStore.getState().setEndingStage("poweroff");
      sound().play("powerOff");
      sound().stopHum(0.4);
      await wait(1_400);
      if (!cancelled) useGameStore.getState().setScreen("ending");
    };

    void (ending.ending === "preserved" ? runGood() : runBad());
    return () => {
      cancelled = true;
    };
  }, [ending]);
}
