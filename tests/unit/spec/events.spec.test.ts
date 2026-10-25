/** docs/design/events.md: eligibility, weights, effects, cadence guard, illness pool. */
import { describe, expect, it } from 'vitest';
import { applyAction, createRng, rationNeed, tick, type ConditionId, type GameState, type StepResult } from '@/sim';
import { CONTINUE, allHealth, expectRate, withCrew, ship, type Trial } from './spec-helpers';

const LOSS = ['pirates', 'lost_lane', 'drive_failure', 'drive_stall', 'hull_puncture', 'pump_failure', 'gyro_failure', 'hull_fire', 'crew_eva_drift', 'bad_recycler', 'cargo_shift'];
const CALM_SET = new Set(['calm', 'fair', 'fog']);

const hasEvent = (r: StepResult, id: string): boolean => r.entries.some((e) => e.kind === 'event' && e.id === id);
/** Ticks that did not also trigger weather-driven suit loss or passing help (they would confound supply deltas). */
const clean = (r: StepResult): boolean => !r.entries.some((e) => e.kind === 'suit' || e.kind === 'help');
const dRations = (s: GameState, r: StepResult): number => r.state.supplies.rations - (s.supplies.rations - rationNeed(s));

/** Up to `count` trials in which event `id` fired on a clean tick. */
function fire(s: GameState, id: string, count = 1, max = 60000): Trial[] {
  const out: Trial[] = [];
  for (let seed = 1; seed <= max && out.length < count; seed++) {
    const r = applyAction(s, CONTINUE, createRng(seed));
    if (hasEvent(r, id) && clean(r)) out.push({ r, seed });
  }
  return out;
}

/** Count ticks (seeds 1..n) where event `id` fires. */
function countEvent(s: GameState, id: string, n: number, where: (r: StepResult) => boolean = () => true): { fired: number; ticks: number } {
  let fired = 0;
  let ticks = 0;
  for (let seed = 1; seed <= n; seed++) {
    const r = tick(s, createRng(seed * 31 + 7));
    if (!where(r)) continue;
    ticks++;
    if (hasEvent(r, id)) fired++;
  }
  return { fired, ticks };
}

const base = (over: Parameters<typeof ship>[0] = {}): GameState => allHealth(ship({ rations: 'half', ...over }), 100);

describe('Event eligibility (events.md table "Condition / modifiers")', () => {
  it('pirates need segment >= 3', () => {
    expect(countEvent(base({ segment: 2 }), 'pirates', 5000).fired).toBe(0);
    expect(fire(base({ segment: 3 }), 'pirates')).toHaveLength(1);
  });

  it('derelict needs segment >= 2', () => {
    expect(countEvent(base({ segment: 1 }), 'derelict', 12000).fired).toBe(0);
    expect(fire(base({ segment: 2 }), 'derelict')).toHaveLength(1);
  });

  it.each([[4, false], [5, true], [9, true], [10, false]])('belter_help in segment %i: %s (segments 5-9 only)', (segment, ok) => {
    if (ok) expect(fire(base({ segment }), 'belter_help')).toHaveLength(1);
    else expect(countEvent(base({ segment }), 'belter_help', 12000).fired).toBe(0);
  });

  it('drive_failure needs at least one drive', () => {
    const s = base({ supplies: { drives: 0 } });
    expect(countEvent(s, 'drive_failure', 6000, (r) => !r.entries.some((e) => e.kind === 'help')).fired).toBe(0);
  });

  it('drive_stall needs a working drive (all drives offline: never)', () => {
    expect(countEvent(base({ offlineDrives: [3, 3, 3] }), 'drive_stall', 6000).fired).toBe(0);
  });

  it.each([
    ['hull_puncture', { hull: true, pump: false, gyro: false }],
    ['pump_failure', { hull: false, pump: true, gyro: false }],
    ['gyro_failure', { hull: false, pump: false, gyro: true }],
  ] as const)('%s needs its part intact', (id, broken) => {
    const s = base({ broken: { ...broken }, supplies: { plates: 1, pumps: 1, gyros: 1 } });
    expect(countEvent(s, id, 6000).fired).toBe(0);
  });

  it('crew_eva_drift needs at least 2 present crew', () => {
    let s = base();
    s = { ...s, crew: s.crew.map((c, i) => (i === 0 ? c : { ...c, alive: false, health: 0, cause: 'starvation' as const })) };
    expect(countEvent(s, 'crew_eva_drift', 6000).fired).toBe(0);
  });

  it('cargo_shift only fires on the first tick after leaving a hazard waypoint', () => {
    expect(countEvent(base({ justCrossedHazard: false }), 'cargo_shift', 12000).fired).toBe(0);
    expect(fire(base({ justCrossedHazard: true }), 'cargo_shift')).toHaveLength(1);
  });

  it('cargo_shift does not fire while the ship is still parked at the hazard (resting there)', () => {
    const s = base({ justCrossedHazard: true, arrivedAt: 1, segment: 2 });
    let fired = 0;
    for (let seed = 1; seed <= 6000; seed++) if (hasEvent(applyAction(s, { type: 'rest', days: 1 }, createRng(seed)), 'cargo_shift')) fired++;
    expect(fired).toBe(0);
  });

  it('the cargo_shift window closes after the first tick away from the hazard', () => {
    const s = base({ justCrossedHazard: true });
    expect(applyAction(s, CONTINUE, createRng(1)).state.justCrossedHazard).toBe(false);
  });
});

describe('Event effects (events.md table "Effect")', () => {
  it('pirates: lose 10-30% (floor, min 1) of exactly one stocked type', () => {
    const s = base({ supplies: { rations: 1000, suits: 10, charges: 100, plates: 2, pumps: 2, gyros: 2 } });
    const hit = new Set<string>();
    for (const { r } of fire(s, 'pirates', 220)) {
      const before: Record<string, number> = { rations: s.supplies.rations - rationNeed(s), suits: 10, charges: 100, plates: 2, pumps: 2, gyros: 2 };
      const after: Record<string, number> = { ...r.state.supplies };
      const lost = Object.keys(before).filter((k) => before[k]! > after[k]!);
      expect(lost).toHaveLength(1);
      const k = lost[0]!;
      hit.add(k);
      const loss = before[k]! - after[k]!;
      const q = before[k]!;
      const slack = k === 'rations' ? 2 : 0;
      expect(loss).toBeGreaterThanOrEqual(Math.max(1, Math.floor(q * 0.1)) - slack);
      expect(loss).toBeLessThanOrEqual(Math.max(1, Math.floor(q * 0.3)) + slack);
    }
    expect([...hit].sort()).toEqual(['charges', 'gyros', 'plates', 'pumps', 'rations', 'suits']);
  });

  it('pirates never pick a type with zero quantity', () => {
    const s = base({ supplies: { rations: 800, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 3 } });
    for (const { r } of fire(s, 'pirates', 60)) {
      expect(r.state.supplies.suits).toBe(0);
      expect(r.state.supplies.charges).toBe(0);
      expect(r.state.supplies.plates).toBe(0);
    }
  });

  it('lost_lane: the next 1-3 ticks are delay days', () => {
    const seen = new Set<number>();
    for (const { r } of fire(base({ segment: 4 }), 'lost_lane', 80)) seen.add(r.state.delayDays);
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('drive_failure: one drive destroyed', () => {
    for (const { r } of fire(base(), 'drive_failure', 15)) expect(r.state.supplies.drives).toBe(2);
  });

  it('drive_failure destroys a working drive when one is offline (offline list shrinks with it or stays)', () => {
    const s = base({ offlineDrives: [3], supplies: { drives: 3 } });
    for (const { r } of fire(s, 'drive_failure', 15)) {
      expect(r.state.supplies.drives).toBe(2);
      expect(r.state.offlineDrives.length).toBeLessThanOrEqual(2);
    }
  });

  it('drive_stall: one working drive offline for 1-3 days', () => {
    const seen = new Set<number>();
    for (const { r } of fire(base(), 'drive_stall', 80)) {
      expect(r.state.offlineDrives).toHaveLength(1);
      seen.add(r.state.offlineDrives[0]!);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it.each([['hull_puncture', 'hull'], ['pump_failure', 'pump'], ['gyro_failure', 'gyro']] as const)('%s breaks the %s', (id, part) => {
    const s = base({ supplies: { plates: 1, pumps: 1, gyros: 1 } });
    for (const { r } of fire(s, id, 6)) expect(r.state.broken[part]).toBe(true);
  });

  it('hull_fire: lose 5-15% rations and 1 suit; one random crew member -10 health', () => {
    const s = base({ supplies: { rations: 1000, suits: 10 } });
    const q = s.supplies.rations - rationNeed(s);
    for (const { r } of fire(s, 'hull_fire', 30)) {
      expect(r.state.supplies.suits).toBe(9);
      const loss = q - r.state.supplies.rations;
      expect(loss).toBeGreaterThanOrEqual(Math.floor(q * 0.05) - 2);
      expect(loss).toBeLessThanOrEqual(Math.floor(q * 0.15) + 2);
      expect(r.state.crew.filter((c) => c.health <= 90).length).toBe(1);
    }
  });

  it('hull_fire with no suits costs no suit', () => {
    for (const { r } of fire(base({ supplies: { suits: 0 } }), 'hull_fire', 10)) expect(r.state.supplies.suits).toBe(0);
  });

  it('crew_eva_drift: one crew member away 1-4 days, or (about 5%) lost for good with cause drift', () => {
    const away = new Set<number>();
    let lost = 0;
    const trials = fire(base(), 'crew_eva_drift', 120, 120000);
    expect(trials.length).toBeGreaterThan(60);
    for (const { r } of trials) {
      const gone = r.state.crew.filter((c) => c.awayDays > 0);
      const dead = r.state.crew.filter((c) => !c.alive);
      expect(gone.length + dead.length).toBe(1);
      if (dead.length) {
        lost++;
        expect(dead[0]!.cause).toBe('drift');
        expect(r.state.deaths).toBe(1);
      } else {
        away.add(gone[0]!.awayDays);
      }
    }
    expect([...away].every((d) => d >= 1 && d <= 4)).toBe(true);
    expect(away.size).toBeGreaterThanOrEqual(3);
    expect(lost / trials.length).toBeLessThan(0.2);
  });

  it('bad_recycler: all present crew -5 health; sets the 3-day dysentery window', () => {
    const s = base();
    for (const { r } of fire(s, 'bad_recycler', 20)) {
      for (const c of r.state.crew) expect(c.health === 95 || c.health === 94).toBe(true);
      expect(r.state.badRecyclerUntilDay).toBeGreaterThanOrEqual(r.state.day + 3);
    }
  });

  it('bad_recycler skips absent crew', () => {
    const s = withCrew(base(), 2, { awayDays: 6 });
    for (const { r } of fire(s, 'bad_recycler', 10)) expect(r.state.crew[2]!.health).toBe(100);
  });

  it('derelict: nothing (~50%), 20-60 rations, 1 spare, or 1-2 suits', () => {
    const s = base({ segment: 5, supplies: { rations: 1000, plates: 0, pumps: 0, gyros: 0, suits: 10 } });
    const kinds = { nothing: 0, rations: 0, spare: 0, suits: 0 };
    const trials = fire(s, 'derelict', 160, 200000);
    for (const { r } of trials) {
      const sp = r.state.supplies;
      const dR = dRations(s, r);
      const dSpare = sp.plates + sp.pumps + sp.gyros;
      const dSuits = sp.suits - 10;
      if (dR > 0) {
        expect(dR).toBeGreaterThanOrEqual(20);
        expect(dR).toBeLessThanOrEqual(60);
        expect(dSpare + dSuits).toBe(0);
        kinds.rations++;
      } else if (dSpare > 0) {
        expect(dSpare).toBe(1);
        expect(dSuits).toBe(0);
        kinds.spare++;
      } else if (dSuits > 0) {
        expect(dSuits === 1 || dSuits === 2).toBe(true);
        kinds.suits++;
      } else {
        kinds.nothing++;
      }
    }
    expectRate(kinds.nothing, trials.length, 0.5, 4, 'derelict nothing');
    expectRate(kinds.rations, trials.length, 0.25, 4, 'derelict rations');
    expect(kinds.spare).toBeGreaterThan(0);
    expect(kinds.suits).toBeGreaterThan(0);
  });

  it('derelict spare find at the cap of 3 gives 20-60 rations instead', () => {
    const s = base({ segment: 5, supplies: { rations: 1000, plates: 3, pumps: 3, gyros: 3, suits: 10 } });
    for (const { r } of fire(s, 'derelict', 80, 120000)) {
      expect(r.state.supplies.plates).toBe(3);
      expect(r.state.supplies.pumps).toBe(3);
      expect(r.state.supplies.gyros).toBe(3);
    }
  });

  it('algae_bloom: +20-60 rations', () => {
    const s = base({ supplies: { rations: 1000 } });
    for (const { r } of fire(s, 'algae_bloom', 40)) {
      expect(dRations(s, r)).toBeGreaterThanOrEqual(20);
      expect(dRations(s, r)).toBeLessThanOrEqual(60);
    }
  });

  it('algae_bloom: Hydroponics Farmer x1.5 (floor): 30-90', () => {
    const s = ship({ rations: 'half', supplies: { rations: 1000 } }, 'farmer');
    const gains = fire(s, 'algae_bloom', 80).map((t) => dRations(s, t.r));
    expect(Math.min(...gains)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...gains)).toBeLessThanOrEqual(90);
    expect(Math.max(...gains)).toBeGreaterThan(60);
  });

  it('belter_help: +40-80 rations', () => {
    const s = base({ segment: 6, supplies: { rations: 1000 } });
    for (const { r } of fire(s, 'belter_help', 40)) {
      expect(dRations(s, r)).toBeGreaterThanOrEqual(40);
      expect(dRations(s, r)).toBeLessThanOrEqual(80);
    }
  });

  it('cargo_shift: lose 5-10% of one of rations, suits or charges; spare parts are never taken', () => {
    const s = base({ justCrossedHazard: true, supplies: { rations: 1000, suits: 40, charges: 200, plates: 3, pumps: 3, gyros: 3 } });
    const before = { rations: s.supplies.rations - rationNeed(s), suits: 40, charges: 200 };
    const hit = new Set<string>();
    for (const { r } of fire(s, 'cargo_shift', 100)) {
      const sp = r.state.supplies;
      expect([sp.plates, sp.pumps, sp.gyros]).toEqual([3, 3, 3]);
      const lost = (['rations', 'suits', 'charges'] as const).filter((k) => sp[k] < before[k]);
      expect(lost).toHaveLength(1);
      const k = lost[0]!;
      hit.add(k);
      const loss = before[k] - sp[k];
      const slack = k === 'rations' ? 2 : 0;
      expect(loss).toBeGreaterThanOrEqual(Math.max(1, Math.floor(before[k] * 0.05)) - slack);
      expect(loss).toBeLessThanOrEqual(Math.max(1, Math.floor(before[k] * 0.1)) + slack);
    }
    expect(hit.size).toBe(3);
  });
});

describe('Event weights (events.md modifiers)', () => {
  const N = 24000;
  const ratio = (a: { fired: number; ticks: number }, b: { fired: number; ticks: number }): number => a.fired / a.ticks / (b.fired / b.ticks);

  it('Ship Engineer: drive_failure weight x0.5 (about half as often as the Executive)', () => {
    const ex = countEvent(ship({ rations: 'half' }, 'executive'), 'drive_failure', N);
    const en = countEvent(ship({ rations: 'half' }, 'engineer'), 'drive_failure', N);
    expect(ratio(ex, en)).toBeGreaterThan(1.3);
    expect(ratio(ex, en)).toBeLessThan(3.2);
  });

  it('Overburn: drive_failure weight x2', () => {
    const over = countEvent(base({ thrust: 'overburn' }), 'drive_failure', N);
    const cruise = countEvent(base({ thrust: 'cruise' }), 'drive_failure', N);
    expect(ratio(over, cruise)).toBeGreaterThan(1.3);
    expect(ratio(over, cruise)).toBeLessThan(3.2);
  });

  it('Ion fog: lost_lane and gyro_failure weights x2', () => {
    const run = (w: 'fog' | 'fair', id: string): { fired: number; ticks: number } =>
      countEvent(base({ weather: w, supplies: { gyros: 1 } }), id, N, (r) => (w === 'fog' ? r.state.weather === 'fog' : r.state.weather === 'fair'));
    expect(ratio(run('fog', 'lost_lane'), run('fair', 'lost_lane'))).toBeGreaterThan(1.3);
    expect(ratio(run('fog', 'gyro_failure'), run('fair', 'gyro_failure'))).toBeGreaterThan(1.25);
  });

  it('a broken nav gyro doubles lost_lane weight', () => {
    const ok = countEvent(base(), 'lost_lane', N);
    const bad = countEvent(base({ broken: { hull: false, pump: false, gyro: true }, supplies: { gyros: 1 } }), 'lost_lane', N);
    expect(ratio(bad, ok)).toBeGreaterThan(1.3);
  });

  it('Unsettled weather: hull_puncture weight x1.5', () => {
    const only = (w: string) => (r: StepResult) => r.state.weather === w;
    const un = countEvent(base({ weather: 'unsettled' }), 'hull_puncture', N * 2, only('unsettled'));
    const fair = countEvent(base({ weather: 'fair' }), 'hull_puncture', N * 2, only('fair'));
    expect(ratio(un, fair)).toBeGreaterThan(1.12);
    expect(ratio(un, fair)).toBeLessThan(2.2);
  });

  it('Illness weight rises with poor general health (20 Good, 30 Fair, 40 Poor/Very poor)', () => {
    const rate = (health: number): number => {
      const s = allHealth(ship({ rations: 'half' }), health);
      let k = 0;
      const n = 9000;
      for (let seed = 1; seed <= n; seed++) {
        const r = tick(s, createRng(seed * 5 + 1));
        if (r.entries.some((e) => e.kind === 'condition' && e.id !== 'radiation-sickness')) k++;
      }
      return k / n;
    };
    const good = rate(90);
    const fair = rate(60);
    const poor = rate(30);
    const veryPoor = rate(10);
    expect(fair).toBeGreaterThan(good);
    expect(poor).toBeGreaterThan(fair);
    expect(poor / good).toBeGreaterThan(1.3);
    expect(Math.abs(veryPoor - poor)).toBeLessThan(0.02);
  });
});

describe('Illness pool (events.md "Illness pool")', () => {
  type Counts = Record<string, number>;
  const poolCounts = (s: GameState, n = 12000, where: (r: StepResult) => boolean = (r) => CALM_SET.has(r.state.weather)): Counts => {
    const c: Counts = {};
    for (let seed = 1; seed <= n; seed++) {
      const r = tick(s, createRng(seed * 11 + 2));
      if (!where(r)) continue;
      for (const e of r.entries) if (e.kind === 'condition' && e.id !== 'radiation-sickness' && e.id !== 'exhaustion') c[e.id!] = (c[e.id!] ?? 0) + 1;
    }
    return c;
  };
  const share = (c: Counts, id: ConditionId): number => (c[id] ?? 0) / Math.max(1, Object.values(c).reduce((a, b) => a + b, 0));
  const full = (over: Parameters<typeof ship>[0] = {}): GameState => allHealth(ship({ rations: 'full', segment: 9, distanceTotal: 0, ...over }), 90);

  const baseline = poolCounts(full());

  it('baseline pool at Full rations in calm weather: dysentery 6, mold 3, cryo 4 -> 46% / 23% / 31%', () => {
    expect(Object.keys(baseline).sort()).toEqual(['cryo-fever', 'hull-mold-fever', 'space-dysentery']);
    expect(share(baseline, 'space-dysentery')).toBeGreaterThan(0.36);
    expect(share(baseline, 'space-dysentery')).toBeLessThan(0.56);
    expect(share(baseline, 'hull-mold-fever')).toBeGreaterThan(0.14);
    expect(share(baseline, 'hull-mold-fever')).toBeLessThan(0.33);
  });

  it('Hull mold fever weight x2 once segment >= 10', () => {
    const late = poolCounts(full({ segment: 10 }));
    expect(share(late, 'hull-mold-fever')).toBeGreaterThan(share(baseline, 'hull-mold-fever') + 0.06);
  });

  it('Space dysentery weight x2 on Paste', () => {
    const paste = poolCounts(full({ rations: 'paste' }));
    expect(share(paste, 'space-dysentery')).toBeGreaterThan(share(baseline, 'space-dysentery') + 0.08);
  });

  it('Space dysentery weight x3 for 3 days after bad_recycler', () => {
    const rec = poolCounts(full({ badRecyclerUntilDay: 100 }));
    expect(share(rec, 'space-dysentery')).toBeGreaterThan(share(baseline, 'space-dysentery') + 0.12);
  });

  it('the dysentery boost ends after the recycler window', () => {
    const over = poolCounts(full({ badRecyclerUntilDay: -1 }));
    expect(Math.abs(share(over, 'space-dysentery') - share(baseline, 'space-dysentery'))).toBeLessThan(0.001);
  });

  it('Cryo-fever weight x2 when general health is Poor or worse', () => {
    const poor = poolCounts(allHealth(full(), 40));
    expect(share(poor, 'cryo-fever')).toBeGreaterThan(share(baseline, 'cryo-fever') + 0.08);
  });

  it('Scurvy needs 10+ consecutive days on Half or Paste', () => {
    const fullRations = poolCounts(full({ consecutiveLowRations: 30 }), 8000, () => true);
    expect(fullRations['scurvy'] ?? 0).toBe(0);
    const fresh = poolCounts(full({ rations: 'half', consecutiveLowRations: 0 }), 8000, () => true);
    expect(fresh['scurvy'] ?? 0).toBe(0);
    const eight = poolCounts(full({ rations: 'half', consecutiveLowRations: 7 }), 8000, () => true);
    expect(eight['scurvy'] ?? 0).toBe(0);
    // The counter is compared after that day's increment: the 10th low-ration day is the first eligible one (decisions.md, tester entry).
    const tenth = poolCounts(full({ rations: 'half', consecutiveLowRations: 9 }), 8000, () => true);
    expect(tenth['scurvy'] ?? 0).toBeGreaterThan(0);
    const long = poolCounts(full({ rations: 'half', consecutiveLowRations: 15 }), 8000, () => true);
    expect(long['scurvy'] ?? 0).toBeGreaterThan(0);
  });

  it('Micrometeorite puncture only in Unsettled, Solar storm or Flare weather', () => {
    const s = full({ weather: 'unsettled' });
    const calm = poolCounts(s, 12000, (r) => CALM_SET.has(r.state.weather));
    expect(calm['micrometeorite-puncture'] ?? 0).toBe(0);
    const rough = poolCounts(s, 12000, (r) => r.state.weather === 'unsettled');
    expect(rough['micrometeorite-puncture'] ?? 0).toBeGreaterThan(0);
  });

  it('Radiation sickness, exhaustion and decompression injury are never rolled by the illness event', () => {
    const s = full({ weather: 'unsettled', supplies: { suits: 10 } });
    for (let seed = 1; seed <= 9000; seed++) {
      const r = tick(s, createRng(seed));
      for (const e of r.entries) {
        if (e.kind === 'condition') expect(['radiation-sickness', 'exhaustion', 'decompression-injury']).not.toContain(e.id);
      }
    }
  });

  it('a crew member who already has 2 conditions never receives an illness', () => {
    const conds = [{ id: 'cryo-fever' as const, remaining: 9, daysActive: 1 }, { id: 'space-dysentery' as const, remaining: 9, daysActive: 1 }];
    const s = withCrew(full({ weather: 'unsettled' }), 0, { conditions: conds });
    for (let seed = 1; seed <= 4000; seed++) expect(tick(s, createRng(seed)).state.crew[0]!.conditions.length).toBeLessThanOrEqual(2);
  });

  it('a crew member cannot get a copy of a condition they already have', () => {
    const s = withCrew(full({ weather: 'unsettled' }), 0, { conditions: [{ id: 'cryo-fever' as const, remaining: 9, daysActive: 1 }] });
    for (let seed = 1; seed <= 4000; seed++) {
      const c = tick(s, createRng(seed)).state.crew[0]!;
      if (c.alive) expect(c.conditions.filter((x) => x.id === 'cryo-fever')).toHaveLength(1);
    }
  });
});

describe('Cadence guard (events.md "Cadence guard")', () => {
  const lossTick = (r: StepResult): boolean => r.entries.some((e) => e.kind === 'event' && LOSS.includes(e.id!));

  it('a loss event on day d sets eventCooldownUntilDay = d + 3', () => {
    const s = base({ justCrossedHazard: false });
    let n = 0;
    for (let seed = 1; seed <= 6000 && n < 80; seed++) {
      const r = tick(s, createRng(seed));
      if (!lossTick(r)) continue;
      n++;
      expect(r.state.eventCooldownUntilDay).toBe(r.state.day + 3);
    }
    expect(n).toBe(80);
  });

  it('gains and illness do not start a cooldown', () => {
    const s = base({ segment: 6 });
    for (const id of ['algae_bloom', 'belter_help']) {
      for (const { r } of fire(s, id, 8)) {
        if (!lossTick(r)) expect(r.state.eventCooldownUntilDay).toBe(0);
      }
    }
  });

  it('while day < eventCooldownUntilDay, no loss event fires (3000 days)', () => {
    const s = base({ eventCooldownUntilDay: 3 });
    for (let seed = 1; seed <= 3000; seed++) expect(lossTick(tick(s, createRng(seed)))).toBe(false);
  });

  it('on the day the cooldown expires, loss events fire again', () => {
    const s = base({ eventCooldownUntilDay: 1 });
    let n = 0;
    for (let seed = 1; seed <= 3000; seed++) if (lossTick(tick(s, createRng(seed)))) n++;
    expect(n).toBeGreaterThan(100);
  });

  it('Overburn ignores the cadence guard', () => {
    const s = base({ eventCooldownUntilDay: 3, thrust: 'overburn' });
    let n = 0;
    for (let seed = 1; seed <= 3000; seed++) if (lossTick(tick(s, createRng(seed)))) n++;
    expect(n).toBeGreaterThan(100);
  });

  it('Paste rations ignore the cadence guard', () => {
    const s = base({ eventCooldownUntilDay: 3, rations: 'paste' });
    let n = 0;
    for (let seed = 1; seed <= 3000; seed++) if (lossTick(tick(s, createRng(seed)))) n++;
    expect(n).toBeGreaterThan(100);
  });

  it('illness and gains are never filtered during a cooldown', () => {
    const s = base({ eventCooldownUntilDay: 3, segment: 6 });
    let illness = 0;
    let gains = 0;
    for (let seed = 1; seed <= 6000; seed++) {
      const r = tick(s, createRng(seed));
      if (r.entries.some((e) => e.kind === 'condition' && e.id !== 'radiation-sickness')) illness++;
      if (hasEvent(r, 'algae_bloom') || hasEvent(r, 'belter_help')) gains++;
    }
    expect(illness).toBeGreaterThan(50);
    expect(gains).toBeGreaterThan(10);
  });
});

describe('Quiet days (events.md "quiet_day")', () => {
  it('on a tick with no event, about 10% log a flavor line', () => {
    const s = base();
    let noEvent = 0;
    let quiet = 0;
    for (let seed = 1; seed <= 8000; seed++) {
      const r = tick(s, createRng(seed * 3 + 2));
      if (r.entries.some((e) => e.kind === 'event' || e.kind === 'condition' || e.kind === 'death')) continue;
      noEvent++;
      if (r.entries.some((e) => e.kind === 'quiet')) quiet++;
    }
    expectRate(quiet, noEvent, 0.1, 4.5, 'quiet day');
  });

  it('a quiet day has no effect on supplies beyond the day\'s rations', () => {
    const s = base();
    for (let seed = 1; seed <= 600; seed++) {
      const r = tick(s, createRng(seed));
      if (!r.entries.some((e) => e.kind === 'quiet') || r.entries.some((e) => e.kind === 'event' || e.kind === 'suit' || e.kind === 'help')) continue;
      expect(r.state.supplies.rations).toBe(s.supplies.rations - rationNeed(s));
      expect(r.state.supplies.drives).toBe(s.supplies.drives);
    }
  });
});
