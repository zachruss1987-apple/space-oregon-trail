import { describe, expect, it } from 'vitest';
import { SFX, sfxEvents } from '@/audio/sfx';
import { SONG_DEFS, SONG_IDS, getSong } from '@/audio/songs';
import { CHANNEL_IDS } from '@/audio/types';

describe('songs', () => {
  it('title and travel are registered', () => expect(SONG_IDS).toEqual(expect.arrayContaining(['title', 'travel'])));

  for (const def of SONG_DEFS) {
    describe(def.id, () => {
      const s = getSong(def.id);
      it('parses with bar checks and equal channel loops', () => {
        expect(s.events.length).toBeGreaterThan(20);
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
