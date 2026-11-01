"use client";

import { useEffect } from "react";
import { vegaVoice } from "@/libs/voicePlayer";
import { tapeDeck } from "@/libs/voiceTape";

/**
 * Readies Ines's tapes and M_VEGA's voice while the terminal is open, and
 * silences both when it closes. M_VEGA's lines are spoken from useDialogue.
 */
export function useVoice(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    tapeDeck().preload();
    vegaVoice().prepare();
    return () => {
      tapeDeck().stop();
      vegaVoice().stop();
    };
  }, [active]);
}
