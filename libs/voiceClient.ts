/**
 * Client side of /api/voice. Nothing here throws, and when the server has no
 * ElevenLabs key the client finds out once and never asks again.
 */

const VOICE_ENDPOINT = "/api/voice";
const PROBE_TIMEOUT_MS = 4_000;

let enabled: Promise<boolean> | null = null;

async function probe(): Promise<boolean> {
  try {
    const response = await fetch(VOICE_ENDPOINT, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!response.ok) return false;
    const json = (await response.json()) as { success?: unknown; data?: { enabled?: unknown } };
    return json.success === true && json.data?.enabled === true;
  } catch {
    return false;
  }
}

/** Whether the server can speak. Asked once per page load. */
export function voiceEnabled(): Promise<boolean> {
  enabled ??= probe();
  return enabled;
}

/** Test seam: forget what the server said. */
export function resetVoiceProbe(): void {
  enabled = null;
}

async function errorCode(response: Response): Promise<string | null> {
  try {
    const json = (await response.json()) as { error?: unknown };
    return typeof json.error === "string" ? json.error : null;
  } catch {
    return null;
  }
}

/** mp3 bytes for one M_VEGA line, or null. `token` is the signature /api/dialogue gave a model line. */
export async function fetchVoiceClip(text: string, token: string | null, signal: AbortSignal): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(VOICE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { text, token } : { text }),
      signal,
    });
    if (!response.ok) {
      if (response.status === 503 && (await errorCode(response)) === "disabled") enabled = Promise.resolve(false);
      return null;
    }
    if (!response.headers.get("content-type")?.startsWith("audio/")) return null;
    const bytes = await response.arrayBuffer();
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
}
