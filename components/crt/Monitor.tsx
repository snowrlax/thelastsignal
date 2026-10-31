"use client";

import { useEffect, useState, type ReactNode } from "react";

export type ScreenTone = "lcd" | "phosphor" | "maroon" | "blue" | "black";

interface MonitorProps {
  readonly variant: "room" | "full";
  readonly tone: ScreenTone;
  readonly children: ReactNode;
  readonly leaving?: boolean;
  readonly power?: "on" | "off" | null;
  readonly glitch?: { readonly level: "none" | "low" | "high"; readonly nonce: number };
}

/** A CRT monitor: plastic bezel, recessed tube, curved glass and phosphor overlays. */
export default function Monitor({ variant, tone, children, leaving = false, power = null, glitch }: MonitorProps) {
  const [glitchClass, setGlitchClass] = useState("");

  useEffect(() => {
    if (!glitch || glitch.level === "none") return;
    const start = window.setTimeout(() => setGlitchClass(`glitch-${glitch.level}`), 0);
    if (glitch.level === "high") return () => window.clearTimeout(start);
    const stop = window.setTimeout(() => setGlitchClass(""), 650);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [glitch]);

  const powerClass = power === "on" ? "crt-on" : power === "off" ? "crt-off" : "";

  return (
    <div className={variant === "room" ? "monitor" : "monitor-full"} data-leaving={leaving}>
      <div className="monitor-recess">
        <div
          className={`screen tone-${tone} ${powerClass} ${glitchClass}`}
          data-tone={tone}
          style={{ clipPath: `url(#${variant === "room" ? "crt-pillow" : "crt-pillow-wide"})` }}
        >
          <div className="screen-content">{children}</div>
          {tone === "blue" && (
            <>
              <div className="vhs-noise" />
              <div className="vhs-band" />
            </>
          )}
          <div className="screen-overlay crt-scanlines" />
          <div className="screen-overlay crt-mask" />
          {tone === "phosphor" && <div className="screen-overlay crt-roll" />}
          <div className="screen-overlay crt-vignette" />
          <div className="screen-overlay crt-glass" />
        </div>
      </div>
      {variant === "room" && (
        <>
          <div className="monitor-label" aria-hidden="true">
            OFRENDA <b>·</b> VEGA LAB
          </div>
          <div className="monitor-led" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
