import { typingDuration } from "@/libs/typing";

export interface OpeningCard {
  readonly text: string;
  /** How long the finished line stays on screen before the cut, in ms. */
  readonly hold: number;
  readonly title?: boolean;
}

/** The opening, typed one line at a time on black (PRD: 35-45 s in total). */
export const OPENING_CARDS: readonly OpeningCard[] = [
  { text: "NOVEMBER 2.", hold: 1_100 },
  { text: "FOURTEEN YEARS AGO, DR. INÉS VEGA BUILT A MACHINE.", hold: 1_100 },
  { text: "IT WAS DESIGNED TO PRESERVE THE VOICES OF THE DEAD.", hold: 1_100 },
  { text: "THEIR STORIES.", hold: 600 },
  { text: "THEIR MEMORIES.", hold: 600 },
  { text: "THEIR LAST WORDS.", hold: 900 },
  { text: "IT WAS NEVER MEANT TO SPEAK BACK.", hold: 1_500 },
  { text: "ON NOVEMBER 2, 2012, THE SYSTEM WAS SHUT DOWN.", hold: 1_000 },
  { text: "DR. VEGA WAS FOUND DEAD THE FOLLOWING MORNING.", hold: 1_200 },
  { text: "THE LABORATORY WAS SEALED.", hold: 800 },
  { text: "THE PROJECT WAS FORGOTTEN.", hold: 900 },
  { text: "UNTIL TONIGHT.", hold: 1_800 },
  { text: "THE LAST SIGNAL", hold: 2_800, title: true },
];

/** Black between two cards. */
export const CUT_MS = 380;

/** The last line, typed after the title; any key continues. */
export const PROMPT = "PRESS ANY KEY TO CONTINUE";

/** Each card has its own fixed rhythm, so the opening plays the same every time. */
export function cardSeed(index: number): number {
  return 1_031 + index * 7_919;
}

/** From the first key to the prompt: typing, hold and cut for every card. */
export function openingDurationMs(): number {
  return OPENING_CARDS.reduce((sum, card, index) => sum + typingDuration(card.text, cardSeed(index)) + card.hold + CUT_MS, 0);
}
