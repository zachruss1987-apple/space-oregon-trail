/** hazards.md "Route branch" + trail.md: the Titan Refinery direct/via-Oort choice. */
import { describe, expect, it } from 'vitest';
import {
  applyAction, createRng, crossingOptions, cumulativeAt, isSkipped, nextWaypoint, routeBlocker, routeWaypoints, totalMk, type GameState,
} from '@/sim';
import { ship } from './spec-helpers';

/** trail.md cumulative table. */
const CUM = [0, 102, 185, 304, 554, 640, 830, 932, 989, 1151, 1208, 1390, 1504, 1664, 1719, 1839, 2040];

const atTitan = (over: Parameters<typeof ship>[0] = {}): GameState =>
  ship({ arrivedAt: 10, segment: 10, distanceTotal: 1208, station: { waypoint: 10, offers: [] }, ...over });

describe('route totals and waypoint skipping', () => {
  it('via Oort is 2,040 Mk with every waypoint; direct is 1,926 Mk', () => {
    expect(totalMk('oort')).toBe(2040);
    expect(totalMk('direct')).toBe(1926);
    expect(2040 - 1926).toBe(114);
  });

  it('direct skips waypoint 12 (Oort Beacon): after the Gate (11) comes 13', () => {
    expect(nextWaypoint(11, 'direct')).toBe(13);
    expect(nextWaypoint(11, 'oort')).toBe(12);
    expect(nextWaypoint(12, 'oort')).toBe(13);
    expect(isSkipped(12, 'direct')).toBe(true);
    expect(isSkipped(12, 'oort')).toBe(false);
    for (let i = 0; i <= 16; i++) if (i !== 12) expect(isSkipped(i, 'direct')).toBe(false);
  });

  it('every other step is index + 1 on both routes, ending at 16', () => {
    for (const route of ['oort', 'direct'] as const) {
      for (let i = 0; i < 16; i++) {
        if (i === 11 && route === 'direct') continue;
        if (i === 12 && route === 'direct') continue;
        expect(nextWaypoint(i, route)).toBe(i + 1);
      }
      expect(nextWaypoint(16, route)).toBe(16);
    }
  });

  it('cumulative Mk follows the trail table; direct subtracts 114 from the Heliopause on', () => {
    for (let i = 0; i <= 16; i++) {
      expect(cumulativeAt(i, 'oort')).toBe(CUM[i]);
      expect(cumulativeAt(i, 'direct')).toBe(i > 12 ? CUM[i]! - 114 : CUM[i]);
    }
    expect(cumulativeAt(13, 'direct')).toBe(1550); // 160 Mk after the Gate (1,390)
    expect(cumulativeAt(13, 'direct') - cumulativeAt(11, 'direct')).toBe(160);
  });
});

describe('map helper lists', () => {
  it('oort: 17 rows, indices 0-16 in order, cumulative from the table', () => {
    const rows = routeWaypoints('oort');
    expect(rows.map((w) => w.index)).toEqual([...Array(17).keys()]);
    expect(rows.map((w) => w.cumulative)).toEqual(CUM);
  });

  it('direct: 16 rows, no Oort Beacon, cumulative route-correct and ending at 1,926', () => {
    const rows = routeWaypoints('direct');
    expect(rows.length).toBe(16);
    expect(rows.map((w) => w.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16]);
    expect(rows.find((w) => w.index === 12)).toBeUndefined();
    expect(rows.find((w) => w.index === 13)!.cumulative).toBe(1550);
    expect(rows[rows.length - 1]!.cumulative).toBe(1926);
    for (let k = 1; k < rows.length; k++) expect(rows[k]!.cumulative).toBeGreaterThan(rows[k - 1]!.cumulative);
  });

  it('does not mutate the shared waypoint table', () => {
    routeWaypoints('direct');
    expect(routeWaypoints('oort')[16]!.cumulative).toBe(2040);
  });
});

describe('route intent', () => {
  it('works only while parked at Titan Refinery; logs kind route with id = via; costs no day', () => {
    const s = atTitan();
    expect(s.route).toBe('oort');
    expect(routeBlocker(s)).toBeNull();
    const r = applyAction(s, { type: 'route', via: 'direct' }, createRng(1));
    expect(r.error).toBeUndefined();
    expect(r.state.route).toBe('direct');
    expect(r.state.day).toBe(s.day);
    const e = r.entries.find((x) => x.kind === 'route');
    expect(e?.id).toBe('direct');
  });

  it('may be changed back until departing', () => {
    const direct = applyAction(atTitan(), { type: 'route', via: 'direct' }, createRng(1)).state;
    expect(applyAction(direct, { type: 'route', via: 'oort' }, createRng(1)).state.route).toBe('oort');
  });

  it('is refused behind the fork ("The branch is behind you.") and before it, and at sea', () => {
    expect(applyAction(ship({ arrivedAt: 11, segment: 11 }), { type: 'route', via: 'direct' }, createRng(1)).error).toBe('The branch is behind you.');
    expect(applyAction(ship({ arrivedAt: 3, segment: 3 }), { type: 'route', via: 'direct' }, createRng(1)).error).toBeTruthy();
    expect(applyAction(ship(), { type: 'route', via: 'direct' }, createRng(1)).error).toBeTruthy();
  });

  it('defaults to via Oort for a new game', () => {
    expect(ship().route).toBe('oort');
  });
});

describe('direct route in play', () => {
  /** Continue from the Kuiper Gate with plenty of everything until the next arrival. */
  function nextArrival(route: 'oort' | 'direct', seed: number): GameState | null {
    let s: GameState = ship({
      route, arrivedAt: 11, segment: 12, distanceInSegment: 0, distanceTotal: 1390, credits: 500,
      supplies: { drives: 4, rations: 3000, suits: 30, charges: 200, plates: 3, pumps: 3, gyros: 3 },
    });
    s = { ...s, segment: nextWaypoint(11, route) };
    const rng = createRng(seed);
    for (let i = 0; i < 80 && s.status === 'traveling'; i++) {
      const r = applyAction(s, { type: 'continue' }, rng);
      if (r.error) return null;
      s = r.state;
      if (s.arrivedAt !== null && s.arrivedAt !== 11) return s;
    }
    return null;
  }

  it('via Oort the next stop after the Gate is Oort Beacon (12); direct it is the Heliopause (13)', () => {
    let oort = 0;
    let direct = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const a = nextArrival('oort', seed);
      const b = nextArrival('direct', seed);
      if (a) { expect(a.arrivedAt).toBe(12); oort++; }
      if (b) { expect(b.arrivedAt).toBe(13); direct++; expect(b.crossing?.waypoint).toBe(13); }
    }
    expect(oort).toBeGreaterThanOrEqual(10);
    expect(direct).toBeGreaterThanOrEqual(10);
  });

  it('the Heliopause baseline is +10 on the direct route (35 -> 45, Severe at nominal density)', () => {
    const base = ship({ arrivedAt: 13, segment: 13, crossing: { waypoint: 13, density: 4, pilotDaysLeft: null }, credits: 500 });
    const direct = crossingOptions({ ...base, route: 'direct' }).find((o) => o.method === 'thread')!;
    const oort = crossingOptions({ ...base, route: 'oort' }).find((o) => o.method === 'thread')!;
    expect(oort.chance).toBe(35);
    expect(direct.chance).toBe(45);
    expect(direct.risk).toBe('severe');
    expect(oort.risk).toBe('high');
  });

  it('the +10 applies only at the Heliopause', () => {
    for (const idx of [1, 2, 7, 9]) {
      const mk = (route: 'oort' | 'direct') =>
        crossingOptions(ship({ route, arrivedAt: idx, segment: idx, crossing: { waypoint: idx, density: 3, pilotDaysLeft: null } })).find((o) => o.method === 'thread')!.chance;
      expect(mk('direct')).toBe(mk('oort'));
    }
  });
});
