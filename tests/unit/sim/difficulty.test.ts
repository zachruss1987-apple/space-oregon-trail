/** M5 difficulty: multipliers applied exactly where specified (events, loss weights, buy prices, credits, illness deaths, score). */
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER, EVENTS, EVENT_CHANCE, ITEMS, WAYPOINTS, type DifficultyId, type EventId, type SupplyKey } from '@/content';
import { runCell } from '@/sim/balance';
import { crossChance, tugPrice } from '@/sim/crossing';
import { eventStep, eventWeight } from '@/sim/events';
import { createGame } from '@/sim/game';
import { deathChanceToday, newDayContext } from '@/sim/health';
import { runPolicy } from '@/sim/policy';
import { createRng, seedFromString } from '@/sim/rng';
import { computeScore } from '@/sim/score';
import { fromJSON, toJSON } from '@/sim/serialize';
import { buy, buyBlocker, cents, costOf, localPrice, maxBuyable, priceAt, sellPrice } from '@/sim/store';
import { difficultySpec } from '@/sim/util';
import type { GameState } from '@/sim/types';
import fixture from './fixtures/policy-50.json';
import { scriptedRng, travelingState } from './helpers';

const LEVELS: readonly DifficultyId[] = ['greenhorn', 'spacer', 'pathfinder'];
const at = (difficulty: DifficultyId, over: Parameters<typeof travelingState>[0] = {}): GameState => travelingState({ difficulty, ...over });

describe('difficulty table', () => {
  it('has the brief numbers; spacer is all ones', () => {
    expect(DIFFICULTY_ORDER).toEqual(LEVELS);
    expect(DIFFICULTIES.greenhorn).toMatchObject({ eventChance: 0.75, lossWeight: 0.75, prices: 0.9, credits: 1.15, illnessDeath: 0.5, score: 0.75 });
    expect(DIFFICULTIES.pathfinder).toMatchObject({ eventChance: 1.25, lossWeight: 1.25, prices: 1.15, credits: 0.9, illnessDeath: 1.5, score: 1.25 });
    const { id, name, ...mults } = DIFFICULTIES.spacer;
    expect([id, name]).toEqual(['spacer', 'Spacer']);
    expect(Object.values(mults).every((m) => m === 1)).toBe(true);
  });

  it('difficultySpec falls back to spacer for missing/unknown levels', () => {
    expect(difficultySpec(undefined)).toBe(DIFFICULTIES.spacer);
    expect(difficultySpec('nightmare' as DifficultyId)).toBe(DIFFICULTIES.spacer);
    expect(difficultySpec('pathfinder')).toBe(DIFFICULTIES.pathfinder);
  });
});

describe('createGame', () => {
  it('defaults to spacer with the profession credits', () => {
    const s = createGame({ profession: 'executive', window: 1 }, createRng(1));
    expect(s.difficulty).toBe('spacer');
    expect(s.credits).toBe(1600);
  });

  it('scales starting credits (rounded) and stores the level', () => {
    const credits = (difficulty: DifficultyId, profession: 'executive' | 'engineer' | 'farmer'): number =>
      createGame({ profession, window: 1, difficulty }, createRng(1)).credits;
    expect([credits('greenhorn', 'executive'), credits('greenhorn', 'engineer'), credits('greenhorn', 'farmer')]).toEqual([1840, 920, 460]);
    expect([credits('pathfinder', 'executive'), credits('pathfinder', 'engineer'), credits('pathfinder', 'farmer')]).toEqual([1440, 720, 360]);
    expect(createGame({ profession: 'farmer', window: 2, difficulty: 'pathfinder' }, createRng(1)).difficulty).toBe('pathfinder');
  });

  it('rejects an unknown level and draws the same numbers regardless of level', () => {
    expect(() => createGame({ profession: 'executive', window: 1, difficulty: 'nightmare' as DifficultyId }, createRng(1))).toThrow(/difficulty/);
    const a = createRng(9);
    const b = createRng(9);
    createGame({ profession: 'executive', window: 1 }, a);
    createGame({ profession: 'executive', window: 1, difficulty: 'greenhorn' }, b);
    expect(a.next()).toBe(b.next());
  });
});

describe('prices', () => {
  it('buy prices scale at every store; spacer and the default are identical', () => {
    for (const [i, wp] of WAYPOINTS.entries()) {
      if (!wp.markup) continue;
      for (const item of Object.keys(wp.markup) as SupplyKey[]) {
        const base = localPrice(item, i)!;
        expect(localPrice(item, i, 'spacer')).toBe(base);
        const raw = ITEMS[item].basePrice * wp.markup[item]!;
        expect(base).toBe(cents(raw));
        expect(localPrice(item, i, 'greenhorn')).toBe(cents(raw * 0.9));
        expect(localPrice(item, i, 'pathfinder')).toBe(cents(raw * 1.15));
      }
    }
    expect(priceAt('drives', 0, 'greenhorn')).toBe(36);
    expect(costOf('drives', 2, 0, 'pathfinder')).toBe(92);
  });

  it('store purchases charge the state difficulty price', () => {
    const store = (difficulty: DifficultyId, credits = 100): GameState =>
      ({ ...createGame({ profession: 'executive', window: 1, difficulty }, createRng(1)), credits });
    expect(buy(store('greenhorn'), 'drives', 1).state.credits).toBe(64);
    expect(buy(store('spacer'), 'drives', 1).state.credits).toBe(60);
    expect(buy(store('pathfinder'), 'drives', 1).state.credits).toBe(54);
    expect(maxBuyable(store('pathfinder', 92), 'drives')).toBe(2);
    expect(maxBuyable(store('pathfinder', 91), 'drives')).toBe(1);
    expect(maxBuyable(store('greenhorn', 72), 'drives')).toBe(2);
    expect(buyBlocker(store('pathfinder', 45), 'drives', 1)).toMatch(/afford/);
    expect(buyBlocker(store('greenhorn', 36), 'drives', 1)).toBeNull();
  });

  it('leaves sell-back prices, tug fees and crossing odds alone', () => {
    const station = WAYPOINTS.findIndex((w, i) => i > 0 && w.markup !== undefined);
    const sells = LEVELS.map((d) => {
      const s = at(d, { arrivedAt: station, segment: station + 1 });
      return [sellPrice('rations', station), localPrice('rations', station, s.difficulty)];
    });
    expect(new Set(sells.map((x) => x[0])).size).toBe(1);
    expect(new Set(sells.map((x) => x[1])).size).toBe(3);
    const hz = WAYPOINTS.findIndex((w) => w.hazard !== undefined);
    const crossing = { waypoint: hz, density: 3, pilotDaysLeft: null };
    const prices = LEVELS.map((d) => tugPrice(at(d), WAYPOINTS[hz]!));
    const odds = LEVELS.map((d) => crossChance(at(d, { crossing, arrivedAt: hz, segment: hz + 1 }), 'thread'));
    expect(new Set(prices).size).toBe(1);
    expect(new Set(odds).size).toBe(1);
  });
});

describe('events', () => {
  const weights = (d: DifficultyId): Record<EventId, number> => {
    const s = at(d, { segment: 6, day: 30 });
    const ctx = newDayContext();
    return Object.fromEntries(Object.values(EVENTS).map((e) => [e.id, eventWeight(e, s, ctx)])) as Record<EventId, number>;
  };

  it('scales loss weights only (illness and gains unchanged)', () => {
    const [g, s, p] = LEVELS.map(weights) as [Record<EventId, number>, Record<EventId, number>, Record<EventId, number>];
    for (const e of Object.values(EVENTS)) {
      const [fg, fp] = e.category === 'loss' ? [0.75, 1.25] : [1, 1];
      expect(g[e.id]).toBeCloseTo(s[e.id] * fg, 10);
      expect(p[e.id]).toBeCloseTo(s[e.id] * fp, 10);
    }
    expect(s.pirates).toBe(6);
    expect(g.pirates).toBe(4.5);
    expect(g.algae_bloom).toBe(s.algae_bloom);
    expect(g.illness).toBe(s.illness);
  });

  it('scales the daily event chance with one draw either way', () => {
    // 0.13 is under spacer 0.15, over greenhorn 0.1125; 0.18 is under pathfinder 0.1875, over spacer.
    const happened = (d: DifficultyId, roll: number): boolean => {
      const rng = scriptedRng([roll, 0.99, 0.5, 0.5, 0.5, 0.5]);
      return eventStep(at(d), rng, newDayContext(), []) !== null;
    };
    expect(happened('spacer', 0.13)).toBe(true);
    expect(happened('greenhorn', 0.13)).toBe(false);
    expect(happened('pathfinder', 0.18)).toBe(true);
    expect(happened('spacer', 0.18)).toBe(false);
    expect(EVENT_CHANCE * 0.75).toBeLessThan(0.13);
  });
});

describe('illness death chance', () => {
  it('scales condition death chances', () => {
    const chance = (d: DifficultyId): number => {
      const s = at(d);
      const c = s.crew[0]!;
      c.health = 60;
      const cond = { id: 'hull-mold-fever' as const, remaining: 5, daysActive: 1 };
      c.conditions = [cond];
      return deathChanceToday(s, c, cond);
    };
    expect(chance('spacer')).toBeCloseTo(0.03, 10);
    expect(chance('greenhorn')).toBeCloseTo(0.015, 10);
    expect(chance('pathfinder')).toBeCloseTo(0.045, 10);
  });
});

describe('score', () => {
  const arrived = (d: DifficultyId): GameState => at(d, { status: 'arrived', date: '2184-10-01', deaths: 1 });

  it('adds a final Difficulty line after the multiplier (0 on spacer)', () => {
    const s = computeScore(arrived('spacer'));
    const g = computeScore(arrived('greenhorn'));
    const p = computeScore(arrived('pathfinder'));
    expect(s.difficulty).toEqual({ key: 'difficulty', points: 0 });
    expect(s.total).toBe(s.subtotal * s.multiplier);
    expect(g.subtotal).toBe(s.subtotal);
    expect(g.total).toBe(Math.floor(s.total * 0.75));
    expect(g.difficulty.points).toBe(g.total - s.total);
    expect(g.difficulty.points).toBeLessThan(0);
    expect(p.total).toBe(Math.floor(s.total * 1.25));
    expect(p.difficulty.points).toBeGreaterThan(0);
    expect([g.difficultyMultiplier, s.difficultyMultiplier, p.difficultyMultiplier]).toEqual([0.75, 1, 1.25]);
    expect(g.lines.some((l) => l.key === 'difficulty')).toBe(false);
  });

  it('no survivors: zero everywhere', () => {
    const s = arrived('pathfinder');
    for (const c of s.crew) c.alive = false;
    expect(computeScore(s)).toMatchObject({ total: 0, difficulty: { points: 0 }, difficultyMultiplier: 1.25 });
  });
});

describe('saves and policy', () => {
  it('migrates a v3 save to v4 spacer and round-trips other levels', () => {
    const v3 = JSON.parse(toJSON(at('pathfinder'))) as { version: number; state: Record<string, unknown> };
    v3.version = 3;
    v3.state['version'] = 3;
    delete v3.state['difficulty'];
    expect(fromJSON(JSON.stringify(v3))).toMatchObject({ version: 4, difficulty: 'spacer' });
    expect(fromJSON(toJSON(at('greenhorn'))).difficulty).toBe('greenhorn');
  });

  it('runPolicy with difficulty spacer reproduces the 50-seed snapshot', () => {
    const now = fixture.map((f) => {
      const r = runPolicy(f.seed, { difficulty: 'spacer' });
      const trace = r.final.log.map((e) => `${e.day}|${e.kind}|${e.id ?? ''}`).join(';');
      return {
        seed: r.seed, profession: r.profession, window: r.window, status: r.status, days: r.days, deaths: r.deaths,
        causes: r.causes, score: r.score, logLength: r.final.log.length, trace: seedFromString(trace),
      };
    });
    expect(now).toEqual(fixture);
  });

  it('other levels change runs and the harness passes difficulty through', () => {
    const changed = fixture.slice(0, 10).filter((f) => runPolicy(f.seed, { difficulty: 'pathfinder' }).final.log.length !== f.logLength);
    expect(changed.length).toBeGreaterThan(0);
    expect(runPolicy(1, { difficulty: 'greenhorn' }).final.difficulty).toBe('greenhorn');
    const g = runCell('executive', 3, 'balanced', 4, 'greenhorn');
    const s = runCell('executive', 3, 'balanced', 4);
    expect(g.runs).toBe(4);
    expect(g).not.toEqual(s);
  });
});
