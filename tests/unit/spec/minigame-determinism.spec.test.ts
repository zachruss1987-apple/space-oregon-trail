/** minigames.md "Timestep": a fixed 60 Hz step, so the same seed + the same inputs = the same run. Pure logic modules only. */
import { describe, expect, it } from 'vitest';
import {
  createFlareWorld, flareElapsed, flareOver, flareResult, stepFlare, type FlareInput, type FlareWorld,
} from '@/minigames/flareLogic';
import {
  createSalvageWorld, salvageOutcome, salvageOver, stepSalvage, type SalvageInput, type SalvageWorld,
} from '@/minigames/salvageLogic';
import {
  createThreadingWorld, stepThreading, threadingOver, threadingResult, type ThreadingInput, type ThreadingWorld,
} from '@/minigames/threadingLogic';
import { createRng, minigameSeed } from '@/sim';
import { ship } from './spec-helpers';

const HZ = 60;
const base = ship({ seed: 'DET', day: 12, date: '2184-07-01', weather: 'fair', segment: 4, supplies: { charges: 20 } });
const crossing = ship({
  seed: 'DET', day: 12, date: '2184-07-01', weather: 'fair', segment: 2, arrivedAt: 1, credits: 500,
  crossing: { waypoint: 1, density: 3, pilotDaysLeft: null },
});
const seedOf = (kind: 'salvage' | 'threading' | 'flare', label: string) => createRng(minigameSeed({ seed: label, day: 12 }, kind));

/** A fixed, mildly busy script: a function of the step index only. */
const dirX = (i: number): number => [1, 1, 0, -1, 0, 1][Math.floor(i / 37) % 6]!;
const dirY = (i: number): number => [0, 1, -1, -1, 1, 0, 1][Math.floor(i / 29) % 7]!;

const salvageInput = (i: number): SalvageInput => ({ dirX: dirX(i), dirY: dirY(i), fire: i % 70 === 3 });
const threadInput = (i: number): ThreadingInput => ({ dirY: dirY(i) });
const flareInput = (i: number): FlareInput => ({ dirX: dirX(i), dirY: dirY(i) });

function salvageTrace(label: string, steps: number): { trace: string[]; w: SalvageWorld } {
  const w = createSalvageWorld(base);
  const rng = seedOf('salvage', label);
  const trace: string[] = [];
  for (let i = 0; i < steps; i++) {
    stepSalvage(w, salvageInput(i), rng);
    trace.push(JSON.stringify([w.drone.x, w.drone.y, w.drone.hp, w.debris.map((d) => [d.id, d.type, d.x, d.y]), w.haul, w.chargesUsed]));
  }
  return { trace, w };
}

function threadTrace(label: string): { trace: string[]; w: ThreadingWorld } {
  const w = createThreadingWorld(crossing, seedOf('threading', label));
  const trace: string[] = [JSON.stringify(w.rocks)];
  for (let i = 0; !threadingOver(w); i++) {
    stepThreading(w, threadInput(i));
    trace.push(JSON.stringify([w.ship.y, w.ship.vy, w.hits]));
  }
  return { trace, w };
}

function flareTrace(label: string, steps: number): { trace: string[]; w: FlareWorld } {
  const w = createFlareWorld(base, seedOf('flare', label));
  const trace: string[] = [JSON.stringify(w.arcs)];
  for (let i = 0; i < steps && !flareOver(w); i++) {
    stepFlare(w, flareInput(i));
    trace.push(JSON.stringify([w.ship.x, w.ship.y, w.hits]));
  }
  return { trace, w };
}

describe('Salvage Run determinism', () => {
  it('same seed + same inputs = identical trajectory and result', () => {
    const a = salvageTrace('ALPHA', 1500);
    const b = salvageTrace('ALPHA', 1500);
    expect(a.trace).toEqual(b.trace);
    expect(salvageOutcome(a.w)).toEqual(salvageOutcome(b.w));
  });

  it('a different seed gives a different field', () => {
    expect(salvageTrace('ALPHA', 600).trace).not.toEqual(salvageTrace('BETA', 600).trace);
  });

  it('40 s is exactly 2400 fixed steps', () => {
    const w = createSalvageWorld(base);
    const rng = seedOf('salvage', 'ALPHA');
    let n = 0;
    while (!salvageOver(w) && n < 5000) { stepSalvage(w, { dirX: 0, dirY: 0 }, rng); n++; }
    // Idle drone at (64,200): a tumbler might wreck it early; the unwrecked count must be 40 * 60.
    if (!w.wrecked) expect(n).toBe(40 * HZ);
    else expect(n).toBeLessThanOrEqual(40 * HZ);
  });

  it('the result does not depend on how many steps are batched per frame (pure step function)', () => {
    const a = salvageTrace('GAMMA', 2400);
    const w = createSalvageWorld(base);
    const rng = seedOf('salvage', 'GAMMA');
    let i = 0;
    for (const chunk of [1, 5, 17, 60, 2317]) for (let k = 0; k < chunk && i < 2400; k++, i++) stepSalvage(w, salvageInput(i), rng);
    expect(salvageOutcome(w)).toEqual(salvageOutcome(a.w));
  });
});

describe('Debris Threading determinism', () => {
  it('same seed + same inputs = identical rock field, trajectory and result', () => {
    const a = threadTrace('ALPHA');
    const b = threadTrace('ALPHA');
    expect(a.trace).toEqual(b.trace);
    expect(threadingResult(a.w)).toEqual(threadingResult(b.w));
  });

  it('a different seed gives a different rock field', () => {
    expect(threadTrace('ALPHA').trace[0]).not.toEqual(threadTrace('BETA').trace[0]);
  });

  it('25 s is exactly 1500 fixed steps', () => {
    const w = createThreadingWorld(crossing, seedOf('threading', 'ALPHA'));
    let n = 0;
    while (!threadingOver(w)) { stepThreading(w, { dirY: 0 }); n++; }
    expect(n).toBe(25 * HZ);
  });
});

describe('Flare Belt determinism', () => {
  it('same seed + same inputs = identical arcs, trajectory and result', () => {
    const a = flareTrace('ALPHA', 2700);
    const b = flareTrace('ALPHA', 2700);
    expect(a.trace).toEqual(b.trace);
    expect(flareResult(a.w)).toEqual(flareResult(b.w));
  });

  it('a different seed gives different arcs', () => {
    expect(flareTrace('ALPHA', 1).trace[0]).not.toEqual(flareTrace('BETA', 1).trace[0]);
  });

  it('45 s is exactly 2700 fixed steps when the ship is not crashed', () => {
    const w = createFlareWorld(base, seedOf('flare', 'ALPHA'));
    w.arcs = [];
    let n = 0;
    while (!flareOver(w)) { stepFlare(w, { dirX: 0, dirY: 0 }); n++; }
    expect(n).toBe(45 * HZ);
    expect(flareElapsed(w)).toBeCloseTo(45, 9);
  });
});
