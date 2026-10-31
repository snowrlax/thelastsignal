"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { humanTypingSchedule } from "@/libs/typing";

interface HumanTypingOptions {
  readonly seed: number;
  /** Show the whole text at once (reduced motion). */
  readonly instant?: boolean;
  /** Called once per typed character, e.g. for a key sound. */
  readonly onStroke?: (char: string) => void;
}

export interface HumanTyping {
  /** Characters of the text shown so far. */
  readonly count: number;
  readonly done: boolean;
  /** Finish the line now. */
  readonly complete: () => void;
}

/** Types `text` out one key at a time with a human rhythm. Restarts when the text or seed changes. */
export function useHumanTyping(text: string, { seed, instant = false, onStroke }: HumanTypingOptions): HumanTyping {
  const key = `${seed}:${text}`;
  const [progress, setProgress] = useState({ key, count: 0 });
  const timer = useRef<number | null>(null);
  const strokeRef = useRef(onStroke);

  useEffect(() => {
    strokeRef.current = onStroke;
  }, [onStroke]);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    if (instant || !text) return;
    const times = humanTypingSchedule(text, seed);
    const start = Date.now();
    // Every key is timed from the start, not from the key before, so timer lag never piles up.
    const strike = (index: number) => {
      setProgress({ key, count: index + 1 });
      strokeRef.current?.(text[index]);
      const next = index + 1;
      timer.current = next < text.length ? window.setTimeout(() => strike(next), Math.max(0, times[next] - (Date.now() - start))) : null;
    };
    timer.current = window.setTimeout(() => strike(0), times[0]);
    return stop;
  }, [key, text, seed, instant, stop]);

  const complete = useCallback(() => {
    stop();
    setProgress({ key, count: text.length });
  }, [stop, key, text]);

  const count = instant ? text.length : progress.key === key ? progress.count : 0;
  return { count, done: count >= text.length, complete };
}
