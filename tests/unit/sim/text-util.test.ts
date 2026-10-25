import { describe, expect, it } from 'vitest';
import { createRng } from '@/sim/rng';
import { fill, lookupVariants, resolveText } from '@/sim/text';
import {
  addDays, averageHealth, generalHealth, hasRoom, healthLabel, isFlareSeason, pctLoss, workingDrives,
} from '@/sim/util';
import { constRng, travelingState } from './helpers';

describe('text resolver', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(fill('{name} lost {n} {item} {x}', { name: 'Ezra', n: 3, item: 'rations' })).toBe('Ezra lost 3 rations {x}');
  });

  it('finds direct keys, dotted paths, and single strings', () => {
    expect(lookupVariants('events', 'pirates')!.length).toBeGreaterThan(0);
    expect(lookupVariants('ui', 'crossing.clear')!.length).toBeGreaterThan(0);
    expect(lookupVariants('ui', 'title.name')).toEqual(['THE PROXIMA TRAIL']);
    expect(lookupVariants('events', 'nope.nothing')).toBeNull();
    expect(lookupVariants('ui', 'status')).toBeNull();
  });

  it('picks a variant and fills it', () => {
    const t = resolveText(createRng(1), 'events', 'pirates', { n: 212, item: 'rations' });
    expect(t).toContain('212');
    expect(t).not.toContain('{n}');
  });

  it('falls back to the given template, else the key with vars', () => {
    expect(resolveText(createRng(1), 'events', 'missing.key', { n: 2 }, 'got {n}')).toBe('got 2');
    expect(resolveText(createRng(1), 'events', 'missing.key', { n: 2 })).toBe('missing.key (n=2)');
    expect(resolveText(createRng(1), 'events', 'missing.key')).toBe('missing.key');
  });

  it('consumes exactly one draw regardless of variants', () => {
    const a = createRng(5);
    const b = createRng(5);
    resolveText(a, 'events', 'pirates');
    resolveText(b, 'events', 'missing');
    expect(a.next()).toBe(b.next());
  });
});

describe('util', () => {
  it('dates and flare season', () => {
    expect(addDays('2184-02-28', 1)).toBe('2184-02-29');
    expect(addDays('2184-12-31', 1)).toBe('2185-01-01');
    expect(isFlareSeason('2184-09-14')).toBe(false);
    expect(isFlareSeason('2184-09-15')).toBe(true);
  });

  it('health labels and general health', () => {
    expect([100, 75, 74, 50, 49, 25, 24, 0].map(healthLabel)).toEqual(['Good', 'Good', 'Fair', 'Fair', 'Poor', 'Poor', 'Very poor', 'Very poor']);
    const s = travelingState();
    s.crew.forEach((c) => (c.health = 40));
    s.crew[0]!.alive = false;
    s.crew[0]!.health = 0;
    expect(averageHealth(s)).toBe(40);
    expect(generalHealth(s)).toBe('Poor');
    s.crew.forEach((c) => (c.alive = false));
    expect(averageHealth(s)).toBe(0);
  });

  it('pctLoss floors with a minimum of 1', () => {
    expect(pctLoss(0, 50)).toBe(0);
    expect(pctLoss(3, 10)).toBe(1);
    expect(pctLoss(1000, 25)).toBe(250);
  });

  it('working drives and room', () => {
    const s = travelingState({ offlineDrives: [1, 2] });
    expect(workingDrives(s)).toBe(1);
    const c = s.crew[0]!;
    c.conditions = [{ id: 'scurvy', remaining: 2, daysActive: 0 }];
    expect(hasRoom(c, 'scurvy')).toBe(false);
    expect(hasRoom(c, 'cryo-fever')).toBe(true);
    c.conditions.push({ id: 'cryo-fever', remaining: 2, daysActive: 0 });
    expect(hasRoom(c)).toBe(false);
    expect(constRng(0.99).int(1, 10)).toBe(10);
  });
});
