import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { VoiceEnv } from "@/libs/voiceProfile";

/**
 * Model lines are written by the server, so the server signs them: /api/voice
 * only speaks a model line that comes back with its token. Without this the
 * route would be a free text-to-speech proxy on the owner's ElevenLabs credits.
 */

export type VoicedSpeaker = "vega";

/** base64url of a SHA-256 MAC. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function signingSecret(env: VoiceEnv): string | null {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;
  const explicit = env.VOICE_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  return createHash("sha256").update(`the-last-signal/voice-token/${apiKey}`).digest("hex");
}

function mac(secret: string, speaker: VoicedSpeaker, text: string): Buffer {
  return createHmac("sha256", secret).update(`${speaker}|${text}`).digest();
}

/** Null when voice is off: there is nothing to sign for. */
export function signVoiceLine(speaker: VoicedSpeaker, text: string, env: VoiceEnv = process.env): string | null {
  const secret = signingSecret(env);
  return secret ? mac(secret, speaker, text).toString("base64url") : null;
}

export function verifyVoiceLine(speaker: VoicedSpeaker, text: string, token: string, env: VoiceEnv = process.env): boolean {
  const secret = signingSecret(env);
  if (!secret || !TOKEN.test(token)) return false;
  const expected = mac(secret, speaker, text);
  const given = Buffer.from(token, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
