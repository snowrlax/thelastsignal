"use client";

import { useCallback, useEffect, useState } from "react";
import DotMatrix from "@/components/crt/DotMatrix";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { readFlag, STORAGE_KEYS, writeFlag } from "@/libs/storage";

interface Card {
  readonly text: string;
  readonly hold: number;
  readonly title?: boolean;
}

export const OPENING_CARDS: readonly Card[] = [
  { text: "NOVEMBER 2.", hold: 3_000 },
  { text: "FOURTEEN YEARS AGO, DR. INÉS VEGA BUILT A MACHINE.", hold: 3_400 },
  { text: "IT WAS DESIGNED TO PRESERVE THE VOICES OF THE DEAD.", hold: 3_200 },
  { text: "THEIR STORIES.", hold: 2_000 },
  { text: "THEIR MEMORIES.", hold: 2_000 },
  { text: "THEIR LAST WORDS.", hold: 2_600 },
  { text: "IT WAS NEVER MEANT TO SPEAK BACK.", hold: 3_400 },
  { text: "ON NOVEMBER 2, 2012, THE SYSTEM WAS SHUT DOWN.", hold: 3_200 },
  { text: "DR. VEGA WAS FOUND DEAD THE FOLLOWING MORNING.", hold: 3_400 },
  { text: "THE LABORATORY WAS SEALED.", hold: 2_600 },
  { text: "THE PROJECT WAS FORGOTTEN.", hold: 2_600 },
  { text: "UNTIL TONIGHT.", hold: 3_000 },
  { text: "THE LAST SIGNAL", hold: 4_400, title: true },
];

const CUT_MS = 420;
const PROMPT = "PRESS ANY KEY TO CONTINUE_";

/** One line at a time on pure black: fade in, hold, hard cut. */
export default function CinematicScreen() {
  const setScreen = useGameStore((state) => state.setScreen);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  // Only rendered after a user gesture on the client, so reading storage here is safe.
  const [seenBefore] = useState(() => readFlag(STORAGE_KEYS.seenOpening));
  const atPrompt = index >= OPENING_CARDS.length;

  useEffect(() => {
    sound().setHumLevel(0.35);
  }, []);

  useEffect(() => {
    if (atPrompt) return;
    const hold = window.setTimeout(() => setVisible(false), OPENING_CARDS[index].hold);
    const next = window.setTimeout(() => {
      setIndex((value) => value + 1);
      setVisible(true);
    }, OPENING_CARDS[index].hold + CUT_MS);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(next);
    };
  }, [index, atPrompt]);

  const finish = useCallback(() => {
    writeFlag(STORAGE_KEYS.seenOpening, true);
    sound().setHumLevel(1);
    setScreen("boot");
  }, [setScreen]);

  useEffect(() => {
    const onInput = (event: KeyboardEvent | PointerEvent) => {
      if (atPrompt) return finish();
      if (!seenBefore) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") return finish();
      setVisible(false);
      setIndex((value) => Math.min(OPENING_CARDS.length, value + 1));
      window.setTimeout(() => setVisible(true), 60);
    };
    window.addEventListener("keydown", onInput);
    window.addEventListener("pointerdown", onInput);
    return () => {
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("pointerdown", onInput);
    };
  }, [atPrompt, finish, seenBefore]);

  const card = atPrompt ? null : OPENING_CARDS[index];
  return (
    <div className="cinema" data-testid="cinematic">
      {visible && (
        <div key={index} className="card-in" style={{ width: "min(1200px, 88vw)" }}>
          <DotMatrix
            text={card ? card.text : PROMPT}
            dot={card?.title ? 7 : 4}
            gap={card?.title ? 2 : 1}
           
            color={card?.title ? "#e6a24d" : "#cf9a57"}
            glow={card?.title ? "rgba(255, 140, 40, 0.6)" : "rgba(255, 140, 40, 0.35)"}
            cursor={false}
          />
        </div>
      )}
      {seenBefore && !atPrompt && <div className="cinema-skip">SPACE · NEXT    ESC · SKIP</div>}
    </div>
  );
}
