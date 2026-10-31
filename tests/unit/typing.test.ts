import { describe, expect, it } from "vitest";
import { caretCell, lineStarts, wrapText } from "@/components/crt/dotMatrixLayout";
import { CUT_MS, OPENING_CARDS, PROMPT, cardSeed, openingDurationMs } from "@/components/screens/opening";
import { TYPING, humanTypingSchedule, seededRandom, typingDuration } from "@/libs/typing";

const gaps = (times: readonly number[]): number[] => times.slice(1).map((time, index) => time - times[index]);

describe("seededRandom", () => {
  it("repeats for a seed, stays in [0, 1) and differs between seeds", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const first = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
    const c = seededRandom(8);
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(first);
  });
});

describe("humanTypingSchedule", () => {
  const text = "FOURTEEN YEARS AGO, DR. INÉS VEGA BUILT A MACHINE.";

  it("gives every character one strictly increasing time, after a lead-in", () => {
    const times = humanTypingSchedule(text, 3);
    expect(times).toHaveLength(text.length);
    expect(times[0]).toBe(TYPING.leadInMs);
    expect(gaps(times).every((gap) => gap > 0)).toBe(true);
  });

  it("is deterministic per seed, and another seed gives another rhythm", () => {
    expect(humanTypingSchedule(text, 3)).toEqual(humanTypingSchedule(text, 3));
    expect(humanTypingSchedule(text, 4)).not.toEqual(humanTypingSchedule(text, 3));
  });

  it("types letters inside a word at an uneven, human pace", () => {
    const word = "REMEMBERING";
    const strokes = gaps(humanTypingSchedule(word, 11));
    const [min, max] = TYPING.stroke;
    expect(strokes.every((gap) => gap >= min && gap <= max)).toBe(true);
    expect(new Set(strokes).size).toBeGreaterThanOrEqual(5);
  });

  it("reaches for each new word and pauses after punctuation", () => {
    const sample = "DR. VEGA, NOW";
    const times = humanTypingSchedule(sample, 5);
    const gapBefore = (index: number) => times[index] - times[index - 1];
    expect(gapBefore(sample.indexOf("V"))).toBeGreaterThanOrEqual(TYPING.stroke[0] + TYPING.wordReach[0]);
    expect(gapBefore(sample.indexOf(".") + 1)).toBeGreaterThanOrEqual(TYPING.stroke[0] + TYPING.pauses["."][0]);
    expect(gapBefore(sample.indexOf(",") + 1)).toBeGreaterThanOrEqual(TYPING.stroke[0] + TYPING.pauses[","][0]);
  });

  it("sometimes hesitates before a word, but not before every word", () => {
    const long = Array.from({ length: 80 }, () => "WORD").join(" ");
    const times = humanTypingSchedule(long, 21);
    const wordStarts = [...long].flatMap((char, index) => (index > 0 && long[index - 1] === " " ? [index] : []));
    const plainMax = TYPING.stroke[1] + TYPING.wordReach[1];
    const hesitated = wordStarts.filter((index) => times[index] - times[index - 1] > plainMax);
    expect(hesitated.length).toBeGreaterThan(0);
    expect(hesitated.length).toBeLessThan(wordStarts.length / 4);
  });

  it("has nothing to type for empty text", () => {
    expect(humanTypingSchedule("", 1)).toEqual([]);
    expect(typingDuration("", 1)).toBe(0);
  });

  it("reports the time of the last stroke as the duration", () => {
    const times = humanTypingSchedule(text, 9);
    expect(typingDuration(text, 9)).toBe(times[times.length - 1]);
  });
});

describe("dot-matrix caret layout", () => {
  const measure = (value: string) => value.length;

  it("maps each wrapped line back to its offset in the text", () => {
    const text = "AB CD EF";
    const lines = wrapText(text, measure, 5);
    expect(lines).toEqual(["AB CD", "EF"]);
    expect(lineStarts(text, lines)).toEqual([0, 6]);
  });

  it("handles words split across lines", () => {
    const text = "ABCDEFG";
    const lines = wrapText(text, measure, 3);
    expect(lineStarts(text, lines)).toEqual([0, 3, 6]);
  });

  it("puts the caret after the last typed character, across wrap points", () => {
    const lines = ["AB CD", "EF"];
    const starts = [0, 6];
    expect(caretCell(lines, starts, 0)).toEqual({ line: 0, col: 0 });
    expect(caretCell(lines, starts, 2)).toEqual({ line: 0, col: 2 });
    expect(caretCell(lines, starts, 5)).toEqual({ line: 0, col: 5 });
    expect(caretCell(lines, starts, 6)).toEqual({ line: 1, col: 0 });
    expect(caretCell(lines, starts, 8)).toEqual({ line: 1, col: 2 });
    expect(caretCell(lines, starts, 99)).toEqual({ line: 1, col: 2 });
  });

  it("keeps the caret on the previous line while a dropped wrap space is typed", () => {
    expect(caretCell(["AB", "CD"], [0, 4], 3)).toEqual({ line: 0, col: 2 });
  });
});

describe("the opening", () => {
  it("lasts 35-45 seconds including typing, holds and cuts (PRD), with a second spare for rendering", () => {
    const total = openingDurationMs();
    expect(total).toBeGreaterThanOrEqual(35_000);
    expect(total).toBeLessThanOrEqual(44_000);
  });

  it("adds up typing, hold and cut for every card", () => {
    const manual = OPENING_CARDS.reduce((sum, card, index) => sum + typingDuration(card.text, cardSeed(index)) + card.hold + CUT_MS, 0);
    expect(openingDurationMs()).toBe(manual);
  });

  it("tells the story in order and ends on the title and a prompt", () => {
    expect(OPENING_CARDS[0].text).toBe("NOVEMBER 2.");
    expect(OPENING_CARDS.at(-1)).toMatchObject({ text: "THE LAST SIGNAL", title: true });
    expect(PROMPT).toBe("PRESS ANY KEY TO CONTINUE");
    expect(new Set(OPENING_CARDS.map((_, index) => cardSeed(index))).size).toBe(OPENING_CARDS.length);
  });
});
