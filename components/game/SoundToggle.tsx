"use client";

import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { STORAGE_KEYS, writeFlag } from "@/libs/storage";

/** The always-visible mute control. */
export default function SoundToggle() {
  const muted = useGameStore((state) => state.muted);
  const setMuted = useGameStore((state) => state.setMuted);

  const toggle = () => {
    sound().unlock();
    setMuted(!muted);
    writeFlag(STORAGE_KEYS.muted, !muted);
  };

  return (
    <button type="button" className="sound-toggle" onClick={toggle} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Mute sound"}>
      {muted ? "♪ SOUND OFF" : "♪ SOUND ON"}
    </button>
  );
}
