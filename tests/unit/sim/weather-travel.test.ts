import { describe, expect, it } from 'vitest';
import { LATE_ROWS, MID_ROW, WINDOWS } from '@/content';
import { createRng } from '@/sim/rng';
import { daysOfRations, dailyDistance, damageFactor, driveFactor, massFactor, rationNeed, remainingInSegment } from '@/sim/travel';
import { allowedIn, drawWeather, nextWeather, phaseFor, weatherRow } from '@/sim/weather';
import { constRng, scriptedRng, travelingState } from './helpers';

describe('weather Markov chain (travel.md)', () => {
  it('phases by segment', () => {
    expect([1, 5, 6, 13, 14, 16].map(phaseFor)).toEqual(['early', 'early', 'mid', 'mid', 'late', 'late']);
  });

  it('selects rows by window, phase and flare season', () => {
    expect(weatherRow(1, 2, '2184-03-02')).toBe(WINDOWS[1].earlyRow);
    expect(weatherRow(4, 8, '2184-07-01')).toBe(MID_ROW);
    expect(weatherRow(4, 15, '2184-09-14')).toBe(LATE_ROWS.before);
    expect(weatherRow(4, 15, '2184-09-15')).toBe(LATE_ROWS.flareSeason);
  });

  it('keeps today with p = 0.6', () => {
    expect(nextWeather(constRng(0.59), 'storm', 1, 2, '2184-03-02')).toBe('storm');
  });

  it('redraws Flare outside the late phase even when persisting', () => {
    expect(allowedIn('flare', MID_ROW)).toBe(false);
    const w = nextWeather(scriptedRng([0.1, 0.99]), 'flare', 3, 10, '2184-07-01');
    expect(w).not.toBe('flare');
  });

  it('draws from the row otherwise', () => {
    expect(drawWeather(constRng(0), WINDOWS[1].earlyRow)).toBe('calm');
    expect(nextWeather(scriptedRng([0.9, 0.0]), 'storm', 3, 2, '2184-05-02')).toBe('calm');
  });

  it('empirical early-row frequencies approach the weights', () => {
    const rng = createRng(11);
    let storms = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (drawWeather(rng, WINDOWS[1].earlyRow) === 'storm') storms++;
    expect(storms / n).toBeGreaterThan(0.27);
    expect(storms / n).toBeLessThan(0.33);
  });
});

describe('distance and rations (travel.md)', () => {
  it('drive, mass and damage factors', () => {
    expect([0, 1, 2, 3, 4, 9].map(driveFactor)).toEqual([0, 0.6, 0.85, 1.0, 1.1, 1.1]);
    expect(massFactor(1000)).toBe(1);
    expect(massFactor(2000)).toBeCloseTo(0.95);
    expect(massFactor(3000)).toBeCloseTo(0.9);
    expect(massFactor(9000)).toBeCloseTo(0.85);
    const s = travelingState();
    expect(damageFactor(s)).toBe(1);
    s.broken.hull = true;
    expect(damageFactor(s)).toBe(0.5);
    s.broken.pump = true;
    expect(damageFactor(s)).toBe(0);
  });

  it('distance = base × drive × weather × mass × damage', () => {
    const s = travelingState({ thrust: 'hard', weather: 'storm', supplies: { drives: 2, rations: 2000 } });
    expect(dailyDistance(s)).toBeCloseTo(27 * 0.85 * 0.6 * 0.95);
    s.offlineDrives = [1, 1];
    expect(dailyDistance(s)).toBe(0);
  });

  it('remaining in segment', () => {
    const s = travelingState({ segment: 2, distanceInSegment: 80 });
    expect(remainingInSegment(s)).toBe(3);
  });

  it('ration need per present crew; Farmer floor ×0.65 min 1 (T-039, decisions.md 2026-10-25)', () => {
    const s = travelingState();
    expect(rationNeed(s)).toBe(15);
    expect(rationNeed(s, 'paste')).toBe(5);
    s.crew[4]!.awayDays = 2;
    expect(rationNeed(s, 'half')).toBe(8);
    const f = travelingState({}, 'farmer');
    expect(rationNeed(f)).toBe(9);
    f.crew.slice(1).forEach((c) => (c.alive = false));
    expect(rationNeed(f, 'paste')).toBe(1);
    f.crew[0]!.alive = false;
    expect(rationNeed(f)).toBe(0);
    expect(daysOfRations(f)).toBe(Infinity);
    expect(daysOfRations(travelingState({ supplies: { rations: 100 } }))).toBe(6);
  });
});
