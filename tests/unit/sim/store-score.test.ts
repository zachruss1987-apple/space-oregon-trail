import { describe, expect, it } from 'vitest';
import { createGame } from '@/sim/game';
import { createRng } from '@/sim/rng';
import { computeScore, crewPoints, ratingFor } from '@/sim/score';
import { buy, buyBlocker, costOf, depart, maxBuyable, priceAt, sellPrice, storeWarnings } from '@/sim/store';
import { travelingState } from './helpers';

const fresh = (p: 'executive' | 'engineer' | 'farmer' = 'executive') => createGame({ profession: p, window: 1 }, createRng(1));

describe('store (resources.md)', () => {
  it('price = base × markup; only stations have a store', () => {
    expect(priceAt('drives')).toBe(40);
    expect(priceAt('rations')).toBe(0.3);
    expect(priceAt('drives', 3)).toBe(50);
    expect(() => priceAt('drives', 1)).toThrow();
    expect(costOf('rations', 7)).toBe(2.1);
    expect(costOf('charges', 5)).toBe(10);
  });

  it('buys, deducting credits and adding units (charges in boxes of 20)', () => {
    let s = fresh();
    s = buy(s, 'drives', 3).state;
    s = buy(s, 'charges', 5).state;
    s = buy(s, 'rations', 1001).state;
    expect(s.supplies).toMatchObject({ drives: 3, charges: 100, rations: 1001 });
    expect(s.credits).toBe(1600 - 120 - 10 - 300.3);
  });

  it('enforces limits, caps and credits', () => {
    const s = fresh('farmer');
    expect(buyBlocker(s, 'drives', 0)).toMatch(/whole/);
    expect(buyBlocker(s, 'drives', 1.5)).toMatch(/whole/);
    expect(buyBlocker(s, 'nope' as never, 1)).toMatch(/Unknown/);
    expect(buyBlocker(s, 'plates', 4)).toMatch(/at most 3/);
    expect(buyBlocker(s, 'drives', 10)).toMatch(/at most 9/);
    expect(buyBlocker(s, 'suits', 41)).toMatch(/afford/);
    expect(buyBlocker(s, 'rations', 3001)).toMatch(/at most/);
    const r = buy(s, 'drives', 11);
    expect(r.error).toBeDefined();
    expect(r.state).toBe(s);
    const capped = { ...s, supplies: { ...s.supplies, plates: 3 } };
    expect(maxBuyable(capped, 'plates')).toBe(0);
    expect(maxBuyable(s, 'drives')).toBe(9);
    expect(maxBuyable(s, 'rations')).toBe(1333);
    expect(buyBlocker(travelingState(), 'drives', 1)).toMatch(/closed/);
  });

  it('capped items reject buys past the cap even under the limit', () => {
    const s = fresh();
    s.supplies.plates = 3;
    expect(buyBlocker(s, 'plates', 1)).toMatch(/at most 3/);
  });

  it('sell price: none at Independence, 50% elsewhere', () => {
    expect(sellPrice('drives', 0)).toBeNull();
    expect(sellPrice('drives', 3)).toBe(25);
    expect(sellPrice('charges', 3)).toBe(0.06);
  });

  it("Mattie's warnings", () => {
    const s = fresh();
    expect(storeWarnings(s)).toEqual(['noDrives', 'lowRations', 'lowSuits']);
    s.credits = 0;
    expect(storeWarnings(s)).toContain('noCredits');
  });

  it('depart needs ≥ 1 drive and only works from the store', () => {
    const s = fresh();
    expect(depart(s, createRng(1)).error).toMatch(/far/);
    const ok = depart(buy(s, 'drives', 1).state, createRng(1));
    expect(ok.state.status).toBe('traveling');
    expect(ok.entries[0]!.kind).toBe('depart');
    expect(depart(ok.state, createRng(1)).error).toBeDefined();
  });
});

describe('score (scoring.md)', () => {
  it('reproduces the worked example: Engineer = 3,970 Spacer', () => {
    const s = travelingState({
      date: '2184-09-02', credits: 0, deaths: 1, status: 'arrived',
      supplies: { drives: 3, plates: 1, pumps: 1, gyros: 0, suits: 7, charges: 80, rations: 120 },
    }, 'engineer');
    [90, 80, 60, 30].forEach((h, i) => (s.crew[i]!.health = h));
    s.crew[4]!.alive = false;
    const r = computeScore(s);
    expect(r.subtotal).toBe(1985);
    expect(r.total).toBe(3970);
    expect(r.rating).toBe('Spacer');
  });

  it('bonuses: no deaths +300, flare season forfeits +200; nobody alive scores 0', () => {
    const s = travelingState({ date: '2184-09-15', deaths: 0, credits: 9, supplies: { plates: 5 } });
    const r = computeScore(s);
    expect(r.lines.find((l) => l.key === 'noDeathsBonus')!.points).toBe(300);
    expect(r.lines.find((l) => l.key === 'flareBonus')!.points).toBe(0);
    expect(r.lines.find((l) => l.key === 'spares')!.points).toBe((3 + 1 + 1) * 2);
    expect(r.lines.find((l) => l.key === 'credits')!.points).toBe(1);
    s.crew.forEach((c) => (c.alive = false));
    expect(computeScore(s).total).toBe(0);
  });

  it('crew points and ratings', () => {
    expect([75, 74, 50, 49, 25, 24].map(crewPoints)).toEqual([500, 400, 400, 300, 300, 200]);
    expect([6000, 5999, 3000, 2999].map(ratingFor)).toEqual(['Pathfinder', 'Spacer', 'Spacer', 'Groundling']);
  });
});
