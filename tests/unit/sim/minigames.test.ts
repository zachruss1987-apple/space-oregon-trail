/** minigames.md: result validation, Salvage / Threading / Flare application, minigameSeed, and the unchanged policy. */
import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { applyAction, applyFlareResult, applySalvageResult, applyThreadingResult, intentBlocker } from '@/sim/actions';
import { createGame } from '@/sim/game';
import { applySalvage, haulUnits, minigameSeed, partsPhrase, resultError } from '@/sim/minigame';
import { runPolicy } from '@/sim/policy';
import { createRng, seedFromString } from '@/sim/rng';
import { computeScore } from '@/sim/score';
import { rationNeed } from '@/sim/travel';
import type { FlareResult, GameState, LogEntry, SalvageResult, ThreadingResult } from '@/sim/types';
import fixture from './fixtures/policy-50.json';
import { constRng, scriptedRng, travelingState } from './helpers';

const BELT = 7;
const LUNAR = 1;
const FLARE = 15;

function pending(idx: number, density: number, over: Parameters<typeof travelingState>[0] = {}): GameState {
  return travelingState({
    segment: idx + 1, arrivedAt: idx, distanceTotal: WAYPOINTS[idx]!.cumulative, rations: 'half', date: '2184-07-01', window: 3,
    crossing: { waypoint: idx, density, pilotDaysLeft: null }, credits: 500,
    ...over,
    supplies: { drives: 3, rations: 1500, suits: 20, charges: 200, plates: 3, pumps: 3, gyros: 3, ...over.supplies },
  });
}
const salv = (over: Partial<SalvageResult> = {}): SalvageResult =>
  ({ kind: 'salvage', rations: 0, plates: 0, pumps: 0, gyros: 0, chargesUsed: 0, crewHurt: 0, ...over });
const thread = (hits: number, bonus: ThreadingResult['bonus'] = null): ThreadingResult => ({ kind: 'threading', hits, bonus });
const flare = (hits: number): FlareResult => ({ kind: 'flare', hits });
const ids = (es: readonly LogEntry[], kind?: string): string[] =>
  es.filter((e) => kind === undefined || e.kind === kind).map((e) => (kind ? `${e.id}` : `${e.kind}:${e.id}`));

describe('result validation (schemas + cross-field rules)', () => {
  it('accepts well-formed results', () => {
    expect(resultError(salv({ rations: 70, plates: 1, pumps: 1, gyros: 1, chargesUsed: 20, crewHurt: 3, droneWrecked: true }), 'salvage')).toBeNull();
    expect(resultError(thread(0, 'health'), 'threading')).toBeNull();
    expect(resultError(thread(99), 'threading')).toBeNull();
    expect(resultError(flare(5), 'flare')).toBeNull();
  });

  it.each([
    ['not an object', null],
    ['an array', []],
    ['wrong kind', { ...salv(), kind: 'flare' }],
    ['missing field', { kind: 'salvage', rations: 1 }],
    ['extra field', { ...salv(), bonus: 1 }],
    ['fractional', salv({ rations: 1.5 })],
    ['negative', salv({ plates: -1 })],
    ['rations over 100', salv({ rations: 101 })],
    ['part over 3', salv({ gyros: 4 })],
    ['charges over 20', salv({ chargesUsed: 21 })],
    ['crewHurt over 3', salv({ crewHurt: 4 })],
    ['droneWrecked not boolean', { ...salv(), droneWrecked: 'yes' }],
    ['over the carry limit', salv({ rations: 80, plates: 3 })],
  ])('refuses a salvage result: %s', (_, r) => {
    expect(resultError(r, 'salvage')).toBeTruthy();
  });

  it('refuses bad threading and flare results', () => {
    expect(resultError(thread(1, 'rations'), 'threading')).toMatch(/clean/);
    expect(resultError(thread(100), 'threading')).toBeTruthy();
    expect(resultError({ kind: 'threading', hits: 0, bonus: 'credits' }, 'threading')).toBeTruthy();
    expect(resultError({ kind: 'threading', hits: 0 }, 'threading')).toBeTruthy();
    expect(resultError(flare(6), 'flare')).toBeTruthy();
    expect(resultError(thread(0), 'flare')).toBeTruthy();
  });

  it('haulUnits: 1 per ration, 10 per part', () => {
    expect(haulUnits(salv({ rations: 30, plates: 1, gyros: 2 }))).toBe(60);
  });
});

describe('Salvage Run application', () => {
  const at = (over: Parameters<typeof travelingState>[0] = {}) => travelingState({ segment: 3, ...over });

  it('one day; spends chargesUsed; adds rations and parts; counts as a scan; logs salvage/haul', () => {
    const s = at({ supplies: { plates: 1 } });
    const r = applySalvageResult(s, salv({ rations: 40, plates: 1, chargesUsed: 12 }), createRng(3));
    expect(r.error).toBeUndefined();
    expect(r.state.day).toBe(s.day + 1);
    expect(r.state.supplies.charges).toBe(88);
    expect(r.state.supplies.plates).toBe(2);
    expect(r.state.supplies.rations).toBe(1500 + 40 - rationNeed(s));
    expect(r.state.scansThisSegment).toBe(1);
    expect(ids(r.entries, 'salvage')).toEqual(['haul']);
    expect(s.supplies.charges).toBe(100);
  });

  it('the 3rd scan/salvage in a segment halves rations (floor), not parts', () => {
    const s = at({ scansThisSegment: 2, supplies: { plates: 0 } });
    const out: LogEntry[] = [];
    expect(applySalvage(s, salv({ rations: 41, plates: 2 }), createRng(1), out)).toBe(20);
    expect(s.supplies).toMatchObject({ rations: 1520, plates: 2 });
    expect(s.scansThisSegment).toBe(3);
  });

  it('parts clamp to the hold cap of 3; text picks haulParts / haulRations / haul / nothing', () => {
    const s = at({ supplies: { plates: 3, pumps: 2, gyros: 0 } });
    const out: LogEntry[] = [];
    applySalvage(s, salv({ plates: 2, pumps: 2, gyros: 1 }), createRng(1), out);
    expect(s.supplies).toMatchObject({ plates: 3, pumps: 3, gyros: 1 });
    expect(out.map((e) => e.id)).toEqual(['haul']);
    applySalvage(s, salv({ plates: 1 }), createRng(1), out);
    expect(out.map((e) => e.id)).toEqual(['haul', 'nothing']);
  });

  it('droneWrecked logs the wrecked line first; each hot chunk hurts one random present crew by 5 (one draw each)', () => {
    const s = at();
    for (const c of s.crew) c.health = 50;
    s.crew[1]!.awayDays = 2;
    const out: LogEntry[] = [];
    // draws: wrecked text, nothing text, pick (0 -> crew[0]), text, pick (0.99 -> last present), text
    applySalvage(s, salv({ crewHurt: 2, droneWrecked: true }), scriptedRng([0.5, 0.5, 0, 0.5, 0.99, 0.5]), out);
    expect(out.map((e) => `${e.kind}:${e.id}`)).toEqual(['salvage:wrecked', 'salvage:nothing', 'salvage:hot', 'salvage:hot']);
    expect(s.crew.map((c) => c.health)).toEqual([45, 50, 50, 50, 45]);
  });

  it('a hot chunk can kill; with nobody present no draw is made', () => {
    const s = at();
    s.crew[0]!.health = 3;
    for (const c of s.crew.slice(1)) c.alive = false;
    const out: LogEntry[] = [];
    applySalvage(s, salv({ crewHurt: 3 }), constRng(0), out);
    expect(s.crew[0]!.alive).toBe(false);
    expect(out.filter((e) => e.id === 'hot')).toHaveLength(1);
  });

  it('refusals: impossible charges, no charges, bad shape, at New Willamette; no day passes', () => {
    const few = at({ supplies: { charges: 5 } });
    const r = applySalvageResult(few, salv({ chargesUsed: 6 }), createRng(1));
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(few);
    expect(applySalvageResult(at({ supplies: { charges: 0 } }), salv(), createRng(1)).error).toMatch(/charges/);
    expect(applySalvageResult(at(), salv({ rations: 90, gyros: 1, plates: 1 }), createRng(1)).error).toMatch(/carry/);
    expect(intentBlocker(at({ arrivedAt: 16 }), { type: 'salvage', result: salv() })).toBeTruthy();
    expect(applySalvageResult(at({ supplies: { charges: 1 } }), salv({ chargesUsed: 1 }), createRng(1)).error).toBeUndefined();
  });

  it('auto-resolve: { type: "salvage" } without a result is exactly the 5-charge scan', () => {
    const s = at();
    const a = applyAction(s, { type: 'salvage' }, createRng(11));
    const b = applyAction(s, { type: 'scan' }, createRng(11));
    expect(a).toEqual(b);
    expect(applyAction(at({ supplies: { charges: 4 } }), { type: 'salvage' }, createRng(1)).error).toBeTruthy();
  });
});

describe('Debris Threading application', () => {
  it('clean: no roll, the bonus pick, logs crossing/thread, threading/clean, hazard/clear; no day', () => {
    const s = pending(BELT, 4);
    s.crew[0]!.health = 99;
    s.crew[1]!.health = 50;
    const h = applyThreadingResult(s, thread(0, 'health'), createRng(1));
    expect(ids(h.entries)).toEqual(['crossing:thread', 'threading:clean', 'hazard:clear']);
    expect(h.state.crew.slice(0, 2).map((c) => c.health)).toEqual([100, 52]);
    expect(h.state).toMatchObject({ day: s.day, crossing: null, justCrossedHazard: true, arrivedAt: BELT });
    const r = applyThreadingResult(s, thread(0, 'rations'), createRng(1));
    expect(r.state.supplies.rations).toBe(1510);
    expect(applyThreadingResult(s, thread(0), createRng(1)).state.supplies.rations).toBe(1500);
  });

  it('rolls 1-2 are capped at 95 (never Lost), +5 at density >= 4', () => {
    const r = applyThreadingResult(pending(BELT, 4), thread(2), constRng(0.99));
    expect(ids(r.entries, 'hazard')).toEqual(['injury', 'injury']);
    expect(r.state.deaths).toBe(0);
    // density 2: d100 41 -> cargo; density 4: 41 + 5 = 46 -> cargo; d100 36 + 5 = 41 -> cargo vs 36 scraped
    expect(ids(applyThreadingResult(pending(LUNAR, 2), thread(1), scriptedRng([0.5, 0.5, 0.35])).entries, 'hazard')).toEqual(['scraped']);
    expect(ids(applyThreadingResult(pending(BELT, 4), thread(1), scriptedRng([0.5, 0.5, 0.35])).entries, 'hazard')).toEqual(['cargo']);
  });

  it('rolls 3-4 are uncapped (Lost possible); at most 4 rolls; logs threading/hit with {hits}', () => {
    const r = applyThreadingResult(pending(BELT, 4), thread(3), constRng(0.99));
    expect(ids(r.entries, 'hazard')).toEqual(['injury', 'injury', 'lost']);
    expect(r.state.deaths).toBe(1);
    expect(ids(r.entries, 'threading')).toEqual(['hit']);
    const many = applyThreadingResult(pending(BELT, 4), thread(10), constRng(0.01));
    expect(ids(many.entries, 'hazard')).toEqual(['scraped', 'scraped', 'scraped', 'scraped']);
    expect(many.state.delayDays).toBe(1);
  });

  it('refusals: a result needs thread, the right kind for the place, and a valid shape', () => {
    const s = pending(BELT, 4);
    expect(applyAction(s, { type: 'cross', method: 'shields', result: thread(0) }, createRng(1)).error).toBeTruthy();
    expect(applyAction(s, { type: 'cross', method: 'thread', result: flare(0) }, createRng(1)).error).toBeTruthy();
    expect(applyThreadingResult(s, thread(2, 'health'), createRng(1)).error).toBeTruthy();
    expect(applyThreadingResult(pending(FLARE, 5), thread(0), createRng(1)).error).toBeTruthy();
    expect(applyThreadingResult(pending(BELT, 4, { broken: { hull: false, pump: true, gyro: false } }), thread(0), createRng(1)).error).toBeTruthy();
  });

  it('cross thread without a result is the unchanged statistical roll', () => {
    const r = applyAction(pending(BELT, 4), { type: 'cross', method: 'thread' }, createRng(5));
    expect(ids(r.entries, 'threading')).toEqual([]);
    expect(ids(r.entries, 'crossing')).toEqual(['thread']);
  });
});

describe('Flare Belt application', () => {
  const at = (over: Parameters<typeof travelingState>[0] = {}) => pending(FLARE, 5, over);
  const hit = (s: GameState, values: number[]) => applyFlareResult(s, flare(1), scriptedRng([0.5, ...values]));

  it('clean: rodeTheWind, flare/clean, +200 "Rode the wind" before the multiplier; tug and auto-resolve never earn it', () => {
    const s = at();
    const r = applyFlareResult(s, flare(0), createRng(1));
    expect(ids(r.entries)).toEqual(['crossing:thread', 'flare:clean']);
    expect(r.state).toMatchObject({ rodeTheWind: true, crossing: null, justCrossedHazard: true, day: s.day });
    const with_ = computeScore(r.state);
    const without = computeScore(s);
    expect(with_.lines.find((l) => l.key === 'rodeTheWind')!.points).toBe(200);
    expect(without.lines.find((l) => l.key === 'rodeTheWind')!.points).toBe(0);
    expect(with_.total - without.total).toBe(200 * with_.multiplier);
    expect(applyAction(s, { type: 'cross', method: 'thread' }, createRng(1)).state.rodeTheWind).toBe(false);
    expect(applyAction(s, { type: 'cross', method: 'tug' }, createRng(1)).state.rodeTheWind).toBe(false);
  });

  it('1-35 scorch: one cargo type with qty > 0 loses 10-25% (min 1)', () => {
    const r = hit(at(), [0, 0, 0]);
    expect(ids(r.entries, 'flare')).toEqual(['scorch']);
    expect(r.state.supplies.rations).toBe(1350);
    const empty = hit(at({ supplies: { rations: 0, suits: 0, charges: 0 } }), [0]);
    expect(ids(empty.entries, 'flare')).toEqual(['scorch']);
  });

  it('36-65 burn: random present crew -10, -5 if suited', () => {
    expect(hit(at(), [0.4, 0]).state.crew[0]!.health).toBe(95);
    expect(hit(at({ supplies: { suits: 0 } }), [0.4, 0]).state.crew[0]!.health).toBe(90);
  });

  it('66-85 damage: as trail.md Damage', () => {
    const r = hit(at(), [0.7, 0]);
    expect(ids(r.entries, 'flare')).toEqual(['damage']);
    expect(r.state.broken.hull).toBe(true);
  });

  it('86-100 radiation: unsuited crew gains radiation sickness; none eligible -> random present crew -10', () => {
    const r = hit(at({ supplies: { suits: 0 } }), [0.9, 0]);
    expect(r.state.crew[0]!.conditions.map((c) => c.id)).toEqual(['radiation-sickness']);
    const suited = hit(at(), [0.9, 0]);
    expect(ids(suited.entries, 'flare')).toEqual(['radiation']);
    expect(suited.state.crew[0]!.health).toBe(90);
    const full = at({ supplies: { suits: 0 } });
    full.crew[0]!.conditions = [{ id: 'space-dysentery', remaining: 3, daysActive: 1 }, { id: 'cryo-fever', remaining: 3, daysActive: 1 }];
    const noRoom = hit(full, [0.9, 0, 0.5, 0]);
    expect(noRoom.state.crew[0]!.health).toBe(90);
  });

  it('flare season adds +10 to the hit d100 (31 -> burn)', () => {
    expect(ids(hit(at({ date: '2184-09-20' }), [0.3, 0]).entries, 'flare')).toEqual(['burn']);
    expect(ids(hit(at({ date: '2184-07-01' }), [0.3, 0, 0]).entries, 'flare')).toEqual(['scorch']);
  });

  it('hits apply in order, one d100 each', () => {
    const r = applyFlareResult(at(), flare(4), constRng(0.7));
    expect(ids(r.entries, 'flare')).toEqual(['damage', 'damage', 'damage', 'damage']);
  });

  it('crash (5 hits): a crew member dies, rations/suits/charges halve, one of each spare lost, hull breaks', () => {
    const r = applyFlareResult(at({ supplies: { rations: 1501, pumps: 0 } }), flare(5), constRng(0));
    expect(ids(r.entries)).toEqual(['crossing:thread', 'flare:crash', 'death:hazard']);
    expect(r.state.deaths).toBe(1);
    expect(r.state.crew[0]!.cause).toBe('hazard');
    expect(r.state.supplies).toMatchObject({ rations: 751, suits: 10, charges: 100, plates: 2, pumps: 0, gyros: 2 });
    expect(r.state.broken.hull).toBe(true);
    expect(r.state.status).toBe('traveling');
  });

  it('a crash that kills the last crew ends the run', () => {
    const s = at();
    for (const c of s.crew.slice(1)) c.alive = false;
    expect(applyFlareResult(s, flare(5), createRng(1)).state.status).toBe('dead');
  });
});

describe('state.seed and minigameSeed', () => {
  it('createGame stores the seed label (default ""); rodeTheWind starts false', () => {
    expect(createGame({ profession: 'farmer', window: 1, seed: 'ABC' }, createRng(1))).toMatchObject({ seed: 'ABC', rodeTheWind: false });
    expect(createGame({ profession: 'farmer', window: 1 }, createRng(1)).seed).toBe('');
  });

  it('minigameSeed = seedFromString(`${seed}:${kind}:${day}`)', () => {
    expect(minigameSeed({ seed: 'ABC', day: 41 }, 'salvage')).toBe(seedFromString('ABC:salvage:41'));
    expect(minigameSeed({ seed: '', day: 41 }, 'salvage')).toBe(seedFromString(':salvage:41'));
    expect(minigameSeed({ seed: 'ABC', day: 41 }, 'flare')).not.toBe(minigameSeed({ seed: 'ABC', day: 41 }, 'threading'));
  });

  it('partsPhrase builds prose', () => {
    expect(partsPhrase({ plates: 0, pumps: 0, gyros: 0 })).toBe('');
    expect(partsPhrase({ plates: 1, pumps: 0, gyros: 2 })).toBe('a hull plate and 2 nav gyros');
    expect(partsPhrase({ plates: 1, pumps: 1, gyros: 1 })).toBe('a hull plate, a coolant pump and a nav gyro');
  });
});

describe('reference policy unchanged (minigames.md "Reference policy")', () => {
  it('50 seeds give the same RunSummary as before M3 (fixture snapshot)', () => {
    const now = fixture.map((f) => {
      const r = runPolicy(f.seed);
      const trace = r.final.log.map((e) => `${e.day}|${e.kind}|${e.id ?? ''}`).join(';');
      return {
        seed: r.seed, profession: r.profession, window: r.window, status: r.status, days: r.days, deaths: r.deaths,
        causes: r.causes, score: r.score, logLength: r.final.log.length, trace: seedFromString(trace),
      };
    });
    expect(now).toEqual(fixture);
  });
});
