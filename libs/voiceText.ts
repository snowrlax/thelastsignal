import { recordingLines } from "@/game/content/recordings";
import type { OutputLine, RecordingId } from "@/game/types";
import { spokenForm } from "@/libs/voiceProfile";

/**
 * Pure text work for Ines's tapes, shared by the pre-render script and the
 * client: transcript → speech text, ElevenLabs timestamps → per-line cues,
 * and cues → printer delays so the transcript scrolls with her voice.
 */

/** A pre-rendered tape, as written to libs/voiceManifest.ts by the render script. */
export interface RecordingTape {
  readonly src: string;
  readonly durationMs: number;
  /** When each transcript line starts in the audio, one per `voice` line. */
  readonly cuesMs: readonly number[];
  /** Hash of the transcript the tape was rendered from; a stale tape is ignored. */
  readonly transcriptHash: string;
}

export type RecordingTapes = Readonly<Partial<Record<RecordingId, RecordingTape>>>;

export interface SpeechScript {
  /** The text sent to ElevenLabs. */
  readonly text: string;
  /** Where each transcript line's speech starts in `text` (text.length when the line is silent). */
  readonly offsets: readonly number[];
  /** Each line's spoken words without audio tags, used to find it in the alignment. */
  readonly probes: readonly string[];
}

export interface Alignment {
  readonly characters: readonly string[];
  readonly character_start_times_seconds: readonly number[];
}

const RECORDING_SET = { voice_001: true, final_recording: true } satisfies Record<RecordingId, true>;
export const RECORDING_IDS = Object.keys(RECORDING_SET) as RecordingId[];

const TIMESTAMP = /^\s*\[\d{2}:\d{2}\]\s*/;
const DIRECTION = /\(([^()]{1,40})\)/g;
const AUDIO_TAG = /\[[^\]]*\]|<[^>]*>/g;
/** Printed after the tape ends, before "■ STOP". */
const STOP_TAIL_MS = 700;

/** M_VEGA's words in a block of terminal output (the takeover), as one line. Speaker labels are skipped. */
export function vegaSpeech(lines: readonly OutputLine[]): string | null {
  const spoken = lines.filter((line) => line.kind === "vega" && line.text.trim() !== "" && !line.text.trim().endsWith(":"));
  return spoken.length > 0 ? spoken.map((line) => line.text.trim()).join(" ") : null;
}

/** The transcript lines exactly as `play` prints them. */
export function recordingTranscript(id: RecordingId): string[] {
  return recordingLines(id)
    .filter((line) => line.kind === "voice")
    .map((line) => line.text);
}

function direction(raw: string, tags: boolean): string {
  const cue = raw.trim().toLowerCase();
  if (cue === "recording ends" || cue === "end of tape") return "";
  if (cue === "pause") return tags ? "[long pause]" : '<break time="2.0s" />';
  return tags ? `[${cue}]` : "";
}

/** One transcript line as speech: no timestamp, no wrapping indent, stage directions as tags or pauses. */
export function speechForLine(line: string, tags: boolean): string {
  const spoken = line
    .replace(TIMESTAMP, "")
    .replace(DIRECTION, (_, raw: string) => direction(raw, tags))
    .replace(/\s+/g, " ")
    .trim();
  return spokenForm(spoken);
}

function probeFor(speech: string): string {
  return speech.replace(AUDIO_TAG, " ").replace(/\s+/g, " ").trim().slice(0, 14);
}

/** Joins a transcript into one take, remembering where each printed line begins. */
export function buildSpeechScript(transcript: readonly string[], tags: boolean): SpeechScript {
  return transcript.reduce<SpeechScript>(
    (script, line) => {
      const speech = speechForLine(line, tags);
      if (!speech) return { ...script, offsets: [...script.offsets, script.text.length], probes: [...script.probes, ""] };
      const text = script.text ? `${script.text} ${speech}` : speech;
      return { text, offsets: [...script.offsets, text.length - speech.length], probes: [...script.probes, probeFor(speech)] };
    },
    { text: "", offsets: [], probes: [] },
  );
}

function alignedTime(script: SpeechScript, alignment: Alignment, index: number, from: number): { ms: number; at: number } | null {
  const offset = script.offsets[index];
  const spoken = alignment.characters.join("");
  if (spoken === script.text && offset < alignment.character_start_times_seconds.length) {
    return { ms: alignment.character_start_times_seconds[offset] * 1000, at: offset };
  }
  const probe = script.probes[index];
  const at = probe ? spoken.indexOf(probe, from) : -1;
  return at >= 0 ? { ms: alignment.character_start_times_seconds[at] * 1000, at } : null;
}

/**
 * Turns ElevenLabs character timestamps into one cue per transcript line.
 * Lines that cannot be found fall back to their share of the text.
 */
export function cuesFromAlignment(script: SpeechScript, alignment: Alignment | null, durationMs: number): number[] {
  const length = Math.max(1, script.text.length);
  return script.offsets.reduce<{ readonly cues: number[]; readonly from: number }>(
    ({ cues, from }, offset, index) => {
      const silent = offset >= script.text.length;
      const found = silent || !alignment ? null : alignedTime(script, alignment, index, from);
      const estimate = silent ? durationMs : (offset / length) * durationMs;
      const previous = cues.length > 0 ? cues[cues.length - 1] : 0;
      const cue = Math.round(Math.min(durationMs, Math.max(previous, found ? found.ms : estimate)));
      return { cues: [...cues, cue], from: found ? found.at + 1 : from };
    },
    { cues: [], from: 0 },
  ).cues;
}

/** FNV-1a: enough to notice that a transcript changed after its tape was rendered. */
export function transcriptHash(lines: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const char of lines.join("\n")) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface RetimedRecording {
  readonly lines: OutputLine[];
  /** The first transcript line: the tape starts the moment it prints. */
  readonly first: OutputLine;
}

/**
 * Re-paces `play` output to its tape: each transcript line prints as Ines
 * reaches it, and "■ STOP" waits for the tape to run out. Returns null when the
 * tape does not match the transcript, so the caller keeps today's pacing.
 */
export function retimeTranscript(lines: readonly OutputLine[], tape: RecordingTape): RetimedRecording | null {
  const voiceIndexes = lines.flatMap((line, index) => (line.kind === "voice" ? [index] : []));
  if (voiceIndexes.length === 0 || voiceIndexes.length !== tape.cuesMs.length) return null;
  if (transcriptHash(voiceIndexes.map((index) => lines[index].text)) !== tape.transcriptHash) return null;

  const lastCue = tape.cuesMs[tape.cuesMs.length - 1];
  const afterVoice = voiceIndexes[voiceIndexes.length - 1] + 1;
  const retimed = lines.map((line, index): OutputLine => {
    const voice = voiceIndexes.indexOf(index);
    if (voice === 0) return { ...line };
    if (voice > 0) return { ...line, delayMs: Math.max(0, Math.round(tape.cuesMs[voice] - tape.cuesMs[voice - 1])) };
    if (index === afterVoice) return { ...line, delayMs: Math.max(line.delayMs ?? 0, Math.round(tape.durationMs - lastCue) + STOP_TAIL_MS) };
    return line;
  });
  return { lines: retimed, first: retimed[voiceIndexes[0]] };
}
