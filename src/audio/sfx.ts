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
  vib?: { cents: number; hz: number };
}

export interface SfxDef {
  id: string;
  /** `duck` ducks the music bus while it plays; `ui` does not. */
  cls: 'duck' | 'ui';
  /** Total length in ms. */
  dur: number;
  /** Minimum ms between plays of this id (rate limit). */
  minGap?: number;
  /** One cycle of a bed or sweep. AudioManager re-triggers it every `dur` ms until `stopSfx(id)`. */
  loop?: boolean;
  /** Fade-out in ms used when the effect is cut short (`stopSfx`, voice steal); the effect also holds its polyphony slot for this long. `stopSfx` default 40. */
  fadeOutMs?: number;
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
  { id: 'ui.deny', cls: 'ui', dur: 120, notes: [tone(0, 50, 'p50', 'blip', 'A3'), tone(70, 50, 'p50', 'blip', 'A3')] },
  { id: 'store.sell', cls: 'ui', dur: 150, notes: [tone(0, 50, 'p25', 'pluck', 'G6'), tone(50, 50, 'p25', 'pluck', 'E6'), tone(100, 50, 'p25', 'pluck', 'C6')] },
  { id: 'trade.accept', cls: 'duck', dur: 250, notes: [tone(0, 120, 'p50', 'lead', 'C5'), tone(0, 120, 'tri', 'organ', 'G5'), tone(120, 130, 'p50', 'lead', 'C6'), tone(120, 130, 'tri', 'organ', 'C6')] },
  /** One 1 s cycle of a bed; loops until `stopSfx('drive.hum')`. */
  { id: 'drive.hum', cls: 'ui', dur: 1000, loop: true, notes: [{ ...tone(0, 1000, 'tri', 'organ', 'A1', undefined, 0.7), vib: { cents: 10, hz: 3 } }, noise(0, 1000, 'nzl', 'organ', 2, undefined, 2 / 15)] },
  { id: 'hull.hit', cls: 'duck', dur: 300, notes: [noise(0, 300, 'nzl', 'kick', 6, 1), tone(0, 300, 'saw', 'kick', 'C3', 'G1', 0.8)] },
  { id: 'grapple.attach', cls: 'duck', dur: 80, notes: [tone(0, 80, 'p12', 'blip', 'C6'), noise(0, 40, 'nzs', 'hat', 10)] },
  /** One 0.5 s reel sweep; loops until `stopSfx('grapple.reel')`. */
  { id: 'grapple.reel', cls: 'ui', dur: 500, loop: true, notes: [tone(0, 500, 'p12', 'organ', 'C4', 'C5', 0.6)] },
  { id: 'grapple.snap', cls: 'duck', dur: 90, fadeOutMs: 150, notes: [noise(0, 90, 'nzs', 'snare', 15, 8)] },
  { id: 'grapple.empty', cls: 'ui', dur: 40, notes: [tone(0, 40, 'p50', 'blip', 'C3')] },
  { id: 'collision', cls: 'duck', dur: 220, notes: [noise(0, 220, 'nzl', 'snare', 8, 2), tone(0, 220, 'p50', 'kick', 'E3', 'C3', 0.8)] },
  { id: 'flare.warn', cls: 'ui', dur: 1200, notes: [noise(0, 1200, 'nzl', 'swell', 3, 6, 5 / 15)] },
  { id: 'flare.hit', cls: 'duck', dur: 350, notes: [tone(0, 350, 'saw', 'kick', 'E4', 'E2', 0.9), noise(0, 350, 'nzl', 'snare', 12, 4)] },
  { id: 'crash', cls: 'duck', dur: 1200, notes: [noise(0, 1200, 'nzl', 'toll', 15, 0), tone(0, 1200, 'tri', 'toll', 'C2', 'C1')] },
  { id: 'death.toll', cls: 'duck', dur: 1800, notes: [tone(0, 1800, 'tri', 'toll', 'A2'), tone(0, 1800, 'p50', 'toll', 'A3', undefined, 0.6)] },
  { id: 'arrival.bell', cls: 'duck', dur: 1400, notes: [tone(0, 350, 'p50', 'toll', 'C6', undefined, 0.8), tone(350, 350, 'p50', 'toll', 'G5', undefined, 0.8), tone(700, 350, 'p50', 'toll', 'C6', undefined, 0.8), tone(1050, 350, 'p50', 'toll', 'E6', undefined, 0.8)] },
  { id: 'countdown.beep', cls: 'ui', dur: 120, notes: [tone(0, 120, 'p25', 'blip', 'A4')] },
  /** The GO beep of the countdown (audio.md: A5 250 ms). */
  { id: 'countdown.go', cls: 'ui', dur: 250, notes: [tone(0, 250, 'p25', 'blip', 'A5')] },
  { id: 'pause', cls: 'ui', dur: 100, notes: [tone(0, 50, 'p50', 'blip', 'C5'), tone(50, 50, 'p50', 'blip', 'G4')] },
  { id: 'event.ding', cls: 'ui', dur: 120, notes: [tone(0, 120, 'p12', 'pluck', 'G5')] },
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
    ...(n.vib ? { vib: n.vib } : {}),
  }));
}
