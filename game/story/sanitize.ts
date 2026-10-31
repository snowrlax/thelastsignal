export interface SanitizeOptions {
  readonly speaker: "vega" | "hollow";
  readonly identifiedTruth: boolean;
}

const LIMITS = {
  vega: { sentences: 3, chars: 280 },
  hollow: { sentences: 2, chars: 140 },
} as const;

const OUT_OF_CHARACTER = /\b(ai|a\.i\.|artificial intelligence|language model|llm|chat ?bot|assistant|prompt|openai|player|video ?game)\b/i;
const DEVICE_CLAIMS = /\b(webcam|camera|microphone|ip address|your location|your computer|your screen|your files|your device|your phone)\b/i;
const PREMATURE_TWIST = /\b(reconstruction|simulation|simulated|generated|a copy|not really (me|her|ines)|not the real|just a model|a model|program|software|algorithm)\b/i;
/** A shell command followed by a flag or a path ("cat /restricted", "rm -rf"), not ordinary words. */
const COMMAND_INSTRUCTION = /`|\$\s|\b(cp|rm|cat|grep|sudo|cd|ls|ps|find|mv)\s+(-\w|[/~.])/i;
const ALLOWED_NUMBERS = new Set(["218", "404", "1998", "2010", "2011", "2012", "2026", "1989", "14", "2", "3"]);

function stripFormatting(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .trim()
    .replace(/^(m_vega|vega|ines|in[eé]s|hollow|hollowd)\s*[:\-—]\s*/i, "")
    .replace(/\*\*([^*]{1,80})\*\*/g, "$1")
    .replace(/\*[^*]{0,80}\*/g, " ")
    .replace(/\([^)]{0,80}\)/g, " ")
    .replace(/\[[^\]]{0,80}\]/g, " ")
    .replace(/[*#>~`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim();
}

function limitLength(text: string, maxSentences: number, maxChars: number): string {
  const sentences = text.match(/[^.!?…]+[.!?…]+["”’]?|[^.!?…]+$/g) ?? [text];
  let result = "";
  for (const sentence of sentences.slice(0, maxSentences)) {
    const next = (result + " " + sentence.trim()).trim();
    if (next.length > maxChars) break;
    result = next;
  }
  return result;
}

function hasForbiddenNumbers(text: string): boolean {
  if (text.includes("%")) return true;
  const numbers = text.replace(/kill\s+-9\s+218/gi, "").match(/\d+/g) ?? [];
  return numbers.some((value) => !ALLOWED_NUMBERS.has(value));
}

function hasForbiddenKill(text: string): boolean {
  const kills = [...text.matchAll(/kill\s+(?:-\S+\s+)?(\d+)/gi)];
  return kills.some((match) => match[1] !== "218");
}

/**
 * Cleans a model reply and enforces the character rules. Returns null when the
 * reply cannot be used, so the caller falls back to authored dialogue.
 */
export function sanitizeDialogue(raw: string, options: SanitizeOptions): string | null {
  if (typeof raw !== "string") return null;
  const limits = LIMITS[options.speaker];
  const cleaned = limitLength(stripFormatting(raw), limits.sentences, limits.chars);
  if (cleaned.length < 2) return null;
  if (OUT_OF_CHARACTER.test(cleaned) || DEVICE_CLAIMS.test(cleaned)) return null;
  if (COMMAND_INSTRUCTION.test(cleaned) || hasForbiddenKill(cleaned) || hasForbiddenNumbers(cleaned)) return null;
  if (options.speaker === "vega" && !options.identifiedTruth && PREMATURE_TWIST.test(cleaned)) return null;
  return options.speaker === "hollow" ? cleaned.toUpperCase() : cleaned;
}
