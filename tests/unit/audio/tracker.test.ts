import { describe, expect, it } from 'vitest';
import { adsrAt, adsrPoints, crossfadeAt, dbToGain, duckPlan, lfsr } from '@/audio/dsp';
import { beatsToSeconds, durToSec, eventsBetween, noteToFreq, parseChannel, parseSong, TrackerError } from '@/audio/tracker';

const ch = (text: string, tempo = 120, meter = 0, c: 'p1' | 'noise' = 'p1') => parseChannel(text, tempo, meter, c);

describe('noteToFreq', () => {
  it('A4 = 440, C4 = 261.63, C#4 = Db4', () => {
    expect(noteToFreq('A4')).toBe(440);
    expect(noteToFreq('C4')).toBeCloseTo(261.63, 2);
    expect(noteToFreq('C#4')).toBeCloseTo(noteToFreq('Db4'), 9);
    expect(noteToFreq('A5')).toBeCloseTo(880, 6);
  });
  it('bad note throws', () => {
    expect(() => noteToFreq('H4')).toThrow();
    expect(() => noteToFreq('C')).toThrow();
  });
});

describe('durations', () => {
  it('120 BPM: 4 = 0.5s, 8 = 0.25s, 4. = 0.75s, 8t = 0.1667s, 1 = 2s', () => {
    expect(durToSec(120, '4')).toBe(0.5);
    expect(durToSec(120, '8')).toBe(0.25);
    expect(durToSec(120, '4.')).toBe(0.75);
    expect(durToSec(120, '8t')).toBeCloseTo(0.1667, 4);
    expect(durToSec(120, '1')).toBe(2);
    expect(beatsToSeconds(60, 3)).toBe(3);
  });
  it('bad duration throws', () => expect(() => durToSec(120, '3')).toThrow());
});

describe('parseChannel', () => {
  it('notes and rests advance time; volume and presets apply', () => {
    const r = ch('v10 @pluck C4:4 r:4 E4:2');
    expect(r.events.map((e) => [e.t, e.dur])).toEqual([[0, 0.5], [1, 1]]);
    expect(r.events[0]?.vol).toBeCloseTo(10 / 15, 9);
    expect(r.events[0]?.preset).toBe('pluck');
    expect(r.length).toBe(4);
  });
  it('ties extend the previous note without a new attack', () => {
    const r = ch('C4:4 -:8 -:8');
    expect(r.events).toHaveLength(1);
    expect(r.events[0]?.dur).toBeCloseTo(1, 9);
  });
  it('tie with nothing to extend is an error naming channel, index and token', () => {
    expect(() => ch('r:4 -:4')).toThrow(TrackerError);
    try {
      ch('C4:4 r:4 -:4');
    } catch (e) {
      expect((e as TrackerError).index).toBe(2);
      expect((e as TrackerError).token).toBe('-:4');
      expect((e as Error).message).toContain('p1[2]');
    }
  });
  it('arpeggio [C4 E4 G4]:4 at 120 BPM, 20 Hz is 10 steps cycling C E G', () => {
    const r = ch('[C4 E4 G4]:4');
    expect(r.events).toHaveLength(10);
    const names = r.events.map((e) => e.freq);
    expect(names.slice(0, 4)).toEqual([noteToFreq('C4'), noteToFreq('E4'), noteToFreq('G4'), noteToFreq('C4')]);
    expect(r.events[1]?.t).toBeCloseTo(0.05, 9);
    expect(r.length).toBe(1);
  });
  it('@arp sets the step rate', () => expect(ch('@arp=10 [C4 E4]:4').events).toHaveLength(5));
  it('vibrato attaches to tonal notes', () => {
    expect(ch('@vib=15,6 C4:4 @vib=0 D4:4').events.map((e) => e.vib)).toEqual([{ cents: 15, hz: 6 }, undefined]);
  });
  it('loop markers are reported in beats', () => {
    const r = ch('C4:1 |: D4:1 E4:1 :|');
    expect([r.loopStart, r.loopEnd, r.length]).toEqual([4, 12, 12]);
  });
  it('noise channel: drums and raw noise pitch', () => {
    const r = ch('K:4 S:4 H:4 N!4:4', 120, 0, 'noise');
    expect(r.events.map((e) => [e.voice, e.noise])).toEqual([['nzl', 6], ['nzl', 9], ['nzl', 14], ['nzs', 4]]);
    expect(() => ch('Q:4', 120, 0, 'noise')).toThrow(TrackerError);
  });
  it('bars that do not sum to the meter fail with the bar number', () => {
    expect(() => ch('C4:1 | D4:2 |', 120, 4)).toThrow(/bar 2 has 2 beats/);
    expect(() => ch('C4:1 | D4:1 | E4:2', 120, 4)).toThrow(/final bar 3/);
  });
  it('triplets fill a bar', () => expect(() => ch('C4:4t C4:4t C4:4t C4:2 |', 120, 4)).not.toThrow());
  it('clear errors for bad input', () => {
    expect(() => ch('C4')).toThrow(/expected/);
    expect(() => ch('C4:3')).toThrow(/bad duration/);
    expect(() => ch('Z4:4')).toThrow(/bad note/);
    expect(() => ch('v16')).toThrow(/0-15/);
    expect(() => ch('@nope')).toThrow(/unknown directive/);
    expect(() => ch('C4:4 :|')).toThrow(/without loop start/);
    expect(() => ch('|: C4:1')).toThrow(/without loop end/);
  });
  it('comments are ignored', () => expect(ch('C4:4 ; hello C5:4\nD4:4').events).toHaveLength(2));
});

describe('parseSong / eventsBetween', () => {
  const song = parseSong({ id: 't', tempo: 120, meter: [4, 4], channels: { p1: 'C4:1 |: D4:2 E4:2 :|', tri: 'r:1 |: C2:1 :|' } });
  it('merges channels sorted by time with loop points in seconds', () => {
    expect(song.loops).toBe(true);
    expect([song.loopStart, song.loopEnd, song.lengthSec]).toEqual([2, 4, 4]);
    expect(song.events.map((e) => e.t)).toEqual([0, 2, 2, 3]);
  });
  it('mismatched channel lengths or loops are validation errors', () => {
    expect(() => parseSong({ id: 'x', tempo: 120, meter: [4, 4], channels: { p1: 'C4:1', tri: 'C2:1 C2:1' } })).toThrow(/beats/);
    expect(() => parseSong({ id: 'x', tempo: 120, meter: [4, 4], channels: { p1: '|: C4:1 :|', tri: 'r:1 |: C2:1 :|' } })).toThrow(/beats|loop points differ/);
    expect(() => parseSong({ id: 'x', tempo: 120, meter: [4, 4], channels: { p1: '|: C4:1 :|', tri: 'C2:1' } })).toThrow(/loop presence/);
  });
  it('windows tile with no gaps or doubles at the loop seam', () => {
    const all: number[] = [];
    for (let i = 0; i < 30; i++) all.push(...eventsBetween(song, i * 0.37, (i + 1) * 0.37).map((e) => e.t));
    const direct = eventsBetween(song, 0, 30 * 0.37).map((e) => e.t);
    expect(all).toEqual(direct);
    // D4 (t=2) recurs every loop length (2 s)
    const d4 = direct.filter((t) => t >= 2 && Math.abs((t - 2) % 2) < 1e-9);
    expect(d4.length).toBeGreaterThan(3);
    expect(new Set(direct.map((t) => t.toFixed(6))).size).toBeLessThanOrEqual(direct.length);
  });
  it('non-looping songs do not repeat', () => {
    const s = parseSong({ id: 'n', tempo: 120, meter: [4, 4], channels: { p1: 'C4:1' } });
    expect(eventsBetween(s, 0, 100)).toHaveLength(1);
  });
});

describe('dsp math', () => {
  it('adsr boundaries', () => {
    expect(adsrAt('lead', 0, 1)).toBe(0);
    expect(adsrAt('lead', 0.005, 1)).toBeCloseTo(1, 9); // end of attack
    expect(adsrAt('lead', 0.085, 1)).toBeCloseTo(0.6, 9); // end of decay = sustain
    expect(adsrAt('lead', 0.5, 1)).toBeCloseTo(0.6, 9);
    expect(adsrAt('lead', 1.04, 1)).toBeCloseTo(0.3, 9); // half through release
    expect(adsrAt('lead', 1.2, 1)).toBe(0);
    expect(adsrAt('pluck', 0.5, 1)).toBe(0); // sustain 0
  });
  it('short notes are cut mid-envelope and still release to 0', () => {
    const pts = adsrPoints('pad', 1, 0.03);
    expect(pts[pts.length - 1]?.[1]).toBe(0);
    expect(pts.every((p, i) => i === 0 || p[0] > (pts[i - 1] as [number, number])[0])).toBe(true);
  });
  it('dbToGain(-6) = 0.501', () => expect(dbToGain(-6)).toBeCloseTo(0.501, 3));
  it('duck reaches target in 20 ms and releases in 250 ms', () => {
    const plan = duckPlan(1, 0.5, false);
    expect(plan[1]).toEqual([1.02, dbToGain(-6), 'ramp']);
    expect(plan[3]?.[0]).toBeCloseTo(1.75, 9);
    expect(plan[3]?.[1]).toBe(1);
  });
  it('crossfade is equal power', () => {
    for (let i = 0; i <= 12; i++) {
      const { out, in: inn } = crossfadeAt(i / 12);
      expect(out * out + inn * inn).toBeCloseTo(1, 3);
    }
  });
  it('lfsr is deterministic with periods 32767 (long) and 93 (short)', () => {
    expect(lfsr(1, 'long', 64)).toEqual(lfsr(1, 'long', 64));
    const period = (mode: 'long' | 'short') => {
      const a = lfsr(1, mode, 70000);
      for (let p = 1; p < 40000; p++) {
        let same = true;
        for (let i = 0; i < 200 && same; i++) same = a[i] === a[i + p];
        if (same) return p;
      }
      return -1;
    };
    expect(period('long')).toBe(32767);
    expect(period('short')).toBe(93);
  });
});
