import { sound } from "@/libs/audio";
import { fetchVoiceClip, voiceEnabled } from "@/libs/voiceClient";
import { decodeSpeech, startSpeaker, type Playback } from "@/libs/voiceOutput";

/**
 * Plays M_VEGA's lines through the terminal speaker. A line is spoken only if
 * its audio is ready within VOICE_DEADLINE_MS of the message appearing and no
 * newer message has appeared since: late audio is dropped, never queued.
 */

export const VOICE_DEADLINE_MS = 2_500;

export interface LinePlayerDeps<Clip> {
  /** False before the first gesture, while muted, or without Web Audio: then nothing is requested. */
  canPlay(): boolean;
  enabled(): Promise<boolean>;
  fetchClip(text: string, token: string | null, signal: AbortSignal): Promise<ArrayBuffer | null>;
  decode(bytes: ArrayBuffer): Promise<Clip | null>;
  start(clip: Clip): Playback | null;
}

export interface LinePlayer {
  /** Asks the server whether voice is on ahead of the first line, so that line is not late. */
  prepare(): void;
  /** Resolves true if the line started playing. Never throws. */
  speak(text: string, token: string | null): Promise<boolean>;
  /** A newer message appeared: anything not yet playing is now late. */
  supersede(): void;
  /** Waits for the current line (fetch and playback) to finish, at most `maxMs`. */
  untilQuiet(maxMs: number): Promise<void>;
  stop(): void;
}

export function createLinePlayer<Clip>(deps: LinePlayerDeps<Clip>, deadlineMs = VOICE_DEADLINE_MS): LinePlayer {
  let generation = 0;
  let pending: AbortController | null = null;
  let current: Playback | null = null;
  let activity: Promise<unknown> = Promise.resolve();

  const supersede = () => {
    generation += 1;
    pending?.abort();
    pending = null;
  };

  const load = async (text: string, token: string | null, signal: AbortSignal): Promise<Clip | null> => {
    if (!(await deps.enabled()) || signal.aborted) return null;
    const bytes = await deps.fetchClip(text, token, signal);
    if (!bytes || signal.aborted) return null;
    const clip = await deps.decode(bytes);
    return signal.aborted ? null : clip;
  };

  const play = (clip: Clip | null, line: number): boolean => {
    if (!clip || line !== generation || !deps.canPlay()) return false;
    current?.stop();
    current = deps.start(clip);
    return current !== null;
  };

  const speak = async (text: string, token: string | null): Promise<boolean> => {
    supersede();
    if (!deps.canPlay()) return false;
    const line = generation;
    const controller = new AbortController();
    pending = controller;
    const deadline = setTimeout(() => controller.abort(), deadlineMs);
    const task = load(text, token, controller.signal)
      .catch(() => null)
      .then((clip) => play(clip, line))
      .catch(() => false)
      .finally(() => clearTimeout(deadline));
    activity = task.then((started) => (started ? current?.done : undefined));
    return task;
  };

  const untilQuiet = (maxMs: number): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cap = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, maxMs);
    });
    const quiet = activity.then(
      () => undefined,
      () => undefined,
    );
    return Promise.race([quiet, cap]).finally(() => clearTimeout(timer));
  };

  const stop = () => {
    supersede();
    current?.stop();
    current = null;
  };

  const prepare = () => {
    if (deps.canPlay()) void deps.enabled().catch(() => false);
  };

  return { prepare, speak, supersede, untilQuiet, stop };
}

let player: LinePlayer | null = null;

/** The game's M_VEGA voice, wired to Web Audio and /api/voice. */
export function vegaVoice(): LinePlayer {
  player ??= createLinePlayer<AudioBuffer>({
    canPlay: () => sound().voiceBus() !== null && !sound().isMuted,
    enabled: voiceEnabled,
    fetchClip: fetchVoiceClip,
    decode: async (bytes) => {
      const bus = sound().voiceBus();
      return bus ? decodeSpeech(bus, bytes) : null;
    },
    start: (clip) => {
      const bus = sound().voiceBus();
      return bus ? startSpeaker(bus, clip) : null;
    },
  });
  return player;
}
