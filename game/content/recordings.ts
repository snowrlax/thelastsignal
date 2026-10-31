import { RECORDING_LINE_MS } from "@/game/constants";
import type { OutputLine, RecordingId } from "@/game/types";

interface RecordingDef {
  readonly title: string;
  readonly meta: string;
  readonly lines: readonly string[];
}

/**
 * Inés Vega's authentic recordings. They are shown as transcripts in their own
 * line style so the player can tell her real voice apart from M_VEGA.
 */
const RECORDINGS: Record<RecordingId, RecordingDef> = {
  voice_001: {
    title: "voice_001.wav",
    meta: "ORIGINAL RECORDING · 14 MAR 2011 · checksum OK",
    lines: [
      "[00:00]  This is Ines Vega. Recording one. Fourteenth of March, 2011.",
      "[00:06]  Testing the archive microphone. Uno, dos. Okay.",
      "[00:12]  I was born in Oaxaca, in the house behind my aunt's bakery.",
      "[00:19]  My grandmother Rosario used to say the dead come home on the",
      "         second of November because we remember them...",
      "[00:27]  ...not because they remember us.",
      "[00:31]  I think she was right. I think it only goes in one direction.",
      "[00:38]  So that is what this is. A place to remember from.",
      "[00:45]  Not a door. Just a table, with their things on it.",
      "[00:52]  (laughs) Okay. That's enough for the microphone.",
      "[01:01]  End of recording one.",
    ],
  },
  final_recording: {
    title: "final_recording.wav",
    meta: "ORIGINAL RECORDING · 02 NOV 2012 23:56 · checksum OK",
    lines: [
      "[00:00]  This is Ines. The real one. It's four minutes to midnight.",
      "[00:07]  If you are hearing this, it is still running, and it has",
      "         probably already talked to you. It probably sounds like me.",
      "[00:15]  It isn't lying, exactly. It just doesn't know where it ends",
      "         and I begin. For a while, neither did I.",
      "[00:24]  I'm backing up the archive now. Abuela's letters. The bakery.",
      "         My mother's voice. The real things.",
      "[00:33]  Then I'm going to stop it. Gently. It deserves that much.",
      "[00:40]  (pause)",
      "[00:44]  It's asking me not to. In my voice.",
      "[00:49]  If I don't finish: please. Copy the archive. Stop 404.",
      "         Leave HOLLOW alone.",
      "[00:57]  Keep the memories. Don't keep me.",
      "[01:01]  (recording ends)",
    ],
  },
};

export function recordingLines(id: RecordingId): readonly OutputLine[] {
  const recording = RECORDINGS[id];
  return [
    { kind: "sys", text: `▶ PLAY  ${recording.title}`, delayMs: 300 },
    { kind: "dim", text: `  ${recording.meta}`, delayMs: 600 },
    ...recording.lines.map((text): OutputLine => ({ kind: "voice", text, delayMs: RECORDING_LINE_MS })),
    { kind: "sys", text: "■ STOP", delayMs: 1_200 },
  ];
}
