/** Thin Web Audio wrapper over an injected AudioContext-like object (tests pass a fake). */
import { ADSR, adsrPoints, lfsr, noiseRate, pulseCoefficients } from './dsp';
import type { NoteEvent, VoiceId } from './types';

export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  cancelScheduledValues(t: number): unknown;
}
export interface NodeLike {
  connect(dest: unknown): unknown;
  disconnect(): void;
}
export interface GainLike extends NodeLike {
  gain: ParamLike;
}
export interface SourceLike extends NodeLike {
  start(t?: number): void;
  stop(t?: number): void;
}
export interface OscLike extends SourceLike {
  type: string;
  frequency: ParamLike;
  detune: ParamLike;
  setPeriodicWave(w: unknown): void;
}
export interface BufferSourceLike extends SourceLike {
  buffer: unknown;
  loop: boolean;
  playbackRate: ParamLike;
}
export interface FilterLike extends NodeLike {
  type: string;
  frequency: ParamLike;
}
export interface BufferLike {
  getChannelData(ch: number): Float32Array;
}
export interface CtxLike {
  readonly currentTime: number;
  readonly state: string;
  readonly sampleRate: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createGain(): GainLike;
  createOscillator(): OscLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(channels: number, length: number, rate: number): BufferLike;
  createPeriodicWave(real: Float32Array, imag: Float32Array): unknown;
  createBiquadFilter(): FilterLike;
}

const DUTY: Partial<Record<VoiceId, number>> = { p12: 0.125, p25: 0.25, p50: 0.5 };

/** A scheduled voice: when it ends, and a way to cut it short. */
export interface Voice {
  end: number;
  /** Cut the voice at `at` with a linear fade of `fadeSec` (default 10 ms). */
  stop(at: number, fadeSec?: number): void;
}

export class Synth {
  readonly master: GainLike;
  readonly music: GainLike;
  readonly sfx: GainLike;
  private waves = new Map<VoiceId, unknown>();
  private buffers = new Map<VoiceId, BufferLike>();
  private ends: number[] = [];

  constructor(readonly ctx: CtxLike) {
    this.master = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(ctx.destination);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Voices scheduled and not yet finished. */
  voiceCount(): number {
    this.ends = this.ends.filter((e) => e > this.now);
    return this.ends.length;
  }

  private wave(voice: VoiceId): unknown {
    let w = this.waves.get(voice);
    if (!w) {
      const { real, imag } = pulseCoefficients(DUTY[voice] ?? 0.5, 32);
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(voice, w);
    }
    return w;
  }

  private noiseBuffer(voice: VoiceId): BufferLike {
    let b = this.buffers.get(voice);
    if (!b) {
      const n = Math.floor(this.ctx.sampleRate);
      b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const bits = lfsr(1, voice === 'nzs' ? 'short' : 'long', n);
      const data = b.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (bits[i] as number) * 2 - 1;
      this.buffers.set(voice, b);
    }
    return b;
  }

  /** Schedule one note at absolute context time `ev.t` into `dest`. */
  playNote(dest: GainLike, ev: NoteEvent): Voice {
    const ctx = this.ctx;
    const t0 = Math.max(ev.t, ctx.currentTime);
    const len = Math.max(0.005, ev.dur - (t0 - ev.t));
    const env = ctx.createGain();
    const pts = adsrPoints(ev.preset, ev.vol, len);
    env.gain.setValueAtTime(0, t0);
    for (const [dt, v] of pts.slice(1)) env.gain.linearRampToValueAtTime(v, t0 + dt);
    env.connect(dest);
    const end = t0 + len + ADSR[ev.preset].r / 1000 + 0.02;
    let src: SourceLike;
    if (ev.voice === 'nzl' || ev.voice === 'nzs') {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer(ev.voice);
      s.loop = true;
      s.playbackRate.setValueAtTime(noiseRate(ev.noise ?? 0), t0);
      if (ev.noise2 !== undefined) s.playbackRate.linearRampToValueAtTime(noiseRate(ev.noise2), t0 + len);
      src = s;
      s.connect(env);
    } else {
      const o = ctx.createOscillator();
      if (ev.voice in DUTY) o.setPeriodicWave(this.wave(ev.voice));
      else o.type = ev.voice === 'tri' ? 'triangle' : 'sawtooth';
      o.frequency.setValueAtTime(ev.freq, t0);
      if (ev.freq2 !== undefined && ev.freq2 > 0 && ev.freq > 0) o.frequency.exponentialRampToValueAtTime(ev.freq2, t0 + len);
      if (ev.voice === 'saw') {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2400, t0);
        o.connect(f);
        f.connect(env);
      } else o.connect(env);
      if (ev.vib) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.setValueAtTime(ev.vib.hz, t0);
        depth.gain.setValueAtTime(ev.vib.cents, t0);
        lfo.connect(depth);
        depth.connect(o.detune);
        lfo.start(t0);
        lfo.stop(end);
      }
      src = o;
    }
    src.start(t0);
    src.stop(end);
    this.ends.push(end);
    const voice: Voice = {
      end,
      stop: (at, fadeSec = 0.01) => {
        const a = Math.max(at, ctx.currentTime);
        const f = Math.max(0.005, fadeSec);
        env.gain.cancelScheduledValues(a);
        env.gain.setValueAtTime(env.gain.value, a);
        env.gain.linearRampToValueAtTime(0, a + f);
        voice.end = Math.min(voice.end, a + f + 0.01);
        try {
          src.stop(a + f + 0.01);
        } catch {
          /* already stopped */
        }
      },
    };
    return voice;
  }
}

