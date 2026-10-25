import { describe, expect, it } from 'vitest';
import { EVENTS, EVENT_LIST, type EventId } from '@/content';
import { applyEvent, eventStep, eventWeight, illnessWeight } from '@/sim/events';
import { createRng } from '@/sim/rng';
import type { GameState, LogEntry } from '@/sim/types';
import { constRng, ctxAndLog, scriptedRng, travelingState } from './helpers';

const w = (id: EventId, s: GameState): number => eventWeight(EVENTS[id], s, ctxAndLog().ctx);

describe('event weights and conditions (events.md)', () => {
  it('illness weight scales with general health', () => {
    const s = travelingState();
    expect(w('illness', s)).toBe(20);
    s.crew.forEach((c) => (c.health = 60));
    expect(w('illness', s)).toBe(30);
    s.crew.forEach((c) => (c.health = 10));
    expect(w('illness', s)).toBe(40);
    s.crew.forEach((c) => (c.conditions = [
      { id: 'scurvy', remaining: 3, daysActive: 0 }, { id: 'cryo-fever', remaining: 3, daysActive: 0 },
    ]));
    expect(w('illness', s)).toBe(0);
  });

  it('segment gates', () => {
    const s = travelingState({ segment: 2 });
    expect(w('pirates', s)).toBe(0);
    expect(w('derelict', s)).toBe(4);
    expect(w('belter_help', s)).toBe(0);
    s.segment = 5;
    expect(w('pirates', s)).toBe(6);
    expect(w('belter_help', s)).toBe(3);
    s.segment = 10;
    expect(w('belter_help', s)).toBe(0);
  });

  it('weather, gyro, overburn and profession modifiers', () => {
    const s = travelingState({ weather: 'fog' });
    expect(w('lost_lane', s)).toBe(12);
    s.broken.gyro = true;
    expect(w('lost_lane', s)).toBe(24);
    expect(w('gyro_failure', s)).toBe(0);
    s.weather = 'storm';
    expect(w('hull_puncture', s)).toBe(9);
    s.thrust = 'overburn';
    expect(w('drive_failure', s)).toBe(8);
    const e = travelingState({}, 'engineer');
    expect(w('drive_failure', e)).toBe(2);
  });

  it('requirements: drives, parts, two present, lossable, just crossed', () => {
    const s = travelingState({ supplies: { drives: 1 }, offlineDrives: [2] });
    expect(w('drive_stall', s)).toBe(0);
    expect(w('drive_failure', s)).toBe(4);
    s.broken.hull = true;
    s.broken.pump = true;
    expect(w('hull_puncture', s)).toBe(0);
    expect(w('pump_failure', s)).toBe(0);
    s.crew.slice(1).forEach((c) => (c.alive = false));
    expect(w('crew_eva_drift', s)).toBe(0);
    expect(w('cargo_shift', s)).toBe(0);
    s.justCrossedHazard = true;
    expect(w('cargo_shift', s)).toBe(3);
    s.arrivedAt = 1;
    expect(w('cargo_shift', s)).toBe(0);
    s.segment = 4;
    for (const k of ['rations', 'suits', 'charges', 'plates', 'pumps', 'gyros'] as const) s.supplies[k] = 0;
    expect(w('pirates', s)).toBe(0);
  });

  it('cadence guard filters loss events unless Overburn or Paste; never gains or illness', () => {
    const s = travelingState({ day: 10, eventCooldownUntilDay: 12 });
    expect(EVENT_LIST.filter((e) => e.category === 'loss').every((e) => eventWeight(e, s, ctxAndLog().ctx) === 0)).toBe(true);
    expect(w('algae_bloom', s)).toBe(5);
    expect(w('illness', s)).toBe(20);
    s.rations = 'paste';
    expect(w('bad_recycler', s)).toBe(6);
    s.rations = 'half';
    s.thrust = 'overburn';
    expect(w('bad_recycler', s)).toBe(6);
    s.thrust = 'cruise';
    s.day = 12;
    expect(w('bad_recycler', s)).toBe(6);
  });

  it('illness pool modifiers', () => {
    const s = travelingState({ rations: 'paste', day: 5, badRecyclerUntilDay: 6, segment: 10, weather: 'fair' });
    expect(illnessWeight('space-dysentery', 6, s)).toBe(36);
    expect(illnessWeight('hull-mold-fever', 3, s)).toBe(6);
    expect(illnessWeight('scurvy', 4, s)).toBe(0);
    expect(illnessWeight('micrometeorite-puncture', 3, s)).toBe(0);
    expect(illnessWeight('cryo-fever', 4, s)).toBe(4);
    s.crew.forEach((c) => (c.health = 20));
    s.consecutiveLowRations = 10;
    s.weather = 'unsettled';
    expect(illnessWeight('cryo-fever', 4, s)).toBe(8);
    expect(illnessWeight('scurvy', 4, s)).toBe(4);
    expect(illnessWeight('micrometeorite-puncture', 3, s)).toBe(3);
  });
});

describe('event effects', () => {
  const run = (id: EventId, s: GameState, rng = createRng(3)): LogEntry[] => {
    const { ctx, out } = ctxAndLog();
    applyEvent(id, s, rng, ctx, out);
    return out;
  };

  it('pirates and cargo_shift take a percentage and log numbers', () => {
    const s = travelingState({ supplies: { rations: 1000, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 } });
    const out = run('pirates', s, constRng(0));
    expect(s.supplies.rations).toBe(900);
    expect(out[0]!.text).toContain('100');
    run('cargo_shift', s, constRng(0.99));
    expect(s.supplies.rations).toBe(810);
  });

  it('delays, stalls, failures, breakages', () => {
    const s = travelingState({ supplies: { drives: 2 } });
    run('lost_lane', s, constRng(0.99));
    expect(s.delayDays).toBe(3);
    run('drive_stall', s, constRng(0));
    expect(s.offlineDrives).toEqual([1]);
    run('drive_failure', s);
    expect(s.supplies.drives).toBe(1);
    expect(s.offlineDrives).toEqual([1]);
    run('drive_failure', s);
    expect(s.supplies.drives).toBe(0);
    expect(s.offlineDrives).toEqual([]);
    run('hull_puncture', s);
    run('pump_failure', s);
    run('gyro_failure', s);
    expect(s.broken).toEqual({ hull: true, pump: true, gyro: true });
  });

  it('hull fire: rations, a suit, and 10 damage', () => {
    const s = travelingState({ supplies: { rations: 200, suits: 1 } });
    run('hull_fire', s, constRng(0));
    expect(s.supplies.rations).toBe(190);
    expect(s.supplies.suits).toBe(0);
    expect(s.crew[0]!.health).toBe(90);
  });

  it('eva drift: away 1–4 days, or 5% lost for good', () => {
    const s = travelingState();
    run('crew_eva_drift', s, scriptedRng([0, 0.5, 0.99]));
    expect(s.crew[0]!.awayDays).toBe(4);
    run('crew_eva_drift', s, scriptedRng([0, 0.01]));
    expect(s.crew[1]!.alive).toBe(false);
    expect(s.crew[1]!.cause).toBe('drift');
  });

  it('bad recycler hurts everyone and boosts dysentery for 3 days', () => {
    const s = travelingState({ day: 7 });
    run('bad_recycler', s);
    expect(s.crew.every((c) => c.health === 95)).toBe(true);
    expect(s.badRecyclerUntilDay).toBe(10);
  });

  it('gains: algae (Farmer ×1.5), belter help, derelict branches', () => {
    const f = travelingState({ supplies: { rations: 0 } }, 'farmer');
    run('algae_bloom', f, constRng(0.99));
    expect(f.supplies.rations).toBe(90);
    run('belter_help', f, constRng(0));
    expect(f.supplies.rations).toBe(130);
    const s = travelingState({ supplies: { rations: 0, suits: 0, plates: 3, pumps: 3, gyros: 3 } });
    expect(run('derelict', s, constRng(0.1))[0]!.id).toBe('derelict');
    expect(s.supplies.rations).toBe(0);
    run('derelict', s, scriptedRng([0.9, 0.1, 0.0]));
    expect(s.supplies.rations).toBe(20);
    run('derelict', s, scriptedRng([0.9, 0.99, 0.99]));
    expect(s.supplies.suits).toBe(2);
    run('derelict', s, scriptedRng([0.9, 0.6, 0.0, 0.99]));
    expect(s.supplies.rations).toBe(80);
    s.supplies.plates = 0;
    run('derelict', s, scriptedRng([0.9, 0.6, 0.0]));
    expect(s.supplies.plates).toBe(1);
  });

  it('illness: gains a pool condition, or a quiet day when nobody qualifies', () => {
    const s = travelingState();
    const out = run('illness', s, constRng(0));
    expect(out[0]!.kind).toBe('condition');
    expect(s.crew[0]!.conditions[0]!.id).toBe('space-dysentery');
    s.crew.forEach((c) => (c.conditions = [{ id: 'space-dysentery', remaining: 3, daysActive: 0 }]));
    expect(run('illness', s, constRng(0))[0]!.kind).toBe('quiet');
  });
});

describe('eventStep', () => {
  it('fires at most one event, sets the loss cooldown, logs quiet days', () => {
    const s = travelingState({ day: 4 });
    const { ctx, out } = ctxAndLog();
    const id = eventStep(s, scriptedRng([0.01, 0.3]), ctx, out);
    expect(id).not.toBeNull();
    if (EVENTS[id!].category === 'loss') expect(s.eventCooldownUntilDay).toBe(7);
    const quiet: LogEntry[] = [];
    expect(eventStep(s, scriptedRng([0.5, 0.05]), ctxAndLog().ctx, quiet)).toBeNull();
    expect(quiet[0]!.kind).toBe('quiet');
    expect(eventStep(s, scriptedRng([0.1]), ctxAndLog({ rest: true }).ctx, [])).toBeNull();
  });

  it('a loss event starts the cooldown', () => {
    const s = travelingState({ day: 4, rations: 'half' });
    eventStep(s, scriptedRng([0.0, 0.32]), ctxAndLog().ctx, []);
    expect(s.eventCooldownUntilDay).toBe(7);
  });

  it('no present crew → no event', () => {
    const s = travelingState();
    s.crew.forEach((c) => (c.alive = false));
    expect(eventStep(s, constRng(0), ctxAndLog().ctx, [])).toBeNull();
  });
});
