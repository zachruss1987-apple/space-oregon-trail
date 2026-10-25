/** Random-intent fuzzing over many seeds: whatever the player does, the sim's invariants hold. */
import { describe, expect, it } from 'vitest';
import {
  applyAction, buy, createGame, createRng, depart, fromJSON, policyCross, policyShop, toJSON, type GameState, type Intent, type ProfessionId, type Rng, type Status,
  type SupplyKey, type WindowId,
} from '@/sim';
import { daysBetween } from './spec-helpers';

const MAX_DAYS = 400;
const PROFESSIONS: ProfessionId[] = ['executive', 'engineer', 'farmer'];
const ITEMS: SupplyKey[] = ['drives', 'rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'];
const RANK: Record<Status, number> = { store: 0, traveling: 1, arrived: 2, dead: 2, adrift: 2 };

/** Careful play (even seeds) mostly travels, rests and repairs, so runs reach the later segments and the arrival. */
function carefulIntent(r: Rng): Intent {
  const x = r.next();
  if (x < 0.8) return { type: 'continue' };
  if (x < 0.88) return { type: 'rest', days: r.int(1, 4) };
  if (x < 0.93) return { type: 'repair', part: r.pick(['hull', 'pump', 'gyro'] as const) };
  if (x < 0.97) return { type: 'scan' };
  return { type: 'setRations', rations: r.pick(['full', 'half'] as const) };
}

function randomIntent(r: Rng): Intent {
  const x = r.next();
  if (x < 0.5) return { type: 'continue' };
  if (x < 0.62) return { type: 'rest', days: r.int(1, 9) };
  if (x < 0.7) return { type: 'setThrust', thrust: r.pick(['cruise', 'cruise', 'cruise', 'hard', 'overburn'] as const) };
  if (x < 0.78) return { type: 'setRations', rations: r.pick(['full', 'full', 'half', 'half', 'paste'] as const) };
  if (x < 0.88) return { type: 'repair', part: r.pick(['hull', 'pump', 'gyro'] as const) };
  if (x < 0.95) return { type: 'scan' };
  return { type: 'rest', days: r.pick([0, 10, 99]) }; // out-of-range on purpose: must be refused
}

/**
 * hazards.md "Flow": a hazard arrival now pauses in `state.crossing` until a `cross` intent, so the fuzz must choose a
 * method (any of the four; blocked ones are refused like other bad intents). economy.md / hazards.md: road-station
 * buy/sell/trade and the Titan route intents are mixed in too (0 days).
 */
function m2Intent(s: GameState, r: Rng, careful: boolean): Intent | null {
  if (s.crossing && r.chance(careful ? 0.9 : 0.5)) {
    return { type: 'cross', method: r.pick(careful ? (['thread', 'shields', 'tug', 'pilot'] as const) : (['thread', 'shields', 'tug', 'pilot', 'pilot'] as const)) };
  }
  if (s.arrivedAt !== null && r.chance(0.3)) {
    const x = r.next();
    if (x < 0.3) return { type: 'buy', item: r.pick(ITEMS), packs: r.int(0, 4) };
    if (x < 0.55) return { type: 'sell', item: r.pick(ITEMS), packs: r.int(0, 3) };
    if (x < 0.85) return { type: 'trade', offer: r.int(0, 3) };
    return { type: 'route', via: r.pick(['oort', 'direct'] as const) };
  }
  return null;
}

/** Shop at random (some purchases are refused on purpose), then depart if possible. */
function shop(s: GameState, r: Rng): GameState {
  let state = s;
  for (let i = 0; i < 10; i++) {
    const item = r.pick(ITEMS);
    const res = buy(state, item, r.int(0, 12));
    if (res.error) expect(res.state).toBe(state);
    state = res.state;
  }
  if (state.supplies.drives === 0 && r.chance(0.9)) state = buy(state, 'drives', 3).state;
  if (state.supplies.rations < 1500 && r.chance(0.7)) state = buy(state, 'rations', Math.min(1500, Math.floor(state.credits / 0.3))).state;
  return state;
}

function checkState(s: GameState, label: string): void {
  for (const [k, v] of Object.entries(s.supplies)) {
    expect(Number.isInteger(v) && v >= 0, `${label}: supplies.${k} = ${v}`).toBe(true);
  }
  expect(s.credits, `${label}: credits`).toBeGreaterThanOrEqual(0);
  expect(s.crew, label).toHaveLength(5);
  for (const c of s.crew) {
    expect(Number.isInteger(c.health) && c.health >= 0 && c.health <= 100, `${label}: health ${c.health}`).toBe(true);
    expect(c.conditions.length, `${label}: conditions`).toBeLessThanOrEqual(2);
    expect(new Set(c.conditions.map((x) => x.id)).size, `${label}: duplicate condition`).toBe(c.conditions.length);
    expect(c.awayDays, label).toBeGreaterThanOrEqual(0);
    if (!c.alive) {
      expect(c.health, `${label}: dead with health`).toBe(0);
      expect(c.cause, `${label}: dead without cause`).not.toBeNull();
      expect(c.awayDays, label).toBe(0);
      expect(c.conditions, label).toEqual([]);
    } else {
      expect(c.cause, label).toBeNull();
    }
  }
  expect(s.deaths, `${label}: deaths counter`).toBe(s.crew.filter((c) => !c.alive).length);
  expect(s.segment, `${label}: segment`).toBeGreaterThanOrEqual(1);
  expect(s.segment, `${label}: segment`).toBeLessThanOrEqual(16);
  expect(s.distanceTotal, label).toBeGreaterThanOrEqual(0);
  expect(s.distanceTotal, label).toBeLessThanOrEqual(2040 + 1e-6);
  expect(s.distanceInSegment, label).toBeGreaterThanOrEqual(0);
  expect(s.delayDays, label).toBeGreaterThanOrEqual(0);
  expect(s.strandedDays, label).toBeGreaterThanOrEqual(0);
  expect(s.offlineDrives.length, label).toBeLessThanOrEqual(s.supplies.drives);
  if (s.arrivedAt !== null) expect(s.arrivedAt >= 0 && s.arrivedAt <= 16, label).toBe(true);
  if (s.status === 'arrived') expect(s.crew.some((c) => c.alive), label).toBe(true);
  if (s.status === 'dead') expect(s.crew.some((c) => c.alive), label).toBe(false);
  if (s.status === 'adrift') expect(s.supplies.drives, label).toBe(0);
}

interface RunResult { json: string; steps: number; status: Status; days: number }

/** One fuzzed run: checks every invariant after every step. */
function fuzz(seed: number, check: boolean): RunResult {
  const rng = createRng(seed * 7919 + 13);
  const choice = createRng(seed * 104729 + 7); // intent chooser, independent of the sim's rng
  const profession = PROFESSIONS[seed % 3]!;
  const window = ((seed % 5) + 1) as WindowId;
  const fresh = createGame({ profession, window }, rng);
  let s = seed % 2 === 0 ? policyShop(fresh) : shop(fresh, choice);
  let status = s.status;
  let steps = 0;
  const dep = depart(s, rng);
  if (dep.error) expect(dep.state).toBe(s);
  s = dep.state;
  if (check) checkState(s, `seed ${seed} after depart`);
  let guard = 0;
  while (s.status === 'traveling' && s.day < MAX_DAYS && guard++ < 2000) {
    const intent = m2Intent(s, choice, seed % 2 === 0) ?? (seed % 2 === 0 ? carefulIntent(choice) : randomIntent(choice));
    const before = s;
    const r = applyAction(s, intent, rng);
    steps++;
    s = r.state;
    if (check) {
      const label = `seed ${seed} step ${steps} ${JSON.stringify(intent)} day ${before.day}`;
      expect(RANK[s.status], `${label}: status ${before.status} -> ${s.status}`).toBeGreaterThanOrEqual(RANK[before.status]);
      if (r.error) {
        expect(s, `${label}: refused intents return the same state`).toBe(before);
        expect(r.entries, label).toEqual([]);
      } else {
        const dd = s.day - before.day;
        if (['setThrust', 'setRations', 'buy', 'sell', 'trade', 'route'].includes(intent.type)) {
          expect(dd, label).toBe(0);
        } else if (intent.type === 'cross') {
          // hazards.md: resolution costs no day; a pilot runs up to 4 wait days.
          expect(dd, label).toBeGreaterThanOrEqual(0);
          expect(dd, label).toBeLessThanOrEqual(4);
        } else if (intent.type === 'rest') {
          expect(dd, label).toBeGreaterThanOrEqual(1);
          expect(dd, label).toBeLessThanOrEqual(intent.days);
        } else {
          expect(dd, label).toBe(1);
        }
        expect(daysBetween(before.date, s.date), `${label}: date advances 1 day per tick`).toBe(dd);
        expect(s.segment, label).toBeGreaterThanOrEqual(before.segment);
        expect(s.distanceTotal, label).toBeGreaterThanOrEqual(before.distanceTotal - 1e-9);
        for (const e of r.entries) expect(e.day, label).toBeGreaterThanOrEqual(before.day);
        expect(s.log.length, `${label}: log grows by the entries returned`).toBe(before.log.length + r.entries.length);
      }
      checkState(s, label);
      if (steps % 40 === 0) {
        const j = toJSON(s);
        expect(toJSON(fromJSON(j)), `${label}: toJSON(fromJSON(x)) is stable`).toBe(j);
      }
    }
  }
  status = s.status;
  return { json: toJSON(s), steps, status, days: s.day };
}

describe('Fuzzed invariants (300 seeds x up to 400 days)', () => {
  const endings: Record<string, number> = {};
  let totalSteps = 0;
  it.each([[1, 100], [101, 200], [201, 300]])('supplies, health, day, date, segment and status stay legal after every step: seeds %i-%i', (from, to) => {
    for (let seed = from; seed <= to; seed++) {
      const r = fuzz(seed, true);
      endings[r.status] = (endings[r.status] ?? 0) + 1;
      totalSteps += r.steps;
    }
  }, 20000);

  it('the fuzz visits both death and arrival endings, so it proves something', () => {
    expect(totalSteps).toBeGreaterThan(10000);
    expect(endings['dead']).toBeGreaterThan(20);
    expect(endings['arrived']).toBeGreaterThan(5);
  });

  it('after the run ends every intent is refused and the state does not change', () => {
    let tested = 0;
    for (let seed = 1; seed <= 80 && tested < 12; seed++) {
      const rng = createRng(seed);
      let s = shop(createGame({ profession: 'executive', window: 3 }, rng), createRng(seed + 1000));
      s = depart(s, rng).state;
      for (let i = 0; i < 600 && s.status === 'traveling'; i++) s = applyAction(s, s.crossing ? policyCross(s) : { type: 'continue' }, rng).state;
      if (s.status === 'traveling' || s.status === 'store') continue;
      tested++;
      for (const intent of [{ type: 'continue' }, { type: 'rest', days: 2 }, { type: 'scan' }, { type: 'cross', method: 'tug' }, { type: 'trade', offer: 0 }] as Intent[]) {
        const r = applyAction(s, intent, rng);
        expect(r.error).toBeTruthy();
        expect(r.state).toBe(s);
      }
    }
    expect(tested).toBeGreaterThan(5);
  });

  it('intents are refused in the store (nothing runs before departure)', () => {
    const s = createGame({ profession: 'executive', window: 1 }, createRng(1));
    expect(applyAction(s, { type: 'continue' }, createRng(1)).error).toBeTruthy();
  });

  it('save/load: toJSON(fromJSON(x)) is stable at every stage of the game', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      let s = shop(createGame({ profession: PROFESSIONS[seed % 3]!, window: 1 }, rng), createRng(seed));
      const j0 = toJSON(s);
      expect(toJSON(fromJSON(j0))).toBe(j0);
      s = depart(s, rng).state;
      for (let i = 0; i < 60 && s.status === 'traveling'; i++) {
        s = applyAction(s, { type: 'continue' }, rng).state;
        if (i % 12 === 0) {
          const j = toJSON(s);
          expect(toJSON(fromJSON(j))).toBe(j);
          expect(fromJSON(j)).toEqual(s);
        }
      }
    }
  });

  it('fromJSON rejects garbage and wrong versions', () => {
    expect(() => fromJSON('not json')).toThrow();
    expect(() => fromJSON('{}')).toThrow();
    expect(() => fromJSON('null')).toThrow();
  });

  it('same seed + same intents reproduce byte-identical runs (100 seeds)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const a = fuzz(seed, false);
      const b = fuzz(seed, false);
      expect(b.json, `seed ${seed}`).toBe(a.json);
    }
  });

  it('different seeds give different runs (the rng is actually used)', () => {
    const outs = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) outs.add(fuzz(seed, false).json);
    expect(outs.size).toBeGreaterThan(25);
  });
});
