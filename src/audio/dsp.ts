/** Pure audio math: ADSR, dB, LFSR, crossfade and duck plans. No Web Audio here. */
import type { PresetId } from './types';

/** ADSR presets (audio.md). a/d/r in ms, s as a fraction of note volume. */
export const ADSR: Record<PresetId, { a: number; d: number; s: number; r: number }> = {
  pluck: { a: 2, d: 120, s: 0.0, r: 40 },
  lead: { a: 5, d: 80, s: 0.6, r: 80 },
  pad: { a: 60, d: 200, s: 0.5, r: 250 },
  bass: { a: 2, d: 40, s: 0.8, r: 30 },
  organ: { a: 5, d: 0, s: 1.0, r: 20 },
  swell: { a: 250, d: 0, s: 1.0, r: 300 },
  blip: { a: 1, d: 30, s: 0.0, r: 10 },
  kick: { a: 1, d: 60, s: 0.0, r: 10 },
  snare: { a: 1, d: 90, s: 0.0, r: 30 },
  hat: { a: 1, d: 25, s: 0.0, r: 5 },
  toll: { a: 2, d: 900, s: 0.15, r: 1200 },
};

/** Envelope breakpoints `[secondsAfterNoteOn, gain]` (linear segments) for a note of `len` seconds at volume `vol`. */
export function adsrPoints(preset: PresetId, vol: number, len: number): [number, number][] {
  const p = ADSR[preset];
  const a = Math.max(p.a, 1) / 1000;
  const d = p.d / 1000;
  const r = p.r / 1000;
  const pts: [number, number][] = [[0, 0]];
  let level: number;
  if (len <= a) {
    level = vol * (len / a);
  } else {
    pts.push([a, vol]);
    if (len <= a + d) {
      level = vol * (1 - (1 - p.s) * ((len - a) / d));
    } else {
      level = vol * p.s;
      if (d > 0) pts.push([a + d, level]);
    }
  }
  pts.push([len, level]);
  pts.push([len + r, 0]);
  // Drop non-increasing duplicates (keeps ramps well-formed).
  return pts.filter((pt, i) => i === 0 || pt[0] > (pts[i - 1] as [number, number])[0] + 1e-9);
}

/** Envelope level (0..vol) `t` seconds after note on for a note of `len` seconds. */
export function adsrAt(preset: PresetId, t: number, len: number, vol = 1): number {
  const pts = adsrPoints(preset, vol, len);
  if (t <= 0) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i] as [number, number];
    const [t0, v0] = pts[i - 1] as [number, number];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return 0;
}

export const dbToGain = (db: number): number => 10 ** (db / 20);

/** 15-bit LFSR. Long mode taps bits 0,1 (period 32,767); short mode taps 0,6 (period 93). Returns `n` bits (0/1). */
export function lfsr(seed: number, mode: 'long' | 'short', n: number): Uint8Array {
  const tap = mode === 'long' ? 1 : 6;
  let r = (seed & 0x7fff) || 1;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = r & 1;
    const fb = (r ^ (r >> tap)) & 1;
    r = (r >> 1) | (fb << 14);
  }
  return out;
}

/** Playback rate for noise pitch step 0..15 (N0 lowest). */
export const noiseRate = (step: number): number => 0.125 * 2 ** (Math.min(15, Math.max(0, step)) / 3);

/** Equal-power crossfade gains at progress x in 0..1: `out² + in² = 1`. */
export function crossfadeAt(x: number): { out: number; in: number } {
  const c = Math.min(1, Math.max(0, x));
  return { out: Math.cos((c * Math.PI) / 2), in: Math.sin((c * Math.PI) / 2) };
}

export const DUCK = { db: -6, attack: 0.02, release: 0.25 } as const;

/** Gain breakpoints for the duck bus: `[time, gain, 'set' | 'ramp']`. */
export function duckPlan(now: number, duration: number, alreadyDucked: boolean): [number, number, 'set' | 'ramp'][] {
  const g = dbToGain(DUCK.db);
  const end = now + duration;
  return [
    [now, alreadyDucked ? g : 1, 'set'],
    [now + DUCK.attack, g, 'ramp'],
    [Math.max(end, now + DUCK.attack), g, 'set'],
    [Math.max(end, now + DUCK.attack) + DUCK.release, 1, 'ramp'],
  ];
}

/** PeriodicWave coefficients for a pulse of duty `d` (0..1), `harmonics` terms. Index 0 (DC) is 0. */
export function pulseCoefficients(duty: number, harmonics = 32): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(n * Math.PI * duty));
  }
  return { real, imag };
}
