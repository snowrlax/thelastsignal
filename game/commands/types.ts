import type { Effect, GameState, OutputLine, StoryEvent } from "@/game/types";

export interface CommandInput {
  readonly state: GameState;
  readonly name: string;
  readonly args: readonly string[];
  readonly raw: string;
}

export interface CommandOutcome {
  readonly state?: GameState;
  readonly lines?: readonly OutputLine[];
  readonly events?: readonly StoryEvent[];
  readonly effects?: readonly Effect[];
  /** A harmless mistake (bad argument, missing file). Counts toward hints, never penalized. */
  readonly error?: boolean;
}

export type CommandHandler = (input: CommandInput) => CommandOutcome;

export interface CommandSpec {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly usage: string;
  readonly summary: string;
  readonly handler: CommandHandler;
  /** Hidden commands work but are not listed by help or tab completion. */
  readonly hidden?: boolean;
}
