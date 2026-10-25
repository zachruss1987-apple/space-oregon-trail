/** Debris Threading logic (minigames.md section 2): rock count, field layout, movement, collisions, result. */
import { describe, expect, it } from 'vitest';
import { THREADING_RUN, WAYPOINTS } from '@/content';
import {
  createThreadingWorld, largestGap, makeRocks, rockCount, rockX, scrollSpeed, severityRolls, shipTouches, stepThreading,
  threadingElapsed, threadingOver, threadingResult, type ThreadingWorld,
} from '@/minigames/threadingLogic';
import { createRng, crossChance, minigameSeed, resultError, type GameState } from '@/sim';
import { travelingState } from '../sim/helpers';

const BELT = 7;
const HZ = 60;
const RK = THREADING_RUN.rocks;

function pending(idx: number, density: number, over: Parameters<typeof travelingState>[0] = {}): GameState {
  return travelingState({ segment: idx + 1, arrivedAt: idx, window: 3, date: '2184-07-01', crossing: { waypoint: idx, density, pilotDaysLeft: null }, ...over });
}

/** A world with no rocks except the ones a test places. */
function emptyWorld(density = 3): ThreadingWorld {
  const w = createThreadingWorld(pending(BELT, density), createRng(1));
  w.rocks = [];
  return w;
}

/** A rock that reaches the ship's x at time `at` (s) at height y. */
function rockAt(w: ThreadingWorld, at: number, y: number, r = 12, id = w.rocks.length + 1): void {
  const travel = THREADING_RUN.field.right + r - THREADING_RUN.shipX;
  w.rocks.push({ id, t: at - travel / w.scroll, y, r, hit: false });
}

const run = (w: ThreadingWorld, seconds: number, dirY = 0): void => {
  for (let i = 0; i < Math.round(seconds * HZ); i++) stepThreading(w, { dirY });
};

describe('rock count and field', () => {
  it('R = clamp(round(T / 3), 4, 32)', () => {
    expect([35, 20, 52, 5, 9, 13, 95, 99].map(rockCount)).toEqual([12, 7, 17, 4, 4, 4, 32, 32]);
  });

  it('builds from the sim incident (crossChance) and today density', () => {
    const s = pending(BELT, 4);
    const w = createThreadingWorld(s, createRng(minigameSeed(s, 'threading')));
    expect(w.incident).toBe(crossChance(s, 'thread'));
    expect(w.rocks).toHaveLength(rockCount(w.incident));
    expect(w.scroll).toBe(scrollSpeed(4));
    expect(w.scroll).toBe(210);
    expect(w.dust).toHaveLength(80);
    const broken = pending(BELT, 5, { broken: { hull: true, pump: false, gyro: true } });
    expect(createThreadingWorld(broken, createRng(1)).rocks.length).toBeGreaterThan(w.rocks.length);
    expect(WAYPOINTS[BELT]!.hazard).toBeTruthy();
  });

  it('is deterministic by seed and differs across seeds', () => {
    const a = makeRocks(20, 3, createRng(42));
    expect(makeRocks(20, 3, createRng(42))).toEqual(a);
    expect(makeRocks(20, 3, createRng(43))).not.toEqual(a);
  });

  it('spreads rocks over 1-24 s with sizes 10 + 2d +- 4; <= 2 per 120 px, gap >= 60 px', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const density = 1 + (seed % 5);
      const rocks = makeRocks(32, density, createRng(seed));
      const windowS = RK.windowPx / scrollSpeed(density);
      for (const [i, k] of rocks.entries()) {
        expect(k.t).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(k.r).toBeGreaterThanOrEqual(10 + 2 * density - 4);
        expect(k.r).toBeLessThanOrEqual(10 + 2 * density + 4);
        const win = rocks.filter((o) => o.t >= k.t - 1e-9 && o.t - k.t < windowS - 1e-9);
        expect(win.length, `seed ${seed} rock ${i}`).toBeLessThanOrEqual(2);
        expect(largestGap(win)).toBeGreaterThanOrEqual(60);
      }
      expect(rocks[0]!.t).toBeLessThan(2);
      expect(rocks.every((k, i) => i === 0 || k.t >= rocks[i - 1]!.t)).toBe(true);
    }
  });

  it('largestGap measures free lane space', () => {
    expect(largestGap([])).toBe(346);
    expect(largestGap([{ y: 200, r: 20 }])).toBe(153);
    expect(largestGap([{ y: 100, r: 20 }, { y: 300, r: 20 }])).toBe(160);
  });
});

describe('movement and collisions', () => {
  it('vertical only, speed capped at 200 px/s, clamped to y 32-368', () => {
    const w = emptyWorld();
    stepThreading(w, { dirY: 1 });
    expect(w.ship.vy).toBeCloseTo(20);
    run(w, 0.5, 1);
    expect(w.ship.vy).toBe(200);
    run(w, 3, 1);
    expect(w.ship.y).toBe(368);
    run(w, 3, -1);
    expect(w.ship.y).toBe(32);
    const touch = emptyWorld();
    for (let i = 0; i < 180; i++) stepThreading(touch, { dirY: 0, target: { x: 300, y: 100 } });
    expect(touch.ship.y).toBeCloseTo(100, 0);
  });

  it('ship hitbox is a 20 x 10 rectangle at x 96', () => {
    expect(shipTouches(200, 96, 200, 1)).toBe(true);
    expect(shipTouches(200, 96 + 10 + 11, 200, 12)).toBe(true);
    expect(shipTouches(200, 96 + 10 + 13, 200, 12)).toBe(false);
    expect(shipTouches(200, 96, 200 + 5 + 13, 12)).toBe(false);
  });

  it('a hit shatters the rock, counts, and grants 1 s of invulnerability', () => {
    const w = emptyWorld();
    rockAt(w, 2, w.ship.y);
    rockAt(w, 2.5, w.ship.y);
    rockAt(w, 4, w.ship.y);
    run(w, 2.2);
    expect(w.hits).toBe(1);
    expect(w.rocks[0]!.hit).toBe(true);
    run(w, 0.6);
    expect(w.hits).toBe(1);
    expect(w.rocks[1]!.hit).toBe(false);
    run(w, 2);
    expect(w.hits).toBe(2);
    expect(rockX(w, w.rocks[1]!)).toBeLessThan(0);
  });

  it('a rock out of the ship lane passes harmlessly', () => {
    const w = emptyWorld();
    rockAt(w, 1, 360);
    run(w, 3);
    expect(w.hits).toBe(0);
  });
});

describe('end and result', () => {
  it('ends at 25 s; hits keep counting past 4 but the sim rolls at most 4; schema max 99', () => {
    const w = emptyWorld();
    run(w, 24.99);
    expect(threadingOver(w)).toBe(false);
    run(w, 0.02);
    expect(threadingOver(w)).toBe(true);
    expect(threadingElapsed(w)).toBeCloseTo(25, 1);
    w.hits = 7;
    expect(threadingResult(w)).toEqual({ kind: 'threading', hits: 7, bonus: null });
    expect(severityRolls(7)).toBe(4);
    expect(severityRolls(2)).toBe(2);
    w.hits = 150;
    expect(threadingResult(w).hits).toBe(99);
    expect(resultError(threadingResult(w), 'threading')).toBeNull();
  });

  it('the bonus survives only on a clean run', () => {
    const w = emptyWorld();
    expect(threadingResult(w, 'rations')).toEqual({ kind: 'threading', hits: 0, bonus: 'rations' });
    w.hits = 1;
    expect(threadingResult(w, 'health').bonus).toBeNull();
  });

  it('an idle full run is deterministic for the same seed', () => {
    const s = pending(BELT, 4);
    const play = () => {
      const w = createThreadingWorld(s, createRng(minigameSeed(s, 'threading')));
      run(w, 25);
      return threadingResult(w);
    };
    expect(play()).toEqual(play());
  });
});

describe('e2e fixture (tests/e2e/threading.spec.ts loads this state)', () => {
  it('Lunar Debris Ring, density 1, window 1, intact, day 10: CLEAN-0 idles clean, CLEAN-1 takes 1 hit', () => {
    const idle = (seed: string) => {
      const s = travelingState({ seed, day: 10, segment: 2, arrivedAt: 1, window: 1, crossing: { waypoint: 1, density: 1, pilotDaysLeft: null } });
      expect(crossChance(s, 'thread')).toBe(20);
      const w = createThreadingWorld(s, createRng(minigameSeed(s, 'threading')));
      while (!threadingOver(w)) stepThreading(w, { dirY: 0 });
      return w.hits;
    };
    expect(idle('CLEAN-0')).toBe(0);
    expect(idle('CLEAN-1')).toBe(1);
  });
});
