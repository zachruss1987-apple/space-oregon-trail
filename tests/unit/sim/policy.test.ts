import { describe, expect, it } from 'vitest';
import { createGame } from '@/sim/game';
import { policyIntent, policyKit, policyShop, runPolicy } from '@/sim/policy';
import { createRng } from '@/sim/rng';
import { travelingState } from './helpers';

describe('reference policy (travel.md)', () => {
  it('shops the reference kit with rations from the remainder (cap 3,000)', () => {
    const shop = (p: 'executive' | 'engineer' | 'farmer') => policyShop(createGame({ profession: p, window: 1 }, createRng(1)));
    expect(shop('executive').supplies).toEqual({ drives: 3, suits: 10, plates: 1, pumps: 1, gyros: 1, charges: 100, rations: 3000 });
    expect(shop('executive').credits).toBe(440);
    expect(shop('engineer').supplies.rations).toBe(1300); // T-039, decisions.md 2026-10-25: Engineer 650 cr, Farmer 8 suits
    expect(shop('engineer').credits).toBe(0);
    expect(shop('farmer').supplies).toMatchObject({ suits: 8, rations: 533 });
    expect(policyKit('farmer').suits).toBe(8);
  });

  it('chooses repair > rations > thrust > rest > scan > continue', () => {
    const s = travelingState({ rations: 'half', broken: { hull: true, pump: false, gyro: false } });
    expect(policyIntent(s)).toEqual({ type: 'repair', part: 'hull' });
    s.broken.hull = false;
    s.rations = 'full';
    expect(policyIntent(s)).toEqual({ type: 'setRations', rations: 'half' });
    s.rations = 'half';
    s.thrust = 'hard';
    expect(policyIntent(s)).toEqual({ type: 'setThrust', thrust: 'cruise' });
    s.thrust = 'cruise';
    s.crew.forEach((c) => (c.health = 40));
    expect(policyIntent(s)).toEqual({ type: 'rest', days: 1 });
    s.crew.forEach((c) => (c.health = 90));
    s.supplies.rations = 50;
    expect(policyIntent(s)).toEqual({ type: 'setRations', rations: 'paste' });
    s.rations = 'paste';
    expect(policyIntent(s)).toEqual({ type: 'scan' });
    s.supplies.charges = 0;
    expect(policyIntent(s)).toEqual({ type: 'continue' });
  });

  it('runPolicy is deterministic and honours fixed profession/window', () => {
    const a = runPolicy(5, { profession: 'farmer', window: 2 });
    const b = runPolicy(5, { profession: 'farmer', window: 2 });
    expect(a.status).toBe(b.status);
    expect(a.days).toBe(b.days);
    expect(a.profession).toBe('farmer');
    expect(a.window).toBe(2);
  });
});
