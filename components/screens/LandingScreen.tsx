"use client";

import { useCallback, useEffect, useState } from "react";
import Monitor from "@/components/crt/Monitor";
import { BatteryIcon, EnvelopeIcon, SignalIcon } from "@/components/crt/PixelIcons";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { STORAGE_KEYS, writeFlag } from "@/libs/storage";

type Stage = "idle" | "vhs" | "leaving";

function useLocalTime(): string {
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const id = window.setInterval(update, 10_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

/** A dark room, an old monitor, an orange screen, one obvious action. */
export default function LandingScreen() {
  const [stage, setStage] = useState<Stage>("idle");
  const muted = useGameStore((state) => state.muted);
  const setMuted = useGameStore((state) => state.setMuted);
  const setScreen = useGameStore((state) => state.setScreen);
  const time = useLocalTime();

  const play = useCallback(() => {
    if (stage !== "idle") return;
    const audio = sound();
    audio.unlock();
    audio.startHum();
    audio.play("vhs");
    setStage("vhs");
    window.setTimeout(() => setStage("leaving"), 1_400);
    window.setTimeout(() => setScreen("identify"), 2_200);
  }, [setScreen, stage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  const toggleSound = () => {
    sound().unlock();
    setMuted(!muted);
    writeFlag(STORAGE_KEYS.muted, !muted);
  };

  return (
    <div className="room">
      <Monitor variant="room" tone={stage === "idle" ? "lcd" : "blue"} leaving={stage === "leaving"}>
        {stage === "idle" ? (
          <div className="lcd">
            <div className="lcd-bar" aria-hidden="true">
              <span className="icons">
                <SignalIcon bars={2} />
                <EnvelopeIcon className="blink" />
              </span>
              <span className="icons">
                {time}
                <BatteryIcon level={1} />
              </span>
            </div>
            <div className="lcd-title">
              <h1>
                THE LAST
                <br />
                SIGNAL.
              </h1>
              <p>A short interactive psychological horror experience</p>
            </div>
            <nav className="softkeys" aria-label="Title menu">
              <button type="button" className="softkey" onClick={toggleSound}>
                {muted ? "Sound" : "Mute"}
              </button>
              <button type="button" className="softkey softkey-primary" onClick={play} autoFocus data-testid="play">
                ▶ Play
              </button>
              <span aria-hidden="true" />
            </nav>
          </div>
        ) : (
          <VhsPlay />
        )}
      </Monitor>
    </div>
  );
}

function VhsPlay() {
  return (
    <div className="vhs-osd" style={{ position: "absolute", top: "8%", left: "8%", fontSize: "clamp(28px, 5vw, 64px)", zIndex: 4 }}>
      <div style={{ position: "relative" }}>
        <span>PLAY ▶</span>
        <span aria-hidden="true" style={{ position: "absolute", left: "0.06em", top: "0.5em", opacity: 0.45 }}>
          PLAY
        </span>
      </div>
    </div>
  );
}
