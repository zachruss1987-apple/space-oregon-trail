/** docs/design/trail.md: the Lane's waypoints, hazard parameters, and the M1 crossing roll. (hazards.md is still a stub.) */
import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { createRng, tick, type GameState, type LogEntry } from '@/sim';
import { allHealth, expectRate, isQuiet, ship } from './spec-helpers';

/** trail.md table: [name, type, Mk from previous, cumulative]. */
const TRAIL: [string, string, number, number][] = [
  ['Independence Station', 'start', 0, 0],
  ['Lunar Debris Ring', 'hazard', 102, 102],
  ['Lagrange Shoals', 'hazard', 83, 185],
  ['Mars Relay', 'station', 119, 304],
  ['Ceres Approach Spire', 'landmark', 250, 554],
  ['Ceres Depot', 'station', 86, 640],
  ['Jupiter\'s Eye', 'landmark', 190, 830],
  ['The Belt Crossing', 'hazard', 102, 932],
  ['Europa Outpost', 'station', 57, 989],
  ['Saturn Ring Plane', 'hazard', 162, 1151],
  ['Titan Refinery', 'station', 57, 1208],
  ['Kuiper Gate', 'gate', 182, 1390],
  ['Oort Beacon', 'station', 114, 1504],
  ['Proxima Heliopause Shock', 'hazard', 160, 1664],
  ['Lane Terminus Station', 'station', 55, 1719],
  ['The Flare Belt', 'hazard', 120, 1839],
  ['New Willamette', 'end', 201, 2040],
];
/** trail.md hazard parameters: index -> [density, baseline incident %, tug price, pilot wait]. */
const HAZ: Record<number, [number, number, number, number | null]> = {
  1: [2, 15, 25, 2], 2: [2, 15, 35, 2], 7: [4, 35, 80, 4], 9: [3, 25, 60, 3], 13: [4, 35, 90, 4], 15: [5, 45, 120, null],
};

describe('The trail (trail.md table)', () => {
  it('has 17 waypoints in 16 segments totalling 2,040 Mk', () => {
    expect(WAYPOINTS).toHaveLength(17);
    expect(WAYPOINTS[16]!.cumulative).toBe(2040);
    expect(WAYPOINTS.reduce((a, w) => a + w.mk, 0)).toBe(2040);
  });

  it.each(TRAIL.map((r, i) => [i, ...r] as const))('waypoint %i %s is a %s, %i Mk from the previous, cumulative %i', (i, name, type, mk, cum) => {
    const w = WAYPOINTS[i]!;
    expect(w.name).toBe(name);
    expect(w.type).toBe(type);
    expect(w.mk).toBe(mk);
    expect(w.cumulative).toBe(cum);
    expect(TRAIL.slice(0, i + 1).reduce((a, r) => a + r[2], 0)).toBe(cum);
  });

  it.each(Object.entries(HAZ).map(([i, v]) => [Number(i), ...v] as const))('hazard %i: density %i, incident %i%%, tug %i cr, pilot wait %s', (i, density, incident, tug, pilot) => {
    const h = WAYPOINTS[i]!.hazard!;
    expect(h.density).toBe(density);
    expect(h.incident).toBe(incident);
    expect(h.tugPrice).toBe(tug);
    expect(h.pilotWait).toBe(pilot);
  });

  it('only the six hazard waypoints carry hazard parameters', () => {
    expect(WAYPOINTS.filter((w) => w.hazard).map((w) => w.index)).toEqual([1, 2, 7, 9, 13, 15]);
  });

  it('M1 takes the default path via Oort Beacon (it is waypoint 12, between the Gate and the Heliopause)', () => {
    expect(WAYPOINTS[11]!.name).toBe('Kuiper Gate');
    expect(WAYPOINTS[12]!.name).toBe('Oort Beacon');
    expect(WAYPOINTS[13]!.name).toBe('Proxima Heliopause Shock');
  });
});

/** Arrive at waypoint `idx` on the next tick. */
function arrivalState(idx: number, over: Partial<GameState> = {}, health = 100): GameState {
  const w = WAYPOINTS[idx]!;
  return allHealth(ship({
    segment: idx, distanceInSegment: w.mk - 0.05, distanceTotal: w.cumulative - 0.05, rations: 'half',
    supplies: { rations: 1000, suits: 20, charges: 200, plates: 3, pumps: 3, gyros: 3, drives: 3 }, ...over,
  }), health);
}
const hazardEntry = (es: readonly LogEntry[]): string | undefined => es.find((e) => e.kind === 'hazard')?.id;
const arrived = (es: readonly LogEntry[]): boolean => es.some((e) => e.kind === 'arrival');

/** Cross hazard `idx` n times, return outcomes. */
function crossings(s: GameState, n: number) {
  const out: { id: string; r: ReturnType<typeof tick>; seed: number }[] = [];
  for (let seed = 1; seed <= n; seed++) {
    const r = tick(s, createRng(seed * 19 + 3));
    if (!arrived(r.entries)) continue;
    out.push({ id: hazardEntry(r.entries) ?? 'none', r, seed });
  }
  return out;
}

describe('Incident chance (trail.md "M1 crossing roll" step 1)', () => {
  const rate = (idx: number, windowId: 1 | 2 | 3 | 4 | 5, date: string, n = 3000): { k: number; n: number } => {
    const res = crossings(arrivalState(idx, { window: windowId, date }), n);
    return { k: res.filter((c) => c.id !== 'clear').length, n: res.length };
  };

  it.each([
    [1, 3, '2184-05-10', 15], [2, 3, '2184-05-10', 15], [7, 3, '2184-07-01', 35], [9, 3, '2184-07-20', 25],
    [13, 3, '2184-08-10', 35], [15, 3, '2184-08-20', 45],
  ] as const)('hazard %i (window %i): baseline %i%%', (idx, w, date, pct) => {
    const r = rate(idx, w, date);
    expectRate(r.k, r.n, pct / 100, 4, `incident at ${idx}`);
  });

  it.each([[1, 25], [2, 25]])('Window 1 spring tides: +10 at waypoint %i (-> %i%%)', (idx, pct) => {
    const r = rate(idx, 1, '2184-03-10');
    expectRate(r.k, r.n, pct / 100, 4, 'w1');
  });

  it.each([[1, 20], [2, 20]])('Window 2 spring tides: +5 at waypoint %i (-> %i%%)', (idx, pct) => {
    const r = rate(idx, 2, '2184-04-10');
    expectRate(r.k, r.n, pct / 100, 4, 'w2');
  });

  it('Window 1 gets no bonus at the Belt Crossing (the bonus applies to the first two hazards only)', () => {
    const r = rate(7, 1, '2184-05-20');
    expectRate(r.k, r.n, 0.35, 4, 'belt w1');
  });

  it('The Flare Belt in flare season: +15 (-> 60%)', () => {
    const r = rate(15, 3, '2184-09-20');
    expectRate(r.k, r.n, 0.6, 4, 'flare belt flare season');
  });

  it('The Flare Belt just before flare season (14 Sep) has no bonus; arriving on the 15th does', () => {
    const before = rate(15, 3, '2184-09-12'); // tick makes it the 13th
    expectRate(before.k, before.n, 0.45, 4, 'flare belt before');
    const on = rate(15, 3, '2184-09-14'); // tick makes it the 15th
    expectRate(on.k, on.n, 0.6, 4, 'flare belt on 15 Sep');
  });
});

describe('Severity bands (trail.md severity table)', () => {
  const shares = (idx: number, date: string, n: number) => {
    const res = crossings(arrivalState(idx, { date, window: 5 }), n).filter((c) => c.id !== 'clear' && c.id !== 'none');
    const count: Record<string, number> = {};
    for (const c of res) count[c.id] = (count[c.id] ?? 0) + 1;
    return { count, total: res.length };
  };

  it('density 2 (Lunar Debris Ring, window 5): scraped 40% / cargo 30% / damage 15% / injury 10% / lost 5%', () => {
    const { count, total } = shares(1, '2184-07-10', 26000);
    expect(total).toBeGreaterThan(3000);
    expectRate(count['scraped'] ?? 0, total, 0.4, 4, 'scraped');
    expectRate(count['cargo'] ?? 0, total, 0.3, 4, 'cargo');
    expectRate(count['damage'] ?? 0, total, 0.15, 4, 'damage');
    expectRate(count['injury'] ?? 0, total, 0.1, 4, 'injury');
    expectRate(count['lost'] ?? 0, total, 0.05, 4, 'lost');
  });

  it('density >= 4 adds +5 severity (Belt Crossing): 35 / 30 / 15 / 10 / 10', () => {
    const { count, total } = shares(7, '2184-08-01', 9000);
    expect(total).toBeGreaterThan(2500);
    expectRate(count['scraped'] ?? 0, total, 0.35, 4, 'scraped');
    expectRate(count['cargo'] ?? 0, total, 0.3, 4, 'cargo');
    expectRate(count['damage'] ?? 0, total, 0.15, 4, 'damage');
    expectRate(count['injury'] ?? 0, total, 0.1, 4, 'injury');
    expectRate(count['lost'] ?? 0, total, 0.1, 4, 'lost');
  });

  it('Flare Belt in flare season adds +5 (density) +10 (season): 25 / 30 / 15 / 10 / 20', () => {
    const { count, total } = shares(15, '2184-09-20', 7000);
    expect(total).toBeGreaterThan(3000);
    expectRate(count['scraped'] ?? 0, total, 0.25, 4, 'scraped');
    expectRate(count['cargo'] ?? 0, total, 0.3, 4, 'cargo');
    expectRate(count['damage'] ?? 0, total, 0.15, 4, 'damage');
    expectRate(count['injury'] ?? 0, total, 0.1, 4, 'injury');
    expectRate(count['lost'] ?? 0, total, 0.2, 4, 'lost');
  });
});

describe('Outcome effects (trail.md)', () => {
  const noise = (es: readonly LogEntry[]): boolean => isQuiet(es, ['arrival', 'hazard', 'death', 'condition']) && !es.some((e) => (e.kind === 'death' && e.id !== 'hazard') || (e.kind === 'condition' && e.id !== 'decompression-injury'));
  const outcomes = (idx: number, id: string, want: number, n = 30000, date = '2184-08-01', health = 100) => {
    const out: ReturnType<typeof crossings> = [];
    const s = arrivalState(idx, { date, window: 5 }, health);
    for (let seed = 1; seed <= n && out.length < want; seed++) {
      const r = tick(s, createRng(seed * 23 + 1));
      if (arrived(r.entries) && hazardEntry(r.entries) === id && noise(r.entries)) out.push({ id, r, seed });
    }
    return { out, s };
  };

  it('every hazard arrival sets arrivedAt, advances the segment and flags a just-crossed hazard', () => {
    for (const [idx] of Object.entries(HAZ)) {
      const i = Number(idx);
      const r = tick(arrivalState(i), createRng(5)).state;
      expect(r.arrivedAt).toBe(i);
      expect(r.segment).toBe(i + 1);
      expect(r.justCrossedHazard).toBe(true);
      expect(r.distanceTotal).toBe(WAYPOINTS[i]!.cumulative);
    }
  });

  it('every hazard arrival logs exactly one crossing outcome', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = tick(arrivalState(7), createRng(seed));
      expect(r.entries.filter((e) => e.kind === 'hazard')).toHaveLength(1);
      expect(['clear', 'scraped', 'cargo', 'damage', 'injury', 'lost']).toContain(hazardEntry(r.entries));
    }
  });

  it.each([3, 4, 11, 12, 14])('stations, landmarks and the gate (waypoint %i) have no crossing roll', (idx) => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = tick(arrivalState(idx), createRng(seed));
      expect(arrived(r.entries)).toBe(true);
      expect(hazardEntry(r.entries)).toBeUndefined();
      expect(r.state.justCrossedHazard).toBe(false);
    }
  });

  it('clear crossing: "You made it across." - nothing is lost and no delay follows', () => {
    const { out, s } = outcomes(1, 'clear', 40);
    for (const { r } of out) {
      expect(r.state.delayDays).toBe(0);
      expect(r.state.crew.every((c) => c.alive && c.conditions.length === 0)).toBe(true);
      expect(r.state.broken).toEqual(s.broken);
    }
  });

  it('scraped through: the next tick is a delay day', () => {
    const { out } = outcomes(7, 'scraped', 30);
    expect(out.length).toBe(30);
    for (const { r } of out) expect(r.state.delayDays).toBe(1);
  });

  it('cargo loss: one stocked type loses 10-25% (min 1)', () => {
    const { out, s } = outcomes(7, 'cargo', 120);
    expect(out.length).toBe(120);
    const need = 10; // half rations, five crew
    const before: Record<string, number> = { rations: s.supplies.rations - need, suits: 20, charges: 200, plates: 3, pumps: 3, gyros: 3 };
    const hit = new Set<string>();
    for (const { r } of out) {
      const lost = Object.keys(before).filter((k) => (r.state.supplies as Record<string, number>)[k]! < before[k]!);
      expect(lost).toHaveLength(1);
      const k = lost[0]!;
      hit.add(k);
      const loss = before[k]! - (r.state.supplies as Record<string, number>)[k]!;
      const slack = k === 'rations' ? 2 : 0;
      expect(loss).toBeGreaterThanOrEqual(Math.max(1, Math.floor(before[k]! * 0.1)) - slack);
      expect(loss).toBeLessThanOrEqual(Math.max(1, Math.floor(before[k]! * 0.25)) + slack);
    }
    expect(hit.size).toBeGreaterThanOrEqual(5);
  });

  it('cargo loss with an empty hold is not an error (the crossing counts as clear)', () => {
    const s = arrivalState(7, { supplies: { rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0, drives: 3 } });
    for (let seed = 1; seed <= 500; seed++) expect(() => tick(s, createRng(seed))).not.toThrow();
  });

  it('damage: hull plate 50%, coolant pump 25%, nav gyro 25%', () => {
    const { out } = outcomes(7, 'damage', 400, 60000);
    expect(out.length).toBeGreaterThan(300);
    const c = { hull: 0, pump: 0, gyro: 0 };
    for (const { r } of out) {
      const parts = (['hull', 'pump', 'gyro'] as const).filter((p) => r.state.broken[p]);
      expect(parts).toHaveLength(1);
      c[parts[0]!]++;
    }
    expectRate(c.hull, out.length, 0.5, 4, 'hull');
    expectRate(c.pump, out.length, 0.25, 4, 'pump');
    expectRate(c.gyro, out.length, 0.25, 4, 'gyro');
  });

  it('injury: a random present crew member gains a decompression injury (10-20 days)', () => {
    const { out } = outcomes(7, 'injury', 150, 60000);
    expect(out.length).toBeGreaterThan(100);
    const victims = new Set<number>();
    for (const { r } of out) {
      const hurt = r.state.crew.map((c, i) => [c, i] as const).filter(([c]) => c.conditions.some((x) => x.id === 'decompression-injury'));
      expect(hurt).toHaveLength(1);
      victims.add(hurt[0]![1]);
      const x = hurt[0]![0].conditions.find((y) => y.id === 'decompression-injury')!;
      expect(x.remaining).toBeGreaterThanOrEqual(10);
      expect(x.remaining).toBeLessThanOrEqual(20);
    }
    expect(victims.size).toBe(5);
  });

  it('injury with no room for a condition does -15 health instead', () => {
    const twoEach = (s: GameState): GameState => ({
      ...s,
      crew: s.crew.map((c) => ({ ...c, conditions: [{ id: 'cryo-fever' as const, remaining: 12, daysActive: 1 }, { id: 'scurvy' as const, remaining: 12, daysActive: 1 }] })),
    });
    const s = twoEach(arrivalState(7, { date: '2184-08-01', window: 5 }));
    let seen = 0;
    for (let seed = 1; seed <= 60000 && seen < 20; seed++) {
      const r = tick(s, createRng(seed * 3 + 1));
      if (!arrived(r.entries) || hazardEntry(r.entries) !== 'injury' || r.entries.some((e) => e.kind === 'death' || e.kind === 'event')) continue;
      seen++;
      expect(r.state.crew.some((c) => c.conditions.some((x) => x.id === 'decompression-injury'))).toBe(false);
      expect(r.state.crew.filter((c) => c.health <= 85)).toHaveLength(1);
    }
    expect(seen).toBe(20);
  });

  it('lost: a random present crew member dies (cause hazard)', () => {
    const { out } = outcomes(7, 'lost', 80, 90000);
    expect(out.length).toBeGreaterThan(60);
    for (const { r } of out) {
      const dead = r.state.crew.filter((c) => !c.alive);
      expect(dead).toHaveLength(1);
      expect(dead[0]!.cause).toBe('hazard');
      expect(r.state.deaths).toBe(1);
    }
  });
});
