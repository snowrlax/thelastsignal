import { z } from "zod";
import { MAX_NAME_LENGTH, MAX_REPLY_LENGTH } from "@/game/constants";
import { EVIDENCE_FLAGS, PHASES, STORY_EVENTS } from "@/game/types";

export const MAX_RECENT_MESSAGES = 8;
export const MAX_RECENT_TEXT = 300;

/** Request body for POST /api/dialogue. The model never sees free-form prompt text from the client. */
export const dialogueRequestSchema = z.object({
  speaker: z.enum(["vega", "hollow"]),
  event: z.enum(STORY_EVENTS),
  playerName: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  phase: z.enum(PHASES),
  evidence: z.array(z.enum(EVIDENCE_FLAGS)).max(EVIDENCE_FLAGS.length),
  system: z.object({
    archiveCopied: z.boolean(),
    hollowRunning: z.boolean(),
    personaRunning: z.boolean(),
  }),
  remainingSeconds: z.number().int().min(0).max(3_600).nullable(),
  recent: z
    .array(z.object({ speaker: z.enum(["vega", "hollow", "player"]), text: z.string().max(MAX_RECENT_TEXT) }))
    .max(MAX_RECENT_MESSAGES),
  playerMessage: z.string().trim().min(1).max(MAX_REPLY_LENGTH).optional(),
  /** Opaque per-playthrough id, used only to group traces into one conversation. */
  runId: z.string().regex(/^[a-z0-9-]{8,64}$/i).optional(),
});

export type DialogueRequest = z.infer<typeof dialogueRequestSchema>;

/** Fewest evidence flags with which recovery can be unlocked (3 archive + 2 process + containment + truth). */
const MIN_EVIDENCE_TO_PRESERVE = 7;

export const runRecordSchema = z
  .object({
  ending: z.enum(["preserved", "lost"]),
  cause: z.enum(["hollow_killed", "timeout", "destructive"]).nullable(),
  durationMs: z.number().int().min(0).max(4 * 3_600_000),
  reducedPressure: z.boolean(),
  evidenceCount: z.number().int().min(0).max(EVIDENCE_FLAGS.length),
  commandsRun: z.number().int().min(0).max(10_000),
  hintsShown: z.number().int().min(0).max(10_000),
  phaseReached: z.enum(PHASES),
  aiLines: z.number().int().min(0).max(10_000),
  })
  .refine((run) => (run.ending === "preserved" ? run.cause === null : run.cause !== null), "cause must match ending")
  .refine(
    (run) => run.ending !== "preserved" || (run.phaseReached === "recovery" && run.evidenceCount >= MIN_EVIDENCE_TO_PRESERVE && run.commandsRun >= 2),
    "a preserved archive requires the recovery phase",
  )
  .refine((run) => run.phaseReached !== "prologue" && run.phaseReached !== "ended", "runs end inside a timed phase")
  .refine((run) => run.cause !== "hollow_killed" || run.commandsRun >= 1, "killing HOLLOW takes a command");

export type RunRecord = z.infer<typeof runRecordSchema>;

export interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}
