// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DotMatrix from "@/components/crt/DotMatrix";
import { GLYPH_WIDTH } from "@/components/crt/font5x7";

const CELL = GLYPH_WIDTH + 1;
let dots: Array<{ x: number; y: number }> = [];

beforeEach(() => {
  dots = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect(): void {}
    },
  );
  const context = {
    setTransform: () => undefined,
    clearRect: () => undefined,
    fillRect: (x: number, y: number) => void dots.push({ x, y }),
    fillStyle: "",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Draw once and return the lit dots, in grid columns (dot 2 + gap 1 = pitch 3). */
function draw(props: Partial<Parameters<typeof DotMatrix>[0]>): Array<{ col: number; row: number }> {
  dots = [];
  act(() => void render(<DotMatrix text="AB CD" dot={2} gap={1} align="left" {...props} />));
  const drawn = dots.map(({ x, y }) => ({ col: x / 3, row: y / 3 }));
  cleanup();
  return drawn;
}

const columns = (drawn: Array<{ col: number }>) => drawn.map((dot) => dot.col);

describe("DotMatrix typing", () => {
  it("draws only the revealed characters", () => {
    const one = draw({ reveal: 1 });
    expect(one.length).toBeGreaterThan(0);
    expect(Math.max(...columns(one))).toBeLessThan(CELL);
    const full = draw({});
    expect(Math.max(...columns(full))).toBeGreaterThan(3 * CELL);
  });

  it("draws a solid caret in the cell after the last typed character", () => {
    const withCaret = draw({ reveal: 1, caret: "solid" });
    const caretDots = withCaret.filter((dot) => dot.col >= CELL);
    expect(caretDots.length).toBeGreaterThan(0);
    expect(Math.min(...columns(caretDots))).toBe(CELL);
    expect(Math.max(...columns(caretDots))).toBe(CELL + GLYPH_WIDTH - 1);
  });

  it("keeps every letter where the finished line puts it, so centred text never shifts while typing", () => {
    const early = draw({ reveal: 1, align: "center" });
    const finished = draw({ reveal: 5, align: "center" });
    const key = ({ col, row }: { col: number; row: number }) => `${col},${row}`;
    const finishedSet = new Set(finished.map(key));
    expect(early.every((dot) => finishedSet.has(key(dot)))).toBe(true);
  });

  it("draws nothing but the caret before the first key", () => {
    expect(draw({ reveal: 0 })).toEqual([]);
    const caretOnly = draw({ reveal: 0, caret: "solid" });
    expect(Math.min(...columns(caretOnly))).toBe(0);
    expect(Math.max(...columns(caretOnly))).toBe(GLYPH_WIDTH - 1);
  });
});
