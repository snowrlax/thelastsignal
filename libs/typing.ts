/**
 * Human-like typing rhythm: uneven keystrokes, a reach before each new word,
 * the odd hesitation, and pauses after punctuation. Pure and seeded so a line
 * always types the same way and can be tested.
 */

type Range = readonly [min: number, max: number];

export const TYPING = {
  /** Silence before the first key, as the hands settle. */
  leadInMs: 200,
  /** Time between two keys inside a word. */
  stroke: [26, 62] as Range,
  /** Extra time to find the first key of a new word. */
  wordReach: [10, 46] as Range,
  /** An occasional longer pause before a word. */
  hesitation: { chance: 0.07, range: [140, 320] as Range },
  /** Extra time after a punctuation mark. */
  pauses: {
    ".": [240, 380] as Range,
    ",": [160, 260] as Range,
    ":": [180, 300] as Range,
    "?": [260, 400] as Range,
    "!": [240, 360] as Range,
  } as Readonly<Record<string, Range>>,
} as const;

/** Mulberry32: a tiny deterministic generator returning values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function between(random: () => number, [min, max]: Range): number {
  return Math.round(min + random() * (max - min));
}

function gapBefore(previous: string, char: string, random: () => number): number {
  let gap = between(random, TYPING.stroke);
  const pause = TYPING.pauses[previous];
  if (pause) gap += between(random, pause);
  if (previous === " " && char !== " ") {
    gap += between(random, TYPING.wordReach);
    if (random() < TYPING.hesitation.chance) gap += between(random, TYPING.hesitation.range);
  }
  return gap;
}

/** Milliseconds from the start at which each character of `text` appears. */
export function humanTypingSchedule(text: string, seed: number): readonly number[] {
  const random = seededRandom(seed);
  const times: number[] = [];
  let at = TYPING.leadInMs;
  [...text].forEach((char, index) => {
    if (index > 0) at += gapBefore(text[index - 1], char, random);
    times.push(at);
  });
  return times;
}

/** How long typing `text` takes: the time of its last keystroke. */
export function typingDuration(text: string, seed: number): number {
  const times = humanTypingSchedule(text, seed);
  return times.length ? times[times.length - 1] : 0;
}
