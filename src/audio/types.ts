/** Shared audio types. Pure (no DOM, no Web Audio), so the tracker and tests can import them. */

export type VoiceId = 'p12' | 'p25' | 'p50' | 'tri' | 'saw' | 'nzl' | 'nzs';
export const VOICE_IDS: readonly VoiceId[] = ['p12', 'p25', 'p50', 'tri', 'saw', 'nzl', 'nzs'];

export type PresetId = 'pluck' | 'lead' | 'pad' | 'bass' | 'organ' | 'swell' | 'blip' | 'kick' | 'snare' | 'hat' | 'toll';
export const PRESET_IDS: readonly PresetId[] = ['pluck', 'lead', 'pad', 'bass', 'organ', 'swell', 'blip', 'kick', 'snare', 'hat', 'toll'];

export type ChannelId = 'p1' | 'p2' | 'tri' | 'noise';
export const CHANNEL_IDS: readonly ChannelId[] = ['p1', 'p2', 'tri', 'noise'];

/** One scheduled note. Times in seconds; `vol` 0..1. Tonal notes use `freq`; noise notes use `noise` (0..15). */
export interface NoteEvent {
  t: number;
  dur: number;
  freq: number;
  vol: number;
  voice: VoiceId;
  preset: PresetId;
  /** Noise pitch step 0..15 (noise voices only). */
  noise?: number;
  /** Glide target: frequency (tonal) or noise step, reached at the end of `dur`. */
  freq2?: number;
  noise2?: number;
  /** Vibrato depth in cents and rate in Hz. */
  vib?: { cents: number; hz: number };
  /** Source channel (tracker output only). */
  ch?: ChannelId;
}

export interface ParsedSong {
  id: string;
  tempo: number;
  /** Beats (quarter notes) per bar. */
  beatsPerBar: number;
  events: NoteEvent[];
  /** Seconds. With no loop, `loops` is false and loopStart = loopEnd = lengthSec. */
  loops: boolean;
  loopStart: number;
  loopEnd: number;
  lengthSec: number;
}

export interface SongDef {
  id: string;
  /** Quarter-note BPM. */
  tempo: number;
  /** Time signature `[beats, unit]`, e.g. `[3, 4]`. */
  meter: [number, number];
  channels: Partial<Record<ChannelId, string>>;
  /** Default voice per channel (p1 p25, p2 p12, tri tri, noise nzl). */
  voices?: Partial<Record<ChannelId, VoiceId>>;
}
