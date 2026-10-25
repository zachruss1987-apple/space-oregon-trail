/** Spec-driven audio tests: numbers typed from docs/design/audio.md, not read from src/. */
import { describe, expect, it } from 'vitest';
import { AudioManager } from '@/audio/AudioManager';
import { DUCK, crossfadeAt, dbToGain, duckPlan } from '@/audio/dsp';
import { SETTINGS_KEY, DEFAULT_SETTINGS, parseAudioSettings } from '@/audio/settings';
import { SFX } from '@/audio/sfx';
import { SONG_DEFS, getSong } from '@/audio/songs';
import { FakeCtx, FakeStorage, noTimer } from '../audio/fakes';

/** audio.md Songs table: id, tempo, beats per bar, intro bars, loop bars (0 = no loop; then length = intro bars). */
const SONGS: [string, number, number, number, number][] = [
  ['title', 116, 3, 2, 32], ['travel', 92, 4, 0, 16], ['station', 104, 2, 0, 16], ['danger', 140, 4, 2, 0],
  ['hazard', 100, 4, 0, 8], ['dirge', 60, 3, 4, 8], ['fanfare', 120, 4, 4, 8], ['mg.salvage', 128, 4, 0, 8],
  ['mg.thread', 150, 4, 0, 8], ['mg.flare', 160, 4, 0, 16], ['jingle.clean', 150, 4, 2, 0],
];

describe('audio.md songs', () => {
  it('registers exactly the eleven songs in the table', () => {
    expect(SONG_DEFS.map((d) => d.id).sort()).toEqual(SONGS.map((s) => s[0]).sort());
  });
  it.each(SONGS)('%s: %i BPM, %i beats/bar, %i intro bars, %i loop bars', (id, tempo, beats, intro, loop) => {
    const s = getSong(id);
    const bar = (beats * 60) / tempo;
    expect(s.tempo).toBe(tempo);
    expect(s.beatsPerBar).toBe(beats);
    expect(s.loops).toBe(loop > 0);
    if (loop > 0) {
      expect(s.loopStart).toBeCloseTo(intro * bar, 3);
      expect(s.loopEnd - s.loopStart).toBeCloseTo(loop * bar, 3);
    } else expect(s.lengthSec).toBeCloseTo(intro * bar, 2);
  });
  it('every song uses at most 3 tonal channels plus noise', () => {
    for (const d of SONG_DEFS) expect(Object.keys(d.channels).length, d.id).toBeLessThanOrEqual(4);
  });
});

/** audio.md SFX table: id, max duration ms (loops list one cycle), class. */
const SFX_SPEC: [string, number, 'ui' | 'duck'][] = [
  ['ui.move', 30, 'ui'], ['ui.select', 80, 'ui'], ['ui.back', 80, 'ui'], ['ui.deny', 120, 'ui'], ['text.tick', 15, 'ui'],
  ['store.buy', 150, 'ui'], ['store.sell', 150, 'ui'], ['trade.accept', 250, 'duck'], ['drive.hum', 1000, 'ui'],
  ['alarm', 720, 'duck'], ['hull.hit', 300, 'duck'], ['grapple.fire', 120, 'duck'], ['grapple.attach', 80, 'duck'],
  ['grapple.reel', 500, 'ui'], ['grapple.snap', 90, 'duck'], ['grapple.empty', 40, 'ui'], ['collision', 220, 'duck'],
  ['flare.warn', 1200, 'ui'], ['flare.hit', 350, 'duck'], ['crash', 1200, 'duck'], ['beacon.chime', 900, 'duck'],
  ['death.toll', 1800, 'duck'], ['arrival.bell', 1400, 'duck'], ['countdown.beep', 120, 'ui'], ['countdown.go', 250, 'ui'],
  ['pause', 100, 'ui'], ['event.ding', 120, 'ui'],
];

describe('audio.md SFX', () => {
  it.each(SFX_SPEC)('%s lasts at most %i ms and is class %s', (id, maxMs, cls) => {
    const d = SFX[id];
    expect(d, `${id} registered`).toBeDefined();
    expect(d?.dur).toBeLessThanOrEqual(maxMs);
    expect(d?.cls).toBe(cls);
    for (const n of d?.notes ?? []) expect(n.at + n.len, `${id} note ends inside the effect`).toBeLessThanOrEqual((d?.dur ?? 0) + 1e-9);
  });
  it('drive.hum and grapple.reel loop; text.tick is rate limited to 1 per 40 ms', () => {
    expect(SFX['drive.hum']?.loop).toBe(true);
    expect(SFX['grapple.reel']?.loop).toBe(true);
    expect(SFX['text.tick']?.minGap).toBe(40);
  });
});

describe('audio.md mixing', () => {
  it('duck is -6 dB (x0.501) with a 20 ms attack and 250 ms release', () => {
    expect(DUCK).toEqual({ db: -6, attack: 0.02, release: 0.25 });
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(-12)).toBeCloseTo(0.251, 3);
    const plan = duckPlan(10, 1, false);
    expect(plan[1]?.[0]).toBeCloseTo(10.02, 6);
    expect(plan[1]?.[1]).toBeCloseTo(0.501, 3);
    expect(plan[3]?.[0]).toBeCloseTo(11.25, 6);
    expect(plan[3]?.[1]).toBe(1);
  });
  it('crossfade is equal-power: out^2 + in^2 = 1 across the 300 ms', () => {
    for (let i = 0; i <= 30; i++) {
      const c = crossfadeAt(i / 30);
      expect(c.out ** 2 + c.in ** 2).toBeCloseTo(1, 3);
    }
    expect(crossfadeAt(0).out).toBeCloseTo(1, 6);
    expect(crossfadeAt(1).in).toBeCloseTo(1, 6);
  });
  it('a scene music change crossfades over 300 ms and the same id does not restart', async () => {
    const ctx = new FakeCtx();
    const m = new AudioManager({ createContext: () => ctx, storage: new FakeStorage(), timer: noTimer });
    await m.unlock();
    m.playMusic('title');
    ctx.currentTime = 1;
    const before = ctx.gains.length;
    m.playMusic('title');
    expect(ctx.gains.length).toBe(before);
    m.playMusic('travel');
    expect(m.playing).toBe('travel');
    const ends = ctx.gains.flatMap((g) => g.gain.calls).map((c) => c.t);
    expect(ends.some((t) => Math.abs(t - 1.3) < 1e-6), 'a gain ramp ends 300 ms after the change').toBe(true);
  });
  it('defaults master 0.8, music 0.6, sfx 0.8, unmuted; persisted under proxima.settings with v 1', () => {
    expect(DEFAULT_SETTINGS).toEqual({ master: 0.8, music: 0.6, sfx: 0.8, muted: false });
    expect(SETTINGS_KEY).toBe('proxima.settings');
    const storage = new FakeStorage();
    const m = new AudioManager({ createContext: () => new FakeCtx(), storage, timer: noTimer });
    m.setVolumes({ music: 0, muted: true });
    const saved = JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
    expect(saved).toMatchObject({ v: 1, music: 0, muted: true, master: 0.8, sfx: 0.8 });
    expect(parseAudioSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseAudioSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('audio.md autoplay unlock', () => {
  it('no AudioContext exists and nothing is scheduled before unlock; sfx is dropped, not queued', async () => {
    let created = 0;
    const ctx = new FakeCtx();
    const m = new AudioManager({ createContext: () => { created++; return ctx; }, storage: new FakeStorage(), timer: noTimer });
    m.playMusic('title');
    m.playSting('danger');
    expect(m.sfx('ui.select')).toBe(false);
    m.tick();
    expect(created).toBe(0);
    expect(m.state).toBe('locked');
    expect(ctx.oscs.length + ctx.sources.length + ctx.gains.length).toBe(0);
    expect(m.playing).toBe('title'); // recorded as pending
    await m.unlock();
    expect(created).toBe(1);
    m.tick();
    expect(ctx.oscs.length + ctx.sources.length).toBeGreaterThan(0); // pending music starts on unlock
    const oscs = ctx.oscs.length;
    expect(m.sfx('ui.select')).toBe(true);
    expect(ctx.oscs.length).toBeGreaterThan(oscs);
  });
});
