/** docs/design/health.md: labels, daily delta, death rolls, conditions, game over. */
import { describe, expect, it } from 'vitest';
import { applyAction, createRng, generalHealth, healthLabel, tick, type ActiveCondition, type ConditionId, type GameState } from '@/sim';
import {
  CONTINUE, WEATHER_SPEC, allHealth, expectRate, isQuiet, quietTick, runTrials, ship, withCrew, type Trial, type WeatherName,
} from './spec-helpers';

/** health.md condition table: [duration lo, hi, daily health, death chance]. */
const COND: Record<ConditionId, { dur: [number, number]; daily: number; death: number }> = {
  'space-dysentery': { dur: [5, 10], daily: -4, death: 0.01 },
  'hull-mold-fever': { dur: [4, 8], daily: -6, death: 0.03 },
  'cryo-fever': { dur: [7, 14], daily: -3, death: 0.02 },
  scurvy: { dur: [6, 12], daily: -2, death: 0.005 },
  'micrometeorite-puncture': { dur: [3, 6], daily: -6, death: 0.04 },
  'radiation-sickness': { dur: [5, 9], daily: -5, death: 0.02 },
  exhaustion: { dur: [2, 2], daily: -3, death: 0 },
  'decompression-injury': { dur: [10, 20], daily: -1, death: 0 },
};
const cond = (id: ConditionId, remaining = 8, daysActive = 3): ActiveCondition => ({ id, remaining, daysActive });
const noDeathNoEvent = (t: Trial): boolean => isQuiet(t.r.entries);

describe('General health labels (health.md header)', () => {
  it.each([[100, 'Good'], [75, 'Good'], [74, 'Fair'], [50, 'Fair'], [49, 'Poor'], [25, 'Poor'], [24, 'Very poor'], [0, 'Very poor']] as const)(
    'health %i is labelled %s', (n, label) => {
      expect(healthLabel(n)).toBe(label);
    });

  it('general health is the average of living crew (dead crew are ignored)', () => {
    let s = allHealth(ship(), 100);
    s = withCrew(s, 0, { health: 60 });
    s = withCrew(s, 1, { health: 60 });
    s = withCrew(s, 2, { health: 60 });
    s = withCrew(s, 3, { health: 60 });
    s = withCrew(s, 4, { health: 0, alive: false });
    expect(generalHealth(s)).toBe('Fair');
    expect(generalHealth(allHealth(ship(), 49))).toBe('Poor');
    expect(generalHealth(allHealth(ship(), 24))).toBe('Very poor');
  });

  it('a new crew starts at health 100, Good', () => {
    expect(generalHealth(ship())).toBe('Good');
    expect(ship().crew.every((c) => c.health === 100)).toBe(true);
  });
});

describe('Daily health delta (health.md "Daily health delta")', () => {
  it('delta = rations + thrust (moving days) + weather + conditions + rest, clamped; 400 random combinations', () => {
    const ids = Object.keys(COND) as ConditionId[];
    const rng = createRng(2024);
    let checked = 0;
    for (let k = 0; k < 400; k++) {
      const rations = rng.pick(['full', 'half', 'paste'] as const);
      const thrust = rng.pick(['cruise', 'hard', 'overburn'] as const);
      const suits = rng.pick([0, 2, 10]);
      const rest = rng.chance(0.4);
      const atStation = rest && rng.chance(0.5);
      const conds: ConditionId[] = [];
      for (const id of ids) if (conds.length < 2 && rng.chance(0.2)) conds.push(id);
      let s = ship({ rations, thrust, supplies: { suits }, weather: rng.pick(['fair', 'storm', 'unsettled', 'fog'] as const), ...(atStation ? { arrivedAt: 3, segment: 4 } : {}) });
      s = withCrew(allHealth(s, 70), 0, { conditions: conds.map((id) => cond(id)) });
      const t = runTrials(s, rest ? { type: 'rest', days: 1 } : CONTINUE, 20, noDeathNoEvent)[0];
      if (!t) continue;
      const w = WEATHER_SPEC[t.r.state.weather as WeatherName];
      const moving = t.r.state.distanceInSegment > 0;
      const present = 0; // crew[0] is first in roster order
      const suited = present < suits;
      const delta =
        { full: 2, half: 0, paste: -2 }[rations] +
        (moving ? { cruise: 0, hard: -2, overburn: -5 }[thrust] : 0) +
        (suited ? w.suited : w.unsuited) +
        conds.reduce((a, id) => a + COND[id].daily, 0) +
        (rest ? (atStation ? 6 : 3) : 0);
      expect(t.r.state.crew[0]!.health, `${rations}/${thrust}/suits ${suits}/rest ${rest}/${atStation}/${conds.join('+')}`).toBe(Math.max(0, Math.min(100, 70 + delta)));
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it.each(Object.keys(COND) as ConditionId[])('%s costs its table health per day', (id) => {
    const s = withCrew(allHealth(ship({ rations: 'half' }), 70), 1, { conditions: [cond(id)] });
    const { r } = quietTick(s);
    expect(r.state.crew[1]!.health).toBe(70 + COND[id].daily + WEATHER_SPEC[r.state.weather as WeatherName].suited);
  });

  it('health is clamped to 100 (Full rations at 99 or 100)', () => {
    for (const h of [99, 100]) {
      const { r } = quietTick(allHealth(ship({ rations: 'full', weather: 'fair' }), h), CONTINUE, (t) => isQuiet(t.r.entries) && t.r.state.weather === 'fair');
      expect(r.state.crew[0]!.health).toBe(100);
    }
  });

  it('rest also clamps at 100', () => {
    const { r } = quietTick(allHealth(ship({ rations: 'half', weather: 'fair' }), 99), { type: 'rest', days: 1 }, (t) => isQuiet(t.r.entries) && t.r.state.weather === 'fair');
    expect(r.state.crew[0]!.health).toBe(100);
  });

  it('only present crew take health changes: a drifting crew member is untouched and her away days count down', () => {
    const s = withCrew(allHealth(ship({ rations: 'paste' }), 80), 3, { awayDays: 2 });
    const { r } = quietTick(s);
    expect(r.state.crew[3]!.health).toBe(80);
    expect(r.state.crew[3]!.awayDays).toBe(1);
    expect(r.state.crew[0]!.health).toBeLessThan(80);
  });

  it('missing crew rejoin when away days reach 0', () => {
    const s = withCrew(ship(), 3, { awayDays: 1 });
    const { r } = quietTick(s, CONTINUE, (t) => !t.r.entries.some((e) => e.kind === 'event' || e.kind === 'death'));
    expect(r.state.crew[3]!.awayDays).toBe(0);
    expect(r.entries.some((e) => e.kind === 'rejoin')).toBe(true);
  });

  it('missing crew never catch conditions', () => {
    const s = withCrew(ship({ weather: 'storm', supplies: { suits: 0 } }), 3, { awayDays: 9 });
    for (let seed = 1; seed <= 400; seed++) expect(tick(s, createRng(seed)).state.crew[3]!.conditions).toEqual([]);
  });
});

describe('Death chance per condition (health.md "Conditions"; multiplier by health)', () => {
  /** Post-delta health lands in the target band; returns P(crew[0] dies of `id`) over n ticks. */
  const deathRate = (id: ConditionId, preHealth: number, extra: Partial<GameState> & { suits?: number } = {}, daysActive = 3, n = 4000) => {
    const { suits = 10, ...rest } = extra;
    const s = withCrew(allHealth(ship({ rations: 'full', weather: 'fair', supplies: { suits }, ...rest }), 100), 0, {
      health: preHealth, conditions: [cond(id, 9, daysActive)],
    });
    let deaths = 0;
    for (let seed = 1; seed <= n; seed++) {
      const c = tick(s, createRng(seed * 13 + 5)).state.crew[0]!;
      if (!c.alive && c.cause === id) deaths++;
    }
    return { deaths, n };
  };
  const mid = (id: ConditionId): number => 58 - COND[id].daily;

  it.each([
    'space-dysentery', 'hull-mold-fever', 'cryo-fever', 'scurvy', 'radiation-sickness',
  ] as ConditionId[])('%s: %s death chance per day at health 50-74 (x1)', (id) => {
    const { deaths, n } = deathRate(id, mid(id));
    expectRate(deaths, n, COND[id].death, 4, id);
  });

  it('Exhaustion and decompression injury never kill by dice (death chance 0)', () => {
    for (const id of ['exhaustion', 'decompression-injury'] as ConditionId[]) expect(deathRate(id, mid(id), {}, 3, 1500).deaths).toBe(0);
  });

  it.each([
    ['>= 75', 89, 0.5], ['50-74', 64, 1], ['25-49', 41, 1.5], ['< 25', 19, 2],
  ] as const)('health multiplier on death chance, health %s: x%f (hull mold fever 3%%)', (_band, pre, mult) => {
    const { deaths, n } = deathRate('hull-mold-fever', pre, {}, 3, 5000);
    expectRate(deaths, n, 0.03 * mult, 4, `mold x${mult}`);
  });

  it('Micrometeorite puncture: 4% on its first 2 days when unsuited (x1 band)', () => {
    const { deaths, n } = deathRate('micrometeorite-puncture', mid('micrometeorite-puncture'), { suits: 0 }, 0, 5000);
    expectRate(deaths, n, 0.04, 4, 'puncture day 1 unsuited');
  });

  it('Micrometeorite puncture: 1% on its first 2 days when suited', () => {
    const { deaths, n } = deathRate('micrometeorite-puncture', mid('micrometeorite-puncture'), { suits: 10 }, 1, 5000);
    expectRate(deaths, n, 0.01, 4, 'puncture day 2 suited');
  });

  it('Micrometeorite puncture: 0% after its first 2 days', () => {
    expect(deathRate('micrometeorite-puncture', mid('micrometeorite-puncture'), { suits: 0 }, 2, 3000).deaths).toBe(0);
  });
});

describe('Death causes at health 0 (health.md step 2)', () => {
  it('cause is the active condition with the most negative daily health', () => {
    const s = withCrew(ship({ rations: 'half' }), 0, { health: 3, conditions: [cond('space-dysentery'), cond('hull-mold-fever'), cond('scurvy')] });
    const r = tick(s, createRng(1));
    const c = r.state.crew[0]!;
    expect(c.alive).toBe(false);
    expect(c.cause).toBe('hull-mold-fever');
    expect(c.health).toBe(0);
    expect(c.diedOnDay).toBe(1);
    expect(r.state.deaths).toBe(1);
    expect(r.entries.some((e) => e.kind === 'death' && e.id === 'hull-mold-fever')).toBe(true);
  });

  it('ties go to table order (mold fever before micrometeorite puncture, both -6)', () => {
    const s = withCrew(ship({ rations: 'half' }), 0, { health: 1, conditions: [cond('micrometeorite-puncture', 4, 5), cond('hull-mold-fever')] });
    expect(tick(s, createRng(1)).state.crew[0]!.cause).toBe('hull-mold-fever');
  });

  it('starving crew with no condition die of starvation', () => {
    const s = withCrew(ship({ supplies: { rations: 0 } }), 0, { health: 5 });
    expect(tick(s, createRng(1)).state.crew[0]!.cause).toBe('starvation');
  });

  it('no condition and not starving: exhaustion', () => {
    const s = withCrew(ship({ rations: 'half', thrust: 'overburn' }), 0, { health: 3 });
    const c = tick(s, createRng(1)).state.crew[0]!;
    expect(c.alive).toBe(false);
    expect(c.cause).toBe('exhaustion');
  });

  it('a condition beats starvation as the cause', () => {
    const s = withCrew(ship({ supplies: { rations: 0 } }), 0, { health: 5, conditions: [cond('cryo-fever')] });
    expect(tick(s, createRng(1)).state.crew[0]!.cause).toBe('cryo-fever');
  });

  it('the dead stay dead, eat nothing and have no conditions left', () => {
    const s = withCrew(ship({ supplies: { rations: 0 } }), 0, { health: 5 });
    const dead = tick(s, createRng(1)).state;
    const c = dead.crew[0]!;
    expect(c.conditions).toEqual([]);
    const next = tick(dead, createRng(2)).state.crew[0]!;
    expect(next.alive).toBe(false);
    expect(next.health).toBe(0);
  });
});

describe('Triggers and progress (health.md steps 4-5)', () => {
  it('Exhaustion: the 5th consecutive Overburn moving day gives every present crew member exhaustion', () => {
    const s = ship({ thrust: 'overburn', consecutiveOverburn: 4 });
    for (let seed = 1; seed <= 25; seed++) {
      const r = tick(s, createRng(seed)).state;
      expect(r.consecutiveOverburn).toBe(5);
      for (const c of r.crew) expect(c.conditions.some((x) => x.id === 'exhaustion')).toBe(true);
    }
  });

  it('Exhaustion is not triggered on the 4th Overburn day', () => {
    const s = ship({ thrust: 'overburn', consecutiveOverburn: 3 });
    for (let seed = 1; seed <= 25; seed++) {
      expect(tick(s, createRng(seed)).state.crew.some((c) => c.conditions.some((x) => x.id === 'exhaustion'))).toBe(false);
    }
  });

  it('Exhaustion needs Overburn moving days: a ship that cannot move does not accumulate them', () => {
    const s = ship({ thrust: 'overburn', consecutiveOverburn: 4, broken: { hull: false, pump: true, gyro: false } });
    for (let seed = 1; seed <= 25; seed++) {
      const r = tick(s, createRng(seed)).state;
      expect(r.crew.some((c) => c.conditions.some((x) => x.id === 'exhaustion'))).toBe(false);
    }
  });

  it('a crew member with 2 active conditions cannot gain a third (exhaustion finds no room)', () => {
    const full = withCrew(ship({ thrust: 'overburn', consecutiveOverburn: 4 }), 0, { conditions: [cond('cryo-fever'), cond('scurvy')] });
    for (let seed = 1; seed <= 25; seed++) {
      const c = tick(full, createRng(seed)).state.crew[0]!;
      expect(c.conditions.length).toBeLessThanOrEqual(2);
      expect(c.conditions.some((x) => x.id === 'exhaustion')).toBe(false);
    }
  });

  it('a crew member cannot hold two copies of one condition', () => {
    const s = withCrew(ship({ thrust: 'overburn', consecutiveOverburn: 6 }), 0, { conditions: [cond('exhaustion', 2, 1)] });
    for (let seed = 1; seed <= 25; seed++) {
      expect(tick(s, createRng(seed)).state.crew[0]!.conditions.filter((x) => x.id === 'exhaustion').length).toBe(1);
    }
  });

  it('Exhaustion ends after 2 consecutive days off Overburn; an Overburn day in between resets it', () => {
    const base = withCrew(allHealth(ship({ rations: 'half' }), 90), 0, { conditions: [cond('exhaustion', 2, 1)] });
    const step = (s: GameState, thrust: 'cruise' | 'overburn'): GameState => {
      const prepared = { ...s, thrust, consecutiveOverburn: 0 };
      return runTrials(prepared, CONTINUE, 50, (t) => !t.r.entries.some((e) => e.kind === 'event' || e.kind === 'death'))[0]!.r.state;
    };
    const has = (s: GameState): boolean => s.crew[0]!.conditions.some((x) => x.id === 'exhaustion');
    const a = step(base, 'cruise');
    expect(has(a)).toBe(true); // one day off Overburn: still exhausted
    const b = step(a, 'overburn');
    expect(has(b)).toBe(true); // back on Overburn: the clock resets
    const c = step(b, 'cruise');
    expect(has(c)).toBe(true);
    const d = step(c, 'cruise');
    expect(has(d)).toBe(false); // second consecutive day off Overburn
  });

  it('a condition is removed when its remaining days reach 0, with a recovery line', () => {
    const s = withCrew(allHealth(ship({ rations: 'half' }), 90), 0, { conditions: [cond('cryo-fever', 1, 6)] });
    const t = runTrials(s, CONTINUE, 50, (x) => !x.r.entries.some((e) => e.kind === 'event' || e.kind === 'death'))[0]!;
    expect(t.r.state.crew[0]!.conditions).toEqual([]);
    expect(t.r.entries.some((e) => e.kind === 'recover' && e.id === 'cryo-fever')).toBe(true);
  });

  it('conditions count down 1 per normal day', () => {
    const s = withCrew(ship({ rations: 'half' }), 0, { conditions: [cond('cryo-fever', 9, 1)] });
    expect(quietTick(s).r.state.crew[0]!.conditions[0]!.remaining).toBe(8);
  });

  it('Scurvy: on Full rations remaining is capped at 3 days', () => {
    const s = withCrew(ship({ rations: 'full' }), 0, { conditions: [cond('scurvy', 10, 1)] });
    expect(quietTick(s).r.state.crew[0]!.conditions[0]!.remaining).toBeLessThanOrEqual(3);
  });

  it('Scurvy: on Half rations it just counts down', () => {
    const s = withCrew(ship({ rations: 'half' }), 0, { conditions: [cond('scurvy', 10, 1)] });
    expect(quietTick(s).r.state.crew[0]!.conditions[0]!.remaining).toBe(9);
  });

  it('Scurvy on Full rations is gone within 4 days', () => {
    let s = withCrew(allHealth(ship({ rations: 'full' }), 90), 0, { conditions: [cond('scurvy', 10, 1)] });
    for (let day = 0; day < 4; day++) {
      s = runTrials(s, CONTINUE, 50, (x) => !x.r.entries.some((e) => e.kind === 'event' || e.kind === 'death'))[0]!.r.state;
    }
    expect(s.crew[0]!.conditions.some((x) => x.id === 'scurvy')).toBe(false);
  });

  it('Radiation sickness: duration 5-9 days (a condition caught today does not tick down today; decisions.md, tester entry)', () => {
    const s = allHealth(ship({ weather: 'storm', supplies: { suits: 0 } }), 100);
    const seen: number[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const r = tick(s, createRng(seed)).state;
      for (const c of r.crew) for (const x of c.conditions) if (x.id === 'radiation-sickness') seen.push(x.remaining);
    }
    expect(seen.length).toBeGreaterThan(100);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...seen)).toBeLessThanOrEqual(9);
    expect(Math.max(...seen)).toBeGreaterThanOrEqual(8);
  });

  it('Illness durations match the table for all five illness conditions (and each is seen)', () => {
    const s0 = allHealth(ship({ weather: 'unsettled', rations: 'half', segment: 11, consecutiveLowRations: 12, distanceTotal: 0 }), 100);
    const durations = new Map<string, number[]>();
    for (let seed = 1; seed <= 9000; seed++) {
      const r = tick(s0, createRng(seed * 17 + 3));
      for (const e of r.entries) {
        if (e.kind !== 'condition' || e.id === 'radiation-sickness' || e.id === 'exhaustion') continue;
        const holder = r.state.crew.find((c) => c.conditions.some((x) => x.id === e.id && x.daysActive === 0));
        const x = holder?.conditions.find((y) => y.id === e.id);
        if (x) durations.set(e.id!, [...(durations.get(e.id!) ?? []), x.remaining]);
      }
    }
    for (const id of ['space-dysentery', 'hull-mold-fever', 'cryo-fever', 'scurvy', 'micrometeorite-puncture'] as ConditionId[]) {
      const d = durations.get(id) ?? [];
      expect(d.length, `${id} samples`).toBeGreaterThan(15);
      expect(Math.min(...d), `${id} min`).toBeGreaterThanOrEqual(COND[id].dur[0]);
      expect(Math.max(...d), `${id} max`).toBeLessThanOrEqual(COND[id].dur[1]);
      if (d.length >= 40) {
        expect(Math.min(...d), `${id} reaches min`).toBe(COND[id].dur[0]);
        expect(Math.max(...d), `${id} reaches max`).toBe(COND[id].dur[1]);
      }
    }
  });
});

describe('Game over (health.md "Game over")', () => {
  it('No living crew: status dead', () => {
    const s = allHealth(ship({ supplies: { rations: 0 } }), 5);
    const r = tick(s, createRng(1));
    expect(r.state.crew.every((c) => !c.alive)).toBe(true);
    expect(r.state.status).toBe('dead');
    expect(r.entries.some((e) => e.kind === 'gameover' && e.id === 'dead')).toBe(true);
  });

  it('Only missing crew remain alive: they rejoin at once, and it is not game over', () => {
    let s = ship();
    s = { ...s, crew: s.crew.map((c, i) => (i < 4 ? { ...c, alive: false, health: 0, cause: 'starvation' as const } : { ...c, awayDays: 4 })) };
    const r = tick(s, createRng(1));
    expect(r.state.crew[4]!.awayDays).toBe(0);
    expect(r.state.status).toBe('traveling');
    expect(r.entries.some((e) => e.kind === 'rejoin')).toBe(true);
  });

  it('Starvation is not a separate ending: with no food the crew is dead in about 10 days', () => {
    let s = ship({ supplies: { rations: 0 } });
    let day = 0;
    for (; s.status === 'traveling' && day < 14; day++) s = applyAction(s, CONTINUE, createRng(day + 1)).state;
    expect(s.status).toBe('dead');
    expect(day).toBeLessThanOrEqual(10);
    expect(day).toBeGreaterThanOrEqual(8);
    expect(s.crew.filter((c) => c.cause === 'starvation').length).toBeGreaterThanOrEqual(3);
  });

  it('Arrival with at least one living crew member ends the run (even if others died)', () => {
    let s = ship({ segment: 16, distanceInSegment: 200, distanceTotal: 2039 });
    s = { ...s, crew: s.crew.map((c, i) => (i === 0 ? c : { ...c, alive: false, health: 0, cause: 'starvation' as const })) };
    const t = runTrials(s, CONTINUE, 50, (x) => x.r.state.arrivedAt === 16)[0]!;
    expect(t.r.state.status).toBe('arrived');
  });
});
