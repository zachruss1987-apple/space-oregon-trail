import { describe, expect, it } from 'vitest';
import {
  causeAtZero, dailyDelta, damageCrew, deathMultiplier, gainCondition, healthStep, isSuited, killCrew, missingStep,
} from '@/sim/health';
import { constRng, ctxAndLog, scriptedRng, travelingState } from './helpers';

describe('daily health delta (health.md)', () => {
  it('sums rations, thrust (moving only), weather, conditions, rest', () => {
    const s = travelingState({ rations: 'paste', thrust: 'overburn', weather: 'storm', supplies: { suits: 0 } });
    const c = s.crew[0]!;
    c.conditions = [{ id: 'cryo-fever', remaining: 5, daysActive: 0 }];
    expect(dailyDelta(s, c, ctxAndLog({ moving: true }).ctx)).toBe(-2 - 5 - 3 - 3);
    expect(dailyDelta(s, c, ctxAndLog({ moving: false, rest: true }).ctx)).toBe(-2 - 3 - 3 + 3);
    expect(dailyDelta(s, c, ctxAndLog({ rest: true, atStation: true, starving: true }).ctx)).toBe(-10 - 3 - 3 + 6);
  });

  it('suits are assigned in roster order to present crew', () => {
    const s = travelingState({ weather: 'flare', supplies: { suits: 2 } });
    s.crew[0]!.awayDays = 1;
    expect(s.crew.map((c) => isSuited(s, c))).toEqual([false, true, true, false, false]);
    expect(dailyDelta(s, s.crew[1]!, ctxAndLog().ctx)).toBe(2 - 2);
    expect(dailyDelta(s, s.crew[3]!, ctxAndLog().ctx)).toBe(2 - 5);
  });

  it('death multiplier bands', () => {
    expect([100, 75, 74, 50, 49, 25, 24, 0].map(deathMultiplier)).toEqual([0.5, 0.5, 1, 1, 1.5, 1.5, 2, 2]);
  });
});

describe('deaths and causes', () => {
  it('cause at zero: worst condition with table-order ties, else starvation, else exhaustion', () => {
    const c = travelingState().crew[0]!;
    expect(causeAtZero(c, false)).toBe('exhaustion');
    expect(causeAtZero(c, true)).toBe('starvation');
    c.conditions = [
      { id: 'micrometeorite-puncture', remaining: 2, daysActive: 0 },
      { id: 'hull-mold-fever', remaining: 2, daysActive: 0 },
    ];
    expect(causeAtZero(c, true)).toBe('hull-mold-fever');
  });

  it('health reaching 0 kills and logs a death', () => {
    const s = travelingState({ rations: 'paste' });
    const c = s.crew[2]!;
    c.health = 1;
    c.conditions = [{ id: 'space-dysentery', remaining: 5, daysActive: 0 }];
    const { ctx, out } = ctxAndLog({ starving: true });
    healthStep(s, constRng(0.99), ctx, out);
    expect(c.alive).toBe(false);
    expect(c.cause).toBe('space-dysentery');
    expect(s.deaths).toBe(1);
    expect(out.some((e) => e.kind === 'death' && e.id === 'space-dysentery')).toBe(true);
    killCrew(s, c, 'hazard', constRng(0.5), out);
    expect(s.deaths).toBe(1);
  });

  it('condition death roll × health multiplier', () => {
    const s = travelingState();
    const c = s.crew[0]!;
    c.health = 60;
    c.conditions = [{ id: 'hull-mold-fever', remaining: 5, daysActive: 1 }];
    const { ctx, out } = ctxAndLog();
    healthStep(s, scriptedRng([0.01]), ctx, out);
    expect(c.alive).toBe(false);
    expect(c.cause).toBe('hull-mold-fever');
  });

  it('puncture: 4% (1% suited) on the first 2 days only', () => {
    const s = travelingState({ supplies: { suits: 0 } });
    const c = s.crew[0]!;
    c.conditions = [{ id: 'micrometeorite-puncture', remaining: 5, daysActive: 2 }];
    const { ctx, out } = ctxAndLog();
    healthStep(s, constRng(0), ctx, out);
    expect(c.alive).toBe(true);
    const s2 = travelingState({ supplies: { suits: 10 } });
    const c2 = s2.crew[0]!;
    c2.health = 60;
    c2.conditions = [{ id: 'micrometeorite-puncture', remaining: 5, daysActive: 0 }];
    healthStep(s2, scriptedRng([0.015]), ctxAndLog().ctx, []);
    expect(c2.alive).toBe(true);
    c2.health = 60;
    healthStep(s2, scriptedRng([0.005]), ctxAndLog().ctx, []);
    expect(c2.alive).toBe(false);
  });

  it('event damage kills with a given or derived cause', () => {
    const s = travelingState();
    const out: never[] = [];
    s.crew[0]!.health = 5;
    damageCrew(s, s.crew[0]!, 10, 'hull_fire', constRng(0.5), out);
    expect(s.crew[0]!.cause).toBe('hull_fire');
    s.crew[1]!.health = 5;
    damageCrew(s, s.crew[1]!, 10, null, constRng(0.5), out);
    expect(s.crew[1]!.cause).toBe('exhaustion');
  });
});

describe('triggers and progression', () => {
  it('radiation sickness: storm day, unsuited, 15%', () => {
    const s = travelingState({ weather: 'storm', supplies: { suits: 4 } });
    const { ctx, out } = ctxAndLog();
    healthStep(s, constRng(0.1), ctx, out);
    expect(s.crew[4]!.conditions.map((c) => c.id)).toEqual(['radiation-sickness']);
    expect(s.crew[0]!.conditions).toHaveLength(0);
    expect(s.crew[4]!.conditions[0]!.remaining).toBeGreaterThanOrEqual(5);
  });

  it('exhaustion on the 5th Overburn moving day; clears after 2 off days', () => {
    const s = travelingState({ thrust: 'overburn', consecutiveOverburn: 5 });
    healthStep(s, constRng(0.9), ctxAndLog({ moving: true, overburnDay: true }).ctx, []);
    expect(s.crew.every((c) => c.conditions[0]?.id === 'exhaustion')).toBe(true);
    healthStep(s, constRng(0.9), ctxAndLog({ moving: true, overburnDay: true }).ctx, []);
    expect(s.crew[0]!.conditions[0]!.remaining).toBe(2);
    healthStep(s, constRng(0.9), ctxAndLog({ rest: true }).ctx, []);
    expect(s.crew[0]!.conditions[0]!.remaining).toBe(1);
    const out: { kind: string }[] = [];
    healthStep(s, constRng(0.9), ctxAndLog().ctx, out as never);
    expect(s.crew[0]!.conditions).toHaveLength(0);
    expect(out.some((e) => e.kind === 'recover')).toBe(true);
  });

  it('rest ticks durations by 2; scurvy capped at 3 on Full; one new condition per day', () => {
    const s = travelingState({ rations: 'full' });
    const c = s.crew[0]!;
    c.conditions = [{ id: 'scurvy', remaining: 10, daysActive: 0 }, { id: 'cryo-fever', remaining: 10, daysActive: 0 }];
    healthStep(s, constRng(0.9), ctxAndLog({ rest: true }).ctx, []);
    expect(c.conditions.map((x) => x.remaining)).toEqual([3, 8]);
    const { ctx, out } = ctxAndLog();
    const d = s.crew[1]!;
    expect(gainCondition(s, d, 'scurvy', constRng(0), ctx, out)).toBe(true);
    expect(gainCondition(s, d, 'cryo-fever', constRng(0), ctx, out)).toBe(false);
    d.awayDays = 1;
    expect(gainCondition(s, d, 'cryo-fever', constRng(0), ctxAndLog().ctx, out)).toBe(false);
  });

  it('missing crew count down and rejoin; absent crew take no health change', () => {
    const s = travelingState({ rations: 'paste' });
    s.crew[1]!.awayDays = 2;
    s.crew[1]!.health = 50;
    healthStep(s, constRng(0.9), ctxAndLog().ctx, []);
    expect(s.crew[1]!.health).toBe(50);
    const out: { kind: string }[] = [];
    missingStep(s, constRng(0.9), out as never);
    expect(s.crew[1]!.awayDays).toBe(1);
    missingStep(s, constRng(0.9), out as never);
    expect(s.crew[1]!.awayDays).toBe(0);
    expect(out.map((e) => e.kind)).toEqual(['rejoin']);
  });
});
