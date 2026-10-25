/** beacons.md: record shape, defensive parsing, 200 cap, per-waypoint mixing of player and canned beacons, display line. */
import { describe, expect, it } from 'vitest';
import {
  appendBeacon, BEACONS, beaconsForSegment, cannedBeacons, createRng, formatBeacon, isValidEpitaph, makeBeacon, parseBeacons,
  type BeaconRecord,
} from '@/sim';
import { ship } from './spec-helpers';

const rec = (segment: number, name = 'Ada', text = 'Gone ahead.', captain = 'Zed', date = '2184-05-01'): BeaconRecord => ({ segment, captain, name, text, date });
/** n player beacons for `segment`, names P0..P(n-1) in storage order (last = most recent). */
const player = (segment: number, n: number): BeaconRecord[] => Array.from({ length: n }, (_, i) => rec(segment, `P${i}`, `Text ${i}`));

describe('makeBeacon', () => {
  it('copies name, trimmed text, captain = crew[0], date = in-game date, segment = arrivedAt', () => {
    const s = ship({ arrivedAt: 5, segment: 5, date: '2184-06-30' });
    const b = makeBeacon(s, 'Hester', '  Should have bought the suit.  ');
    expect(b).toEqual({ segment: 5, captain: s.crew[0]!.name, name: 'Hester', text: 'Should have bought the suit.', date: '2184-06-30' });
  });

  it('segment is the next waypoint when between waypoints', () => {
    const s = ship({ arrivedAt: null, segment: 4 });
    expect(makeBeacon(s, 'Ada', 'x').segment).toBe(4);
  });

  it('parked at waypoint n and on the way to n are both segment n', () => {
    expect(makeBeacon(ship({ arrivedAt: 7, segment: 7 }), 'A', 'x').segment).toBe(7);
    expect(makeBeacon(ship({ arrivedAt: null, segment: 7 }), 'A', 'x').segment).toBe(7);
  });

  it('the captain may be the one who died: captain stays crew[0]', () => {
    const s = ship();
    expect(makeBeacon(s, s.crew[0]!.name, 'x').captain).toBe(s.crew[0]!.name);
  });
});

describe('epitaph text', () => {
  it('accepts 1-40 printable ASCII characters only', () => {
    expect(isValidEpitaph('a')).toBe(true);
    expect(isValidEpitaph('x'.repeat(40))).toBe(true);
    expect(isValidEpitaph('x'.repeat(41))).toBe(false);
    expect(isValidEpitaph('')).toBe(false);
    expect(isValidEpitaph('   ')).toBe(false);
    expect(isValidEpitaph('café')).toBe(false);
    expect(isValidEpitaph('tab\there')).toBe(false);
    expect(isValidEpitaph('Hello, void! ~')).toBe(true);
  });
});

describe('parseBeacons tolerates garbage', () => {
  it('non-arrays give []', () => {
    for (const raw of [null, undefined, 42, 'x', {}, { segment: 1 }, true]) expect(parseBeacons(raw)).toEqual([]);
  });

  it('skips entries missing segment/name/text or of the wrong type; missing captain -> ""', () => {
    const raw = [
      null, 7, 'str', [], {},
      { segment: 1, name: 'A' },
      { segment: 1, text: 'x' },
      { name: 'A', text: 'x' },
      { segment: '3', name: 'A', text: 'x' },
      { segment: 2, name: 'Ok', text: 'fine', date: '2184-01-01' },
      { segment: 3, captain: 'Cap', name: 'Ok2', text: 'fine2', date: '2184-01-02' },
    ];
    expect(parseBeacons(raw)).toEqual([
      { segment: 2, captain: '', name: 'Ok', text: 'fine', date: '2184-01-01' },
      { segment: 3, captain: 'Cap', name: 'Ok2', text: 'fine2', date: '2184-01-02' },
    ]);
  });

  it('survives a JSON round trip of valid records', () => {
    const list = [rec(1), rec(9, 'B', 'y', '')];
    expect(parseBeacons(JSON.parse(JSON.stringify(list)))).toEqual(list);
  });
});

describe('appendBeacon', () => {
  it('appends in order (array order = recency) and keeps the last 200', () => {
    expect(BEACONS.key).toBe('proxima.beacons');
    let list: BeaconRecord[] = [];
    for (let i = 0; i < 205; i++) list = appendBeacon(list, rec(1, `N${i}`));
    expect(list.length).toBe(200);
    expect(list[0]!.name).toBe('N5');
    expect(list[199]!.name).toBe('N204');
  });

  it('does not mutate the input list', () => {
    const list = [rec(1)];
    appendBeacon(list, rec(2));
    expect(list.length).toBe(1);
  });
});

describe('canned beacons', () => {
  const canned = cannedBeacons();
  it('has at least 40 entries, every segment 1-15 covered, >= 3 for each hazard segment, all valid', () => {
    expect(canned.length).toBeGreaterThanOrEqual(40);
    for (let seg = 1; seg <= 15; seg++) expect(canned.some((b) => b.segment === seg), `segment ${seg}`).toBe(true);
    for (const seg of [1, 2, 7, 9, 13, 15]) expect(canned.filter((b) => b.segment === seg).length, `hazard ${seg}`).toBeGreaterThanOrEqual(3);
    for (const b of canned) {
      expect(isValidEpitaph(b.text), b.text).toBe(true);
      expect(b.name.length, b.name).toBeLessThanOrEqual(12);
      expect(b.date < '2184-03-01', b.date).toBe(true);
    }
    expect(new Set(canned.map((b) => b.text)).size).toBe(canned.length);
  });

  it('none for segment 16 (New Willamette)', () => {
    expect(canned.some((b) => b.segment === 16)).toBe(false);
  });
});

describe('beaconsForSegment (beacons.md "Reading")', () => {
  const canned = cannedBeacons();
  const isCanned = (b: BeaconRecord) => canned.some((c) => c.name === b.name && c.text === b.text);

  it('no beacons at New Willamette (16)', () => {
    expect(beaconsForSegment(player(16, 5), 16, createRng(1))).toEqual([]);
  });

  it('no player beacons: up to 2 canned, all for this segment, distinct', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const out = beaconsForSegment([], 7, createRng(seed));
      expect(out.length).toBe(Math.min(2, canned.filter((b) => b.segment === 7).length));
      expect(out.every((b) => b.segment === 7 && isCanned(b))).toBe(true);
      expect(new Set(out.map((b) => b.text)).size).toBe(out.length);
    }
  });

  it('1 player beacon: it comes first, then up to 2 canned (3 total)', () => {
    const out = beaconsForSegment(player(7, 1), 7, createRng(3));
    expect(out.length).toBe(3);
    expect(out[0]!.name).toBe('P0');
    expect(isCanned(out[1]!) && isCanned(out[2]!)).toBe(true);
  });

  it('player beacons are most recent first', () => {
    const out = beaconsForSegment(player(7, 3), 7, createRng(1));
    expect(out.map((b) => b.name)).toEqual(['P2', 'P1', 'P0']);
  });

  it('3 or more player beacons: exactly 3 real, no canned, newest three', () => {
    const out = beaconsForSegment(player(7, 6), 7, createRng(1));
    expect(out.map((b) => b.name)).toEqual(['P5', 'P4', 'P3']);
  });

  it('2 player beacons (fewer than 10 total): 2 real + 1 canned fills the third slot', () => {
    const out = beaconsForSegment(player(7, 2), 7, createRng(1));
    expect(out.length).toBe(3);
    expect(out.slice(0, 2).map((b) => b.name)).toEqual(['P1', 'P0']);
    expect(isCanned(out[2]!)).toBe(true);
  });

  it('10+ player beacons in total: canned fill at most 1 slot', () => {
    const many = [...player(2, 10), ...player(7, 1)]; // 11 in total, 1 here
    for (let seed = 1; seed <= 30; seed++) {
      const out = beaconsForSegment(many, 7, createRng(seed));
      expect(out.length).toBe(2);
      expect(out[0]!.name).toBe('P0');
      expect(isCanned(out[1]!)).toBe(true);
    }
    const none = beaconsForSegment(player(2, 12), 7, createRng(1));
    expect(none.length).toBe(1);
    expect(isCanned(none[0]!)).toBe(true);
  });

  it('boundary: 9 stored beacons still allow 2 canned, 10 allow 1', () => {
    expect(beaconsForSegment(player(2, 9), 7, createRng(1)).length).toBe(2);
    expect(beaconsForSegment(player(2, 10), 7, createRng(1)).length).toBe(1);
  });

  it('never more than 3, and only this segment', () => {
    for (let seg = 1; seg <= 15; seg++) for (const n of [0, 1, 2, 3, 4, 12]) {
      const out = beaconsForSegment(player(seg, n), seg, createRng(seg * 7 + n));
      expect(out.length).toBeLessThanOrEqual(3);
      expect(out.every((b) => b.segment === seg)).toBe(true);
    }
  });

  it('ignores player beacons for other segments', () => {
    const out = beaconsForSegment(player(3, 4), 7, createRng(1));
    expect(out.every(isCanned)).toBe(true);
  });

  it('canned picks use the supplied Rng: same seed, same picks', () => {
    expect(beaconsForSegment([], 9, createRng(5))).toEqual(beaconsForSegment([], 9, createRng(5)));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) seen.add(beaconsForSegment([], 9, createRng(seed)).map((b) => b.text).join('|'));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('accepts a custom canned pool (empty pool -> section omitted)', () => {
    expect(beaconsForSegment([], 7, createRng(1), [])).toEqual([]);
  });
});

describe('formatBeacon', () => {
  it('with captain: Beacon: {name}, of Captain {captain}\'s ship, {date}. "{text}"', () => {
    expect(formatBeacon(rec(1, 'Hester', 'Should have bought the second suit.', 'Silas', '2183-04-11'))).toBe(
      'Beacon: Hester, of Captain Silas\'s ship, 2183-04-11. "Should have bought the second suit."',
    );
  });

  it('empty captain: Beacon: {name}, {date}. "{text}"', () => {
    expect(formatBeacon(rec(1, 'Hester', 'Gone.', '', '2183-04-11'))).toBe('Beacon: Hester, 2183-04-11. "Gone."');
  });

  it('every canned beacon formats within a fit-on-screen length', () => {
    // 12-char name + captain + date + 40-char text + the template words stay well under 140
    for (const b of cannedBeacons()) expect(formatBeacon(b).length, b.name).toBeLessThanOrEqual(140);
    const worst = formatBeacon(rec(1, 'N'.repeat(12), 'x'.repeat(40), 'C'.repeat(12)));
    expect(worst.length).toBeLessThanOrEqual(140);
  });
});
