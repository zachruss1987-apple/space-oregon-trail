/** docs/design/minigames.md: spec numbers typed from the tables (never read back from src/content). */
import { describe, expect, it } from 'vitest';
import { arcTimes, flareParams } from '@/minigames/flareLogic';
import {
  createSalvageWorld, finishHaul, fireGrapple, salvageOver, salvageParams, spawnDebris, stepSalvage, towHaul,
  type Debris, type SalvageWorld,
} from '@/minigames/salvageLogic';
import { createThreadingWorld, makeRocks, rockCount, scrollSpeed, stepThreading, threadingOver } from '@/minigames/threadingLogic';
import {
  applyAction, applyFlareResult, applySalvageResult, applyThreadingResult, computeScore, createRng, minigameSeed,
  resultError, runPolicy, seedFromString, toJSON, type GameState, type LogEntry,
} from '@/sim';
import { expectRate, ship } from './spec-helpers';

const HZ = 60;
const ids = (es: readonly LogEntry[], kind: string): string[] => es.filter((e) => e.kind === kind).map((e) => `${e.id}`);
const salv = (o: Record<string, unknown> = {}) => ({ kind: 'salvage', rations: 0, plates: 0, pumps: 0, gyros: 0, chargesUsed: 0, crewHurt: 0, ...o });
const thread = (hits: number, bonus: 'health' | 'rations' | null = null) => ({ kind: 'threading', hits, bonus });
const flare = (hits: number) => ({ kind: 'flare', hits });

/** Parked at a hazard (waypoint index `wp`), intact ship, 5 crew, plenty of everything. */
function pending(wp: number, density: number, o: Record<string, unknown> = {}): GameState {
  return ship({
    segment: wp + 1, arrivedAt: wp, date: '2184-07-01', credits: 500, rations: 'half',
    crossing: { waypoint: wp, density, pilotDaysLeft: null }, ...o,
  } as Partial<GameState>);
}

/** A salvage arena with no spawns; drone at its start (64, 200) facing right. */
function quiet(charges = 30, segment = 3): SalvageWorld {
  const w = createSalvageWorld(ship({ segment, weather: 'fair', supplies: { charges, plates: 0, pumps: 0, gyros: 0 } }));
  w.params.population = 0;
  return w;
}
function put(w: SalvageWorld, type: Debris['type'], dx: number, r: number): Debris {
  const d: Debris = { id: w.nextId++, type, x: w.drone.x + dx, y: w.drone.y, vx: 0, vy: 0, r, spin: 0, hooked: false };
  w.debris.push(d);
  return d;
}
const idle = (w: SalvageWorld, seconds: number): void => {
  const rng = createRng(1);
  for (let i = 0; i < Math.round(seconds * HZ); i++) stepSalvage(w, { dirX: 0, dirY: 0 }, rng);
};

describe('Salvage Run numbers', () => {
  it('lasts 40 s (2400 steps) unless wrecked', () => {
    const w = quiet();
    idle(w, 39.98);
    expect(salvageOver(w)).toBe(false);
    idle(w, 0.04);
    expect(salvageOver(w)).toBe(true);
  });

  it('grapple range is 140 px: a piece 130 px out is hooked, one 160 px out is missed; the charge is spent either way', () => {
    const hit = quiet();
    put(hit, 'crate', 130, 6);
    fireGrapple(hit);
    idle(hit, 1.5);
    expect(hit.haul.rations).toBe(5);
    const miss = quiet();
    put(miss, 'crate', 160, 6);
    fireGrapple(miss);
    idle(miss, 1.5);
    expect(miss.haul.rations).toBe(0);
    expect([hit.chargesUsed, miss.chargesUsed]).toEqual([1, 1]);
  });

  it('grapple cooldown is 0.8 s from firing', () => {
    const w = quiet();
    fireGrapple(w);
    idle(w, 0.7);
    fireGrapple(w);
    expect(w.chargesUsed).toBe(1);
    idle(w, 0.12);
    fireGrapple(w);
    expect(w.chargesUsed).toBe(2);
  });

  it.each([[50, 20], [20, 20], [7, 7], [1, 1]])('with %i charges the run can spend min(charges, 20) = %i', (held, cap) => {
    const w = quiet(held);
    for (let i = 0; i < 25; i++) {
      fireGrapple(w);
      idle(w, 1.7);
    }
    expect(w.chargesUsed).toBe(cap);
  });

  it('with 0 charges left the grapple only clicks and the run goes on', () => {
    const w = quiet(1);
    fireGrapple(w);
    idle(w, 1.7);
    fireGrapple(w);
    expect(w.events).toContain('click');
    expect(w.chargesUsed).toBe(1);
    expect(salvageOver(w)).toBe(false);
  });

  it.each([
    ['crate', 6, { rations: 5 }], ['pallet', 10, { rations: 15 }], ['galley', 14, { rations: 30 }],
    ['plate', 10, { plates: 1 }], ['pump', 7, { pumps: 1 }], ['gyro', 6, { gyros: 1 }], ['scrap', 8, {}],
  ] as const)('reeling in a %s yields %j', (type, r, yieldOf) => {
    const w = quiet();
    put(w, type, 80, r);
    fireGrapple(w);
    idle(w, 1.5);
    expect(w.haul).toEqual({ rations: 0, plates: 0, pumps: 0, gyros: 0, ...yieldOf });
  });

  it('a tumbler snaps the cable for nothing; a hot chunk reeled in hurts crew and vanishes', () => {
    const t = quiet();
    put(t, 'tumbler', 80, 12);
    fireGrapple(t);
    idle(t, 0.5);
    expect(t.haul).toEqual({ rations: 0, plates: 0, pumps: 0, gyros: 0 });
    const h = quiet();
    put(h, 'hot', 80, 8);
    fireGrapple(h);
    idle(h, 1.5);
    expect(h.crewHurt).toBe(1);
    expect(h.debris).toHaveLength(0);
  });

  it('weights sum to 100 and spawn frequencies match the table (3000 pieces, 4 sigma)', () => {
    const p = salvageParams(3, 'fair');
    expect(p.weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(100, 6);
    const spec: Record<string, number> = { crate: 30, pallet: 15, galley: 5, plate: 4, pump: 3, gyro: 3, scrap: 25, tumbler: 10, hot: 5 };
    const counts: Record<string, number> = {};
    const w = quiet();
    for (let seed = 1; seed <= 3000; seed++) {
      const d = spawnDebris(w, createRng(seed));
      counts[d.type] = (counts[d.type] ?? 0) + 1;
    }
    for (const [type, pct] of Object.entries(spec)) expectRate(counts[type] ?? 0, 3000, pct / 100, 4, type);
  });

  it('difficulty: population 10 / 12 / 8 by segment band; part weights x1.5 in the belt; deep Lane drift x1.2', () => {
    expect([1, 5, 6, 13, 14, 16].map((s) => salvageParams(s, 'calm').population)).toEqual([10, 10, 12, 12, 8, 8]);
    const near = salvageParams(3, 'calm').weights.find((w) => w.item === 'plate')!.weight;
    const belt = salvageParams(8, 'calm').weights.find((w) => w.item === 'plate')!.weight;
    expect(belt / near).toBeGreaterThan(1.4);
    expect(salvageParams(15, 'calm').drift / salvageParams(3, 'calm').drift).toBeCloseTo(1.2, 9);
  });
});

describe('Carry limit and wreck', () => {
  it('under 100 units everything is kept; a haul of exactly 100 is kept', () => {
    expect(towHaul({ rations: 100, plates: 0, pumps: 0, gyros: 0 })).toMatchObject({ dropped: 0, kept: { rations: 100 } });
    expect(towHaul({ rations: 50, plates: 1, pumps: 1, gyros: 3 }).dropped).toBe(0);
  });

  it('over 100: gyros, then pumps, then plates keep their 10 units, rations fill the rest', () => {
    const t = towHaul({ rations: 90, plates: 3, pumps: 3, gyros: 3 });
    expect(t.kept).toEqual({ rations: 10, plates: 3, pumps: 3, gyros: 3 });
    expect(t.dropped).toBe(80);
    expect(towHaul({ rations: 100, plates: 2, pumps: 2, gyros: 3 }).kept).toEqual({ rations: 30, plates: 2, pumps: 2, gyros: 3 });
  });

  it('weight never exceeds 100 for any haul (property over a grid)', () => {
    for (let r = 0; r <= 400; r += 25) for (let p = 0; p <= 3; p++) for (let u = 0; u <= 3; u++) {
      const k = towHaul({ rations: r, plates: p, pumps: u, gyros: 3 }).kept;
      expect(k.rations + 10 * (k.plates + k.pumps + k.gyros)).toBeLessThanOrEqual(100);
    }
  });

  it('the drone has 3 HP; the third tumbler hit wrecks it and halves every count (floor)', () => {
    const w = quiet();
    expect(w.drone.hp).toBe(3);
    w.haul = { rations: 51, plates: 3, pumps: 1, gyros: 2 };
    for (let i = 0; i < 3; i++) {
      put(w, 'tumbler', 0, 12);
      idle(w, 1.1);
    }
    expect(w.wrecked).toBe(true);
    expect(finishHaul(w.haul, { wrecked: true, chargesUsed: 2, crewHurt: 0 }).result).toEqual(
      { kind: 'salvage', rations: 25, plates: 1, pumps: 0, gyros: 1, chargesUsed: 2, crewHurt: 0, droneWrecked: true },
    );
  });
});

describe('Debris Threading numbers', () => {
  it.each([[0, 4], [12, 4], [13, 4], [14, 5], [20, 7], [35, 12], [52, 17], [95, 32], [100, 32]])('T %i -> %i rocks (clamp(round(T/3), 4, 32))', (t, r) => {
    expect(rockCount(t)).toBe(r);
  });

  it('scroll speed is 150 + 15 x density; rocks are 10 + 2d +- 4 px, spawned over 1-24 s (+-0.3 s)', () => {
    for (let d = 1; d <= 5; d++) {
      expect(scrollSpeed(d)).toBe(150 + 15 * d);
      for (let seed = 1; seed <= 100; seed++) for (const k of makeRocks(12, d, createRng(seed))) {
        expect(k.r).toBeGreaterThanOrEqual(10 + 2 * d - 4);
        expect(k.r).toBeLessThanOrEqual(10 + 2 * d + 4);
        expect(k.t).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(k.t).toBeLessThanOrEqual(24.3 + 1e-9);
      }
    }
  });

  it('the world holds R rocks for the option incident T and lasts 1500 steps', () => {
    const w = createThreadingWorld(pending(1, 1), createRng(3));
    expect(w.rocks).toHaveLength(rockCount(w.incident));
    expect(w.incident).toBeGreaterThan(0);
    let n = 0;
    while (!threadingOver(w)) { stepThreading(w, { dirY: 0 }); n++; }
    expect(n).toBe(1500);
  });
});

describe('Threading hits -> severity (main Rng)', () => {
  it('hits 1-2 are capped at 95: never Lost in 2000 seeds at density 4', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const r = applyThreadingResult(pending(7, 4), thread(2) as never, createRng(seed));
      expect(ids(r.entries, 'hazard')).not.toContain('lost');
    }
  });

  it('hits 3-4 are uncapped: Lost happens in 2000 seeds', () => {
    let lost = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const r = applyThreadingResult(pending(7, 4), thread(30) as never, createRng(seed));
      expect(r.entries.filter((e) => e.kind === 'threading')).toHaveLength(1);
      if (ids(r.entries, 'hazard').includes('lost')) lost++;
    }
    expect(lost).toBeGreaterThan(0);
  });

  it('at most 4 severity rolls: 40 hits consume the same main-Rng draws as 4 hits', () => {
    const probe = (hits: number): number => {
      let used = 0;
      const rng = createRng(9);
      const counting = { ...rng, next: () => (used++, rng.next()), int: (a: number, b: number) => (used++, rng.int(a, b)) };
      applyThreadingResult(pending(7, 4), thread(hits) as never, counting as never);
      return used;
    };
    expect(probe(40)).toBe(probe(4));
    expect(probe(4)).toBeGreaterThan(probe(2));
  });

  it('a clean run: no rolls; +2 health (capped 100) or +10 rations; logs clean then hazard/clear; no day', () => {
    const s = pending(7, 4);
    s.crew[0]!.health = 99;
    s.crew[1]!.health = 50;
    const h = applyThreadingResult(s, thread(0, 'health') as never, createRng(1));
    expect(h.state.crew.slice(0, 2).map((c) => c.health)).toEqual([100, 52]);
    expect(ids(h.entries, 'threading')).toEqual(['clean']);
    expect(ids(h.entries, 'hazard')).toEqual(['clear']);
    expect(applyThreadingResult(s, thread(0, 'rations') as never, createRng(1)).state.supplies.rations).toBe(s.supplies.rations + 10);
    expect(applyThreadingResult(s, thread(0) as never, createRng(1)).state.supplies.rations).toBe(s.supplies.rations);
    expect(h.state.day).toBe(s.day);
    expect(h.state.crossing).toBeNull();
  });
});

describe('Flare Belt numbers', () => {
  it('arc counts: about 30 normally, 37-38 in flare season; the interval runs 2.0 s -> 1.0 s', () => {
    const normal = arcTimes(flareParams({ date: '2184-07-01', weather: 'fair' }));
    const season = arcTimes(flareParams({ date: '2184-09-20', weather: 'fair' }));
    expect(normal.length).toBeGreaterThanOrEqual(29);
    expect(normal.length).toBeLessThanOrEqual(31);
    expect(season.length).toBeGreaterThanOrEqual(36);
    expect(season.length).toBeLessThanOrEqual(38);
    expect(normal[1]! - normal[0]!).toBeCloseTo(2.0, 1);
    expect(normal[normal.length - 1]! - normal[normal.length - 2]!).toBeLessThan(1.15);
  });

  it('telegraph 1.0 s (0.8 in season); active 0.5 s (0.7 in flare weather)', () => {
    expect(flareParams({ date: '2184-07-01', weather: 'fair' })).toMatchObject({ telegraphS: 1, activeS: 0.5 });
    expect(flareParams({ date: '2184-09-20', weather: 'fair' }).telegraphS).toBe(0.8);
    expect(flareParams({ date: '2184-07-01', weather: 'flare' }).activeS).toBe(0.7);
  });

  it('a clean ride sets rodeTheWind and adds exactly +200 before the multiplier (Engineer x2 = +400)', () => {
    const s = pending(15, 5);
    const eng = { ...s, profession: 'engineer' } as GameState;
    const r = applyFlareResult(eng, flare(0) as never, createRng(1));
    expect(r.state.rodeTheWind).toBe(true);
    expect(ids(r.entries, 'flare')).toEqual(['clean']);
    const after = computeScore({ ...r.state, status: 'arrived' });
    const before = computeScore({ ...eng, status: 'arrived' });
    expect(after.lines.find((l) => l.key === 'rodeTheWind')?.points).toBe(200);
    expect(after.total - before.total).toBe(200 * after.multiplier);
    expect(after.multiplier).toBe(2);
  });

  it('only the mini-game earns it: tug and the statistical thread never set rodeTheWind', () => {
    const s = pending(15, 5);
    for (let seed = 1; seed <= 50; seed++) {
      expect(applyAction(s, { type: 'cross', method: 'tug' }, createRng(seed)).state.rodeTheWind).toBe(false);
      expect(applyAction(s, { type: 'cross', method: 'thread' }, createRng(seed)).state.rodeTheWind).toBe(false);
    }
  });

  it('5 hits = crash: one crew dies (hazard), rations/suits/charges halve (floor), one of each spare lost, hull breaks', () => {
    const s = pending(15, 5, { supplies: { drives: 3, rations: 1501, suits: 9, charges: 33, plates: 2, pumps: 1, gyros: 1 } });
    for (let seed = 1; seed <= 50; seed++) {
      const r = applyFlareResult(s, flare(5) as never, createRng(seed));
      const dead = r.state.crew.filter((c) => !c.alive);
      expect(dead).toHaveLength(1);
      expect(dead[0]!.cause).toBe('hazard');
      expect(r.state.supplies).toMatchObject({ rations: 751, suits: 5, charges: 17, plates: 1, pumps: 0, gyros: 0 });
      expect(r.state.broken.hull).toBe(true);
      expect(ids(r.entries, 'flare')).toContain('crash');
      expect(r.state.day).toBe(s.day);
    }
  });

  it('hits 1-4 each cost one d100: over 400 seeds all four effect ids appear and nothing else', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const r = applyFlareResult(pending(15, 5), flare(1) as never, createRng(seed));
      for (const id of ids(r.entries, 'flare')) seen.add(id);
    }
    expect([...seen].sort()).toEqual(['burn', 'damage', 'radiation', 'scorch']);
  });
});

describe('Validation refusals (sim README)', () => {
  const s = pending(15, 5);
  const bad: [string, unknown, string][] = [
    ['salvage non-integer', salv({ rations: 1.5 }), 'salvage'], ['salvage over 100 units', salv({ rations: 80, plates: 3 }), 'salvage'],
    ['salvage charges over 20', salv({ chargesUsed: 21 }), 'salvage'], ['salvage extra key', { ...salv(), x: 1 }, 'salvage'],
    ['bonus with hits', thread(1, 'health'), 'threading'], ['hits over 99', thread(100), 'threading'],
    ['flare hits 6', flare(6), 'flare'], ['wrong kind', flare(1), 'threading'],
  ];
  it.each(bad)('resultError refuses %s', (_n, r, kind) => {
    expect(resultError(r, kind as never)).toBeTruthy();
  });

  it('salvage: refused with more charges used than held, with no charges, at New Willamette; no day, state unchanged', () => {
    const few = ship({ supplies: { charges: 5 } });
    const r = applySalvageResult(few, salv({ chargesUsed: 6 }) as never, createRng(1));
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(few);
    expect(applySalvageResult(ship({ supplies: { charges: 0 } }), salv() as never, createRng(1)).error).toBeTruthy();
    expect(applySalvageResult(ship({ arrivedAt: 16 }), salv() as never, createRng(1)).error).toBeTruthy();
    expect(applySalvageResult(few, salv({ chargesUsed: 5 }) as never, createRng(1)).error).toBeUndefined();
  });

  it('a result on any method but thread, or the wrong kind for the place, is refused', () => {
    expect(applyAction(s, { type: 'cross', method: 'tug', result: flare(0) } as never, createRng(1)).error).toBeTruthy();
    expect(applyAction(s, { type: 'cross', method: 'thread', result: thread(0) } as never, createRng(1)).error).toBeTruthy();
    expect(applyAction(pending(7, 4), { type: 'cross', method: 'thread', result: flare(0) } as never, createRng(1)).error).toBeTruthy();
  });

  it('salvage application: parts clamp to the hold cap of 3; the 3rd scan in a segment halves rations, not parts', () => {
    const r = applySalvageResult(ship({ supplies: { plates: 2, charges: 50 } }), salv({ rations: 30, plates: 3, chargesUsed: 4 }) as never, createRng(1));
    expect(r.state.supplies.plates).toBe(3);
    expect(r.state.supplies.charges).toBe(46);
    const run = (scans: number) => applySalvageResult(ship({ scansThisSegment: scans, supplies: { pumps: 0, charges: 50 } }), salv({ rations: 31, pumps: 2, chargesUsed: 3 }) as never, createRng(1)).state;
    const [first, third] = [run(0), run(2)];
    expect(first.supplies.rations - third.supplies.rations).toBe(31 - 15); // same day's use; haul floor(31/2) = 15
    expect([first.supplies.pumps, third.supplies.pumps]).toEqual([2, 2]);
  });
});

describe('minigameSeed and independence from the run Rng', () => {
  it('= seedFromString(seed:kind:day); differs by kind and by day', () => {
    const st = { seed: 'ABC', day: 41 };
    expect(minigameSeed(st, 'salvage')).toBe(seedFromString('ABC:salvage:41'));
    expect(minigameSeed(st, 'threading')).toBe(seedFromString('ABC:threading:41'));
    expect(minigameSeed(st, 'flare')).toBe(seedFromString('ABC:flare:41'));
    expect(new Set([minigameSeed(st, 'salvage'), minigameSeed(st, 'threading'), minigameSeed({ ...st, day: 42 }, 'salvage')]).size).toBe(3);
  });

  it('a v2 save (seed empty) still gives a deterministic mini-game seed', () => {
    expect(minigameSeed({ seed: '', day: 41 }, 'salvage')).toBe(seedFromString(':salvage:41'));
  });

  it('consuming a mini-game Rng does not change the next travel day (state and main Rng untouched)', () => {
    const s = ship({ seed: 'IND' });
    const frozen = toJSON(s);
    const plain = applyAction(s, { type: 'continue' }, createRng(5));
    const w = createSalvageWorld(s);
    const mini = createRng(minigameSeed(s, 'salvage'));
    for (let i = 0; i < 600; i++) stepSalvage(w, { dirX: 1, dirY: 0 }, mini);
    for (let i = 0; i < 5000; i++) mini.next();
    expect(toJSON(s)).toBe(frozen);
    expect(applyAction(s, { type: 'continue' }, createRng(5))).toEqual(plain);
  });
});

describe('Skip penalties and auto-resolve (statistical, 3000 seeds, 4 sigma)', () => {
  const N = 3000;
  it('auto-resolve salvage is the travel.md scan: 25% nothing, 5% spare part', () => {
    let nothing = 0;
    let part = 0;
    for (let seed = 1; seed <= N; seed++) {
      const ks = ids(applyAction(ship(), { type: 'salvage' }, createRng(seed)).entries, 'scan');
      if (ks.includes('nothing')) nothing++;
      if (ks.includes('part')) part++;
    }
    expectRate(nothing, N, 0.25, 4, 'nothing');
    expectRate(part, N, 0.05, 4, 'part');
  });

  it('skipping a salvage rolls d100 - 10: 35% nothing, never a part; logs info/skipped', () => {
    let nothing = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = applyAction(ship(), { type: 'salvage', skipped: true }, createRng(seed));
      expect(ids(r.entries, 'info')).toContain('skipped');
      expect(ids(r.entries, 'scan')).not.toContain('part');
      if (ids(r.entries, 'scan').includes('nothing')) nothing++;
    }
    expectRate(nothing, N, 0.35, 4, 'nothing');
  });

  it('skipping with fewer than 5 charges spends them all and finds nothing', () => {
    const r = applyAction(ship({ supplies: { charges: 3 } }), { type: 'salvage', skipped: true }, createRng(1));
    expect(r.state.supplies.charges).toBe(0);
    expect(ids(r.entries, 'scan')).toEqual(['nothing']);
  });

  const incident = (s: GameState, intent: object): number => {
    let c = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = applyAction(s, intent as never, createRng(seed));
      if (ids(r.entries, 'hazard').some((id) => id !== 'clear')) c++;
    }
    return c;
  };

  it('skip a Threading: incident chance is min(95, T + 10) versus T', () => {
    const s = pending(1, 1);
    const T = createThreadingWorld(s, createRng(1)).incident / 100;
    expectRate(incident(s, { type: 'cross', method: 'thread' }), N, T, 4, 'auto');
    expectRate(incident(s, { type: 'cross', method: 'thread', skipped: true }), N, Math.min(0.95, T + 0.1), 4, 'skip');
  });

  it('skip at the Flare Belt: incident 45% -> 55%', () => {
    const s = pending(15, 5);
    expectRate(incident(s, { type: 'cross', method: 'thread' }), N, 0.45, 4, 'auto');
    expectRate(incident(s, { type: 'cross', method: 'thread', skipped: true }), N, 0.55, 4, 'skip');
  });

  it('auto-resolve leaves the reference policy unchanged: deterministic per seed, never a mini-game log or rodeTheWind', () => {
    for (const seed of [1, 2, 3]) {
      const a = runPolicy(seed);
      const b = runPolicy(seed);
      expect({ days: a.days, score: a.score, status: a.status, n: a.final.log.length }).toEqual({ days: b.days, score: b.score, status: b.status, n: b.final.log.length });
      expect(a.final.log.some((e) => ['salvage', 'threading', 'flare'].includes(e.kind))).toBe(false);
      expect(a.final.rodeTheWind).toBe(false);
    }
  });
});
