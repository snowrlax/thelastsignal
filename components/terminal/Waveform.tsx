"use client";

import { useEffect, useRef } from "react";

interface WaveformProps {
  /** 0 = flatline, 1 = idle hum, 2+ = speaking. */
  readonly energy: number;
  readonly color?: string;
}

/** The pts/404 carrier: a restless line that spikes when M_VEGA speaks. */
export default function Waveform({ energy, color = "#ffd257" }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(energy);

  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let smooth = energyRef.current;
    let t = 0;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      smooth += (energyRef.current - smooth) * 0.06;
      t += 0.05;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const amp = smooth * (height * 0.16);
        const y =
          height / 2 +
          Math.sin(x * 0.07 + t * 3) * amp * 0.6 +
          Math.sin(x * 0.19 - t * 5) * amp * 0.3 +
          (Math.random() - 0.5) * amp * 0.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [color]);

  return <canvas ref={canvasRef} className="wave" aria-hidden="true" />;
}
