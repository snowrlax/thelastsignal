"use client";

import { useEffect } from "react";
import CrtDefs from "@/components/crt/CrtDefs";
import SoundToggle from "@/components/game/SoundToggle";
import BootScreen from "@/components/screens/BootScreen";
import CinematicScreen from "@/components/screens/CinematicScreen";
import EndingScreen from "@/components/screens/EndingScreen";
import IdentifyScreen from "@/components/screens/IdentifyScreen";
import LandingScreen from "@/components/screens/LandingScreen";
import TerminalScreen from "@/components/screens/TerminalScreen";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { readFlag, readText, STORAGE_KEYS } from "@/libs/storage";

/** Screen flow: landing → identify → cinematic → boot → terminal → ending. */
export default function GameRoot() {
  const screen = useGameStore((state) => state.screen);

  useEffect(() => {
    const store = useGameStore.getState();
    store.setMuted(readFlag(STORAGE_KEYS.muted));
    store.setReducedPressure(readFlag(STORAGE_KEYS.reducedPressure));
    const callsign = readText(STORAGE_KEYS.callsign);
    if (callsign) store.setPlayerName(callsign);

    const unlock = () => sound().unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <main data-screen={screen}>
      <CrtDefs />
      {screen === "landing" && <LandingScreen />}
      {screen === "identify" && <IdentifyScreen />}
      {screen === "cinematic" && <CinematicScreen />}
      {screen === "boot" && <BootScreen />}
      {screen === "terminal" && <TerminalScreen />}
      {screen === "ending" && <EndingScreen />}
      {screen !== "terminal" && <SoundToggle />}
    </main>
  );
}
