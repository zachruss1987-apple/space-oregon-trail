/** hazards.md: pending crossings, today's density, the four methods, availability, risk words, pilot flow, RNG order. */
import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { applyAction, intentBlocker } from '@/sim/actions';
import {
  crossBlocker, crossChance, crossingOptions, densityFactor, densityTrend, riskLabel, riskWord, rollDensity, tugPrice,
} from '@/sim/crossing';
import { policyCross } from '@/sim/policy';
import { createRng } from '@/sim/rng';
import { tick } from '@/sim/tick';
import type { CrossMethod, GameState, LogEntry } from '@/sim/types';
import { constRng, travelingState } from './helpers';

/** Parked at hazard `idx` with a pending crossing at `density`. */
function pending(idx: number, density: number, over: Parameters<typeof travelingState>[0] = {}): GameState {
  return travelingState({
    segment: idx + 1, arrivedAt: idx, distanceTotal: WAYPOINTS[idx]!.cumulative, rations: 'half', date: '2184-07-01', window: 3,
    crossing: { waypoint: idx, density, pilotDaysLeft: null }, credits: 500,
    ...over,
    supplies: { drives: 3, rations: 1500, suits: 20, charges: 200, plates: 3, pumps: 3, gyros: 3, ...over.supplies },
  });
}
const outcome = (es: readonly LogEntry[]): string | undefined => es.find((e) => e.kind === 'hazard' && e.id !== 'pump-strain')?.id;
const cross = (s: GameState, method: CrossMethod, seed: number) => applyAction(s, { type: 'cross', method }, createRng(seed));

describe('today\'s density (hazards.md)', () => {
  it('rolls nominal -1 / nominal / +1 at 25/50/25, clamped 1-5; the Flare Belt is always 5 with no draw', () => {
    const counts: Record<number, number> = {};
    for (let seed = 1; seed <= 8000; seed++) {
      const d = rollDensity(WAYPOINTS[7]!, createRng(seed));
      counts[d] = (counts[d] ?? 0) + 1;
    }
    expect(Object.keys(counts).map(Number).sort()).toEqual([3, 4, 5]);
    expect(counts[3]! / 8000).toBeCloseTo(0.25, 1);
    expect(counts[4]! / 8000).toBeCloseTo(0.5, 1);
    const rng = createRng(3);
    const before = createRng(3).next();
    expect(rollDensity(WAYPOINTS[15]!, rng)).toBe(5);
    expect(rng.next()).toBe(before); // no draw consumed
    expect(rollDensity(WAYPOINTS[1]!, constRng(0))).toBe(1);
    expect(rollDensity(WAYPOINTS[15]!, constRng(0))).toBe(5);
  });

  it('densityFactor and trend words', () => {
    expect(densityFactor(5, 4)).toBeCloseTo(1.2);
    expect(densityFactor(3, 4)).toBeCloseTo(0.8);
    expect(densityTrend({ waypoint: 7, density: 3, pilotDaysLeft: null })).toBe('thinner');
    expect(densityTrend({ waypoint: 7, density: 4, pilotDaysLeft: null })).toBe('usual');
    expect(densityTrend({ waypoint: 7, density: 5, pilotDaysLeft: null })).toBe('thicker');
  });

  it('arrival at a hazard pends the crossing with one density draw and no outcome', () => {
    const s = travelingState({ segment: 7, distanceInSegment: 101.95, distanceTotal: 931.95 });
    const r = tick(s, createRng(11));
    expect(r.state.crossing?.waypoint).toBe(7);
    expect([3, 4, 5]).toContain(r.state.crossing?.density);
    expect(r.entries.some((e) => e.kind === 'hazard')).toBe(false);
  });
});

describe('incident chance and risk words (hazards.md worked examples)', () => {
  it('Belt Crossing, intact, density 4: thread 35, shields 18, tug 0, pilot 3', () => {
    const s = pending(7, 4);
    expect(crossChance(s, 'thread')).toBe(35);
    expect(crossChance(s, 'shields')).toBe(18);
    expect(crossChance(s, 'tug')).toBe(0);
    expect(crossChance(s, 'pilot')).toBe(3);
  });

  it('Belt Crossing, density 5, gyro broken: thread 52 (Severe), shields 26 (High)', () => {
    const s = pending(7, 5, { broken: { hull: false, pump: false, gyro: true } });
    expect(crossChance(s, 'thread')).toBe(52);
    expect(crossChance(s, 'shields')).toBe(26);
    const opts = crossingOptions(s);
    expect(opts.map((o) => o.risk)).toEqual(['severe', 'high', 'none', 'low']);
    expect(opts[2]!.price).toBe(80);
    expect(opts[3]!.waitDays).toBe(4);
  });

  it('Lunar Debris Ring, Window 1, density 1: thread 20, shields 10; no pilot', () => {
    const s = pending(1, 1, { window: 1, date: '2184-03-10' });
    expect(crossChance(s, 'thread')).toBe(20);
    expect(crossChance(s, 'shields')).toBe(10);
    expect(crossChance(s, 'pilot')).toBeNull();
    expect(tugPrice(s, WAYPOINTS[1]!)).toBe(25);
  });

  it('Heliopause, direct route, flare season, density 4: thread 45, shields 23, tug 135', () => {
    const s = pending(13, 4, { route: 'direct', date: '2184-09-20' });
    expect(crossChance(s, 'thread')).toBe(45);
    expect(crossChance(s, 'shields')).toBe(23);
    expect(tugPrice(s, WAYPOINTS[13]!)).toBe(135);
    expect(crossChance(pending(13, 4), 'thread')).toBe(35);
  });

  it('ship modifiers: +10 hull, +10 gyro, +10 for <= 1 working drive; thread capped at 95', () => {
    const s = pending(7, 5, { broken: { hull: true, pump: false, gyro: true }, offlineDrives: [3, 3], route: 'direct' });
    expect(crossChance(s, 'thread')).toBe(72);
    const worst = pending(15 - 2, 5, { broken: { hull: true, pump: false, gyro: true }, offlineDrives: [3, 3], route: 'direct', date: '2184-09-20' });
    expect(crossChance(worst, 'thread')).toBe(84);
    expect(crossChance(pending(7, 5, { broken: { hull: true, pump: false, gyro: true }, supplies: { drives: 1 }, window: 1 }), 'thread')).toBe(72);
  });

  it('flare-season tug prices round half up', () => {
    const prices = [1, 2, 7, 9, 13, 15].map((i) => tugPrice(pending(i, 3, { date: '2184-09-15' }), WAYPOINTS[i]!));
    expect(prices).toEqual([38, 53, 120, 90, 135, 180]);
  });

  it('risk words: 0 None, 1-9 Low, 10-24 Moderate, 25-44 High, >= 45 Severe', () => {
    expect([0, 1, 9, 10, 24, 25, 44, 45, 95].map(riskWord)).toEqual(['none', 'low', 'low', 'moderate', 'moderate', 'high', 'high', 'severe', 'severe']);
    expect(riskLabel(50)).toBe('Severe');
  });
});

describe('availability (hazards.md)', () => {
  it('thread/shields need a working drive and pump; tug and pilot need credits; pilot only where Belters work', () => {
    expect(crossBlocker(pending(7, 4, { broken: { hull: false, pump: true, gyro: false } }), 'thread')).toBe('Your ship cannot move.');
    expect(crossBlocker(pending(7, 4, { offlineDrives: [2, 2, 2] }), 'shields')).toBe('Your ship cannot move.');
    expect(crossBlocker(pending(7, 4, { credits: 79 }), 'tug')).toBe('You cannot afford a tug.');
    expect(crossBlocker(pending(7, 4, { credits: 9.5 }), 'pilot')).toBe('You cannot afford a pilot.');
    expect(crossBlocker(pending(2, 2), 'pilot')).toBe('No Belters work this stretch.');
    expect(crossBlocker(pending(9, 3), 'pilot')).toBeNull();
    expect(crossBlocker(travelingState(), 'thread')).toBe('There is nothing to cross.');
  });

  it('The Flare Belt in M2: thread (M1 roll) and tug only; shields and pilot "Not in this weather."', () => {
    const s = pending(15, 5, { date: '2184-08-20' });
    expect(crossBlocker(s, 'shields')).toBe('Not in this weather.');
    expect(crossBlocker(s, 'pilot')).toBe('Not in this weather.');
    expect(crossChance(s, 'thread')).toBe(45);
    expect(crossChance({ ...s, date: '2184-09-20' }, 'thread')).toBe(60);
    expect(crossChance(s, 'shields')).toBeNull();
    expect(crossingOptions({ ...s, credits: 100 }).map((o) => o.blocker === null)).toEqual([true, false, false, false]);
  });

  it('while pending: continue refused, settings/rest/repair/scan allowed', () => {
    const s = pending(7, 4, { broken: { hull: true, pump: false, gyro: false } });
    expect(intentBlocker(s, { type: 'continue' })).toBe('Choose how to cross first.');
    for (const i of [{ type: 'rest', days: 1 }, { type: 'repair', part: 'hull' }, { type: 'scan' }, { type: 'setThrust', thrust: 'hard' }] as const) {
      expect(intentBlocker(s, i)).toBeNull();
    }
    const rested = applyAction(s, { type: 'rest', days: 2 }, createRng(1)).state;
    expect(rested.crossing).toEqual(s.crossing);
    expect(rested.arrivedAt).toBe(7);
  });
});

describe('outcome distributions per method (10,000 seeded crossings each)', () => {
  const N = 10000;
  const run = (method: CrossMethod, s: GameState) => {
    const ids: Record<string, number> = {};
    let strain = 0;
    let strainBase = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = cross(s, method, seed);
      const id = outcome(r.entries)!;
      ids[id] = (ids[id] ?? 0) + 1;
      if (id !== 'damage') {
        strainBase++;
        if (r.entries.some((e) => e.id === 'pump-strain')) strain++;
      }
    }
    return { ids, incident: 1 - (ids['clear'] ?? 0) / N, strain: strain / Math.max(1, strainBase) };
  };
  const s = { ...pending(9, 4), crossing: { waypoint: 9, density: 4, pilotDaysLeft: 0 } }; // Saturn, wait already done

  it('thread ~ 30% (25 x 1.2), shields ~ 15%, tug 0%, pilot ~ 3%, each within 2 points', () => {
    expect(Math.abs(run('thread', s).incident - 0.3)).toBeLessThan(0.02);
    const sh = run('shields', s);
    expect(Math.abs(sh.incident - 0.15)).toBeLessThan(0.02);
    expect(run('tug', s).incident).toBe(0);
    const p = run('pilot', s);
    expect(Math.abs(p.incident - 0.03)).toBeLessThan(0.02);
  });

  it('shields never Lost and break the pump 15% of the time; pilot never Injury or Lost', () => {
    const sh = run('shields', s);
    expect(sh.ids['lost'] ?? 0).toBe(0);
    expect(Math.abs(sh.strain - 0.15)).toBeLessThan(0.02);
    const p = run('pilot', s);
    expect((p.ids['lost'] ?? 0) + (p.ids['injury'] ?? 0)).toBe(0);
    const t = run('thread', s);
    expect(t.ids['lost'] ?? 0).toBeGreaterThan(0);
  });
});

describe('resolution and logs', () => {
  it('thread: crossing(thread) then hazard(outcome); no day passes; crossing cleared; justCrossed set', () => {
    const s = pending(7, 4);
    const r = cross(s, 'thread', 5);
    expect(r.entries[0]).toMatchObject({ kind: 'crossing', id: 'thread' });
    expect(r.entries[1]!.kind).toBe('hazard');
    expect(r.state.day).toBe(s.day);
    expect(r.state.crossing).toBeNull();
    expect(r.state.justCrossedHazard).toBe(true);
    expect(r.state.arrivedAt).toBe(7);
    expect(intentBlocker(r.state, { type: 'continue' })).toBeNull();
  });

  it('tug: pays the price, clear outcome, no rng draw beyond the text lines', () => {
    const s = pending(13, 4, { date: '2184-09-20', credits: 200 });
    const r = cross(s, 'tug', 9);
    expect(r.state.credits).toBe(65);
    expect(r.entries.map((e) => `${e.kind}:${e.id}`)).toEqual(['crossing:tug', 'hazard:clear']);
    expect(r.entries[0]!.text).toContain('135');
  });

  it('shields at the pump edge: a strain on an already-broken pump does nothing extra', () => {
    const s = pending(7, 4);
    for (let seed = 1; seed <= 300; seed++) {
      const r = cross(s, 'shields', seed);
      const strained = r.entries.filter((e) => e.id === 'pump-strain').length;
      expect(strained).toBeLessThanOrEqual(1);
      if (strained) expect(r.state.broken.pump).toBe(true);
    }
  });

  it('pilot: pays 10 once, waits 4 ticks with distance 0, then resolves; a death mid-wait pauses and resume does not pay again', () => {
    const s = pending(7, 4, { credits: 50 });
    const r = cross(s, 'pilot', 21);
    const kinds = r.entries.filter((e) => e.kind === 'crossing').map((e) => e.id);
    if (r.state.crossing === null) {
      expect(kinds).toEqual(['pilot', 'pilot-wait', 'pilot-wait', 'pilot-wait', 'pilot-wait', 'pilot-arrives']);
      expect(r.state.day).toBe(s.day + 4);
      expect(r.state.distanceTotal).toBe(s.distanceTotal);
      expect(r.state.credits).toBe(40);
      expect(r.state.supplies.rations).toBeLessThan(s.supplies.rations);
    }
    // Force a mid-wait pause: pilotDaysLeft 2, then resume.
    const mid = { ...s, credits: 0, crossing: { waypoint: 7, density: 4, pilotDaysLeft: 2 } };
    expect(crossBlocker(mid, 'pilot')).toBeNull();
    expect(crossBlocker(mid, 'thread')).toBe('You already sent for a pilot.');
    const resumed = cross(mid, 'pilot', 4);
    expect(resumed.state.credits).toBe(0);
    expect(resumed.state.day).toBeLessThanOrEqual(mid.day + 2);
  });

  it('pilot wait stops early on a death', () => {
    let stopped = 0;
    for (let seed = 1; seed <= 400 && stopped < 3; seed++) {
      const s = pending(7, 4, { crew: travelingState().crew.map((c, i) => (i === 1 ? { ...c, health: 1, conditions: [{ id: 'cryo-fever' as const, remaining: 9, daysActive: 1 }] } : c)) });
      const r = cross(s, 'pilot', seed);
      if (r.state.deaths > 0 && r.state.crossing !== null && r.state.status === 'traveling') {
        stopped++;
        expect(r.state.crossing.pilotDaysLeft).toBeGreaterThanOrEqual(0);
        expect(r.state.crossing.pilotDaysLeft).toBeLessThan(4);
      }
    }
    expect(stopped).toBeGreaterThan(0);
  });

  it('a Lost crossing that kills the last crew member ends the run', () => {
    const lone = travelingState().crew.map((c, i) => (i === 0 ? c : { ...c, alive: false, health: 0, cause: 'starvation' as const }));
    let ended = false;
    for (let seed = 1; seed <= 4000 && !ended; seed++) {
      const r = cross(pending(7, 5, { crew: lone, deaths: 4 }), 'thread', seed);
      if (outcome(r.entries) === 'lost') {
        ended = true;
        expect(r.state.status).toBe('dead');
        expect(r.entries.at(-1)!.kind).toBe('gameover');
      }
    }
    expect(ended).toBe(true);
  });

  it('same seed and intents reproduce the crossing exactly', () => {
    const s = travelingState({ segment: 9, distanceInSegment: 161.95 });
    const a = tick(s, createRng(77));
    const b = tick(s, createRng(77));
    expect(b.state).toEqual(a.state);
  });
});

describe('reference policy (hazards.md)', () => {
  it('pilot > tug if credits >= 2x price > shields with a spare pump > thread > rest', () => {
    expect(policyCross(pending(7, 4, { credits: 500 }))).toEqual({ type: 'cross', method: 'pilot' });
    expect(policyCross(pending(13, 4, { credits: 180 }))).toEqual({ type: 'cross', method: 'tug' });
    expect(policyCross(pending(13, 4, { credits: 179 }))).toEqual({ type: 'cross', method: 'shields' });
    expect(policyCross(pending(13, 4, { credits: 0, supplies: { pumps: 0 } }))).toEqual({ type: 'cross', method: 'thread' });
    expect(policyCross(pending(13, 4, { credits: 0, broken: { hull: false, pump: true, gyro: false } }))).toEqual({ type: 'rest', days: 1 });
    expect(policyCross(pending(15, 5, { credits: 0 }))).toEqual({ type: 'cross', method: 'thread' });
  });
});
