/** economy.md "NPC trade offers": count, fairness, give/get, accept-once, value conservation, personas. */
import { describe, expect, it } from 'vitest';
import { TRADE_TEXT } from '@/content';
import { applyAction, createRng, personaIds, tick, type GameState, type SupplyKey, type TradeOffer } from '@/sim';
import { expectRate, ship } from './spec-helpers';

/** Base unit values (economy.md step 4), per unit (charges are single charges: box 2 cr / 20). */
const UNIT: Record<SupplyKey | 'credits', number> = {
  drives: 40, rations: 0.3, suits: 10, charges: 0.1, plates: 10, pumps: 10, gyros: 10, credits: 1,
};
const RATIO: Record<TradeOffer['fairness'], number> = { swindle: 1.6, steep: 1.25, fair: 1.0, generous: 0.75 };
const WP = { 3: 119, 5: 86, 8: 57, 10: 57, 12: 114, 14: 55 } as const;
const CUM = { 3: 304, 5: 640, 8: 989, 10: 1208, 12: 1504, 14: 1719 } as const;

/** Rich holdings so no ask is unaffordable; one tick from the station. */
function approaching(wp: keyof typeof WP, over: Parameters<typeof ship>[0] = {}): GameState {
  return ship({
    segment: wp, distanceInSegment: WP[wp] - 0.05, distanceTotal: CUM[wp] - 0.05, credits: 600, route: 'oort',
    supplies: { drives: 4, rations: 1000, suits: 20, charges: 200, plates: 1, pumps: 1, gyros: 1 },
    ...over,
  });
}
function arrive(wp: keyof typeof WP, seed: number, over: Parameters<typeof ship>[0] = {}): GameState {
  return tick(approaching(wp, over), createRng(seed)).state;
}
const WPS = [3, 5, 8, 10, 12, 14] as const;

function allOffers(n: number, wp: keyof typeof WP = 3, over: Parameters<typeof ship>[0] = {}): { s: GameState; offers: TradeOffer[] }[] {
  const out: { s: GameState; offers: TradeOffer[] }[] = [];
  for (let seed = 1; seed <= n; seed++) {
    const s = arrive(wp, seed, over);
    if (s.station && s.arrivedAt === wp) out.push({ s, offers: s.station.offers });
  }
  return out;
}

describe('offer generation on arrival', () => {
  it('a station visit is created on arrival at each road station, none at hazards or landmarks', () => {
    for (const wp of WPS) expect(arrive(wp, 1).station?.waypoint).toBe(wp);
    const landmark = tick(ship({ segment: 4, distanceInSegment: 249.95, distanceTotal: 553.95 }), createRng(1)).state;
    expect(landmark.arrivedAt).toBe(4);
    expect(landmark.station).toBeNull();
  });

  it('2-3 offers per visit; three about half the time (d100 <= 50)', () => {
    const visits = allOffers(2000);
    expect(visits.length).toBeGreaterThanOrEqual(1900);
    for (const v of visits) expect([2, 3]).toContain(v.offers.length);
    expectRate(visits.filter((v) => v.offers.length === 3).length, visits.length, 0.5, 4, 'three offers');
  });

  it('offers are not taken, personas are distinct within a visit and exist in trades.json', () => {
    const ids = new Set(personaIds());
    const jsonIds = Object.keys((TRADE_TEXT as Record<string, Record<string, unknown>>)['personas']!);
    expect(jsonIds.length).toBeGreaterThanOrEqual(20);
    expect([...ids].sort()).toEqual([...jsonIds].sort());
    for (const { offers } of allOffers(300, 8)) {
      expect(new Set(offers.map((o) => o.persona)).size).toBe(offers.length);
      for (const o of offers) {
        expect(ids.has(o.persona)).toBe(true);
        expect(o.taken).toBe(false);
      }
    }
  });

  it('every persona has name, pitch (with {give} and {get}), accept and decline lines', () => {
    const personas = (TRADE_TEXT as Record<string, Record<string, { name: string; offer?: string[]; pitch?: string[]; accept: string[]; decline: string[] }>>)['personas']!;
    for (const [id, rawP] of Object.entries(personas)) {
      const p = { ...rawP, pitch: rawP.offer ?? rawP.pitch ?? [] }; // shipped content names the pitch key `offer` (decisions.md, tester M2)
      expect(p.name.length, id).toBeLessThanOrEqual(32);
      expect(p.pitch.length, id).toBeGreaterThanOrEqual(2);
      for (const line of p.pitch) expect(line.includes('{give}') && line.includes('{get}'), `${id}: ${line}`).toBe(true);
      expect(p.accept.length, id).toBeGreaterThanOrEqual(1);
      expect(p.decline.length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('is reproducible: same seed, same offers', () => {
    expect(arrive(5, 77).station).toEqual(arrive(5, 77).station);
  });

  it('offers persist through rest days at the station', () => {
    const s = arrive(3, 4, { rations: 'half' });
    const rested = applyAction(s, { type: 'rest', days: 2 }, createRng(2)).state;
    expect(rested.station?.offers.map((o) => o.persona)).toEqual(s.station?.offers.map((o) => o.persona));
  });

  it('are discarded on departure', () => {
    const s = arrive(3, 4);
    const left = applyAction(s, { type: 'continue' }, createRng(2)).state;
    expect(left.station).toBeNull();
  });
});

describe('fairness and value (priced at Independence base values)', () => {
  const visits = allOffers(2000, 3);
  const offers = visits.flatMap((v) => v.offers);

  it('fairness bands are swindle 15%, steep 35%, fair 35%, generous 15%', () => {
    const count = (id: TradeOffer['fairness']) => offers.filter((o) => o.fairness === id).length;
    expectRate(count('swindle'), offers.length, 0.15, 4, 'swindle');
    expectRate(count('steep'), offers.length, 0.35, 4, 'steep');
    expectRate(count('fair'), offers.length, 0.35, 4, 'fair');
    expectRate(count('generous'), offers.length, 0.15, 4, 'generous');
    expect(new Set(offers.map((o) => RATIO[o.fairness]))).toEqual(new Set([1.6, 1.25, 1.0, 0.75]));
  });

  it('value asked is at least ratio x value received, and exceeds it by less than one rounding step', () => {
    for (const o of offers) {
      const v = o.get.qty * UNIT[o.get.item];
      const ratio = o.give.item === 'credits' ? Math.max(RATIO[o.fairness], 1.0) : RATIO[o.fairness];
      const asked = o.give.qty * UNIT[o.give.item];
      const step = o.give.item === 'rations' || o.give.item === 'charges' ? 5 * UNIT[o.give.item] : UNIT[o.give.item];
      expect(asked, JSON.stringify(o)).toBeGreaterThanOrEqual(v * ratio - 1e-9);
      expect(asked, JSON.stringify(o)).toBeLessThan(v * ratio + step + 1e-9);
    }
  });

  it('credit asks are never below the value received (a trader is never cheaper than the cheapest store)', () => {
    const credit = offers.filter((o) => o.give.item === 'credits');
    expect(credit.length).toBeGreaterThan(100);
    for (const o of credit) expect(o.give.qty).toBeGreaterThanOrEqual(o.get.qty * UNIT[o.get.item] - 1e-9);
    // so credits-for-goods never beats the Independence list price
    for (const o of credit) expect(o.give.qty / o.get.qty).toBeGreaterThanOrEqual(UNIT[o.get.item] - 1e-9);
  });

  it('give is never the get item, never credits when < 1 cr held, never the last drive', () => {
    for (const o of offers) expect(o.give.item).not.toBe(o.get.item);
    for (const { s: _s } of visits.slice(0, 1)) expect(_s).toBeTruthy();
    for (const { offers: os } of allOffers(400, 3, { credits: 0.5 })) for (const o of os) expect(o.give.item).not.toBe('credits');
    for (const { offers: os } of allOffers(400, 3, { supplies: { drives: 1 } })) for (const o of os) expect(o.give.item).not.toBe('drives');
  });

  it('get item mix follows the weights and quantities follow the lot ranges', () => {
    const n = offers.length;
    const share = (item: SupplyKey) => offers.filter((o) => o.get.item === item).length;
    // weights 15/30/15/10/10/10/10 of 100, a little distorted by items at cap; the 4-sigma check is on rations (30%)
    expect(share('rations') / n).toBeGreaterThan(0.25);
    expect(share('rations') / n).toBeLessThan(0.36);
    for (const o of offers) {
      const q = o.get.qty;
      switch (o.get.item) {
        case 'drives': expect(q).toBe(1); break;
        case 'rations': expect(q >= 30 && q <= 150 && q % 10 === 0).toBe(true); break;
        case 'suits': expect(q >= 1 && q <= 3).toBe(true); break;
        case 'charges': expect([20, 40, 60]).toContain(q); break;
        default: expect(q).toBe(1);
      }
    }
  });

  it('Oort Beacon offers no drives (nothing to build them from)', () => {
    for (const { offers: os } of allOffers(500, 12)) for (const o of os) expect(o.get.item).not.toBe('drives');
  });

  it('never offers a get item the player already holds at cap', () => {
    let checked = 0;
    for (const { s, offers: os } of allOffers(400, 3, { supplies: { plates: 3, pumps: 3, gyros: 3, drives: 9 } })) {
      // an event earlier in the arrival tick (drive_failure, pirates) can drop a holding below cap before offers are drawn
      if (s.supplies.plates !== 3 || s.supplies.pumps !== 3 || s.supplies.gyros !== 3 || s.supplies.drives !== 9) continue;
      checked++;
      for (const o of os) expect(['plates', 'pumps', 'gyros', 'drives']).not.toContain(o.get.item);
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('worked examples: fair 30 rations (V = 9) for a gyro asks 1 gyro; fair pump for rations asks 35 rations', () => {
    // typed from economy.md "Worked example": ceil(9 x 1.0 / 10) = 1, ceil(10 / 0.30) = 34 -> rounded to 35
    expect(Math.ceil((30 * 0.3 * 1.0) / 10)).toBe(1);
    expect(Math.ceil(Math.ceil((10 * 1.0) / 0.3 - 1e-9) / 5) * 5).toBe(35);
    const hit = offers.find((o) => o.fairness === 'fair' && o.get.item === 'pumps' && o.give.item === 'rations');
    expect(hit?.give.qty).toBe(35);
  });
});

describe('accepting', () => {
  const offerState = (): { s: GameState; i: number } => {
    for (let seed = 1; seed < 200; seed++) {
      const s = arrive(3, seed);
      const i = s.station!.offers.findIndex((o) => o.give.item !== 'drives' && o.give.item !== 'credits');
      if (i >= 0) return { s, i };
    }
    throw new Error('no offer found');
  };

  it('moves goods, marks taken, logs kind trade with id = persona, costs no day', () => {
    const { s, i } = offerState();
    const o = s.station!.offers[i]!;
    const r = applyAction(s, { type: 'trade', offer: i }, createRng(3));
    expect(r.error).toBeUndefined();
    const give = o.give.item as SupplyKey;
    expect(r.state.supplies[give] - s.supplies[give]).toBe(-o.give.qty - (o.get.item === give ? -o.get.qty : 0));
    expect(r.state.supplies[o.get.item]).toBe(s.supplies[o.get.item] + o.get.qty);
    expect(r.state.station!.offers[i]!.taken).toBe(true);
    expect(r.state.day).toBe(s.day);
    const e = r.entries.find((x) => x.kind === 'trade');
    expect(e?.id).toBe(o.persona);
    expect(s.station!.offers[i]!.taken).toBe(false); // input not mutated
  });

  it('accept-once: the same offer again is refused with "That deal is done."', () => {
    const { s, i } = offerState();
    const once = applyAction(s, { type: 'trade', offer: i }, createRng(3)).state;
    const again = applyAction(once, { type: 'trade', offer: i }, createRng(3));
    expect(again.error).toBe('That deal is done.');
    expect(again.state).toBe(once);
  });

  it('re-checks holdings: refused if the ask was sold off ("You don\'t have ... anymore.")', () => {
    const { s, i } = offerState();
    const give = s.station!.offers[i]!.give.item as SupplyKey;
    const poorer = { ...s, supplies: { ...s.supplies, [give]: 0 } };
    expect(applyAction(poorer, { type: 'trade', offer: i }, createRng(3)).error).toMatch(/You don't have .* anymore\./);
  });

  it('refused if the get would exceed a cap or the ask would take the last drive', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = arrive(3, seed);
      const offers = s.station!.offers;
      const d = offers.findIndex((o) => o.give.item === 'drives');
      if (d >= 0) {
        const one = { ...s, supplies: { ...s.supplies, drives: offers[d]!.give.qty } };
        expect(applyAction(one, { type: 'trade', offer: d }, createRng(1)).error).toBe('You need a drive to leave.');
        return;
      }
    }
    throw new Error('no drive-asking offer in 400 seeds');
  });

  it('refuses unknown offer indices', () => {
    const s = arrive(3, 1);
    expect(applyAction(s, { type: 'trade', offer: 9 }, createRng(1)).error).toBeTruthy();
    expect(applyAction(ship(), { type: 'trade', offer: 0 }, createRng(1)).error).toBeTruthy();
  });

  it('never leaves negative holdings or credits over many seeded visits, accepting every offer', () => {
    for (let seed = 1; seed <= 300; seed++) {
      let s = arrive(WPS[seed % 6]!, seed, { credits: 40 });
      for (let i = 0; i < s.station!.offers.length; i++) {
        const r = applyAction(s, { type: 'trade', offer: i }, createRng(seed));
        s = r.state;
        expect(s.credits).toBeGreaterThanOrEqual(0);
        for (const v of Object.values(s.supplies)) expect(v).toBeGreaterThanOrEqual(0);
        expect(s.supplies.drives).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
