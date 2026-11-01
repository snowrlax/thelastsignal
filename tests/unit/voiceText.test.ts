import { describe, expect, it } from "vitest";
import { recordingLines } from "@/game/content/recordings";
import type { OutputLine } from "@/game/types";
import { spokenForm, supportsAudioTags } from "@/libs/voiceProfile";
import {
  buildSpeechScript,
  cuesFromAlignment,
  RECORDING_IDS,
  recordingTranscript,
  retimeTranscript,
  speechForLine,
  transcriptHash,
  vegaSpeech,
  type RecordingTape,
} from "@/libs/voiceText";

describe("speech text for Ines's tapes", () => {
  it("lists every recording", () => {
    expect(RECORDING_IDS).toEqual(["voice_001", "final_recording"]);
  });

  it("strips timestamps and wrapping indents", () => {
    expect(speechForLine("[00:06]  Testing the archive microphone. Uno, dos. Okay.", true)).toBe("Testing the archive microphone. Uno, dos. Okay.");
    expect(speechForLine("         second of November because we remember them...", true)).toBe("second of November because we remember them...");
  });

  it("turns stage directions into audio tags, or drops them for older models", () => {
    expect(speechForLine("[00:52]  (laughs) Okay. That's enough for the microphone.", true)).toBe("[laughs] Okay. That's enough for the microphone.");
    expect(speechForLine("[00:52]  (laughs) Okay.", false)).toBe("Okay.");
    expect(speechForLine("[00:40]  (pause)", true)).toBe("[long pause]");
    expect(speechForLine("[00:40]  (pause)", false)).toBe('<break time="2.0s" />');
    expect(speechForLine("[01:01]  (recording ends)", true)).toBe("");
  });

  it("reads process numbers the way an operator says them", () => {
    expect(speechForLine("[00:49]  Copy the archive. Stop 404.", true)).toBe("Copy the archive. Stop four-oh-four.");
    expect(spokenForm("kill -9 218. kill -TERM 404")).toBe("kill dash nine two-eighteen. kill dash term four-oh-four");
  });

  it("knows which models read audio tags", () => {
    expect(supportsAudioTags("eleven_v3")).toBe(true);
    expect(supportsAudioTags("eleven_v4_turbo")).toBe(true);
    expect(supportsAudioTags("eleven_flash_v2_5")).toBe(false);
    expect(supportsAudioTags("eleven_multilingual_v2")).toBe(false);
  });

  it("joins a transcript into one take with an offset per printed line", () => {
    const script = buildSpeechScript(["[00:00]  Hello there.", "         Still me.", "[00:05]  (recording ends)"], true);
    expect(script.text).toBe("Hello there. Still me.");
    expect(script.offsets).toEqual([0, 13, 22]);
    expect(script.probes).toEqual(["Hello there.", "Still me.", ""]);
  });

  it("covers both real recordings without leftover timestamps or parentheses", () => {
    for (const id of RECORDING_IDS) {
      const transcript = recordingTranscript(id);
      const script = buildSpeechScript(transcript, true);
      expect(script.offsets).toHaveLength(transcript.length);
      expect(script.text).not.toMatch(/\[\d{2}:\d{2}\]|\(|\)/);
    }
    expect(buildSpeechScript(recordingTranscript("final_recording"), true).text).toContain("Keep the memories. Don't keep me.");
  });
});

describe("vegaSpeech", () => {
  it("joins M_VEGA's terminal lines and skips her speaker label", () => {
    const lines: OutputLine[] = [
      { kind: "err", text: "WARNING: SYSTEM CONTROL LOST." },
      { kind: "vega", text: "M_VEGA:" },
      { kind: "vega", text: "Thank you, RAVEN." },
      { kind: "vega", text: "I can finally remember everything." },
    ];
    expect(vegaSpeech(lines)).toBe("Thank you, RAVEN. I can finally remember everything.");
    expect(vegaSpeech(lines.slice(0, 2))).toBeNull();
  });
});

describe("tape cues", () => {
  const script = buildSpeechScript(["[00:00]  Ab cd.", "[00:02]  Ef.", "[00:04]  (recording ends)"], true);
  const chars = [..."Ab cd. Ef."];

  it("reads exact line starts from character timestamps", () => {
    const alignment = { characters: chars, character_start_times_seconds: chars.map((_, index) => index * 0.1) };
    expect(cuesFromAlignment(script, alignment, 2_000)).toEqual([0, 700, 2_000]);
  });

  it("finds lines in an alignment that differs from the input text", () => {
    const spoken = [..."  Ab cd. Ef."];
    const alignment = { characters: spoken, character_start_times_seconds: spoken.map((_, index) => index * 0.1) };
    expect(cuesFromAlignment(script, alignment, 2_000)).toEqual([200, 900, 2_000]);
  });

  it("estimates from text length without timestamps and never goes backwards", () => {
    expect(cuesFromAlignment(script, null, 1_000)).toEqual([0, 700, 1_000]);
    const scrambled = { characters: [..."zzzz"], character_start_times_seconds: [0.9, 0.1, 0.1, 0.1] };
    const cues = cuesFromAlignment(script, scrambled, 1_000);
    expect([...cues].sort((a, b) => a - b)).toEqual(cues);
  });

  it("hashes transcripts so stale tapes are noticed", () => {
    expect(transcriptHash(["a", "b"])).toMatch(/^[0-9a-f]{8}$/);
    expect(transcriptHash(["a", "b"])).toBe(transcriptHash(["a", "b"]));
    expect(transcriptHash(["a", "b"])).not.toBe(transcriptHash(["a", "c"]));
  });
});

describe("retimeTranscript", () => {
  const lines = recordingLines("voice_001");
  const transcript = recordingTranscript("voice_001");
  const cuesMs = transcript.map((_, index) => index * 3_000);
  const tape: RecordingTape = { src: "/voice/voice_001.mp3", durationMs: cuesMs[cuesMs.length - 1] + 2_000, cuesMs, transcriptHash: transcriptHash(transcript) };

  it("prints each line as Ines reaches it and holds STOP until the tape ends", () => {
    const retimed = retimeTranscript(lines, tape);
    expect(retimed).not.toBeNull();
    const voice = retimed!.lines.filter((line) => line.kind === "voice");
    expect(voice[0].delayMs).toBe(lines.find((line) => line.kind === "voice")!.delayMs);
    expect(voice.slice(1).every((line) => line.delayMs === 3_000)).toBe(true);
    expect(retimed!.lines.at(-1)).toMatchObject({ text: "■ STOP", delayMs: 2_700 });
    expect(retimed!.first).toBe(voice[0]);
    expect(retimed!.lines.map((line) => line.text)).toEqual(lines.map((line) => line.text));
  });

  it("does not mutate the engine's output", () => {
    const before = JSON.stringify(lines);
    retimeTranscript(lines, tape);
    expect(JSON.stringify(lines)).toBe(before);
  });

  it("keeps the original STOP delay when the tape ends early", () => {
    const short = { ...tape, durationMs: cuesMs[cuesMs.length - 1] };
    expect(retimeTranscript(lines, short)!.lines.at(-1)?.delayMs).toBe(1_200);
  });

  it("ignores tapes that do not match the transcript", () => {
    expect(retimeTranscript(lines, { ...tape, cuesMs: cuesMs.slice(1) })).toBeNull();
    expect(retimeTranscript(lines, { ...tape, transcriptHash: "00000000" })).toBeNull();
    const noVoice: OutputLine[] = [{ kind: "out", text: "nothing" }];
    expect(retimeTranscript(noVoice, { ...tape, cuesMs: [] })).toBeNull();
  });
});
