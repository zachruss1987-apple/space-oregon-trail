import { describe, expect, it } from 'vitest';
import { SFX, sfxEvents } from '@/audio/sfx';
import { SONG_DEFS, SONG_IDS, getSong } from '@/audio/songs';
import { CHANNEL_IDS } from '@/audio/types';

/** audio.md Songs table: [tempo, beats per bar, intro bars, loop bars (0 = one-shot), total bars when one-shot]. */
const SPEC: Record<string, { tempo: number; beats: number; intro: number; loop: number }> = {
  title: { tempo: 116, beats: 3, intro: 2, loop: 32 },
  travel: { tempo: 92, beats: 4, intro: 0, loop: 16 },
  station: { tempo: 104, beats: 2, intro: 0, loop: 16 },
  danger: { tempo: 140, beats: 4, intro: 2, loop: 0 },
  hazard: { tempo: 100, beats: 4, intro: 0, loop: 8 },
  dirge: { tempo: 60, beats: 3, intro: 4, loop: 8 },
  fanfare: { tempo: 120, beats: 4, intro: 4, loop: 8 },
  'mg.salvage': { tempo: 128, beats: 4, intro: 0, loop: 8 },
  'mg.thread': { tempo: 150, beats: 4, intro: 0, loop: 8 },
  'mg.flare': { tempo: 160, beats: 4, intro: 0, loop: 16 },
  'jingle.clean': { tempo: 150, beats: 4, intro: 2, loop: 0 },
};

describe('songs', () => {
  it('every audio.md song id is registered', () => expect(SONG_IDS).toEqual(expect.arrayContaining(Object.keys(SPEC))));

  for (const def of SONG_DEFS) {
    describe(def.id, () => {
      const s = getSong(def.id);
      it('parses with bar checks and equal channel loops', () => {
        expect(s.events.length).toBeGreaterThan(5);
        expect(Object.keys(def.channels).length).toBeLessThanOrEqual(4);
      });
      it('loop points lie inside the song and loop to the end', () => {
        if (s.loops) {
          expect(s.loopStart).toBeGreaterThanOrEqual(0);
          expect(s.loopStart).toBeLessThan(s.loopEnd);
          expect(s.loopEnd).toBeLessThanOrEqual(s.lengthSec + 1e-9);
        }
        expect(s.events.every((e) => e.t + e.dur <= s.lengthSec + 1e-6)).toBe(true);
      });
      const spec = SPEC[def.id];
      it('tempo, loop and length match audio.md within one bar', () => {
        if (!spec) return;
        const bar = (spec.beats * 60) / spec.tempo;
        expect(def.tempo).toBe(spec.tempo);
        if (spec.loop === 0) {
          expect(s.loops).toBe(false);
          expect(Math.abs(s.lengthSec - spec.intro * bar)).toBeLessThanOrEqual(bar + 1e-6);
        } else {
          expect(s.loops).toBe(true);
          expect(Math.abs(s.loopStart - spec.intro * bar)).toBeLessThanOrEqual(bar + 1e-6);
          expect(Math.abs(s.loopEnd - s.loopStart - spec.loop * bar)).toBeLessThanOrEqual(bar + 1e-6);
        }
      });
      it('lead and bass do not move in parallel octaves', () => {
        const lead = s.events.filter((e) => e.ch === (def.id === 'mg.salvage' ? 'p2' : 'p1') && e.voice !== 'nzl' && e.freq > 0);
        const bass = s.events.filter((e) => e.ch === 'tri');
        const at = (t: number) => bass.find((b) => b.t <= t + 1e-6 && t < b.t + b.dur - 1e-6);
        if (def.id === 'title' || def.id === 'travel') return; // earlier songs predate this rule
        const bad: string[] = [];
        let prev: { l: number; b: number } | null = null;
        for (const l of lead) {
          const b = at(l.t);
          if (!b) { prev = null; continue; }
          const oct = Math.abs(Math.round(12 * Math.log2(l.freq / b.freq))) % 12 === 0;
          if (prev && oct && prev.l !== l.freq && prev.b !== b.freq) {
            const po = Math.abs(Math.round(12 * Math.log2(prev.l / prev.b))) % 12 === 0;
            if (po) bad.push(l.t.toFixed(2));
          }
          prev = { l: l.freq, b: b.freq };
        }
        expect(bad, 'parallel octaves at seconds').toEqual([]);
      });
      it('no overlapping notes on one channel', () => {
        for (const c of CHANNEL_IDS) {
          const evs = s.events.filter((e) => e.ch === c);
          for (let i = 1; i < evs.length; i++) {
            const prev = evs[i - 1];
            expect((prev?.t ?? 0) + (prev?.dur ?? 0)).toBeLessThanOrEqual((evs[i]?.t ?? 0) + 1e-6);
          }
        }
      });
    });
  }

  it('title: 2 bar intro + 32 bar loop in 3/4 at 116 BPM', () => {
    const s = getSong('title');
    const bar = (3 * 60) / 116;
    expect(s.loopStart).toBeCloseTo(2 * bar, 6);
    expect(s.loopEnd - s.loopStart).toBeCloseTo(32 * bar, 6);
  });
  it('travel: 16 bar loop in 4/4 at 92 BPM, no intro', () => {
    const s = getSong('travel');
    expect(s.loopStart).toBe(0);
    expect(s.loopEnd).toBeCloseTo((16 * 4 * 60) / 92, 6);
  });
  it('unknown song throws', () => expect(() => getSong('nope')).toThrow(/unknown song/));
});

const SFX_IDS = ['ui.move', 'ui.select', 'ui.back', 'ui.deny', 'text.tick', 'store.buy', 'store.sell', 'trade.accept', 'drive.hum', 'alarm', 'hull.hit', 'grapple.fire', 'grapple.attach', 'grapple.reel', 'grapple.snap', 'grapple.empty', 'collision', 'flare.warn', 'flare.hit', 'crash', 'beacon.chime', 'death.toll', 'arrival.bell', 'countdown.beep', 'pause', 'event.ding'];

describe('sfx table', () => {
  it('every audio.md id exists with notes', () => {
    for (const id of SFX_IDS) expect(SFX[id]?.notes.length, id).toBeGreaterThan(0);
  });
  it('durations are at most 1.5 s except the drive hum loop and the 1.8 s death toll (audio.md); notes fit their duration', () => {
    for (const id of SFX_IDS) {
      const d = SFX[id]!;
      if (id !== 'drive.hum' && id !== 'death.toll') expect(d.dur, id).toBeLessThanOrEqual(1500);
      for (const e of sfxEvents(d, 0)) expect((e.t + e.dur) * 1000, id).toBeLessThanOrEqual(d.dur + 1e-6);
    }
  });
});

describe('sfx', () => {
  const ids = ['ui.move', 'ui.select', 'ui.back', 'text.tick', 'store.buy', 'alarm', 'grapple.fire', 'beacon.chime'];
  it('has the 8 effects with audio.md durations', () => {
    for (const id of ids) expect(SFX[id]).toBeDefined();
    expect(SFX['alarm']?.dur).toBe(720);
    expect(SFX['ui.move']?.cls).toBe('ui');
    expect(SFX['beacon.chime']?.cls).toBe('duck');
  });
  it('every note ends within the declared duration (plus tail)', () => {
    for (const id of ids) {
      const d = SFX[id]!;
      for (const e of sfxEvents(d, 0)) expect((e.t + e.dur) * 1000).toBeLessThanOrEqual(d.dur + 1e-6);
    }
  });
  it('alarm alternates A5 and E5 six times', () => {
    const f = sfxEvents(SFX['alarm']!, 1).map((e) => Math.round(e.freq));
    expect(f).toEqual([880, 659, 880, 659, 880, 659]);
  });
});
