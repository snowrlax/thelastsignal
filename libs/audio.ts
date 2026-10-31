/**
 * All sound is synthesized with the Web Audio API: no audio files to load.
 * Nothing plays until unlock() is called from a user gesture.
 */
export type Cue =
  | "key"
  | "enter"
  | "hdd"
  | "relay"
  | "message"
  | "hollow"
  | "warn"
  | "deny"
  | "copy"
  | "powerOn"
  | "powerOff"
  | "vhs"
  | "takeover"
  | "beep";

type Ctx = AudioContext;

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private humGain: GainNode | null = null;
  private humSources: AudioScheduledSourceNode[] = [];
  private noise: AudioBuffer | null = null;
  private muted = false;

  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.noise = this.createNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  private createNoise(ctx: Ctx): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private env(gain: GainNode, start: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  private noiseBurst(start: number, duration: number, peak: number, filter: BiquadFilterType, frequency: number, q = 1): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = frequency;
    biquad.Q.value = q;
    const gain = this.ctx.createGain();
    this.env(gain, start, peak, 0.004, duration);
    source.connect(biquad).connect(gain).connect(this.master);
    source.start(start, Math.random());
    source.stop(start + duration + 0.05);
  }

  private tone(start: number, duration: number, frequency: number, peak: number, type: OscillatorType = "sine", endFrequency?: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2_400;
    const gain = this.ctx.createGain();
    this.env(gain, start, peak, 0.008, duration);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  startHum(): void {
    if (!this.ctx || !this.master || this.humGain) return;
    try {
      this.buildHum();
    } catch {
      this.humGain = null;
    }
  }

  private buildHum(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.0001;
    this.humGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
    this.humGain.connect(this.master);

    const mains = ctx.createOscillator();
    mains.frequency.value = 60;
    const mainsGain = ctx.createGain();
    mainsGain.gain.value = 0.045;
    mains.connect(mainsGain).connect(this.humGain);

    const buzz = ctx.createOscillator();
    buzz.type = "sawtooth";
    buzz.frequency.value = 120;
    const buzzFilter = ctx.createBiquadFilter();
    buzzFilter.type = "lowpass";
    buzzFilter.frequency.value = 320;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.012;
    buzz.connect(buzzFilter).connect(buzzGain).connect(this.humGain);

    const room = ctx.createBufferSource();
    room.buffer = this.noise;
    room.loop = true;
    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = "bandpass";
    roomFilter.frequency.value = 180;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.02;
    room.connect(roomFilter).connect(roomGain).connect(this.humGain);

    this.humSources = [mains, buzz, room];
    this.humSources.forEach((source) => source.start());
  }

  /** 1 = normal, higher = more prominent (warning thresholds), 0 = silent. */
  setHumLevel(level: number): void {
    if (!this.ctx || !this.humGain) return;
    this.humGain.gain.setTargetAtTime(Math.max(0.0001, 0.5 * level), this.ctx.currentTime, 0.8);
  }

  stopHum(fadeSeconds = 1.5): void {
    if (!this.ctx || !this.humGain) return;
    const gain = this.humGain;
    const sources = this.humSources;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fadeSeconds / 4);
    window.setTimeout(() => {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
      gain.disconnect();
    }, fadeSeconds * 1000 + 200);
    this.humGain = null;
    this.humSources = [];
  }

  /** Sound is decoration: it must never break the game, so failures are swallowed here. */
  play(cue: Cue): void {
    if (!this.ctx || this.muted) return;
    try {
      this.schedule(cue, this.ctx.currentTime + 0.01);
    } catch {
      /* audio graph unavailable (suspended or closed context) */
    }
  }

  private schedule(cue: Cue, t: number): void {
    switch (cue) {
      case "key":
        this.noiseBurst(t, 0.03, 0.09, "bandpass", 1_800 + Math.random() * 1_400, 2.5);
        break;
      case "enter":
        this.noiseBurst(t, 0.06, 0.14, "bandpass", 900, 1.5);
        this.tone(t, 0.05, 110, 0.05);
        break;
      case "hdd":
      case "copy": {
        const clicks = cue === "copy" ? 26 : 9;
        for (let i = 0; i < clicks; i += 1) this.noiseBurst(t + i * 0.06 + Math.random() * 0.04, 0.012, 0.06 + Math.random() * 0.05, "highpass", 3_200);
        this.tone(t, cue === "copy" ? 2.2 : 0.7, 92, 0.018);
        break;
      }
      case "relay":
        this.tone(t, 0.18, 70, 0.16, "sine", 40);
        this.noiseBurst(t, 0.02, 0.12, "highpass", 2_000);
        break;
      case "message":
        this.noiseBurst(t, 0.42, 0.07, "bandpass", 1_600, 0.7);
        this.tone(t + 0.45, 0.07, 1_320, 0.03, "square");
        this.tone(t + 0.56, 0.09, 1_760, 0.025, "square");
        break;
      case "hollow":
        this.tone(t, 0.09, 440, 0.04, "square");
        this.tone(t + 0.12, 0.09, 440, 0.04, "square");
        break;
      case "warn":
        this.tone(t, 0.12, 880, 0.05, "square");
        this.tone(t + 0.18, 0.16, 660, 0.05, "square");
        break;
      case "deny":
        this.tone(t, 0.2, 140, 0.07, "square");
        break;
      case "beep":
        this.tone(t, 0.12, 1_000, 0.05, "square");
        break;
      case "powerOn":
        this.tone(t, 0.5, 55, 0.3, "sine", 32);
        this.noiseBurst(t + 0.05, 0.35, 0.08, "bandpass", 2_400, 0.6);
        this.tone(t + 0.1, 1.2, 9_000, 0.006, "sine", 15_000);
        break;
      case "powerOff":
        this.tone(t, 0.35, 1_400, 0.06, "sine", 60);
        this.noiseBurst(t, 0.15, 0.08, "lowpass", 1_200);
        break;
      case "vhs":
        this.noiseBurst(t, 0.9, 0.11, "lowpass", 4_200, 0.4);
        this.tone(t, 0.12, 90, 0.12, "sine", 50);
        break;
      case "takeover":
        this.takeover(t);
        break;
    }
  }

  private takeover(t: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(2_200, t + 7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 4);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 9);
    filter.connect(gain).connect(this.master);
    [55, 55.6, 82.4].forEach((frequency) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = frequency;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 9.2);
    });
    for (let i = 0; i < 10; i += 1) this.noiseBurst(t + 1 + i * 0.7 + Math.random() * 0.3, 0.12, 0.05, "bandpass", 600 + Math.random() * 3_000);
  }
}

let engine: SoundEngine | null = null;

export function sound(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}
