import { describe, expect, it } from 'vitest';
import { WAYPOINTS } from '@/content';
import { newDayContext } from '@/sim/health';
import { incidentChance, outcomeFor, resolveCrossing, severityBonus } from '@/sim/hazard';
import { brokenParts, passingHelp, repairBlocker, repairChance, resolveRepair } from '@/sim/repair';
import { canScan, resolveScan, supplyLabel } from '@/sim/salvage';
import type { LogEntry } from '@/sim/types';
import { constRng, scriptedRng, travelingState } from './helpers';

describe('hazard crossing (trail.md)', () => {
  it('incident chance with spring tides and flare season', () => {
    const s = travelingState({}, 'executive', 1);
    expect(incidentChance(s, WAYPOINTS[1]!)).toBe(25);
    expect(incidentChance(s, WAYPOINTS[7]!)).toBe(35);
    expect(incidentChance(travelingState({}, 'executive', 2), WAYPOINTS[2]!)).toBe(20);
    s.date = '2184-09-15';
    expect(incidentChance(s, WAYPOINTS[15]!)).toBe(60);
    expect(incidentChance(s, WAYPOINTS[3]!)).toBe(0);
  });

  it('severity bonus: density ≥ 4 (+5), Flare Belt in season (+10)', () => {
    const s = travelingState({ date: '2184-09-20' });
    expect(severityBonus(s, WAYPOINTS[1]!)).toBe(0);
    expect(severityBonus(s, WAYPOINTS[7]!)).toBe(5);
    expect(severityBonus(s, WAYPOINTS[15]!)).toBe(15);
  });

  it('severity bands', () => {
    expect([1, 40, 41, 70, 71, 85, 86, 95, 96, 100].map(outcomeFor)).toEqual(
      ['scraped', 'scraped', 'cargo', 'cargo', 'damage', 'damage', 'injury', 'injury', 'lost', 'lost'],
    );
  });

  it('clear crossing sets the just-crossed flag', () => {
    const s = travelingState();
    const out: LogEntry[] = [];
    expect(resolveCrossing(s, 1, constRng(0.99), out)).toBe('clear');
    expect(s.justCrossedHazard).toBe(true);
    expect(out[0]!.kind).toBe('hazard');
  });

  it('scraped → delay day; cargo → 10–25% loss; damage → a broken part', () => {
    const s = travelingState({ supplies: { rations: 1000, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 } });
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.1]), [])).toBe('scraped');
    expect(s.delayDays).toBe(1);
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.5, 0, 0]), [])).toBe('cargo');
    expect(s.supplies.rations).toBe(900);
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.75, 0.1]), [])).toBe('damage');
    expect(s.broken.hull).toBe(true);
    const empty = travelingState({ supplies: { rations: 0, suits: 0, charges: 0, plates: 0, pumps: 0, gyros: 0 } });
    expect(resolveCrossing(empty, 1, scriptedRng([0, 0.5]), [])).toBe('clear');
  });

  it('injury → decompression, or −15 with no room; lost → death (hazard)', () => {
    const s = travelingState();
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.9, 0]), [])).toBe('injury');
    expect(s.crew[0]!.conditions[0]!.id).toBe('decompression-injury');
    s.crew[0]!.conditions.push({ id: 'scurvy', remaining: 3, daysActive: 0 });
    resolveCrossing(s, 1, scriptedRng([0, 0.9, 0]), [], newDayContext());
    expect(s.crew[0]!.health).toBe(85);
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.99, 0.99]), [])).toBe('lost');
    expect(s.crew[4]!.cause).toBe('hazard');
    s.crew.forEach((c) => (c.alive = false));
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.9]), [])).toBe('injury');
    expect(resolveCrossing(s, 1, scriptedRng([0, 0.99]), [])).toBe('lost');
  });
});

describe('scan for salvage (travel.md)', () => {
  it('d100 bands and charge cost', () => {
    const s = travelingState({ supplies: { rations: 0, charges: 25, plates: 0 } });
    expect(canScan(s)).toBe(true);
    expect(resolveScan(s, scriptedRng([0.1]), [])).toBe(0);
    expect(s.supplies.charges).toBe(20);
    expect(resolveScan(s, scriptedRng([0.5, 0]), [])).toBe(15);
    expect(resolveScan(s, scriptedRng([0.9, 0.99]), [])).toBe(40);
    expect(s.scansThisSegment).toBe(3);
    s.scansThisSegment = 0;
    expect(resolveScan(s, scriptedRng([0.99, 0]), [])).toBe(0);
    expect(s.supplies.plates).toBe(1);
    s.supplies.pumps = 3;
    expect(resolveScan(s, scriptedRng([0.99, 0.5, 0]), [])).toBe(40);
    expect(canScan(s)).toBe(false);
  });

  it('labels', () => {
    expect(supplyLabel('suits')).toBe('EVA suits');
    expect(supplyLabel('charges')).toBe('drone charges');
  });
});

describe('repairs and passing help (travel.md)', () => {
  it('blockers and chance (decompression −10)', () => {
    const s = travelingState({ supplies: { plates: 0 } });
    expect(repairBlocker(s, 'hull')).toBe('Nothing is broken.');
    s.broken.hull = true;
    expect(repairBlocker(s, 'hull')).toBe('No spare.');
    s.supplies.plates = 1;
    expect(repairBlocker(s, 'hull')).toBeNull();
    expect(repairChance(s)).toBeCloseTo(0.8);
    s.crew[2]!.conditions = [{ id: 'decompression-injury', remaining: 5, daysActive: 0 }];
    expect(repairChance(s)).toBeCloseTo(0.7);
    expect(repairChance(travelingState({}, 'engineer'))).toBeCloseTo(0.95);
  });

  it('success consumes a spare; failure loses it 30% (Engineer 10%)', () => {
    const s = travelingState({ broken: { hull: true, pump: false, gyro: false }, supplies: { plates: 2 } });
    expect(resolveRepair(s, 'hull', scriptedRng([0.9, 0.9]), [])).toBe(false);
    expect(s.supplies.plates).toBe(2);
    expect(resolveRepair(s, 'hull', scriptedRng([0.9, 0.1]), [])).toBe(false);
    expect(s.supplies.plates).toBe(1);
    expect(resolveRepair(s, 'hull', scriptedRng([0.1]), [])).toBe(true);
    expect(s.supplies.plates).toBe(0);
    expect(s.broken.hull).toBe(false);
    const e = travelingState({ broken: { hull: false, pump: true, gyro: false }, supplies: { pumps: 1 } }, 'engineer');
    resolveRepair(e, 'pump', scriptedRng([0.99, 0.2]), []);
    expect(e.supplies.pumps).toBe(1);
  });

  it('passing help fixes pump first among parts with no spare; strands count; a drive resets them', () => {
    const s = travelingState({ broken: { hull: true, pump: true, gyro: true }, supplies: { pumps: 0, plates: 0, gyros: 1 } });
    expect(brokenParts(s)).toEqual(['pump', 'hull', 'gyro']);
    passingHelp(s, constRng(0.05), []);
    expect(s.broken).toEqual({ hull: true, pump: false, gyro: true });
    const t = travelingState({ supplies: { drives: 0 }, strandedDays: 3 });
    passingHelp(t, constRng(0.5), []);
    expect(t.strandedDays).toBe(4);
    passingHelp(t, constRng(0.05), []);
    expect(t.supplies.drives).toBe(1);
    expect(t.strandedDays).toBe(0);
  });
});
