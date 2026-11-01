import type { VoiceBus } from "@/libs/audio";

/**
 * Web Audio graphs for recorded speech. M_VEGA comes through the terminal's
 * small speaker; Ines comes off an old tape. Everything routes into the
 * master bus from libs/audio.ts, so the mute toggle applies, and nothing here
 * may throw into the game.
 */

export interface Playback {
  /** Resolves when the clip ends or is stopped. */
  readonly done: Promise<void>;
  stop(): void;
}

const FADE_IN_S = 0.03;
const FADE_OUT_S = 0.12;

/** Decodes mp3 bytes with the game's context. Null on bad data or a closed context. */
export async function decodeSpeech(bus: VoiceBus, bytes: ArrayBuffer): Promise<AudioBuffer | null> {
  try {
    return await bus.ctx.decodeAudioData(bytes.slice(0));
  } catch {
    return null;
  }
}

function biquad(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7, gain = 0): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  node.gain.value = gain;
  return node;
}

function saturator(ctx: AudioContext, drive: number): WaveShaperNode {
  const node = ctx.createWaveShaper();
  const curve = new Float32Array(1_024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  node.curve = curve;
  return node;
}

function connectAll(nodes: readonly AudioNode[]): void {
  nodes.slice(1).forEach((node, index) => nodes[index].connect(node));
}

interface Graph {
  readonly input: AudioNode;
  readonly output: GainNode;
  /** Extra sources (hiss, wow) that start and stop with the clip. */
  readonly extras: readonly AudioScheduledSourceNode[];
}

function play(bus: VoiceBus, buffer: AudioBuffer, level: number, build: (source: AudioBufferSourceNode) => Graph): Playback | null {
  try {
    const { ctx } = bus;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const graph = build(source);
    source.connect(graph.input);
    graph.output.connect(bus.destination);

    const start = ctx.currentTime + 0.02;
    graph.output.gain.setValueAtTime(0.0001, start);
    graph.output.gain.exponentialRampToValueAtTime(level, start + FADE_IN_S);
    graph.extras.forEach((extra) => extra.start(start));
    source.start(start);

    let finish: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const release = () => {
      graph.extras.forEach((extra) => {
        try {
          extra.stop();
        } catch {
          /* already stopped */
        }
      });
      finish();
    };
    source.onended = release;
    return {
      done,
      stop: () => {
        try {
          graph.output.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_OUT_S / 3);
          source.stop(ctx.currentTime + FADE_OUT_S);
        } catch {
          release();
        }
      },
    };
  } catch {
    return null;
  }
}

/** M_VEGA: a small cone behind the bezel. Band-limited, boxy, gently compressed. */
export function startSpeaker(bus: VoiceBus, buffer: AudioBuffer): Playback | null {
  return play(bus, buffer, 0.6, () => {
    const { ctx } = bus;
    const highpass = biquad(ctx, "highpass", 340);
    const cone = biquad(ctx, "peaking", 1_900, 1.1, 5);
    const lowpass = biquad(ctx, "lowpass", 4_300, 0.9);
    const drive = saturator(ctx, 1.6);
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.ratio.value = 4;
    const output = ctx.createGain();
    connectAll([highpass, cone, lowpass, drive, compressor, output]);
    // The cabinet: a few milliseconds of reflection off the inside of the case.
    const box = ctx.createDelay(0.05);
    box.delayTime.value = 0.009;
    const boxLevel = ctx.createGain();
    boxLevel.gain.value = 0.22;
    connectAll([lowpass, box, boxLevel, compressor]);
    return { input: highpass, output, extras: [] };
  });
}

function tapeHiss(bus: VoiceBus, output: GainNode): AudioBufferSourceNode[] {
  if (!bus.noise) return [];
  const { ctx } = bus;
  const hiss = ctx.createBufferSource();
  hiss.buffer = bus.noise;
  hiss.loop = true;
  const level = ctx.createGain();
  level.gain.value = 0.022;
  connectAll([hiss, biquad(ctx, "highpass", 3_800), biquad(ctx, "lowpass", 9_000), level, output]);
  return [hiss];
}

function wowAndFlutter(ctx: AudioContext, source: AudioBufferSourceNode): OscillatorNode[] {
  return [
    [0.55, 9],
    [6.5, 3],
  ].map(([rate, cents]) => {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = cents;
    lfo.connect(depth).connect(source.detune);
    return lfo;
  });
}

/** Ines: a cassette from 2011. Narrow band, a little wow, hiss underneath. */
export function startTape(bus: VoiceBus, buffer: AudioBuffer): Playback | null {
  return play(bus, buffer, 0.62, (source) => {
    const { ctx } = bus;
    const highpass = biquad(ctx, "highpass", 140);
    const body = biquad(ctx, "peaking", 1_100, 0.8, 2);
    const lowpass = biquad(ctx, "lowpass", 3_600, 0.5);
    const output = ctx.createGain();
    connectAll([highpass, body, lowpass, saturator(ctx, 1.2), output]);
    return { input: highpass, output, extras: [...tapeHiss(bus, output), ...wowAndFlutter(ctx, source)] };
  });
}
