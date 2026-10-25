import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { applyAction, intentBlocker } from '@/sim/actions';
import { createRng } from '@/sim/rng';
import { tick } from '@/sim/tick';
import { constRng, travelingState } from './helpers';

describe('tick (travel.md order of operations)', () => {
  it('advances day and date, moves, eats; never mutates its input', () => {
    const s = travelingState({ supplies: { rations: 1000 } });
    const before = JSON.stringify(s);
    const { state, entries } = tick(s, constRng(0.99));
    expect(JSON.stringify(s)).toBe(before);
    expect(state.day).toBe(1);
    expect(state.date).toBe('2184-05-02');
    expect(state.distanceTotal).toBeGreaterThan(0);
    expect(state.supplies.rations).toBe(985);
    expect(Array.isArray(entries)).toBe(true);
  });

  it('does nothing unless traveling', () => {
    const s = travelingState({ status: 'store' });
    expect(tick(s, createRng(1)).state.day).toBe(0);
  });

  it('delay days cost distance', () => {
    const s = travelingState({ delayDays: 1 });
    const r = tick(s, constRng(0.99));
    expect(r.state.distanceTotal).toBe(0);
    expect(r.state.delayDays).toBe(0);
    expect(r.entries.some((e) => e.id === 'delay')).toBe(true);
  });

  it('a broken pump halts the ship', () => {
    const s = travelingState({ broken: { hull: false, pump: true, gyro: false }, supplies: { pumps: 1 } });
    const r = tick(s, constRng(0.99));
    expect(r.state.distanceTotal).toBe(0);
    expect(r.entries.some((e) => e.id === 'stuck')).toBe(true);
  });

  it('starving day logs and hurts; storms wear suits', () => {
    const s = travelingState({ weather: 'storm', supplies: { rations: 3, suits: 1 } });
    const r = tick(s, constRng(0.1));
    expect(r.state.supplies.rations).toBe(0);
    expect(r.entries.some((e) => e.kind === 'starving')).toBe(true);
    expect(r.state.supplies.suits).toBe(0);
  });

  it('stalled drives come back after their days', () => {
    let s = travelingState({ offlineDrives: [2] });
    s = tick(s, constRng(0.99)).state;
    expect(s.offlineDrives).toEqual([1]);
    s = tick(s, constRng(0.99)).state;
    expect(s.offlineDrives).toEqual([]);
  });

  it('arrives at a hazard, rolls the crossing, and the next tick departs', () => {
    const s = travelingState({ distanceInSegment: 101.9 });
    const r = tick(s, constRng(0.99));
    expect(r.state.arrivedAt).toBe(1);
    expect(r.state.segment).toBe(2);
    expect(r.state.distanceInSegment).toBe(0);
    expect(r.state.distanceTotal).toBe(102);
    expect(r.state.justCrossedHazard).toBe(true);
    expect(r.entries.map((e) => e.kind)).toEqual(expect.arrayContaining(['arrival', 'hazard']));
    const next = tick(r.state, constRng(0.99)).state;
    expect(next.arrivedAt).toBeNull();
    expect(next.justCrossedHazard).toBe(false);
  });

  it('arrival at New Willamette ends the run', () => {
    const s = travelingState({ segment: 16, distanceInSegment: 200.5, distanceTotal: 2039.5 });
    const r = tick(s, constRng(0.99));
    expect(r.state.status).toBe('arrived');
    expect(r.state.distanceTotal).toBe(2040);
    expect(r.entries.at(-1)!.kind).toBe('gameover');
  });

  it('all dead → dead; only drifting crew left → they rejoin', () => {
    const s = travelingState();
    s.crew.forEach((c) => (c.health = 1));
    s.supplies.rations = 0;
    expect(tick(s, constRng(0.99)).state.status).toBe('dead');
    const d = travelingState();
    d.crew.slice(1).forEach((c) => (c.alive = false));
    d.crew[0]!.awayDays = 3;
    const r = tick(d, constRng(0.99));
    expect(r.state.crew[0]!.awayDays).toBe(0);
    expect(r.state.status).toBe('traveling');
  });

  it('adrift after 15 stranded days with no drives', () => {
    const s = travelingState({ supplies: { drives: 0 }, strandedDays: 14 });
    const r = tick(s, constRng(0.99));
    expect(r.state.status).toBe('adrift');
    expect(r.entries.at(-1)!.id).toBe('adrift');
  });

  it('overburn counts consecutive moving days and Half/Paste counts low-ration days', () => {
    let s = travelingState({ thrust: 'overburn', rations: 'half' });
    s = tick(s, constRng(0.99)).state;
    s = tick(s, constRng(0.99)).state;
    expect(s.consecutiveOverburn).toBe(2);
    expect(s.consecutiveLowRations).toBe(2);
  });
});

describe('applyAction (intents)', () => {
  it('settings take no day', () => {
    const s = travelingState();
    const a = applyAction(s, { type: 'setThrust', thrust: 'hard' }, createRng(1));
    expect(a.state.thrust).toBe('hard');
    expect(a.state.day).toBe(0);
    const b = applyAction(a.state, { type: 'setRations', rations: 'paste' }, createRng(1));
    expect(b.state.rations).toBe('paste');
    expect(b.entries[0]!.kind).toBe('setting');
  });

  it('continue runs one travel tick', () => {
    expect(applyAction(travelingState(), { type: 'continue' }, createRng(1)).state.day).toBe(1);
  });

  it('rest runs n days at 0 distance with the station bonus, stopping on a death', () => {
    const s = travelingState({ arrivedAt: 3, segment: 4 });
    s.crew.forEach((c) => (c.health = 50));
    const r = applyAction(s, { type: 'rest', days: 3 }, constRng(0.99));
    expect(r.state.day).toBe(3);
    expect(r.state.distanceTotal).toBe(0);
    expect(r.state.crew[0]!.health).toBe(50 + 3 * 8);
    expect(r.state.arrivedAt).toBe(3);
    const dying = travelingState({ supplies: { rations: 0 } });
    dying.crew[0]!.health = 3;
    expect(applyAction(dying, { type: 'rest', days: 9 }, constRng(0.99)).state.day).toBe(1);
  });

  it('refuses invalid intents without spending a day', () => {
    const s = travelingState({ supplies: { charges: 0 } });
    expect(applyAction(s, { type: 'rest', days: 0 }, createRng(1)).error).toMatch(/Rest/);
    expect(applyAction(s, { type: 'rest', days: 10 }, createRng(1)).error).toBeDefined();
    expect(applyAction(s, { type: 'scan' }, createRng(1)).error).toMatch(/charges/);
    expect(applyAction(s, { type: 'repair', part: 'hull' }, createRng(1)).error).toMatch(/Nothing/);
    expect(intentBlocker(travelingState({ arrivedAt: 16 }), { type: 'scan' })).toMatch(/salvage/);
    expect(intentBlocker(travelingState({ status: 'dead' }), { type: 'continue' })).toMatch(/over/);
  });

  it('scan and repair each take one day', () => {
    const s = travelingState({ broken: { hull: true, pump: false, gyro: false } });
    const r = applyAction(s, { type: 'repair', part: 'hull' }, constRng(0.1));
    expect(r.state.day).toBe(1);
    expect(r.state.broken.hull).toBe(false);
    const sc = applyAction(s, { type: 'scan' }, createRng(2));
    expect(sc.state.day).toBe(1);
    expect(sc.state.supplies.charges).toBe(95);
    expect(sc.entries.some((e) => e.kind === 'scan')).toBe(true);
  });

  it('waypoint table is reachable: total Mk equals the final cumulative', () => {
    expect(WAYPOINTS.at(-1)!.cumulative).toBe(2040);
  });
});
