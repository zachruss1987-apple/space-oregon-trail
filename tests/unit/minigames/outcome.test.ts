/** Mini-game outcome -> intent mapping (minigames.md "Reference policy") and the sim's skip-with-penalty scan. */
import { describe, expect, it } from 'vitest';
import { outcomeIntent } from '@/minigames/outcome';
import { applyAction, intentBlocker } from '@/sim/actions';
import { createRng } from '@/sim/rng';
import { resolveScan } from '@/sim/salvage';
import type { LogEntry, SalvageResult } from '@/sim/types';
import { scriptedRng, travelingState } from '../sim/helpers';

const HAUL: SalvageResult = { kind: 'salvage', rations: 20, plates: 0, pumps: 0, gyros: 0, chargesUsed: 4, crewHurt: 0 };

describe('outcomeIntent', () => {
  it('salvage: result, skip (penalty), auto (the 5-charge scan)', () => {
    expect(outcomeIntent('salvage', { result: HAUL })).toEqual({ type: 'salvage', result: HAUL });
    expect(outcomeIntent('salvage', { skipped: true })).toEqual({ type: 'salvage', skipped: true });
    expect(outcomeIntent('salvage', { auto: true })).toEqual({ type: 'salvage' });
  });

  it('threading / flare: cross thread with or without a result; skip waits for the sim variant', () => {
    expect(outcomeIntent('threading', { result: { kind: 'threading', hits: 1, bonus: null } })).toMatchObject({ type: 'cross', method: 'thread' });
    expect(outcomeIntent('flare', { auto: true })).toEqual({ type: 'cross', method: 'thread' });
    expect(() => outcomeIntent('flare', { skipped: true })).toThrow();
  });
});

describe('skip with penalty (salvage)', () => {
  it('logs info/skipped, then rolls d100 - 10 (a 30 becomes 20: nothing)', () => {
    const s = travelingState({ supplies: { charges: 12 } });
    const out: LogEntry[] = [];
    // draws: skipped text, d100 (0.295 -> 30), nothing text
    expect(resolveScan(s, scriptedRng([0, 0.295, 0]), out, 10)).toBe(0);
    expect(out.map((e) => `${e.kind}/${e.id}`)).toEqual(['info/skipped', 'scan/nothing']);
    expect(s.supplies.charges).toBe(7);
    const plain = travelingState({ supplies: { charges: 12 } });
    expect(resolveScan(plain, scriptedRng([0.295, 0.5, 0]), [], 0)).toBeGreaterThan(0);
  });

  it('clamps the roll at 1 and, with fewer than 5 charges, spends them all for nothing', () => {
    const s = travelingState({ supplies: { charges: 3 } });
    const out: LogEntry[] = [];
    expect(resolveScan(s, createRng(5), out, 10)).toBe(0);
    expect(s.supplies.charges).toBe(0);
    expect(s.scansThisSegment).toBe(1);
    expect(out.map((e) => e.id)).toEqual(['skipped', 'nothing']);
    const low = travelingState({ supplies: { charges: 9 } });
    const lowOut: LogEntry[] = [];
    resolveScan(low, scriptedRng([0, 0.01, 0]), lowOut, 10);
    expect(lowOut[1]?.id).toBe('nothing');
  });

  it('the skipped intent takes a day and needs >= 1 charge', () => {
    const s = travelingState({ supplies: { charges: 2 } });
    expect(intentBlocker(s, { type: 'salvage', skipped: true })).toBeNull();
    expect(intentBlocker(s, { type: 'salvage' })).not.toBeNull();
    const r = applyAction(s, { type: 'salvage', skipped: true }, createRng(9));
    expect(r.error).toBeUndefined();
    expect(r.state.day).toBe(s.day + 1);
    expect(r.state.supplies.charges).toBe(0);
    expect(r.entries.some((e) => e.kind === 'info' && e.id === 'skipped')).toBe(true);
    expect(intentBlocker(r.state, { type: 'salvage', skipped: true })).toBe('No drone charges.');
  });
});
