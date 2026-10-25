/** SFX registry (audio.md "SFX"). Each effect is data: a list of timed notes. */
import { noteToFreq } from './tracker';
import type { NoteEvent, PresetId, VoiceId } from './types';

export interface SfxNote {
  /** Start offset and length in ms. */
  at: number;
  len: number;
  voice: VoiceId;
  preset: PresetId;
  /** Tonal: note name (and optional glide target). */
  f?: string;
  f2?: string;
  /** Noise: step 0..15 (and optional glide target). */
  n?: number;
  n2?: number;
  /** 0..1, default 1. */
  vol?: number;
}

export interface SfxDef {
  id: string;
  /** `duck` ducks the music bus while it plays; `ui` does not. */
  cls: 'duck' | 'ui';
  /** Total length in ms. */
  dur: number;
  /** Minimum ms between plays of this id (rate limit). */
  minGap?: number;
  notes: SfxNote[];
}

const tone = (at: number, len: number, voice: VoiceId, preset: PresetId, f: string, f2?: string, vol = 1): SfxNote => ({ at, len, voice, preset, f, ...(f2 ? { f2 } : {}), vol });
const noise = (at: number, len: number, voice: VoiceId, preset: PresetId, n: number, n2?: number, vol = 1): SfxNote => ({ at, len, voice, preset, n, ...(n2 !== undefined ? { n2 } : {}), vol });

/** Alarm: A5 <-> E5 every 120 ms, 3 cycles. */
const alarmNotes = Array.from({ length: 6 }, (_, i) => tone(i * 120, 120, 'saw', 'organ', i % 2 === 0 ? 'A5' : 'E5', undefined, 0.8));

const DEFS: SfxDef[] = [
  { id: 'ui.move', cls: 'ui', dur: 30, notes: [tone(0, 30, 'p12', 'blip', 'E6', undefined, 0.7)] },
  { id: 'ui.select', cls: 'ui', dur: 80, notes: [tone(0, 40, 'p25', 'blip', 'C6'), tone(40, 40, 'p25', 'blip', 'G6')] },
  { id: 'ui.back', cls: 'ui', dur: 80, notes: [tone(0, 40, 'p25', 'blip', 'G5'), tone(40, 40, 'p25', 'blip', 'C5')] },
  { id: 'text.tick', cls: 'ui', dur: 15, minGap: 40, notes: [noise(0, 15, 'nzs', 'hat', 12, undefined, 4 / 15)] },
  { id: 'store.buy', cls: 'ui', dur: 150, notes: [tone(0, 50, 'p25', 'pluck', 'C6'), tone(50, 50, 'p25', 'pluck', 'E6'), tone(100, 50, 'p25', 'pluck', 'G6')] },
  { id: 'alarm', cls: 'duck', dur: 720, notes: alarmNotes },
  { id: 'grapple.fire', cls: 'duck', dur: 120, notes: [noise(0, 120, 'nzs', 'snare', 8, 3)] },
  { id: 'beacon.chime', cls: 'duck', dur: 900, notes: [tone(0, 300, 'p50', 'toll', 'E6', undefined, 0.8), tone(300, 600, 'p50', 'toll', 'B5', undefined, 0.8)] },
];

export const SFX: Record<string, SfxDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));

/** Concrete note events for an effect starting at context time `t0`. */
export function sfxEvents(def: SfxDef, t0: number): NoteEvent[] {
  return def.notes.map((n) => ({
    t: t0 + n.at / 1000,
    dur: n.len / 1000,
    vol: n.vol ?? 1,
    voice: n.voice,
    preset: n.preset,
    freq: n.f ? noteToFreq(n.f) : 0,
    ...(n.f2 ? { freq2: noteToFreq(n.f2) } : {}),
    ...(n.n !== undefined ? { noise: n.n } : {}),
    ...(n.n2 !== undefined ? { noise2: n.n2 } : {}),
  }));
}
