import { describe, expect, it } from 'vitest';
import { AudioManager } from '@/audio/AudioManager';
import { SETTINGS_KEY, parseAudioSettings } from '@/audio/settings';
import { dbToGain } from '@/audio/dsp';
import { FakeCtx, FakeStorage, noTimer } from './fakes';

function setup(storage = new FakeStorage()) {
  const ctx = new FakeCtx();
  const m = new AudioManager({ createContext: () => ctx, storage, timer: noTimer });
  return { ctx, m, storage };
}

describe('unlock', () => {
  it('is locked until unlock(); unlock creates the context and resumes it', async () => {
    const { ctx, m } = setup();
    expect(m.state).toBe('locked');
    expect(ctx.gains).toHaveLength(0);
    expect(await m.unlock()).toBe(true);
    expect(ctx.resumeCalls).toBe(1);
    expect(m.state).toBe('running');
    expect(m.unlockAttempts).toBe(1);
  });
  it('a refused resume leaves it suspended but still counts the attempt', async () => {
    const { ctx, m } = setup();
    ctx.refuseResume = true;
    expect(await m.unlock()).toBe(false);
    expect(m.state).toBe('suspended');
    expect(m.unlockAttempts).toBe(1);
  });
  it('sfx before unlock is dropped, not queued', async () => {
    const { ctx, m } = setup();
    expect(m.sfx('ui.select')).toBe(false);
    await m.unlock();
    expect(ctx.oscs).toHaveLength(0);
  });
  it('music requested before unlock starts on unlock without crossfade', async () => {
    const { ctx, m } = setup();
    m.playMusic('travel');
    expect(m.playing).toBe('travel');
    expect(ctx.gains).toHaveLength(0);
    await m.unlock();
    m.tick();
    expect(ctx.sources.length + ctx.oscs.length).toBeGreaterThan(0);
  });
});

describe('music', () => {
  it('schedules notes within the 100 ms look-ahead at absolute time, then continues as time advances', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    m.playMusic('travel');
    const first = ctx.oscs.length + ctx.sources.length;
    expect(first).toBeGreaterThan(0);
    for (const o of [...ctx.oscs, ...ctx.sources]) expect((o as { started: number[] }).started[0]).toBeLessThanOrEqual(0.05 + 0.1 + 1e-9);
    ctx.currentTime = 1;
    m.tick();
    expect(ctx.oscs.length + ctx.sources.length).toBeGreaterThan(first);
  });
  it('same id does not restart', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    m.playMusic('travel');
    const gains = ctx.gains.length;
    m.playMusic('travel');
    expect(ctx.gains.length).toBe(gains);
  });
  it('crossfade schedules equal-power gains over 300 ms and retires the old track', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    m.playMusic('travel');
    const buses = () => ctx.gains.filter((g) => g.connected.includes(ctx.gains[3]));
    const oldBus = buses().at(-1)!;
    ctx.currentTime = 2;
    m.playMusic('title', { crossfadeMs: 300 });
    const newBus = buses().at(-1)!;
    expect(newBus).not.toBe(oldBus);
    const lins = (g: typeof newBus) => g.gain.calls.filter((c) => c.fn === 'lin');
    const inn = lins(newBus);
    const out = lins(oldBus).filter((c) => c.t > 2);
    expect(inn.at(-1)).toMatchObject({ v: 1 });
    expect(inn.at(-1)!.t).toBeCloseTo(2.3, 9);
    expect(out.at(-1)!.v).toBeCloseTo(0, 9);
    for (let i = 0; i < inn.length; i++) expect((inn[i]!.v as number) ** 2 + (out[i]!.v as number) ** 2).toBeCloseTo(1, 2);
    ctx.currentTime = 3;
    m.tick();
    expect(oldBus.disconnected).toBe(true);
    expect(m.playing).toBe('title');
  });
  it('stopMusic clears playing', async () => {
    const { m } = setup();
    await m.unlock();
    m.playMusic('travel');
    m.stopMusic();
    expect(m.playing).toBeNull();
  });
  it('unknown song throws', () => expect(() => setup().m.playMusic('nope')).toThrow());
});

describe('sfx and ducking', () => {
  it('a duck sfx drops the duck bus -6 dB in 20 ms and releases 250 ms after it ends', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    ctx.currentTime = 1;
    expect(m.sfx('alarm')).toBe(true);
    const duck = ctx.gains[3]!; // master, music, sfx, duck
    const lin = duck.gain.calls.filter((c) => c.fn === 'lin');
    expect(lin[0]!.t).toBeCloseTo(1.02, 9);
    expect(lin[0]!.v).toBeCloseTo(dbToGain(-6), 9);
    expect(lin[1]!.t).toBeCloseTo(1 + 0.72 + 0.25, 9);
    expect(lin[1]!.v).toBe(1);
  });
  it('a ui sfx does not duck', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    m.sfx('ui.move');
    expect(ctx.gains[3]!.gain.calls.filter((c) => c.fn === 'lin')).toHaveLength(0);
  });
  it('text.tick is rate limited to 1 per 40 ms', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    expect(m.sfx('text.tick')).toBe(true);
    ctx.currentTime = 0.02;
    expect(m.sfx('text.tick')).toBe(false);
    ctx.currentTime = 0.05;
    expect(m.sfx('text.tick')).toBe(true);
  });
  it('polyphony is capped at 8 simultaneous sfx', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    for (let i = 0; i < 12; i++) m.sfx('beacon.chime');
    const stopped = ctx.gains.filter((g) => g.gain.calls.some((c) => c.fn === 'lin' && c.v === 0 && c.t < 0.1));
    expect(stopped.length).toBeGreaterThanOrEqual(4);
  });
  it('unknown sfx id returns false', async () => {
    const { m } = setup();
    await m.unlock();
    expect(m.sfx('nope')).toBe(false);
  });
});

describe('volumes and persistence', () => {
  it('defaults to master .8, music .6, sfx .8', () => {
    expect(setup().m.volumes).toEqual({ master: 0.8, music: 0.6, sfx: 0.8, muted: false });
  });
  it('setVolume applies to the buses and clamps', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    m.setVolume('music', 2);
    m.setVolume('sfx', 0.25);
    expect(ctx.gains[1]!.gain.value).toBe(1);
    expect(ctx.gains[2]!.gain.value).toBe(0.25);
  });
  it('mute ramps master to 0 over 30 ms and unmute restores it', async () => {
    const { ctx, m } = setup();
    await m.unlock();
    ctx.currentTime = 1;
    m.mute(true);
    const last = ctx.gains[0]!.gain.calls.filter((c) => c.fn === 'lin').at(-1)!;
    expect(last).toMatchObject({ v: 0 });
    expect(last.t).toBeCloseTo(1.03, 9);
    m.mute(false);
    expect(ctx.gains[0]!.gain.value).toBe(0.8);
  });
  it('round-trips through storage without clobbering other settings', () => {
    const storage = new FakeStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ v: 1, typewriter: false, textSpeedMs: 30 }));
    const a = setup(storage).m;
    a.setVolumes({ master: 0.3, music: 0.1, sfx: 0.9 });
    a.mute(true);
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY)!);
    expect(raw).toMatchObject({ v: 1, typewriter: false, textSpeedMs: 30, master: 0.3, music: 0.1, sfx: 0.9, muted: true });
    const b = setup(storage).m;
    expect(b.volumes).toEqual({ master: 0.3, music: 0.1, sfx: 0.9, muted: true });
  });
  it('garbage storage falls back to defaults', () => {
    expect(parseAudioSettings('{{{')).toEqual({ master: 0.8, music: 0.6, sfx: 0.8, muted: false });
    expect(parseAudioSettings(JSON.stringify({ master: 'x', music: 5, sfx: -1, muted: 1 }))).toEqual({ master: 0.8, music: 1, sfx: 0, muted: false });
    expect(parseAudioSettings(null).master).toBe(0.8);
  });
});
