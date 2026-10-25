/** docs/design/resources.md: Mattie's Outfitters (prices, limits, caps, warnings) and the Independence store rules. */
import { describe, expect, it } from 'vitest';
import { buy, createGame, createRng, depart, maxBuyable, priceAt, sellPrice, storeWarnings, type GameState, type ProfessionId, type SupplyKey } from '@/sim';

const fresh = (profession: ProfessionId = 'executive'): GameState => createGame({ profession, window: 3 }, createRng(1));
const rich = (): GameState => ({ ...fresh(), credits: 100000 });
const buyAll = (s: GameState, list: [SupplyKey, number][]): GameState =>
  list.reduce((st, [item, packs]) => {
    const r = buy(st, item, packs);
    expect(r.error, `${item} x${packs}`).toBeUndefined();
    return r.state;
  }, s);
const kit: [SupplyKey, number][] = [['drives', 3], ['suits', 10], ['plates', 1], ['pumps', 1], ['gyros', 1], ['charges', 5]];

describe('Prices at Independence Station (resources.md table)', () => {
  it.each([['drives', 40], ['rations', 0.3], ['suits', 10], ['charges', 2], ['plates', 10], ['pumps', 10], ['gyros', 10]] as const)(
    '%s cost %f cr per pack', (item, price) => {
      expect(priceAt(item, 0)).toBeCloseTo(price, 9);
    });

  it('Independence does not buy back', () => {
    expect(sellPrice('drives', 0)).toBeNull();
  });

  it('stations buy back at 50% of their local price', () => {
    expect(sellPrice('drives', 3)).toBeCloseTo(priceAt('drives', 3) * 0.5, 9);
  });
});

describe('Buying: units, limits, caps (resources.md table)', () => {
  it('a purchase deducts exactly its cost and adds its units', () => {
    const r = buy(fresh(), 'drives', 3);
    expect(r.state.credits).toBe(1600 - 120);
    expect(r.state.supplies.drives).toBe(3);
  });

  it('Drone charges are sold as boxes of 20 (2 cr per box), stored as individual charges', () => {
    const r = buy(fresh(), 'charges', 5);
    expect(r.state.supplies.charges).toBe(100);
    expect(r.state.credits).toBeCloseTo(1590, 9);
  });

  it('Rations are sold one ration-day at 0.30 cr each (1,000 cost 300)', () => {
    const r = buy(fresh(), 'rations', 1000);
    expect(r.state.supplies.rations).toBe(1000);
    expect(r.state.credits).toBeCloseTo(1300, 9);
  });

  it('buy does not mutate the input state', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    buy(s, 'drives', 2);
    expect(JSON.stringify(s)).toBe(before);
  });

  it.each([['drives', 9, 10], ['rations', 3000, 3001], ['suits', 99, 100], ['charges', 99, 100], ['plates', 3, 4], ['pumps', 3, 4], ['gyros', 3, 4]] as const)(
    '%s: buy limit %i is allowed, %i is refused', (item, ok, over) => {
      expect(buy(rich(), item, ok).error).toBeUndefined();
      const r = buy(rich(), item, over);
      expect(r.error).toBeTruthy();
      expect(r.state.supplies[item]).toBe(0);
    });

  it('the limit counts what is already held (3 drives + 7 more is refused, +6 is fine)', () => {
    const s = buy(rich(), 'drives', 3).state;
    expect(buy(s, 'drives', 7).error).toBeTruthy();
    expect(buy(s, 'drives', 6).error).toBeUndefined();
  });

  it('spare parts are capped at 3 in inventory (including a held spare)', () => {
    const s = buy(rich(), 'pumps', 2).state;
    expect(buy(s, 'pumps', 2).error).toBeTruthy();
    expect(buy(s, 'pumps', 1).error).toBeUndefined();
  });

  it.each([0, -1, 1.5])('quantity %f is refused', (q) => {
    expect(buy(fresh(), 'drives', q).error).toBeTruthy();
  });

  it('refusal returns the same state object and charges nothing', () => {
    const s = { ...fresh(), credits: 5 };
    const r = buy(s, 'drives', 1);
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(s);
  });

  it('cannot spend credits you do not have (Farmer, 400 cr)', () => {
    const s = buyAll(fresh('farmer'), [['rations', 1000]]);
    expect(buy(s, 'drives', 9).error).toBeTruthy();
    expect(buy(s, 'drives', 2).error).toBeUndefined();
  });

  it('spending all credits is allowed (exact 0, no float drift)', () => {
    const s = buyAll(fresh('farmer'), [['drives', 3], ['suits', 5], ['plates', 1], ['pumps', 1], ['gyros', 1], ['charges', 10], ['rations', 600]]);
    expect(s.credits).toBeCloseTo(0, 9);
    expect(buy(s, 'rations', 1).error).toBeTruthy();
  });

  it('maxBuyable is the smallest of limit room, cap room and affordable packs', () => {
    const s = fresh('farmer');
    expect(maxBuyable(s, 'drives')).toBe(9);
    expect(maxBuyable(s, 'rations')).toBe(1333); // 400 / 0.30
    expect(maxBuyable(s, 'plates')).toBe(3);
    expect(maxBuyable({ ...s, credits: 0 }, 'suits')).toBe(0);
    expect(maxBuyable(rich(), 'rations')).toBe(3000);
  });

  it('the store is closed after leaving Independence', () => {
    const s = depart(buy(fresh(), 'drives', 1).state, createRng(1)).state;
    expect(buy(s, 'suits', 1).error).toBeTruthy();
  });
});

describe('Affordability by profession (resources.md, travel.md worked example)', () => {
  it('Executive kit: 4 drives, 10 suits, 2 of each part, 5 boxes, 3,000 rations leaves 370 cr', () => {
    const s = buyAll(fresh('executive'), [['drives', 4], ['suits', 10], ['plates', 2], ['pumps', 2], ['gyros', 2], ['charges', 5], ['rations', 3000]]);
    expect(s.credits).toBeCloseTo(370, 9);
  });

  it('Engineer kit: 3 drives, 10 suits, 1 of each, 5 boxes, 1,800 rations spends exactly 800', () => {
    const s = buyAll(fresh('engineer'), [...kit, ['rations', 1800]]);
    expect(s.credits).toBeCloseTo(0, 9);
  });

  it('Farmer kit: 3 drives, 5 suits, 1 of each, 10 boxes, 600 rations spends exactly 400', () => {
    const s = buyAll(fresh('farmer'), [['drives', 3], ['suits', 5], ['plates', 1], ['pumps', 1], ['gyros', 1], ['charges', 10], ['rations', 600]]);
    expect(s.credits).toBeCloseTo(0, 9);
  });

  it('only the Executive can afford Full rations for the whole trip (2,250 ration-days = 675 cr) after a basic kit', () => {
    expect(maxBuyable(buyAll(fresh('executive'), kit), 'rations')).toBeGreaterThanOrEqual(2250);
    expect(maxBuyable(buyAll(fresh('engineer'), kit), 'rations')).toBeLessThan(2250);
  });
});

describe('Departing (resources.md "The player cannot leave with 0 drives")', () => {
  it('0 drives: refused, state unchanged', () => {
    const r = depart(fresh(), createRng(1));
    expect(r.error).toBeTruthy();
    expect(r.state.status).toBe('store');
  });

  it('1 drive is enough to depart: status becomes traveling', () => {
    const r = depart(buy(fresh(), 'drives', 1).state, createRng(1));
    expect(r.error).toBeUndefined();
    expect(r.state.status).toBe('traveling');
  });

  it('cannot depart twice', () => {
    const s = depart(buy(fresh(), 'drives', 1).state, createRng(1)).state;
    expect(depart(s, createRng(1)).error).toBeTruthy();
  });

  it('departing does not take a day', () => {
    expect(depart(buy(fresh(), 'drives', 1).state, createRng(1)).state.day).toBe(0);
  });
});

describe("Mattie's warnings (resources.md \"Warnings\")", () => {
  it('an empty basket warns about drives, rations and suits (3 warnings)', () => {
    expect(storeWarnings(fresh())).toHaveLength(3);
  });

  it('0 drives warns', () => {
    expect(storeWarnings(buyAll(fresh(), [['rations', 1000], ['suits', 5]]))).toHaveLength(1);
  });

  it('rations below 1,000 warn; exactly 1,000 does not', () => {
    const base = buyAll(fresh(), [['drives', 3], ['suits', 5]]);
    expect(storeWarnings(buyAll(base, [['rations', 999]]))).toHaveLength(1);
    expect(storeWarnings(buyAll(base, [['rations', 1000]]))).toHaveLength(0);
  });

  it('suits below the crew count warn; 5 suits for 5 crew does not', () => {
    const base = buyAll(fresh(), [['drives', 3], ['rations', 1000]]);
    expect(storeWarnings(buyAll(base, [['suits', 4]]))).toHaveLength(1);
    expect(storeWarnings(buyAll(base, [['suits', 5]]))).toHaveLength(0);
  });

  it('spending credits down to 0 warns', () => {
    const s = buyAll(fresh('farmer'), [['drives', 3], ['suits', 5], ['plates', 1], ['pumps', 1], ['gyros', 1], ['charges', 10], ['rations', 600]]);
    expect(storeWarnings(s)).toHaveLength(2); // 600 rations is also below 1,000
    expect(storeWarnings({ ...s, credits: 0.3 })).toHaveLength(1);
  });
});
