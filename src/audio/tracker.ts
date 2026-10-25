/** Pure parser for the audio.md tracker text format, plus scheduling helpers. */
import { CHANNEL_IDS, PRESET_IDS, VOICE_IDS, type ChannelId, type NoteEvent, type ParsedSong, type PresetId, type SongDef, type VoiceId } from './types';

export class TrackerError extends Error {
  constructor(message: string, readonly channel: string, readonly index: number, readonly token: string) {
    super(`${channel}[${index}] "${token}": ${message}`);
    this.name = 'TrackerError';
  }
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_RE = /^([A-G])([#b]?)(\d)$/;

/** Equal temperament, A4 = 440 Hz. Octave 0..8, `#`/`b` accidentals. Throws on a bad note. */
export function noteToFreq(note: string): number {
  const m = NOTE_RE.exec(note);
  if (!m) throw new Error(`bad note "${note}"`);
  const semis = (SEMITONES[m[1] as string] as number) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = 12 * (Number(m[3]) + 1) + semis;
  return 440 * 2 ** ((midi - 69) / 12);
}

export const beatsToSeconds = (tempo: number, beats: number): number => (beats * 60) / tempo;

/** Beats (quarter notes) in a duration token: `1 2 4 8 16 32`, optional `.` (x1.5) or `t` (x2/3). */
export function durToBeats(dur: string): number {
  const m = /^(1|2|4|8|16|32)(\.|t)?$/.exec(dur);
  if (!m) throw new Error(`bad duration "${dur}"`);
  const base = 4 / Number(m[1]);
  return m[2] === '.' ? base * 1.5 : m[2] === 't' ? (base * 2) / 3 : base;
}

export const durToSec = (tempo: number, dur: string): number => beatsToSeconds(tempo, durToBeats(dur));

const DRUMS: Record<string, Partial<NoteEvent> & { preset: PresetId; voice: VoiceId }> = {
  K: { voice: 'nzl', preset: 'kick', noise: 6, noise2: 1 },
  S: { voice: 'nzl', preset: 'snare', noise: 9 },
  H: { voice: 'nzl', preset: 'hat', noise: 14 },
  C: { voice: 'nzl', preset: 'snare', noise: 12, noise2: 4 },
};

const DEFAULT_VOICES: Record<ChannelId, VoiceId> = { p1: 'p25', p2: 'p12', tri: 'tri', noise: 'nzl' };

interface ChannelResult {
  events: NoteEvent[];
  /** Beats; null when the channel has no loop region. */
  loopStart: number | null;
  loopEnd: number | null;
  length: number;
}

const EPS = 1e-6;

/** Split on whitespace, keeping `[n n n]:dur` arpeggios whole; `;` starts a comment. */
function tokenize(text: string): string[] {
  const clean = text.replace(/;[^\n]*/g, ' ');
  return clean.match(/\[[^\]]*\]:\S+|\S+/g) ?? [];
}

/** Parse one channel's text. Beats are converted to seconds with `tempo`. `beatsPerBar` 0 disables bar checks. */
export function parseChannel(text: string, tempo: number, beatsPerBar: number, ch: ChannelId, voice?: VoiceId): ChannelResult {
  const toks = tokenize(text);
  const events: NoteEvent[] = [];
  let beat = 0;
  let barBeats = 0;
  let barNo = 1;
  let vol = 1;
  let curVoice: VoiceId = voice ?? DEFAULT_VOICES[ch];
  let preset: PresetId = ch === 'noise' ? 'hat' : 'lead';
  let arpHz = 20;
  let vib: { cents: number; hz: number } | undefined;
  let loopStart: number | null = null;
  let loopEnd: number | null = null;
  let last: NoteEvent | null = null; // last tie-able note

  const advance = (beats: number): void => {
    beat += beats;
    barBeats += beats;
  };
  const add = (beats: number, e: Omit<NoteEvent, 't' | 'dur' | 'vol' | 'ch'>): void => {
    const ev: NoteEvent = { t: beatsToSeconds(tempo, beat), dur: beatsToSeconds(tempo, beats), vol, ch, ...e };
    if (vib && e.noise === undefined) ev.vib = vib;
    events.push(ev);
    last = ev;
    advance(beats);
  };

  toks.forEach((tok, i) => {
    const fail = (msg: string): never => {
      throw new TrackerError(msg, ch, i, tok);
    };
    const checkBar = (): void => {
      if (beatsPerBar > 0 && barBeats > EPS && Math.abs(barBeats - beatsPerBar) > EPS) fail(`bar ${barNo} has ${+barBeats.toFixed(4)} beats, meter needs ${beatsPerBar}`);
      if (barBeats > EPS) barNo++;
      barBeats = 0;
    };
    if (tok === '|') return checkBar();
    if (tok === '|:') {
      if (loopStart !== null) fail('second loop start');
      checkBar();
      loopStart = beat;
      return;
    }
    if (tok === ':|') {
      if (loopStart === null) fail('loop end without loop start');
      if (loopEnd !== null) fail('second loop end');
      checkBar();
      loopEnd = beat;
      return;
    }
    if (tok.startsWith('@')) {
      const body = tok.slice(1);
      if ((PRESET_IDS as readonly string[]).includes(body)) preset = body as PresetId;
      else if ((VOICE_IDS as readonly string[]).includes(body)) curVoice = body as VoiceId;
      else if (body.startsWith('arp=')) {
        arpHz = Number(body.slice(4));
        if (!(arpHz > 0)) fail('bad arp rate');
      } else if (body.startsWith('vib=')) {
        const [c, h] = body.slice(4).split(',').map(Number) as [number, number | undefined];
        if (!Number.isFinite(c) || c < 0) fail('bad vibrato');
        vib = c === 0 ? undefined : { cents: c, hz: h ?? 6 };
      } else fail('unknown directive');
      return;
    }
    if (/^v\d+$/.test(tok)) {
      const v = Number(tok.slice(1));
      if (v > 15) fail('volume must be 0-15');
      vol = v / 15;
      return;
    }
    const sep = tok.lastIndexOf(':');
    if (sep < 0) return fail('expected <thing>:<duration>');
    const head = tok.slice(0, sep);
    let beats = 0;
    try {
      beats = durToBeats(tok.slice(sep + 1));
    } catch (e) {
      fail((e as Error).message);
    }
    if (head === 'r') {
      last = null;
      return advance(beats);
    }
    if (head === '-') {
      if (!last) fail('tie has no previous note');
      (last as NoteEvent).dur += beatsToSeconds(tempo, beats);
      return advance(beats);
    }
    if (head.startsWith('[')) {
      if (!head.endsWith(']')) fail('unterminated arpeggio');
      let freqs: number[] = [];
      try {
        freqs = head.slice(1, -1).trim().split(/\s+/).map(noteToFreq);
      } catch (e) {
        fail((e as Error).message);
      }
      const total = beatsToSeconds(tempo, beats);
      const step = 1 / arpHz;
      const n = Math.ceil(total / step - EPS);
      const t0 = beatsToSeconds(tempo, beat);
      for (let k = 0; k < n; k++) {
        const dur = Math.min(step, total - k * step);
        events.push({ t: t0 + k * step, dur, freq: freqs[k % freqs.length] as number, vol, voice: curVoice, preset, ch, ...(vib ? { vib } : {}) });
      }
      last = null;
      return advance(beats);
    }
    if (ch === 'noise') {
      const drum = DRUMS[head];
      if (drum) return add(beats, { freq: 0, ...drum });
      const m = /^N(!?)([0-9A-F])$/.exec(head);
      if (m) return add(beats, { freq: 0, voice: m[1] ? 'nzs' : 'nzl', preset, noise: parseInt(m[2] as string, 16) });
      fail('expected K S H C or N<0-F>');
    }
    let freq = 0;
    try {
      freq = noteToFreq(head);
    } catch (e) {
      fail((e as Error).message);
    }
    add(beats, { freq, voice: curVoice, preset });
  });

  if (beatsPerBar > 0 && barBeats > EPS && Math.abs(barBeats - beatsPerBar) > EPS) throw new TrackerError(`final bar ${barNo} has ${+barBeats.toFixed(4)} beats, meter needs ${beatsPerBar}`, ch, toks.length, '(end)');
  if (loopStart !== null && loopEnd === null) throw new TrackerError('loop start without loop end', ch, toks.length, '(end)');
  return { events, loopStart, loopEnd, length: beat };
}

/** Parse a whole song: all channels merged and sorted by time; loop points validated across channels. */
export function parseSong(def: SongDef): ParsedSong {
  const beatsPerBar = (def.meter[0] * 4) / def.meter[1];
  const results = CHANNEL_IDS.filter((c) => def.channels[c] !== undefined).map((c) => ({ c, r: parseChannel(def.channels[c] as string, def.tempo, beatsPerBar, c, def.voices?.[c]) }));
  const first = results[0];
  if (!first) throw new Error(`song ${def.id}: no channels`);
  const loops = first.r.loopStart !== null;
  for (const { c, r } of results) {
    if ((r.loopStart !== null) !== loops) throw new Error(`song ${def.id}: channel ${c} loop presence differs from ${first.c}`);
    if (Math.abs(r.length - first.r.length) > EPS) throw new Error(`song ${def.id}: channel ${c} is ${r.length} beats, ${first.c} is ${first.r.length}`);
    if (loops && (Math.abs((r.loopStart as number) - (first.r.loopStart as number)) > EPS || Math.abs((r.loopEnd as number) - (first.r.loopEnd as number)) > EPS))
      throw new Error(`song ${def.id}: channel ${c} loop points differ from ${first.c}`);
  }
  if (loops && Math.abs((first.r.loopEnd as number) - first.r.length) > EPS) throw new Error(`song ${def.id}: loop end must be the end of the song`);
  const events = results.flatMap((x) => x.r.events).sort((a, b) => a.t - b.t);
  const lengthSec = beatsToSeconds(def.tempo, first.r.length);
  return {
    id: def.id,
    tempo: def.tempo,
    beatsPerBar,
    events,
    loops,
    loopStart: loops ? beatsToSeconds(def.tempo, first.r.loopStart as number) : lengthSec,
    loopEnd: loops ? beatsToSeconds(def.tempo, first.r.loopEnd as number) : lengthSec,
    lengthSec,
  };
}

/** Events starting in `[t0, t1)` of song time, unrolling loops (t is returned in unrolled song time). */
export function eventsBetween(song: ParsedSong, t0: number, t1: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const len = song.loopEnd - song.loopStart;
  for (const e of song.events) {
    if (!song.loops || e.t < song.loopStart) {
      if (e.t >= t0 && e.t < t1) out.push(e);
      continue;
    }
    const k0 = Math.max(0, Math.ceil((t0 - e.t) / len - 1e-9));
    for (let k = k0; ; k++) {
      const t = e.t + k * len;
      if (t >= t1) break;
      if (t >= t0) out.push(k === 0 ? e : { ...e, t });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
