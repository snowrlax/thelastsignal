"use client";

import { useEffect, useRef, useState } from "react";
import DotMatrix from "@/components/crt/DotMatrix";
import Monitor from "@/components/crt/Monitor";
import { MAX_NAME_LENGTH } from "@/game/constants";
import { sanitizeCallsign } from "@/game/engine";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";
import { STORAGE_KEYS, writeFlag, writeText } from "@/libs/storage";

type Stage = "enter" | "confirm";

/** OPERATOR IDENTIFICATION REQUIRED. A callsign, nothing more. */
export default function IdentifyScreen() {
  const storedName = useGameStore((state) => state.playerName);
  const reducedPressure = useGameStore((state) => state.reducedPressure);
  const setPlayerName = useGameStore((state) => state.setPlayerName);
  const setReducedPressure = useGameStore((state) => state.setReducedPressure);
  const setScreen = useGameStore((state) => state.setScreen);
  const [value, setValue] = useState(storedName);
  const [stage, setStage] = useState<Stage>("enter");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [stage]);

  const confirmName = () => {
    const clean = sanitizeCallsign(value);
    if (!clean) {
      setError("A NAME OR CALLSIGN IS REQUIRED.");
      sound().play("deny");
      return;
    }
    setError(null);
    setValue(clean);
    setPlayerName(clean);
    setStage("confirm");
    sound().play("beep");
  };

  const begin = () => {
    const clean = sanitizeCallsign(value);
    if (!clean) return setStage("enter");
    writeText(STORAGE_KEYS.callsign, clean);
    setPlayerName(clean);
    sound().play("relay");
    setScreen("cinematic");
  };

  const togglePressure = () => {
    setReducedPressure(!reducedPressure);
    writeFlag(STORAGE_KEYS.reducedPressure, !reducedPressure);
    sound().play("key");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (stage === "enter") {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmName();
        return;
      }
      sound().play("key");
      return;
    }
    event.preventDefault();
    if (event.key === "Enter") begin();
    else if (event.key === "Escape" || event.key === "Backspace") setStage("enter");
    else if (event.key.toLowerCase() === "p") togglePressure();
  };

  const display = stage === "enter" ? `> ${value}` : `Ready, ${value}?`;

  return (
    <Monitor variant="full" tone="maroon" power="on">
      <div
        className="term phosphor"
        style={{ gridTemplateRows: "auto 1fr auto", padding: "4vh 5vw 3vh" }}
        onClick={() => inputRef.current?.focus()}
      >
        <div style={{ lineHeight: 1.25 }}>
          <div>
            <span className="inverse">OFRENDA RESEARCH TERMINAL</span>
          </div>
          <div style={{ marginTop: "0.4em" }}>OPERATOR IDENTIFICATION REQUIRED</div>
          <div style={{ marginTop: "1.2em", color: "var(--amber-hi)" }}>
            {stage === "enter" ? "ENTER YOUR NAME OR CALLSIGN:" : "IDENTIFICATION ACCEPTED."}
          </div>
        </div>

        <div style={{ display: "grid", alignContent: "center", gap: "3vh" }}>
          <DotMatrix
            text={display}
            dot={7}
            gap={2}
           
            color="#ffae2f"
           
            glow="rgba(255, 120, 20, 0.85)"
            cursor
            label={stage === "enter" ? `Callsign: ${value}` : `Ready, ${value}?`}
          />
          <div style={{ textAlign: "center", color: error ? "var(--red)" : "var(--amber-dim)", minHeight: "1.2em" }} role="status">
            {error ??
              (stage === "enter"
                ? `${value.length}/${MAX_NAME_LENGTH} · a callsign is fine · nothing else is asked`
                : "ENTER to begin · ESC to edit")}
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            aria-label="Name or callsign"
            value={value}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            spellCheck={false}
            data-testid="callsign"
            onChange={(event) => {
              if (stage === "enter") setValue(event.target.value.slice(0, MAX_NAME_LENGTH));
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        <nav className="softkeys" style={{ fontFamily: "var(--font-pixelify)", color: "var(--amber)" }} aria-label="Identification">
          <button type="button" className="softkey" onClick={() => setStage("enter")} disabled={stage === "enter"} style={{ opacity: stage === "enter" ? 0.35 : 1 }}>
            Edit
          </button>
          <button type="button" className="softkey" onClick={togglePressure} aria-pressed={reducedPressure} data-testid="pressure">
            Pressure: {reducedPressure ? "Reduced 1.5×" : "Standard"}
          </button>
          <button type="button" className="softkey" onClick={stage === "enter" ? confirmName : begin} data-testid="continue">
            Continue
          </button>
        </nav>
      </div>
    </Monitor>
  );
}
