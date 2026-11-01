import type { OutputLine, RecordingId } from "@/game/types";
import { sound } from "@/libs/audio";
import { RECORDING_TAPES } from "@/libs/voiceManifest";
import { decodeSpeech, startTape, type Playback } from "@/libs/voiceOutput";
import { vegaVoice } from "@/libs/voicePlayer";
import { retimeTranscript, type RecordingTapes } from "@/libs/voiceText";

/**
 * Ines's pre-rendered tapes. They are fetched and decoded when the terminal
 * opens, so `play` never waits on the network: if a tape is ready, the
 * transcript is re-paced to it and the tape starts with the first line;
 * otherwise `play` behaves exactly as it always has.
 */

export interface TapeDeckDeps<Clip> {
  load(src: string): Promise<Clip | null>;
  start(clip: Clip): Playback | null;
}

export interface TapeDeck {
  preload(): void;
  /** Returns `play` output paced to the tape (or unchanged) and arms the tape to start with it. */
  arm(lines: readonly OutputLine[], id: RecordingId): readonly OutputLine[];
  /** Called for every printed line; starts the armed tape on its first transcript line. */
  printed(line: OutputLine): void;
  stop(): void;
}

export function createTapeDeck<Clip>(deps: TapeDeckDeps<Clip>, tapes: RecordingTapes = RECORDING_TAPES): TapeDeck {
  const ready = new Map<RecordingId, Clip>();
  const loading = new Set<RecordingId>();
  let armed: { readonly line: OutputLine; readonly clip: Clip } | null = null;
  let playing: Playback | null = null;

  const load = async (id: RecordingId, src: string) => {
    loading.add(id);
    try {
      const clip = await deps.load(src);
      if (clip) ready.set(id, clip);
    } catch {
      /* a missing tape just means no audio */
    } finally {
      loading.delete(id);
    }
  };

  const preload = () => {
    for (const [id, tape] of Object.entries(tapes) as [RecordingId, NonNullable<RecordingTapes[RecordingId]>][]) {
      if (!ready.has(id) && !loading.has(id)) void load(id, tape.src);
    }
  };

  const arm = (lines: readonly OutputLine[], id: RecordingId): readonly OutputLine[] => {
    const tape = tapes[id];
    const clip = ready.get(id);
    if (!tape || !clip) {
      preload();
      return lines;
    }
    const retimed = retimeTranscript(lines, tape);
    if (!retimed) return lines;
    armed = { line: retimed.first, clip };
    return retimed.lines;
  };

  const printed = (line: OutputLine) => {
    if (!armed || line !== armed.line) return;
    const { clip } = armed;
    armed = null;
    playing?.stop();
    playing = deps.start(clip);
  };

  const stop = () => {
    armed = null;
    playing?.stop();
    playing = null;
  };

  return { preload, arm, printed, stop };
}

async function loadTape(src: string): Promise<AudioBuffer | null> {
  const bus = sound().voiceBus();
  if (!bus) return null;
  const response = await fetch(src);
  if (!response.ok) return null;
  return decodeSpeech(bus, await response.arrayBuffer());
}

let deck: TapeDeck | null = null;

/** The game's tape deck, wired to Web Audio and the files in public/voice. */
export function tapeDeck(): TapeDeck {
  deck ??= createTapeDeck<AudioBuffer>({
    load: loadTape,
    start: (clip) => {
      // Nobody talks over Ines: the tape silences M_VEGA.
      vegaVoice().stop();
      const bus = sound().voiceBus();
      return bus ? startTape(bus, clip) : null;
    },
  });
  return deck;
}
