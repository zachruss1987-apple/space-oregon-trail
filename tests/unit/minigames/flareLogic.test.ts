/** Flare Belt Finale logic (minigames.md section 3): arc schedule, geometry, safe gaps, movement, hits, crash. */
import { describe, expect, it } from 'vitest';
import { FLARE_RUN } from '@/content';
import {
  arcPhase, arcTimes, createFlareWorld, distToArc, flareElapsed, flareOver, flareParams, flareResult, hasSafeGap, makeArcs,
  stepFlare, type Arc, type FlareWorld,
} from '@/minigames/flareLogic';
import { createRng, resultError } from '@/sim';

const HZ = 60;
const NORMAL = { date: '2184-07-01', weather: 'fair' } as const;
const SEASON = { date: '2184-09-20', weather: 'fair' } as const;
const F = FLARE_RUN.field;

/** A horizontal arc through y at telegraph start t0. */
const line = (id: number, t0: number, y: number): Arc => ({ id, t0, pts: Array.from({ length: 25 }, (_, i) => ({ x: (i / 24) * 640, y })) });

function quietWorld(arcs: Arc[] = []): FlareWorld {
  const w = createFlareWorld(NORMAL, createRng(1));
  w.arcs = arcs;
  return w;
}

const run = (w: FlareWorld, seconds: number, dirX = 0, dirY = 0): void => {
  for (let i = 0; i < Math.round(seconds * HZ); i++) stepFlare(w, { dirX, dirY });
};

describe('flareParams and the arc schedule', () => {
  it('reads flare season and flare weather from the state', () => {
    expect(flareParams(NORMAL)).toEqual({ season: false, telegraphS: 1, activeS: 0.5, intervalFactor: 1 });
    expect(flareParams(SEASON)).toEqual({ season: true, telegraphS: 0.8, activeS: 0.5, intervalFactor: 0.8 });
    expect(flareParams({ date: '2184-07-01', weather: 'flare' }).activeS).toBe(0.7);
  });

  it('~30 arcs normally, ~37 in flare season, interval shrinking 2.0 -> 1.0 s', () => {
    const normal = arcTimes(flareParams(NORMAL));
    const season = arcTimes(flareParams(SEASON));
    expect(normal.length).toBeGreaterThanOrEqual(28);
    expect(normal.length).toBeLessThanOrEqual(32);
    expect(season.length).toBeGreaterThanOrEqual(35);
    expect(season.length).toBeLessThanOrEqual(39);
    expect(normal[1]! - normal[0]!).toBeCloseTo(2 - 0.5 / 45, 5);
    const lastGap = normal[normal.length - 1]! - normal[normal.length - 2]!;
    expect(lastGap).toBeGreaterThan(1);
    expect(lastGap).toBeLessThan(1.1);
  });

  it('arcs are deterministic by seed, run edge to edge, and overlapping arcs leave a safe gap', () => {
    const p = flareParams(SEASON);
    const a = makeArcs(p, createRng(7));
    expect(makeArcs(p, createRng(7))).toEqual(a);
    expect(makeArcs(p, createRng(8))).not.toEqual(a);
    const onEdge = (q: { x: number; y: number }) => q.x === F.left || q.x === F.right || q.y === F.top || q.y === F.bottom;
    for (let seed = 1; seed <= 10; seed++) {
      const arcs = makeArcs(p, createRng(seed));
      for (const arc of arcs) {
        expect(onEdge(arc.pts[0]!) && onEdge(arc.pts[arc.pts.length - 1]!)).toBe(true);
        const overlap = arcs.filter((o) => o.t0 < arc.t0 && arc.t0 < o.t0 + p.telegraphS + p.activeS);
        if (overlap.length > 0) expect(hasSafeGap([...overlap, arc])).toBe(true);
      }
    }
  });

  it('arc phases: telegraph, active, fade, gone', () => {
    const p = flareParams(NORMAL);
    const arc = line(1, 2, 100);
    expect([1.9, 2.5, 3.2, 3.6, 4].map((t) => arcPhase(p, arc, t))).toEqual(['pending', 'telegraph', 'active', 'fade', 'gone']);
  });

  it('distToArc and hasSafeGap', () => {
    expect(distToArc(line(1, 0, 100), 320, 130)).toBeCloseTo(30);
    expect(distToArc(line(1, 0, 100), -10, 100)).toBeCloseTo(10);
    expect(hasSafeGap([line(1, 0, 100)])).toBe(true);
    const wall = Array.from({ length: 12 }, (_, i) => line(i, 0, 24 + i * 32));
    expect(hasSafeGap(wall)).toBe(false);
  });
});

describe('movement and hits', () => {
  it('free 2D movement, capped at 170 px/s, inside the field', () => {
    const w = quietWorld();
    run(w, 1, 1, 0);
    expect(Math.hypot(w.ship.vx, w.ship.vy)).toBeCloseTo(170);
    run(w, 3, 1, 1);
    expect(w.ship.x).toBe(640 - 7);
    expect(w.ship.y).toBe(400 - 7);
    run(w, 0.2);
    expect(Math.hypot(w.ship.vx, w.ship.vy)).toBe(0);
  });

  it('only active arcs hit; 1 s invulnerable after a hit', () => {
    const y = FLARE_RUN.ship.start.y;
    const w = quietWorld([line(1, 0, y), line(2, 1.1, y + 18), line(3, 1.1, y + 30)]);
    run(w, 0.99);
    expect(w.hits).toBe(0); // telegraph only
    run(w, 0.1);
    expect(w.hits).toBe(1);
    run(w, 1.2); // arc 2 hits at 2.1 (invulnerable until ~2.0); arc 3, active at the same time, cannot
    expect(w.hits).toBe(2);
    expect(flareResult(w)).toEqual({ kind: 'flare', hits: 2 });
  });

  it('5 hits = crash: the run ends at once with hits 5', () => {
    const y = FLARE_RUN.ship.start.y;
    const w = quietWorld(Array.from({ length: 8 }, (_, i) => line(i + 1, i * 1.2, y)));
    let steps = 0;
    while (!flareOver(w) && steps < 45 * HZ) {
      stepFlare(w, { dirX: 0, dirY: 0 });
      steps += 1;
    }
    expect(w.crashed).toBe(true);
    expect(w.hits).toBe(5);
    expect(flareElapsed(w)).toBeLessThan(10);
    expect(flareResult(w)).toEqual({ kind: 'flare', hits: 5 });
    expect(resultError(flareResult(w), 'flare')).toBeNull();
  });

  it('a clean idle run over a quiet field lasts 45 s with 0 hits', () => {
    const w = quietWorld();
    run(w, 45);
    expect(flareOver(w)).toBe(true);
    expect(flareResult(w)).toEqual({ kind: 'flare', hits: 0 });
  });
});
