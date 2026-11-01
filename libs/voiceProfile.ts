/**
 * How OFRENDA sounds. Shared by the server route, the client and the
 * pre-render script (scripts/voice-recordings.mjs), so it holds no secrets.
 *
 * Ines's tapes and M_VEGA use the same ElevenLabs voice: the persona was
 * trained on those tapes ("voiceprint 99.1% synthesized from source").
 * The difference is in the settings. Ines breathes; M_VEGA is a little too
 * steady, a little too clean.
 */

export const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

/** The environment variables voice reads (process.env on the server). */
export type VoiceEnv = Readonly<Record<string, string | undefined>>;

/** "Matilda", an ElevenLabs premade voice: warm, adult, female. Override with ELEVENLABS_VOICE_ID. */
export const DEFAULT_VOICE_ID = "XrExE9yKIg1WjnnlVkGX";

/** Live M_VEGA lines: the low-latency model. Override with ELEVENLABS_MODEL_ID. */
export const DEFAULT_LIVE_MODEL = "eleven_flash_v2_5";

/** Pre-rendered tapes: the expressive model, which understands audio tags such as [laughs]. */
export const DEFAULT_RECORDING_MODEL = "eleven_v3";

/** Small and fast: it plays through a terminal speaker that cuts the highs anyway. */
export const LIVE_OUTPUT_FORMAT = "mp3_22050_32";
export const RECORDING_OUTPUT_FORMAT = "mp3_44100_64";
/** Kilobits per second of RECORDING_OUTPUT_FORMAT, used to estimate a tape's length without timestamps. */
export const RECORDING_KBPS = 64;

/** Longest line /api/voice will speak. M_VEGA's model lines are capped at 280 characters by the sanitizer. */
export const MAX_VOICE_TEXT = 320;

export interface VoiceSettings {
  readonly stability: number;
  readonly similarity_boost: number;
  readonly style?: number;
  readonly use_speaker_boost?: boolean;
  readonly speed?: number;
}

/** M_VEGA: nothing wavers. High stability, no style, a fraction slower than a person. */
export const PERSONA_SETTINGS: VoiceSettings = {
  stability: 0.9,
  similarity_boost: 0.95,
  style: 0,
  use_speaker_boost: true,
  speed: 0.94,
};

/** Ines on tape: natural delivery (Eleven v3 accepts stability 0, 0.5 or 1). */
export const TAPE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  use_speaker_boost: true,
};

const SPOKEN_FORMS: readonly (readonly [RegExp, string])[] = [
  [/\bkill -9\b/gi, "kill dash nine"],
  [/\bkill -TERM\b/gi, "kill dash term"],
  [/\b404\b/g, "four-oh-four"],
  [/\b218\b/g, "two-eighteen"],
];

/** How a line should be said: process numbers the way an operator would read them aloud. */
export function spokenForm(text: string): string {
  return SPOKEN_FORMS.reduce((spoken, [pattern, replacement]) => spoken.replace(pattern, replacement), text);
}

/** Models that read [laughs]-style audio tags; older models get SSML breaks instead. */
export function supportsAudioTags(modelId: string): boolean {
  return /^eleven_v[3-9]/.test(modelId);
}
