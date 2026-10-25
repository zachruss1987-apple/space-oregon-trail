/** economy.md: per-item markups, buying on the road, buy-back caps, NPC trade offers, station visits. */
import { describe, expect, it } from 'vitest';
import { ITEM_ORDER, ITEMS, TRADE_UNIT_CENTS, WAYPOINTS, type SupplyKey } from '@/content';
import { applyAction, intentBlocker } from '@/sim/actions';
import { formatCr, itemPhrase, maxSellable } from '@/sim/market';
import { createRng } from '@/sim/rng';
import { localPrice, maxBuyable, sellPrice, storeIndex } from '@/sim/store';
import { askQty, generateOffers, offerVars, personaIds, personaName, tradeLine } from '@/sim/trade';
import { tick } from '@/sim/tick';
import type { GameState, TradeOffer } from '@/sim/types';
import { travelingState } from './helpers';

/** economy.md "Resulting prices" (cr per pack; charges per box of 20). null = not sold. */
const PRICES: Record<number, (number | null)[]> = {
  0: [40, 0.3, 10, 2, 10, 10, 10],
  3: [50, 0.3, 12.5, 2.5, 12.5, 12.5, 12.5],
  5: [60, 0.45, 15, 2, 12.5, 15, 15],
  8: [80, 0.45, 12.5, 3.5, 17.5, 17.5, 17.5],
  10: [70, 0.75, 20, 4, 20, 12.5, 20],
  12: [null, 0.75, 22.5, 4.5, 25, 25, 15],
  14: [100, 0.6, 25, 5, 25, 25, 25],
};

function parked(idx: number, over: Parameters<typeof travelingState>[0] = {}): GameState {
  return travelingState({ segment: idx + 1, arrivedAt: idx, distanceTotal: WAYPOINTS[idx]!.cumulative, station: { waypoint: idx, offers: [] }, ...over });
}
const UNITS = (k: SupplyKey | 'credits'): number => TRADE_UNIT_CENTS[k];

describe('markups and prices', () => {
  it.each(Object.entries(PRICES))('station %s matches the economy.md price table', (idx, row) => {
    ITEM_ORDER.forEach((k, i) => expect(localPrice(k, Number(idx))).toBe(row[i]));
  });

  it('every markup is within 1.0-2.5; non-stations have no store', () => {
    for (const w of WAYPOINTS) for (const m of Object.values(w.markup ?? {})) expect(m >= 1 && m <= 2.5).toBe(true);
    expect(localPrice('rations', 4)).toBeNull();
  });
});

describe('buy-back (min 50% local, 90% base, floored)', () => {
  it('never exceeds 90% of the Independence price, and is null where not sold or at Independence', () => {
    for (const w of WAYPOINTS) {
      for (const k of ITEM_ORDER) {
        const p = sellPrice(k, w.index);
        if (p === null) continue;
        expect(p).toBeLessThanOrEqual(ITEMS[k].basePrice * 0.9 + 1e-9);
        expect(p).toBeLessThanOrEqual(localPrice(k, w.index)! * 0.5 + 1e-9);
        expect(p).toBeLessThan(ITEMS[k].basePrice); // no arbitrage: cheapest buy is base price
      }
    }
    expect(sellPrice('rations', 0)).toBeNull();
    expect(sellPrice('drives', 12)).toBeNull();
    expect(sellPrice('rations', 5)).toBe(0.22); // 0.225 floored
    expect(sellPrice('rations', 10)).toBe(0.27); // 90% cap binds at Titan
    expect(sellPrice('drives', 14)).toBe(36);
  });

  it('worked example: a broke Farmer at Mars sells 2 boxes and a gyro for 8.75 cr, then buys 29 rations', () => {
    let s = parked(3, { credits: 0, supplies: { charges: 200, gyros: 1, rations: 0 } });
    s = { ...s, profession: 'farmer' };
    s = applyAction(s, { type: 'sell', item: 'charges', packs: 2 }, createRng(1)).state;
    const r = applyAction(s, { type: 'sell', item: 'gyros', packs: 1 }, createRng(1));
    expect(r.state.credits).toBe(8.75);
    expect(r.entries[0]).toMatchObject({ kind: 'store', id: 'gyros', text: 'Sold 1 nav gyro for 6.25 cr.' });
    expect(maxBuyable(r.state, 'rations')).toBe(29);
    const b = applyAction(r.state, { type: 'buy', item: 'rations', packs: 29 }, createRng(1));
    expect(b.state.credits).toBeCloseTo(0.05, 9);
    expect(b.state.supplies.rations).toBe(29);
    expect(b.entries[0]!.text).toBe('Bought 29 rations for 8.70 cr.');
  });

  it('refusals: Mattie, not a store, not bought here, more than held, the last drive', () => {
    const indep = { ...travelingState(), status: 'store' as const };
    expect(intentBlocker(parked(3), { type: 'sell', item: 'drives', packs: 3 })).toBe('You need a drive to leave.');
    expect(applyAction(indep, { type: 'sell', item: 'drives', packs: 1 }, createRng(1)).error).toBe('The journey is over.');
    expect(intentBlocker(travelingState(), { type: 'sell', item: 'drives', packs: 1 })).toBe('The store is closed.');
    expect(intentBlocker(parked(12), { type: 'sell', item: 'drives', packs: 1 })).toBe("They don't buy that here.");
    expect(intentBlocker(parked(3), { type: 'sell', item: 'gyros', packs: 2 })).toBe("You don't have that many.");
    expect(intentBlocker(parked(3), { type: 'sell', item: 'gyros', packs: 0 })).toMatch(/whole number/);
    expect(maxSellable(parked(3), 'drives')).toBe(2);
    expect(maxSellable(parked(12), 'drives')).toBe(0);
    expect(maxSellable(travelingState(), 'suits')).toBe(0);
  });
});

describe('buying on the road', () => {
  it('allowed only while parked at a road station; limits, caps and credits apply; credits never go negative', () => {
    expect(storeIndex(parked(5))).toBe(5);
    expect(storeIndex(parked(4))).toBeNull();
    expect(intentBlocker(travelingState(), { type: 'buy', item: 'rations', packs: 1 })).toBe('The store is closed.');
    expect(intentBlocker(parked(12), { type: 'buy', item: 'drives', packs: 1 })).toBe("They don't sell that here.");
    expect(intentBlocker(parked(3, { supplies: { pumps: 3 } }), { type: 'buy', item: 'pumps', packs: 1 })).toBe('You can carry at most 3.');
    expect(intentBlocker(parked(3, { supplies: { drives: 8 } }), { type: 'buy', item: 'drives', packs: 2 })).toBe('You can carry at most 9.');
    expect(intentBlocker(parked(14, { credits: 99.99 }), { type: 'buy', item: 'drives', packs: 1 })).toBe('You cannot afford that.');
    const r = applyAction(parked(10, { credits: 37.5, supplies: { pumps: 0 } }), { type: 'buy', item: 'pumps', packs: 3 }, createRng(1));
    expect(r.state.credits).toBe(0);
    expect(r.state.supplies.pumps).toBe(3);
    expect(applyAction(parked(10, { credits: 37.49, supplies: { pumps: 0 } }), { type: 'buy', item: 'pumps', packs: 3 }, createRng(1)).error).toBe('You cannot afford that.');
  });

  it('the Executive at Titan buys 3 pumps for 37.50 (from 0 held)', () => {
    const r = applyAction(parked(10, { credits: 370, supplies: { pumps: 0 } }), { type: 'buy', item: 'pumps', packs: 3 }, createRng(1));
    expect(r.state.credits).toBe(332.5);
    expect(r.state.supplies.pumps).toBe(3);
  });
});

describe('station visits', () => {
  it('arriving at a road station creates the visit with offers; departing clears it', () => {
    const s = travelingState({ segment: 3, distanceInSegment: 118.95, distanceTotal: 303.95 });
    const r = tick(s, createRng(4));
    expect(r.state.station?.waypoint).toBe(3);
    expect(r.state.station!.offers.length).toBeLessThanOrEqual(3);
    const next = applyAction(r.state, { type: 'continue' }, createRng(4)).state;
    expect(next.station).toBeNull();
    expect(next.arrivedAt).toBeNull();
  });

  it('landmarks get no visit; rest keeps the offers', () => {
    const r = tick(travelingState({ segment: 4, distanceInSegment: 249.95, distanceTotal: 553.95 }), createRng(4));
    expect(r.state.station).toBeNull();
    const at = parked(5, { station: { waypoint: 5, offers: generateOffers(travelingState(), 5, createRng(1)) } });
    const rested = applyAction(at, { type: 'rest', days: 2 }, createRng(2)).state;
    expect(rested.station).toEqual(at.station);
  });

  it('continue needs >= 1 drive at a station (arriving with 0 drives is not a soft-lock: rest or buy)', () => {
    const s = parked(5, { supplies: { drives: 0 } });
    expect(intentBlocker(s, { type: 'continue' })).toBe('You need at least one ion drive to leave.');
    expect(intentBlocker(s, { type: 'rest', days: 1 })).toBeNull();
    expect(intentBlocker(s, { type: 'buy', item: 'drives', packs: 1 })).toBeNull();
    expect(intentBlocker(parked(4, { supplies: { drives: 0 } }), { type: 'continue' })).toBeNull();
  });

  it('rest at a station gives +6/day', () => {
    const s = parked(5, { crew: travelingState().crew.map((c) => ({ ...c, health: 50 })), rations: 'half' });
    const r = applyAction(s, { type: 'rest', days: 1 }, createRng(3));
    if (!r.entries.some((e) => ['event', 'condition', 'weather'].includes(e.kind))) expect(r.state.crew[0]!.health).toBe(56);
  });
});

describe('NPC offers', () => {
  const holdings = travelingState({ credits: 300, supplies: { drives: 4, rations: 1500, suits: 10, charges: 100, plates: 1, pumps: 1, gyros: 1 } });
  const many = (n: number, waypoint = 5, s = holdings): TradeOffer[][] => Array.from({ length: n }, (_, i) => generateOffers(s, waypoint, createRng(i + 1)));

  it('2-3 offers (50/50), distinct personas, fairness spread 15/35/35/15', () => {
    const visits = many(2000);
    const three = visits.filter((v) => v.length === 3).length / visits.length;
    expect(Math.abs(three - 0.5)).toBeLessThan(0.04);
    const fair: Record<string, number> = {};
    let total = 0;
    for (const v of visits) {
      expect(new Set(v.map((o) => o.persona)).size).toBe(v.length);
      for (const o of v) {
        expect(personaIds()).toContain(o.persona);
        fair[o.fairness] = (fair[o.fairness] ?? 0) + 1;
        total++;
      }
    }
    expect(Math.abs(fair['swindle']! / total - 0.15)).toBeLessThan(0.03);
    expect(Math.abs(fair['fair']! / total - 0.35)).toBeLessThan(0.03);
    expect(Math.abs(fair['generous']! / total - 0.15)).toBeLessThan(0.03);
  });

  it('asks follow V x r / unit (ceil; rations/charges to 5s; credits r >= 1) and fit current holdings', () => {
    const ratio = { swindle: 160, steep: 125, fair: 100, generous: 75 } as const;
    for (const v of many(500)) {
      for (const o of v) {
        expect(o.give.item).not.toBe(o.get.item);
        expect(o.get.item).not.toBe('credits');
        const value = UNITS(o.get.item) * o.get.qty;
        expect(o.give.qty).toBe(askQty(o.give.item, value, ratio[o.fairness]));
        const r = o.give.item === 'credits' ? Math.max(100, ratio[o.fairness]) : ratio[o.fairness];
        expect(UNITS(o.give.item) * o.give.qty * 100).toBeGreaterThanOrEqual(value * r);
        if (o.give.item === 'rations' || o.give.item === 'charges') expect(o.give.qty % 5).toBe(0);
        const held = o.give.item === 'credits' ? holdings.credits : o.give.item === 'drives' ? holdings.supplies.drives - 1 : holdings.supplies[o.give.item];
        expect(o.give.qty).toBeLessThanOrEqual(held);
      }
    }
    expect(askQty('gyros', 900, 100)).toBe(1);
    expect(askQty('rations', 1000, 100)).toBe(35);
    expect(askQty('credits', 900, 75)).toBe(9);
  });

  it('lots: rations 30-150 step 10, suits 1-3, charges 20/40/60; no drives at Oort Beacon; capped items skipped', () => {
    const gets = many(800).flat().map((o) => o.get);
    for (const g of gets) {
      if (g.item === 'rations') expect(g.qty >= 30 && g.qty <= 150 && g.qty % 10 === 0).toBe(true);
      if (g.item === 'charges') expect([20, 40, 60]).toContain(g.qty);
      if (g.item === 'suits') expect(g.qty >= 1 && g.qty <= 3).toBe(true);
    }
    expect(many(400, 12).flat().some((o) => o.get.item === 'drives')).toBe(false);
    const capped = travelingState({ supplies: { plates: 3, pumps: 3, gyros: 3, drives: 9 } });
    expect(many(300, 5, capped).flat().some((o) => ['plates', 'pumps', 'gyros', 'drives'].includes(o.get.item))).toBe(false);
  });

  it('an empty hold and no credits gets no offers', () => {
    const broke = travelingState({ credits: 0, supplies: { drives: 1, rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 } });
    expect(many(50, 5, broke).flat()).toEqual([]);
    expect(intentBlocker(parked(5, { station: null }), { type: 'trade', offer: 0 })).toBe('Nobody here wants to trade.');
  });
});

describe('accepting trades', () => {
  const offer = (o: Partial<TradeOffer>): TradeOffer => ({
    persona: personaIds()[0]!, give: { item: 'gyros', qty: 1 }, get: { item: 'rations', qty: 30 }, fairness: 'fair', taken: false, ...o,
  });
  const at = (offers: TradeOffer[], over: Parameters<typeof travelingState>[0] = {}) => parked(3, { station: { waypoint: 3, offers }, ...over });

  it('conserves goods: give leaves, get arrives, value in/out matches the offer; accept-once', () => {
    for (const v of Array.from({ length: 300 }, (_, i) => generateOffers(travelingState({ credits: 300 }), 5, createRng(i + 7)))) {
      v.forEach((o, i) => {
        const s = parked(5, { credits: 300, station: { waypoint: 5, offers: v } });
        const r = applyAction(s, { type: 'trade', offer: i }, createRng(1));
        if (r.error) return; // e.g. a cap reached by an earlier pick in this loop never happens here, but stay safe
        const giveBefore = o.give.item === 'credits' ? s.credits : s.supplies[o.give.item];
        const giveAfter = o.give.item === 'credits' ? r.state.credits : r.state.supplies[o.give.item];
        expect(giveBefore - giveAfter).toBeCloseTo(o.give.qty, 6);
        expect(r.state.supplies[o.get.item] - s.supplies[o.get.item]).toBe(o.get.qty);
        const total = (x: GameState): number => x.credits * 100 + ITEM_ORDER.reduce((a, k) => a + x.supplies[k] * UNITS(k), 0);
        expect(Math.round(total(r.state) - total(s))).toBe(UNITS(o.get.item) * o.get.qty - UNITS(o.give.item) * o.give.qty);
        expect(r.state.station!.offers[i]!.taken).toBe(true);
        expect(r.entries[0]).toMatchObject({ kind: 'trade', id: o.persona });
        expect(applyAction(r.state, { type: 'trade', offer: i }, createRng(1)).error).toBe('That deal is done.');
      });
    }
  });

  it('re-checks holdings, caps and the last drive', () => {
    expect(intentBlocker(at([offer({})], { supplies: { gyros: 0 } }), { type: 'trade', offer: 0 })).toMatch(/You don't have/);
    expect(intentBlocker(at([offer({ get: { item: 'pumps', qty: 1 } })], { supplies: { pumps: 3 } }), { type: 'trade', offer: 0 })).toBe('You can carry at most 3.');
    expect(intentBlocker(at([offer({ give: { item: 'drives', qty: 3 } })]), { type: 'trade', offer: 0 })).toBe('You need a drive to leave.');
    expect(intentBlocker(at([offer({})]), { type: 'trade', offer: 5 })).toBe('No such offer.');
    const credits = applyAction(at([offer({ give: { item: 'credits', qty: 9 } })], { credits: 10.5 }), { type: 'trade', offer: 0 }, createRng(1));
    expect(credits.state.credits).toBe(1.5);
  });

  it('persona text fills {give}/{get}; phrases and credit formatting', () => {
    const o = offer({ give: { item: 'credits', qty: 40 }, get: { item: 'pumps', qty: 1 } });
    expect(offerVars(o)).toEqual({ give: '40 cr', get: '1 coolant pump', n: 1 });
    const line = tradeLine(createRng(1), o, 'offer');
    expect(line).not.toMatch(/\{give\}|\{get\}/);
    expect(tradeLine(createRng(1), { ...o, persona: 'nobody-here' }, 'offer')).toBe('Got 1 coolant pump. Want 40 cr.');
    expect(tradeLine(createRng(1), { ...o, persona: 'nobody-here' }, 'decline')).toBe('Suit yourself.');
    expect(personaName(o.persona)).not.toBe(o.persona);
    expect(itemPhrase('charges', 20)).toBe('20 drone charges');
    expect(itemPhrase('suits', 1)).toBe('1 EVA suit');
    expect(formatCr(2.5)).toBe('2.50');
  });
});
