"use client";

import { useEffect, useRef, useState } from "react";
import { wrapText } from "@/components/crt/dotMatrixLayout";
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphFor } from "@/components/crt/font5x7";

interface DotMatrixProps {
  readonly text: string;
  /** Size of one lit dot in CSS px. */
  readonly dot?: number;
  readonly gap?: number;
  readonly color?: string;
  readonly glow?: string;
  readonly cursor?: boolean;
  readonly align?: "left" | "center";
  readonly className?: string;
  readonly label?: string;
}

const CELL = GLYPH_WIDTH + 1;
const LINE = GLYPH_HEIGHT + 2;

/** Glowing LED dot-matrix text drawn from a hand-made 5x7 character set. */
export default function DotMatrix({
  text,
  dot = 5,
  gap = 1,
  color = "#ffb03b",
  glow = "rgba(255, 140, 30, 0.75)",
  cursor = false,
  align = "center",
  className,
  label,
}: DotMatrixProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!cursor) return;
    const id = window.setInterval(() => setCursorOn((value) => !value), 530);
    return () => window.clearInterval(id);
  }, [cursor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width) return;
    const measure = (value: string) => [...value].length * CELL - 1;
    const cursorCols = cursor ? CELL : 0;
    // Shrink the dots (never the words) until the longest word fits the width.
    const longestWord = Math.max(...text.split(/\s+/).map(measure)) + cursorCols;
    let size = dot;
    let spacing = gap;
    while (size > 2 && Math.floor(width / (size + spacing)) < longestWord) {
      size -= 1;
      spacing = Math.max(1, Math.min(spacing, Math.round(size / 3)));
    }
    const pitch = size + spacing;
    const maxCols = Math.max(CELL, Math.floor(width / pitch));
    const lines = wrapText(text, measure, maxCols - cursorCols);
    const lineCols = lines.map((line, index) => measure(line) + (index === lines.length - 1 ? cursorCols : 0));
    const cols = Math.max(1, ...lineCols);
    const rows = lines.length * LINE - 2;

    const ratio = window.devicePixelRatio || 1;
    const cssWidth = cols * pitch;
    const cssHeight = rows * pitch;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = color;

    lines.forEach((line, lineIndex) => {
      const offset = align === "center" ? Math.floor((cols - lineCols[lineIndex]) / 2) : 0;
      const top = lineIndex * LINE;
      [...line].forEach((char, charIndex) => {
        const glyph = glyphFor(char);
        const left = offset + charIndex * CELL;
        glyph.forEach((row, y) =>
          row.forEach((lit, x) => {
            if (lit) ctx.fillRect((left + x) * pitch, (top + y) * pitch, size, size);
          }),
        );
      });
      if (cursor && cursorOn && lineIndex === lines.length - 1) {
        const left = offset + lineCols[lineIndex] - GLYPH_WIDTH;
        for (let y = 0; y < GLYPH_HEIGHT - 1; y += 1) {
          for (let x = 0; x < GLYPH_WIDTH; x += 1) ctx.fillRect((left + x) * pitch, (top + y) * pitch, size, size);
        }
      }
    });
  }, [text, width, dot, gap, color, cursor, cursorOn, align]);

  return (
    <div ref={wrapRef} className={className} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "block", margin: align === "center" ? "0 auto" : undefined, filter: `drop-shadow(0 0 ${Math.max(2, dot * 0.9)}px ${glow})` }}
      />
      <span className="sr-only">{label ?? text}</span>
    </div>
  );
}
