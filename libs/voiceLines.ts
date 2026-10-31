import { sanitizeCallsign } from "@/game/engine";
import { badEndingLines } from "@/game/story/endings";
import { resolveLines, TRIGGERS, type TriggerContext } from "@/game/story/triggers";
import { EVIDENCE_FLAGS, PHASES, type Evidence, type Phase } from "@/game/types";
import { vegaSpeech } from "@/libs/voiceText";

/**
 * Authored M_VEGA lines are chosen on the client, so /api/voice verifies them
 * against the script instead of a token. The only free slot is the callsign,
 * and it must be a callsign the game itself would produce.
 */

const NAME_SLOT = "{name}";

function contextFor(phase: Phase, identifiedTruth: boolean): TriggerContext {
  const evidence = Object.fromEntries(EVIDENCE_FLAGS.map((flag) => [flag, flag === "identified_truth" && identifiedTruth])) as unknown as Evidence;
  return {
    phase,
    evidence,
    system: {
      hollowRunning: true,
      personaRunning: true,
      archiveCopied: false,
      recoveryName: null,
      recoveryUnlocked: false,
      containment: "active",
      breach: false,
    },
  };
}

/** Every context a line can depend on (phase and whether the truth is known). */
const CONTEXTS = PHASES.flatMap((phase) => [contextFor(phase, false), contextFor(phase, true)]);

/** What M_VEGA says when she takes the terminal over (the same for every cause). */
const TAKEOVER = vegaSpeech(badEndingLines(NAME_SLOT, "timeout"));

/** Every authored M_VEGA template, with `{name}` still in place. */
export const AUTHORED_VEGA_LINES: readonly string[] = [
  ...new Set([
    ...Object.values(TRIGGERS)
      .flatMap((templates) => templates ?? [])
      .filter((template) => template.speaker === "vega")
      .flatMap((template) => CONTEXTS.flatMap((ctx) => resolveLines(template, ctx))),
    ...(TAKEOVER ? [TAKEOVER] : []),
  ]),
];

/** True when `text` is `template` with every `{name}` replaced by the same sanitized callsign. */
export function matchesTemplate(template: string, text: string): boolean {
  const parts = template.split(NAME_SLOT);
  if (parts.length === 1) return template === text;
  const fixedLength = parts.reduce((sum, part) => sum + part.length, 0);
  const nameLength = (text.length - fixedLength) / (parts.length - 1);
  if (!Number.isInteger(nameLength) || nameLength < 1) return false;
  const name = text.slice(parts[0].length, parts[0].length + nameLength);
  return sanitizeCallsign(name) === name && parts.join(name) === text;
}

export function isAuthoredVegaLine(text: string): boolean {
  return AUTHORED_VEGA_LINES.some((template) => matchesTemplate(template, text));
}
