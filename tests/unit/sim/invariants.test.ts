import { describe, expect, it } from 'vitest';
import { PROFESSION_ORDER, RATIONS, THRUST, WAYPOINTS, WINDOW_ORDER, type RationId, type ThrustId } from '@/content';
import { applyAction } from '@/sim/actions';
import { createGame } from '@/sim/game';
import { policyIntent, policyShop } from '@/sim/policy';
import { createRng, type Rng } from '@/sim/rng';
import { fromJSON, toJSON } from '@/sim/serialize';
import { depart } from '@/sim/store';
import type { GameState, Intent } from '@/sim/types';

const SEEDS = 200;

function noNaN(value: unknown, path = 'state'): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}`);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) noNaN(v, `${path}.${k}`);
  }
}

function fail(msg: string): never {
  throw new Error(msg);
}

/** Plain checks (no expect per value) to keep 400 full runs fast. */
function check(s: GameState, prevDay: number): void {
  noNaN(s);
  if (s.day < prevDay) fail(`day went back: ${prevDay} -> ${s.day}`);
  for (const [k, v] of Object.entries(s.supplies)) if (!Number.isInteger(v) || v < 0) fail(`supplies.${k} = ${v}`);
  if (s.supplies.plates > 3 || s.supplies.pumps > 3 || s.supplies.gyros > 3) fail('spare over cap');
  if (s.credits < 0) fail(`credits ${s.credits}`);
  if (s.offlineDrives.length > s.supplies.drives) fail('more offline drives than drives');
  for (const c of s.crew) {
    if (!Number.isInteger(c.health) || c.health < 0 || c.health > 100) fail(`${c.name} health ${c.health}`);
    if (c.conditions.length > 2) fail(`${c.name} has ${c.conditions.length} conditions`);
    if (new Set(c.conditions.map((x) => x.id)).size !== c.conditions.length) fail('duplicate condition');
    if (!c.alive && c.cause === null) fail('dead without cause');
  }
  if (s.distanceTotal > 2040 + 1e-9) fail(`distance ${s.distanceTotal}`);
  const base = WAYPOINTS[s.segment - 1]!.cumulative;
  if (s.status !== 'arrived' && Math.abs(s.distanceTotal - (base + s.distanceInSegment)) > 1e-6) fail('distance bookkeeping');
}

function randomIntent(s: GameState, rng: Rng): Intent {
  const r = rng.next();
  if (r < 0.05) return { type: 'setThrust', thrust: rng.pick(Object.keys(THRUST) as ThrustId[]) };
  if (r < 0.1) return { type: 'setRations', rations: rng.pick(Object.keys(RATIONS) as RationId[]) };
  if (r < 0.15) return { type: 'rest', days: rng.int(1, 9) };
  if (r < 0.2) return { type: 'scan' };
  if (r < 0.25) return { type: 'repair', part: rng.pick(['hull', 'pump', 'gyro'] as const) };
  return policyIntent(s);
}

function play(seed: number, chooser: (s: GameState, rng: Rng) => Intent): GameState {
  const rng = createRng(seed);
  let s = createGame({ profession: rng.pick(PROFESSION_ORDER), window: rng.pick(WINDOW_ORDER) }, rng);
  s = depart(policyShop(s), rng).state;
  check(s, 0);
  while (s.status === 'traveling' && s.day < 1000) {
    const r = applyAction(s, chooser(s, rng), rng);
    check(r.state, s.day);
    for (const e of r.entries) if (typeof e.text !== 'string' || e.text.length === 0) fail(`empty log text (${e.kind})`);
    s = r.state;
  }
  return s;
}

describe(`invariants over ${SEEDS} seeds`, () => {
  it('policy play keeps supplies ≥ 0, health 0–100, day monotonic, no NaN', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const end = play(seed, (s) => policyIntent(s));
      if (!['arrived', 'dead', 'adrift'].includes(end.status)) fail(`seed ${seed} did not end`);
    }
  }, 30000);

  it('random intents (thrust, rations, rest, scan, repair) keep the same invariants', () => {
    for (let seed = 1001; seed <= 1000 + SEEDS; seed++) play(seed, randomIntent);
  }, 30000);

  it('save/load mid-run is lossless and the run continues identically', () => {
    const rngA = createRng(99);
    let s = depart(policyShop(createGame({ profession: 'engineer', window: 3 }, rngA)), rngA).state;
    for (let i = 0; i < 30; i++) s = applyAction(s, policyIntent(s), rngA).state;
    const loaded = fromJSON(toJSON(s));
    expect(loaded).toEqual(s);
  });

  it('same seed, same run', () => {
    expect(toJSON(play(42, (s) => policyIntent(s)))).toBe(toJSON(play(42, (s) => policyIntent(s))));
  });
});
