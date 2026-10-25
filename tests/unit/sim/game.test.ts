import { describe, expect, it } from 'vitest';
import { NAME_POOL } from '@/content';
import { createGame, isValidName, normalizeCrewNames, randomCrewNames } from '@/sim/game';
import { createRng } from '@/sim/rng';
import { fromJSON, toJSON } from '@/sim/serialize';
import { STATE_VERSION } from '@/sim/types';
import { travelingState } from './helpers';

describe('createGame (world.md initial state)', () => {
  it('builds the documented initial state', () => {
    const s = createGame({ profession: 'engineer', window: 2 }, createRng(1));
    expect(s.crew.map((c) => c.name)).toEqual(['Ezra', 'Temperance', 'Amos', 'Lucinda', 'Hollis']);
    expect(s.crew.every((c) => c.health === 100 && c.alive && c.awayDays === 0 && c.conditions.length === 0)).toBe(true);
    expect(s.credits).toBe(650); // T-039, decisions.md 2026-10-25 (was 800)
    expect(Object.values(s.supplies).every((v) => v === 0)).toBe(true);
    expect(s.broken).toEqual({ hull: false, pump: false, gyro: false });
    expect(s).toMatchObject({
      date: '2184-04-01', day: 0, segment: 1, distanceInSegment: 0, distanceTotal: 0, thrust: 'cruise', rations: 'full',
      weather: 'fair', delayDays: 0, strandedDays: 0, consecutiveOverburn: 0, consecutiveLowRations: 0,
      eventCooldownUntilDay: 0, scansThisSegment: 0, justCrossedHazard: false, arrivedAt: null, status: 'store',
      version: STATE_VERSION, offlineDrives: [],
    });
    expect(s.log).toHaveLength(1);
    expect(s.log[0]!.kind).toBe('depart');
  });

  it('credits by profession', () => {
    expect(createGame({ profession: 'executive', window: 1 }, createRng(1)).credits).toBe(1600);
    expect(createGame({ profession: 'farmer', window: 5 }, createRng(1)).credits).toBe(400);
  });

  it('uses custom names, reverting invalid ones to defaults', () => {
    const s = createGame({ profession: 'farmer', window: 1, crewNames: ['  Kit ', '', 'X'.repeat(13), 'Nellé'] }, createRng(1));
    expect(s.crew.map((c) => c.name)).toEqual(['Kit', 'Temperance', 'Amos', 'Lucinda', 'Hollis']);
  });

  it('rejects unknown profession or window', () => {
    expect(() => createGame({ profession: 'bard' as never, window: 1 }, createRng(1))).toThrow();
    expect(() => createGame({ profession: 'farmer', window: 9 as never }, createRng(1))).toThrow();
  });

  it('name helpers', () => {
    expect(isValidName('Ezra')).toBe(true);
    expect(isValidName('   ')).toBe(false);
    expect(normalizeCrewNames()).toHaveLength(5);
    const names = randomCrewNames(createRng(3));
    expect(new Set(names).size).toBe(5);
    expect(names.every((n) => NAME_POOL.includes(n))).toBe(true);
  });
});

describe('serialize', () => {
  it('round-trips a mid-game state', () => {
    const s = travelingState({ day: 40, weather: 'storm', offlineDrives: [2] });
    s.crew[1]!.conditions.push({ id: 'scurvy', remaining: 3, daysActive: 2 });
    expect(fromJSON(toJSON(s))).toEqual(s);
  });

  it('rejects bad input', () => {
    expect(() => fromJSON('null')).toThrow(/object/);
    expect(() => fromJSON(JSON.stringify({ version: 99, state: {} }))).toThrow(/version/);
    expect(() => fromJSON(JSON.stringify({ version: STATE_VERSION }))).toThrow(/no state/);
    expect(() => fromJSON(JSON.stringify({ version: STATE_VERSION, state: { crew: [] } }))).toThrow(/missing/);
    const s = travelingState();
    const broken = JSON.parse(toJSON(s));
    broken.state.crew = [];
    expect(() => fromJSON(JSON.stringify(broken))).toThrow(/crew/);
  });
});
