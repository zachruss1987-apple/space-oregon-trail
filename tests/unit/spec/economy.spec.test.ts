/** economy.md: per-item markups, road buying, buy-back, the Farmer worked example. Numbers typed from the doc tables. */
import { describe, expect, it } from 'vitest';
import {
  applyAction, createRng, localPrice, maxBuyable, priceAt, sellPrice, type GameState, type SupplyKey,
} from '@/sim';
import { ship } from './spec-helpers';

const ITEMS_ORDER: SupplyKey[] = ['drives', 'rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'];
const BASE: Record<SupplyKey, number> = { drives: 40, rations: 0.3, suits: 10, charges: 2, plates: 10, pumps: 10, gyros: 10 };
/** Markup table (economy.md); null = not sold. Order = ITEMS_ORDER. */
const MARKUP: Record<number, (number | null)[]> = {
  0: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  3: [1.25, 1.0, 1.25, 1.25, 1.25, 1.25, 1.25],
  5: [1.5, 1.5, 1.5, 1.0, 1.25, 1.5, 1.5],
  8: [2.0, 1.5, 1.25, 1.75, 1.75, 1.75, 1.75],
  10: [1.75, 2.5, 2.0, 2.0, 2.0, 1.25, 2.0],
  12: [null, 2.5, 2.25, 2.25, 2.5, 2.5, 1.5],
  14: [2.5, 2.0, 2.5, 2.5, 2.5, 2.5, 2.5],
};
/** Resulting price table (cr per pack). */
const PRICE: Record<number, (number | null)[]> = {
  0: [40, 0.3, 10, 2, 10, 10, 10],
  3: [50, 0.3, 12.5, 2.5, 12.5, 12.5, 12.5],
  5: [60, 0.45, 15, 2, 12.5, 15, 15],
  8: [80, 0.45, 12.5, 3.5, 17.5, 17.5, 17.5],
  10: [70, 0.75, 20, 4, 20, 12.5, 20],
  12: [null, 0.75, 22.5, 4.5, 25, 25, 15],
  14: [100, 0.6, 25, 5, 25, 25, 25],
};
const ROAD = [3, 5, 8, 10, 12, 14];

const atStation = (wp: number, over: Parameters<typeof ship>[0] = {}): GameState =>
  ship({ arrivedAt: wp, segment: wp, station: { waypoint: wp, offers: [] }, credits: 5000, ...over });
const step = (s: GameState, i: Parameters<typeof applyAction>[1]) => applyAction(s, i, createRng(1));

describe('markups and prices (economy.md tables)', () => {
  for (const wp of [0, ...ROAD]) {
    ITEMS_ORDER.forEach((item, k) => {
      const m = MARKUP[wp]![k];
      const price = PRICE[wp]![k] ?? null;
      it(`wp ${wp} ${item}: ${price === null ? 'not sold' : `${price} cr (x${m})`}`, () => {
        if (price === null) {
          expect(localPrice(item, wp)).toBeNull();
          expect(() => priceAt(item, wp)).toThrow();
        } else {
          expect(localPrice(item, wp)).toBeCloseTo(price, 9);
          expect(localPrice(item, wp)).toBeCloseTo(Math.floor(BASE[item] * m! * 100 + 0.5) / 100, 9);
          expect(m).toBeGreaterThanOrEqual(1.0);
          expect(m).toBeLessThanOrEqual(2.5);
        }
      });
    });
  }

  it('non-station waypoints have no store', () => {
    for (const wp of [1, 2, 4, 6, 7, 9, 11, 13, 15, 16]) for (const item of ITEMS_ORDER) expect(localPrice(item, wp)).toBeNull();
  });
});

describe('buy-back price = min(50% local, 90% Independence), floored to the cent', () => {
  for (const wp of ROAD) {
    ITEMS_ORDER.forEach((item, k) => {
      const local = PRICE[wp]![k] ?? null;
      it(`wp ${wp} ${item}`, () => {
        if (local === null) return expect(sellPrice(item, wp)).toBeNull();
        const cents = Math.floor(Math.min(local * 100 * 0.5, BASE[item] * 100 * 0.9) + 1e-6);
        expect(sellPrice(item, wp)).toBeCloseTo(cents / 100, 9);
      });
    });
  }

  it('Independence never buys back', () => {
    for (const item of ITEMS_ORDER) expect(sellPrice(item, 0)).toBeNull();
    const r = step(ship({ status: 'store' }), { type: 'sell', item: 'suits', packs: 1 });
    expect(r.error).toBeTruthy();
  });

  it('the 90% cap binds from Titan outward', () => {
    for (const item of ITEMS_ORDER) {
      for (const wp of ROAD) {
        const s = sellPrice(item, wp);
        if (s !== null) expect(s).toBeLessThanOrEqual(BASE[item] * 0.9 + 1e-9);
      }
    }
    expect(sellPrice('drives', 14)).toBe(36);
    expect(sellPrice('rations', 10)).toBeCloseTo(0.27, 9);
  });

  it('buy then sell never gains, at any station pair', () => {
    for (const a of [0, ...ROAD]) for (const b of ROAD) for (const item of ITEMS_ORDER) {
      const buy = localPrice(item, a);
      const sell = sellPrice(item, b);
      if (buy !== null && sell !== null) expect(sell).toBeLessThanOrEqual(buy * 0.9 + 1e-9);
    }
  });
});

describe('buying on the road', () => {
  it('works at every road station for every sold item, charging the table price and 0 days', () => {
    for (const wp of ROAD) ITEMS_ORDER.forEach((item, k) => {
      const price = PRICE[wp]![k] ?? null;
      const s = atStation(wp, { supplies: { drives: 1, rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 } });
      const r = step(s, { type: 'buy', item, packs: 1 });
      if (price === null) {
        expect(r.error).toBe("They don't sell that here.");
        expect(r.state).toBe(s);
      } else {
        expect(r.error).toBeUndefined();
        expect(r.state.credits).toBeCloseTo(5000 - price, 9);
        expect(r.state.day).toBe(s.day);
      }
    });
  });

  it('charges come in boxes of 20 charges', () => {
    const s = atStation(3, { supplies: { charges: 0 } });
    expect(step(s, { type: 'buy', item: 'charges', packs: 2 }).state.supplies.charges).toBe(40);
  });

  it('caps: 9 drives, 3 of each spare (units), refused with the message and no change', () => {
    const full = atStation(3, { supplies: { drives: 9, plates: 3, pumps: 3, gyros: 3 } });
    for (const item of ['drives', 'plates', 'pumps', 'gyros'] as const) {
      const r = step(full, { type: 'buy', item, packs: 1 });
      expect(r.error).toBe(`You can carry at most ${item === 'drives' ? 9 : 3}.`);
      expect(r.state).toBe(full);
      expect(maxBuyable(full, item)).toBe(0);
    }
    const eight = atStation(3, { supplies: { drives: 8 } });
    expect(step(eight, { type: 'buy', item: 'drives', packs: 2 }).error).toBe('You can carry at most 9.');
    expect(step(eight, { type: 'buy', item: 'drives', packs: 1 }).error).toBeUndefined();
  });

  it('buy limits count what is held: rations 3000, suits 99, charges 99 boxes', () => {
    expect(step(atStation(3, { supplies: { rations: 2999 } }), { type: 'buy', item: 'rations', packs: 2 }).error).toBe('You can carry at most 3000.');
    expect(step(atStation(3, { supplies: { rations: 2999 } }), { type: 'buy', item: 'rations', packs: 1 }).error).toBeUndefined();
    expect(step(atStation(3, { supplies: { suits: 98 } }), { type: 'buy', item: 'suits', packs: 2 }).error).toBe('You can carry at most 99.');
    expect(step(atStation(3, { supplies: { charges: 98 * 20 } }), { type: 'buy', item: 'charges', packs: 2 }).error).toBe('You can carry at most 99.');
  });

  it('refuses what you cannot afford, never partially', () => {
    const s = atStation(3, { credits: 49.99 });
    const r = step(s, { type: 'buy', item: 'drives', packs: 1 });
    expect(r.error).toBe('You cannot afford that.');
    expect(r.state.credits).toBe(49.99);
    expect(r.state.supplies.drives).toBe(s.supplies.drives);
  });

  it('refuses while not parked at a station', () => {
    expect(step(ship(), { type: 'buy', item: 'suits', packs: 1 }).error).toBeTruthy();
  });

  it('credits stay >= 0 across random buy/sell sequences at every station', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = createRng(seed);
      const wp = ROAD[rng.int(0, ROAD.length - 1)]!;
      let s = atStation(wp, { credits: rng.int(0, 200) });
      for (let n = 0; n < 25; n++) {
        const item = ITEMS_ORDER[rng.int(0, ITEMS_ORDER.length - 1)]!;
        const intent = rng.int(0, 1) ? ({ type: 'buy', item, packs: rng.int(1, 5) } as const) : ({ type: 'sell', item, packs: rng.int(1, 5) } as const);
        const before = s;
        const r = step(s, intent);
        if (r.error) expect(r.state).toBe(before);
        s = r.state;
        expect(s.credits).toBeGreaterThanOrEqual(0);
        expect(s.supplies.drives).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('selling', () => {
  it('stations only buy what they sell (Oort Beacon refuses drives)', () => {
    const s = atStation(12, { supplies: { drives: 4 } });
    expect(step(s, { type: 'sell', item: 'drives', packs: 1 }).error).toBe("They don't buy that here.");
    expect(step(s, { type: 'sell', item: 'suits', packs: 1 }).error).toBeUndefined();
  });

  it('pays the table sell price per pack and logs kind store with id = item', () => {
    for (const wp of ROAD) for (const item of ITEMS_ORDER) {
      const price = sellPrice(item, wp);
      if (price === null) continue;
      const s = atStation(wp, { credits: 0, supplies: { drives: 5, rations: 100, suits: 5, charges: 100, plates: 2, pumps: 2, gyros: 2 } });
      const r = step(s, { type: 'sell', item, packs: 1 });
      expect(r.error).toBeUndefined();
      expect(r.state.credits).toBeCloseTo(price, 9);
      const e = r.entries.find((x) => x.kind === 'store');
      expect(e?.id).toBe(item);
      expect(e?.text).toMatch(/^Sold /);
    }
  });

  it('cannot sell the last drive or more than held', () => {
    const one = atStation(8, { supplies: { drives: 1 } });
    expect(step(one, { type: 'sell', item: 'drives', packs: 1 }).error).toBe('You need a drive to leave.');
    const two = atStation(8, { supplies: { drives: 2 } });
    expect(step(two, { type: 'sell', item: 'drives', packs: 2 }).error).toBe('You need a drive to leave.');
    expect(step(two, { type: 'sell', item: 'drives', packs: 1 }).state.supplies.drives).toBe(1);
    expect(step(atStation(8, { supplies: { suits: 3 } }), { type: 'sell', item: 'suits', packs: 4 }).error).toBe("You don't have that many.");
  });
});

describe('leaving a station needs a drive', () => {
  it('refuses continue with 0 drives, allows it with 1; buying a drive fixes it', () => {
    const none = atStation(3, { supplies: { drives: 0 } });
    const r = step(none, { type: 'continue' });
    expect(r.error).toMatch(/drive/i);
    expect(r.state).toBe(none);
    const bought = step(none, { type: 'buy', item: 'drives', packs: 1 }).state;
    expect(step(bought, { type: 'continue' }).error).toBeUndefined();
  });
});

describe('Farmer worked example (economy.md)', () => {
  it('0 cr at Mars Relay, 10 boxes of charges + 1 gyro: nothing to buy, sells for 8.75, buys 29 rations for 8.70', () => {
    let s = atStation(3, { credits: 0, supplies: { charges: 200, gyros: 1 } });
    for (const item of ITEMS_ORDER) expect(step(s, { type: 'buy', item, packs: 1 }).error).toBe('You cannot afford that.');
    s = step(s, { type: 'sell', item: 'charges', packs: 2 }).state;
    expect(s.credits).toBeCloseTo(2.5, 9);
    s = step(s, { type: 'sell', item: 'gyros', packs: 1 }).state;
    expect(s.credits).toBeCloseTo(8.75, 9);
    const rations0 = s.supplies.rations;
    expect(maxBuyable(s, 'rations')).toBe(29);
    const r = step(s, { type: 'buy', item: 'rations', packs: 29 });
    expect(r.error).toBeUndefined();
    expect(r.state.credits).toBeCloseTo(0.05, 9);
    expect(r.state.supplies.rations).toBe(rations0 + 29);
    expect(step(s, { type: 'buy', item: 'rations', packs: 30 }).error).toBe('You cannot afford that.');
  });

  it('loop checks: drive 40 -> Lane Terminus 36; rations 0.30 at Mars -> 0.27 at Titan', () => {
    expect(priceAt('drives', 0) - sellPrice('drives', 14)!).toBeCloseTo(4, 9);
    expect(priceAt('rations', 3) - sellPrice('rations', 10)!).toBeCloseTo(0.03, 9);
  });

  it('Executive at Titan with 370 cr buys 3 pumps for 37.50; Lane Terminus would cost 75', () => {
    const r = step(atStation(10, { credits: 370, supplies: { pumps: 0 } }), { type: 'buy', item: 'pumps', packs: 3 });
    expect(r.state.credits).toBeCloseTo(332.5, 9);
    const lane = step(atStation(14, { credits: 370, supplies: { pumps: 0 } }), { type: 'buy', item: 'pumps', packs: 3 });
    expect(lane.state.credits).toBeCloseTo(295, 9);
  });
});
