/** hazards.md "Route branch", serialize.ts migration (STATE_VERSION 2), beacons.md helpers, station Talk helpers. */
import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { applyAction, intentBlocker } from '@/sim/actions';
import {
  appendBeacon, beaconSegment, beaconsForSegment, cannedBeacons, formatBeacon, isValidEpitaph, lastDeceased, makeBeacon, newlyDead, parseBeacons, type BeaconRecord,
} from '@/sim/beacons';
import { crossChance } from '@/sim/crossing';
import { sellBlocker } from '@/sim/market';
import { createRng } from '@/sim/rng';
import { cumulativeAt, isSkipped, nextWaypoint, routeWaypoints, totalMk } from '@/sim/route';
import { fromJSON, toJSON } from '@/sim/serialize';
import { shuffledTalk, stationGreeting, stationKeeper, stationOpen, stationTalk } from '@/sim/station';
import { tick } from '@/sim/tick';
import { STATE_VERSION } from '@/sim/types';
import { travelingState } from './helpers';

describe('route branch', () => {
  it('lengths: 2,040 via Oort, 1,926 direct; direct skips waypoint 12 and keeps segment 13 at 160 Mk', () => {
    expect(totalMk('oort')).toBe(2040);
    expect(totalMk('direct')).toBe(1926);
    expect(nextWaypoint(11, 'direct')).toBe(13);
    expect(nextWaypoint(11, 'oort')).toBe(12);
    expect(nextWaypoint(16, 'oort')).toBe(16);
    expect(isSkipped(12, 'direct')).toBe(true);
    expect(routeWaypoints('direct').map((w) => w.index)).not.toContain(12);
    expect(routeWaypoints('oort')).toHaveLength(17);
    expect(cumulativeAt(13, 'direct') - cumulativeAt(11, 'direct')).toBe(160);
    expect(routeWaypoints('direct').at(-1)!.cumulative).toBe(1926);
  });

  it('route intent only while parked at Titan Refinery; logs kind route', () => {
    const titan = travelingState({ segment: 11, arrivedAt: 10 });
    const r = applyAction(titan, { type: 'route', via: 'direct' }, createRng(1));
    expect(r.state.route).toBe('direct');
    expect(r.state.day).toBe(titan.day);
    expect(r.entries[0]).toMatchObject({ kind: 'route', id: 'direct' });
    expect(applyAction(r.state, { type: 'route', via: 'oort' }, createRng(1)).state.route).toBe('oort');
    expect(intentBlocker(travelingState({ segment: 12 }), { type: 'route', via: 'direct' })).toBe('The branch is behind you.');
    expect(intentBlocker(travelingState({ segment: 5 }), { type: 'route', via: 'direct' })).toBe('You have not reached the fork yet.');
    expect(intentBlocker({ ...titan, status: 'dead' }, { type: 'route', via: 'direct' })).toBe('The journey is over.');
  });

  it('direct: after the Gate the next waypoint is the Heliopause, distances follow the 1,926 Mk trail, +10 incident there', () => {
    const atGate = travelingState({ segment: 11, distanceInSegment: 181.95, distanceTotal: 1389.95, route: 'direct' });
    const r = tick(atGate, createRng(2)).state;
    expect(r.arrivedAt).toBe(11);
    expect(r.segment).toBe(13);
    const helio = tick({ ...r, arrivedAt: null, distanceInSegment: 159.95, distanceTotal: 1549.95 }, createRng(2)).state;
    expect(helio.arrivedAt).toBe(13);
    expect(helio.distanceTotal).toBe(1550);
    expect(crossChance({ ...helio, crossing: { waypoint: 13, density: 4, pilotDaysLeft: null } }, 'thread')).toBe(45);
  });
});

describe('save migration', () => {
  it('a v1 (M1) save loads with M2 defaults', () => {
    const s = travelingState();
    const v1 = JSON.parse(toJSON(s)) as { version: number; state: Record<string, unknown> };
    v1.version = 1;
    delete v1.state['crossing'];
    delete v1.state['route'];
    delete v1.state['station'];
    v1.state['version'] = 1;
    const loaded = fromJSON(JSON.stringify(v1));
    expect(loaded.crossing).toBeNull();
    expect(loaded.route).toBe('oort');
    expect(loaded.station).toBeNull();
    expect(loaded.version).toBe(STATE_VERSION);
    expect(STATE_VERSION).toBe(3);
  });

  it('a v2 (M2) save loads with the M3 defaults: seed "", rodeTheWind false (minigames.md "State additions")', () => {
    const v2 = JSON.parse(toJSON(travelingState())) as { version: number; state: Record<string, unknown> };
    v2.version = 2;
    delete v2.state['seed'];
    delete v2.state['rodeTheWind'];
    v2.state['version'] = 2;
    const loaded = fromJSON(JSON.stringify(v2));
    expect(loaded.seed).toBe('');
    expect(loaded.rodeTheWind).toBe(false);
    expect(loaded.version).toBe(3);
  });

  it('round-trips v3 state with a crossing and offers; rejects unknown versions', () => {
    const s = travelingState({ crossing: { waypoint: 7, density: 5, pilotDaysLeft: 2 }, route: 'direct' });
    expect(fromJSON(toJSON(s))).toEqual(s);
    expect(() => fromJSON(JSON.stringify({ version: 4, state: s }))).toThrow(/version/);
    expect(() => fromJSON(JSON.stringify({ version: 0, state: s }))).toThrow(/version/);
  });
});

describe('beacons (pure helpers)', () => {
  const b = (segment: number, name: string, captain = 'Ezra'): BeaconRecord => ({ segment, captain, name, text: `RIP ${name}`, date: '2184-05-01' });

  it('segment = arrivedAt ?? segment; captain = crew[0]', () => {
    expect(beaconSegment(travelingState({ segment: 4 }))).toBe(4);
    expect(beaconSegment(travelingState({ segment: 4, arrivedAt: 3 }))).toBe(3);
    expect(makeBeacon(travelingState({ segment: 6 }), 'Amos', '  Gone.  ')).toMatchObject({ segment: 6, captain: 'Ezra', name: 'Amos', text: 'Gone.' });
    expect(isValidEpitaph('x'.repeat(40))).toBe(true);
    expect(isValidEpitaph('x'.repeat(41))).toBe(false);
    expect(isValidEpitaph('   ')).toBe(false);
  });

  it('defensive parse: non-array, missing fields skipped, missing captain -> ""', () => {
    expect(parseBeacons('nope')).toEqual([]);
    expect(parseBeacons(null)).toEqual([]);
    expect(parseBeacons([{ segment: 1, name: 'A', text: 't', date: 'd' }, { name: 'B' }, 7, null])).toEqual([{ segment: 1, captain: '', name: 'A', text: 't', date: 'd' }]);
    expect(parseBeacons([{ segment: 2, name: 'A', text: 't' }])[0]!.date).toBe('');
  });

  it('keeps the last 200', () => {
    let list: BeaconRecord[] = [];
    for (let i = 0; i < 205; i++) list = appendBeacon(list, b(1, `N${i}`));
    expect(list).toHaveLength(200);
    expect(list[0]!.name).toBe('N5');
  });

  it('mixing: player first (most recent first), canned fill <= 2 slots (< 10 player beacons) or 1 (>= 10); none at New Willamette', () => {
    const canned = [b(7, 'C1', 'X'), b(7, 'C2', 'X'), b(7, 'C3', 'X')];
    const rng = createRng(1);
    expect(beaconsForSegment([], 7, rng, canned)).toHaveLength(2);
    const one = beaconsForSegment([b(7, 'P1')], 7, rng, canned);
    expect(one.map((x) => x.name)[0]).toBe('P1');
    expect(one).toHaveLength(3);
    const three = beaconsForSegment([b(7, 'P1'), b(7, 'P2'), b(7, 'P3'), b(7, 'P4')], 7, rng, canned);
    expect(three.map((x) => x.name)).toEqual(['P4', 'P3', 'P2']);
    const veteran = [...Array.from({ length: 10 }, (_, i) => b(2, `V${i}`)), b(7, 'P1')];
    expect(beaconsForSegment(veteran, 7, rng, canned)).toHaveLength(2);
    expect(beaconsForSegment([], 16, rng, canned)).toEqual([]);
    expect(beaconsForSegment([], 4, rng, canned)).toEqual([]);
    expect(cannedBeacons().length).toBeGreaterThanOrEqual(10);
    expect(beaconsForSegment([], 1, rng).length).toBeGreaterThan(0);
  });

  it('display line with and without a captain', () => {
    expect(formatBeacon(b(1, 'Amos'))).toBe('Beacon: Amos, of Captain Ezra\'s ship, 2184-05-01. "RIP Amos"');
    expect(formatBeacon(b(1, 'Amos', ''))).toBe('Beacon: Amos, 2184-05-01. "RIP Amos"');
  });
});

describe('station helpers', () => {
  it('talk shuffle is a permutation of the pool; keeper/greeting fall back gracefully', () => {
    const pool = stationTalk('mars-relay');
    expect(pool.length).toBeGreaterThanOrEqual(10);
    const shuffled = shuffledTalk('mars-relay', createRng(3));
    expect([...shuffled].sort()).toEqual([...pool].sort());
    expect(stationTalk('nowhere')).toEqual([]);
    const keeper = stationKeeper('mars-relay');
    expect(keeper === null || typeof keeper === 'string').toBe(true);
    const greet = stationGreeting(createRng(1), travelingState(), 3);
    expect(greet).not.toMatch(/\{captain\}/);
  });

  it('stationOpen while parked at the visited station; Mattie does not buy back', () => {
    expect(stationOpen(travelingState({ arrivedAt: 5, station: { waypoint: 5, offers: [] } }))).toBe(true);
    expect(stationOpen(travelingState())).toBe(false);
    expect(sellBlocker({ ...travelingState(), status: 'store' }, 'drives', 1)).toBe('Mattie does not buy back.');
    expect(WAYPOINTS[12]!.markup?.drives).toBeUndefined();
  });
});

describe('per-death beacon helpers', () => {
  it('newlyDead lists crew who died between two states in roster order; lastDeceased picks the latest', () => {
    const a = travelingState();
    const b = structuredClone(a);
    b.day = 9;
    for (const i of [1, 3]) Object.assign(b.crew[i]!, { alive: false, diedOnDay: 9 });
    expect(newlyDead(a, b)).toEqual([b.crew[1]!.name, b.crew[3]!.name]);
    expect(newlyDead(b, b)).toEqual([]);
    expect(lastDeceased(b)).toBe(b.crew[3]!.name);
    expect(lastDeceased(a)).toBeNull();
  });
});
