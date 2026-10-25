/** serialize.ts / hazards.md "State and intents summary": an M1 (version 1) save loads with the M2 defaults. */
import { describe, expect, it } from 'vitest';
import { applyAction, createRng, fromJSON, toJSON, type GameState } from '@/sim';
import { ship } from './spec-helpers';

/** What an M1 build wrote: no crossing, route or station fields, envelope version 1. */
function strip<T extends object>(s: T): Record<string, unknown> {
  const o = { ...s } as Record<string, unknown>;
  for (const k of ['crossing', 'route', 'station', 'version']) delete o[k];
  return o;
}
function m1Save(state: GameState): string {
  return JSON.stringify({ version: 1, state: { ...strip(state), version: 1 } });
}

describe('M1 -> M2 save migration', () => {
  it('fills crossing = null, route = "oort", station = null and bumps the version', () => {
    const s = ship({ credits: 123.45, day: 17 });
    const loaded = fromJSON(m1Save(s));
    expect(loaded.crossing).toBeNull();
    expect(loaded.route).toBe('oort');
    expect(loaded.station).toBeNull();
    expect(loaded.version).toBe(2);
  });

  it('keeps every M1 field untouched', () => {
    const s = ship({ credits: 123.45, day: 17, arrivedAt: 4, rations: 'paste' });
    const loaded = fromJSON(m1Save(s));
    expect(strip(loaded)).toEqual(strip(s));
  });

  it('does not overwrite M2 fields that are present', () => {
    const s = ship({ route: 'direct' });
    const raw = JSON.parse(m1Save(s)) as { state: Record<string, unknown> };
    raw.state['route'] = 'direct';
    expect(fromJSON(JSON.stringify(raw)).route).toBe('direct');
  });

  it('a migrated game plays on: continue works and a round trip is stable', () => {
    const loaded = fromJSON(m1Save(ship()));
    const r = applyAction(loaded, { type: 'continue' }, createRng(1));
    expect(r.error).toBeUndefined();
    expect(r.state.day).toBe(loaded.day + 1);
    expect(fromJSON(toJSON(r.state))).toEqual(r.state);
  });

  it('a migrated save has no station visit, so there are no trade offers to accept', () => {
    const loaded = fromJSON(m1Save(ship({ arrivedAt: 3, segment: 3 })));
    expect(loaded.station).toBeNull();
    expect(applyAction(loaded, { type: 'trade', offer: 0 }, createRng(1)).error).toBeTruthy();
  });

  it('rejects unknown versions, bad JSON and missing fields', () => {
    expect(() => fromJSON('not json')).toThrow();
    expect(() => fromJSON(JSON.stringify({ version: 99, state: ship() }))).toThrow();
    expect(() => fromJSON(JSON.stringify({ version: 0, state: ship() }))).toThrow();
    expect(() => fromJSON(JSON.stringify({ version: 1, state: {} }))).toThrow();
    expect(() => fromJSON('null')).toThrow();
  });
});
