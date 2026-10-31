"use client";

import { useEffect, useRef, useState } from "react";
import DotMatrix from "@/components/crt/DotMatrix";
import Monitor from "@/components/crt/Monitor";
import HelpOverlay from "@/components/terminal/HelpOverlay";
import PromptLine, { type PromptHandle } from "@/components/terminal/PromptLine";
import SidePanel from "@/components/terminal/SidePanel";
import StatusBar from "@/components/terminal/StatusBar";
import TerminalFooter from "@/components/terminal/TerminalFooter";
import TerminalOutput from "@/components/terminal/TerminalOutput";
import { GOOD_ENDING_EPITAPH } from "@/game/story/endings";
import { dim, line, out } from "@/game/text";
import { useDialogue } from "@/hooks/useDialogue";
import { useEndingSequence } from "@/hooks/useEndingSequence";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useGameStore } from "@/hooks/useGameStore";
import { usePrinter } from "@/hooks/usePrinter";
import { sound } from "@/libs/audio";
import { STORAGE_KEYS, writeFlag } from "@/libs/storage";

const MOTD = [
  out("OFRENDA-01 · memory preservation terminal · Vega Laboratory, Building C"),
  dim("Last login: Fri Nov  2 21:40:11 2012 on tty1"),
  line("sys", "You have 1 unread signal on pts/404."),
  dim("Type help for a list of commands. Press F1 for the operator manual."),
  out(""),
];

/** The main game: a full-screen amber terminal. */
export default function TerminalScreen() {
  const game = useGameStore((state) => state.game);
  const unread = useGameStore((state) => state.unread);
  const ending = useGameStore((state) => state.ending);
  const endingStage = useGameStore((state) => state.endingStage);
  const glitch = useGameStore((state) => state.glitch);
  const helpOpen = useGameStore((state) => state.helpOpen);
  const setHelp = useGameStore((state) => state.setHelp);
  const submit = useGameStore((state) => state.submit);
  const muted = useGameStore((state) => state.muted);
  const setMuted = useGameStore((state) => state.setMuted);
  const promptRef = useRef<PromptHandle>(null);
  const [poweringOn, setPoweringOn] = useState(true);
  const greeted = useRef(false);

  useGameLoop(true);
  usePrinter(true);
  useDialogue(true);
  useEndingSequence();

  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    useGameStore.getState().enqueueLines(MOTD);
    sound().startHum();
    sound().setHumLevel(1);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setPoweringOn(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "F1") return;
      event.preventDefault();
      const state = useGameStore.getState();
      state.setHelp(!state.helpOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!helpOpen) promptRef.current?.focus();
  }, [helpOpen]);

  if (!game) return null;
  const takenOver = ending?.ending === "lost";
  const recording = game.timer.pausedBy.includes("recording");
  const power = endingStage === "poweroff" ? "off" : poweringOn ? "on" : null;

  return (
    <Monitor variant="full" tone={endingStage === "epitaph" ? "black" : "phosphor"} power={power} glitch={glitch}>
      {endingStage === "epitaph" ? (
        <div className="fade-in" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "0 8vw" }} data-testid="epitaph">
          <DotMatrix text={GOOD_ENDING_EPITAPH} dot={4} gap={1} color="#cf9a57" glow="rgba(255, 140, 40, 0.35)" />
        </div>
      ) : (
        <div className="term phosphor" onClick={() => promptRef.current?.focus()} data-testid="terminal">
          <StatusBar game={game} unread={unread} takenOver={takenOver} />
          <div className="term-body">
            <TerminalOutput>
              <PromptLine ref={promptRef} disabled={Boolean(ending) || recording} takenOver={takenOver} ended={Boolean(ending)} />
            </TerminalOutput>
            <SidePanel game={game} />
          </div>
          <TerminalFooter
            phase={game.phase}
            muted={muted}
            onSound={() => {
              setMuted(!muted);
              writeFlag(STORAGE_KEYS.muted, !muted);
            }}
            onHelp={() => setHelp(true)}
            onHint={() => submit("hint")}
            onReply={() => promptRef.current?.prefill("reply ")}
          />
          {helpOpen && <HelpOverlay onClose={() => setHelp(false)} />}
        </div>
      )}
    </Monitor>
  );
}
