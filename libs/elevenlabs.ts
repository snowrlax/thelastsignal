import "server-only";
import {
  DEFAULT_LIVE_MODEL,
  DEFAULT_VOICE_ID,
  ELEVENLABS_API,
  LIVE_OUTPUT_FORMAT,
  PERSONA_SETTINGS,
  spokenForm,
  type VoiceEnv,
  type VoiceSettings,
} from "@/libs/voiceProfile";

export interface VoiceConfig {
  readonly apiKey: string;
  readonly voiceId: string;
  readonly modelId: string;
}

export interface SpeechOptions {
  readonly timeoutMs?: number;
  readonly settings?: VoiceSettings;
}

const DEFAULT_TIMEOUT_MS = 4_000;
/** Both end up in the request URL or body, so only plain identifiers are accepted. */
const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;
const MODEL_ID = /^[a-z0-9_]{3,48}$/;

/** Null when voice is off: no key, or an identifier that is not one. */
export function voiceConfig(env: VoiceEnv = process.env): VoiceConfig | null {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;
  const voiceId = env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_LIVE_MODEL;
  if (!VOICE_ID.test(voiceId) || !MODEL_ID.test(modelId)) {
    console.error("[elevenlabs] ELEVENLABS_VOICE_ID or ELEVENLABS_MODEL_ID is malformed; voice is off");
    return null;
  }
  return { apiKey, voiceId, modelId };
}

export const DEFAULT_DAILY_LINE_LIMIT = 1_500;

/** Lines synthesized per day across all players (VOICE_DAILY_LINE_LIMIT), the last guard on credits. */
export function dailyLineLimit(env: VoiceEnv = process.env): number {
  const parsed = Number(env.VOICE_DAILY_LINE_LIMIT?.trim() || DEFAULT_DAILY_LINE_LIMIT);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : DEFAULT_DAILY_LINE_LIMIT;
}

/**
 * One line of M_VEGA as mp3. Never throws: any failure returns null and the
 * line simply stays silent.
 */
export async function synthesizeSpeech(config: VoiceConfig, text: string, options: SpeechOptions = {}): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(`${ELEVENLABS_API}/text-to-speech/${config.voiceId}?output_format=${LIVE_OUTPUT_FORMAT}`, {
      method: "POST",
      headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: spokenForm(text), model_id: config.modelId, voice_settings: options.settings ?? PERSONA_SETTINGS }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[elevenlabs] text-to-speech responded ${response.status}`);
      return null;
    }
    const audio = await response.arrayBuffer();
    return audio.byteLength > 0 ? audio : null;
  } catch (error) {
    console.error(`[elevenlabs] text-to-speech failed: ${error instanceof Error ? error.name : "unknown error"}`);
    return null;
  }
}
