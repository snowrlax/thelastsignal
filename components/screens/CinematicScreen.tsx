"use client";

import { useCallback, useEffect, useState } from "react";
import DotMatrix from "@/components/crt/DotMatrix";
import { CUT_MS, OPENING_CARDS, PROMPT, cardSeed } from "@/components/screens/opening";
import { useGameStore } from "@/hooks/useGameStore";
import { useHumanTyping } from "@/hooks/useHumanTyping";
import { sound } from "@/libs/audio";
import { readFlag, STORAGE_KEYS, writeFlag } from "@/libs/storage";

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function strike(char: string): void {
  sound().play(char === " " ? "typeSpace" : "type");
}

type CardState = "typing" | "holding" | "cut" | "prompt";

/** One line at a time on pure black, typed by an unseen hand: keys, hold, carriage return, cut. */
export default function CinematicScreen() {
  const setScreen = useGameStore((state) => state.setScreen);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  // Only rendered after a user gesture on the client, so reading storage and media queries here is safe.
  const [seenBefore] = useState(() => readFlag(STORAGE_KEYS.seenOpening));
  const [reduceMotion] = useState(prefersReducedMotion);
  const atPrompt = index >= OPENING_CARDS.length;
  const card = atPrompt ? null : OPENING_CARDS[index];
  const text = card ? card.text : PROMPT;
  const { count, done, complete } = useHumanTyping(text, { seed: cardSeed(index), instant: reduceMotion, onStroke: strike });

  useEffect(() => {
    sound().setHumLevel(0.35);
  }, []);

  // Once a line is typed: let it sit, return the carriage, cut to black, then the next line.
  useEffect(() => {
    if (!card || !done) return;
    const hold = window.setTimeout(() => {
      setVisible(false);
      sound().play("carriage");
    }, card.hold);
    const next = window.setTimeout(() => {
      setIndex((value) => value + 1);
      setVisible(true);
    }, card.hold + CUT_MS);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(next);
    };
  }, [card, done]);

  const finish = useCallback(() => {
    writeFlag(STORAGE_KEYS.seenOpening, true);
    sound().setHumLevel(1);
    setScreen("boot");
  }, [setScreen]);

  useEffect(() => {
    const onInput = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent && event.repeat) return;
      // First-time players wait for the prompt to finish typing; it is the only way on.
      if (atPrompt) return done || seenBefore ? finish() : undefined;
      if (!seenBefore) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") return finish();
      if (!visible) return; // already cutting to the next line
      if (!done) return complete();
      sound().play("carriage");
      setIndex((value) => Math.min(OPENING_CARDS.length, value + 1));
    };
    window.addEventListener("keydown", onInput);
    window.addEventListener("pointerdown", onInput);
    return () => {
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("pointerdown", onInput);
    };
  }, [atPrompt, finish, seenBefore, visible, done, complete]);

  const state: CardState = atPrompt ? "prompt" : !visible ? "cut" : done ? "holding" : "typing";
  return (
    <div className="cinema" data-testid="cinematic" data-card={atPrompt ? "prompt" : index} data-state={state} data-progress={count}>
      {visible && (
        <div key={index} className="card-in" style={{ width: "min(1200px, 88vw)" }}>
          <DotMatrix
            text={text}
            reveal={count}
            caret={done ? "blink" : "solid"}
            dot={card?.title ? 7 : 4}
            gap={card?.title ? 2 : 1}
            color={card?.title ? "#e6a24d" : "#cf9a57"}
            glow={card?.title ? "rgba(255, 140, 40, 0.6)" : "rgba(255, 140, 40, 0.35)"}
          />
        </div>
      )}
      {seenBefore && !atPrompt && <div className="cinema-skip">SPACE · NEXT    ESC · SKIP</div>}
    </div>
  );
}
