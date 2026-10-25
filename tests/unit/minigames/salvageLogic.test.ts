/** Salvage Run logic (minigames.md section 1): difficulty, spawn table, movement, grapple, hazards, tow. */
import { describe, expect, it } from 'vitest';
import { DEBRIS, DEBRIS_ORDER, SALVAGE_RUN, type DebrisId } from '@/content';
import {
  createSalvageWorld, elapsedOf, finishHaul, salvageOutcome, salvageOver, salvageParams, spawnDebris, stepSalvage, towHaul,
  type Debris, type SalvageInput, type SalvageWorld,
} from '@/minigames/salvageLogic';
import { createRng, minigameSeed, resultError } from '@/sim';
import { travelingState } from '../sim/helpers';

const IDLE: SalvageInput = { dirX: 0, dirY: 0 };
const HZ = 60;
type Hold = Partial<Record<'plates' | 'pumps' | 'gyros', number>>;

/** A quiet world (no spawns) with the drone at its start and `charges` available. */
function quietWorld(charges = 10, hold: Hold = {}): SalvageWorld {
  const w = createSalvageWorld(travelingState({ segment: 3, weather: 'fair', supplies: { charges, plates: 0, pumps: 0, gyros: 0, ...hold } }));
  w.params.population = 0;
  return w;
}

function place(w: SalvageWorld, type: DebrisId, x: number, y: number): Debris {
  const d: Debris = { id: w.nextId++, type, x, y, vx: 0, vy: 0, r: DEBRIS[type].radius[0], spin: 0, hooked: false };
  w.debris.push(d);
  return d;
}

function run(w: SalvageWorld, seconds: number, input: SalvageInput = IDLE, rng = createRng(1)): void {
  for (let i = 0; i < Math.round(seconds * HZ); i++) stepSalvage(w, input, rng);
}

describe('salvageParams', () => {
  const sum = (p: ReturnType<typeof salvageParams>) => p.weights.reduce((s, x) => s + x.weight, 0);
  const wt = (p: ReturnType<typeof salvageParams>, id: DebrisId) => p.weights.find((x) => x.item === id)!.weight;

  it('uses the trail phase population and multipliers, weights rescaled to 100', () => {
    const near = salvageParams(3, 'fair');
    expect(near).toMatchObject({ population: 10, drift: 1, blipRange: null });
    expect(wt(near, 'crate')).toBeCloseTo(30);
    const belt = salvageParams(8, 'calm');
    expect(belt.population).toBe(12);
    expect(wt(belt, 'plate') / wt(belt, 'crate')).toBeCloseTo((4 * 1.5) / 30);
    expect(salvageParams(15, 'fair')).toMatchObject({ population: 8, drift: 1.2 });
    for (const p of [near, belt, salvageParams(16, 'storm')]) expect(sum(p)).toBeCloseTo(100);
  });

  it('applies weather: unsettled tumblers, storm/flare hot chunks and drift, fog blips', () => {
    const uns = salvageParams(3, 'unsettled');
    expect(wt(uns, 'tumbler') / wt(uns, 'crate')).toBeCloseTo(15 / 30);
    const storm = salvageParams(3, 'storm');
    expect(wt(storm, 'hot') / wt(storm, 'crate')).toBeCloseTo(15 / 30);
    expect(storm.drift).toBeCloseTo(1.2);
    expect(salvageParams(15, 'flare').drift).toBeCloseTo(1.44);
    expect(salvageParams(3, 'fog').blipRange).toBe(150);
  });
});

describe('spawn table', () => {
  it('matches the weights over many seeds and spawns at the right edge within the spec ranges', () => {
    const counts = Object.fromEntries(DEBRIS_ORDER.map((id) => [id, 0])) as Record<DebrisId, number>;
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      const w = quietWorld();
      for (let i = 0; i < 100; i++) {
        const d = spawnDebris(w, rng);
        counts[d.type] += 1;
        n += 1;
        const spec = DEBRIS[d.type];
        expect(d.x).toBe(SALVAGE_RUN.field.right + d.r);
        expect(d.y).toBeGreaterThanOrEqual(40);
        expect(d.y).toBeLessThanOrEqual(376);
        expect(d.r).toBeGreaterThanOrEqual(spec.radius[0]);
        expect(d.r).toBeLessThanOrEqual(spec.radius[1]);
        const speed = Math.hypot(d.vx, d.vy);
        expect(speed).toBeGreaterThanOrEqual(spec.drift[0] - 1e-9);
        expect(speed).toBeLessThanOrEqual(spec.drift[1] + 1e-9);
        expect(Math.abs((Math.atan2(d.vy, -d.vx) * 180) / Math.PI)).toBeLessThanOrEqual(20 + 1e-9);
      }
    }
    for (const id of DEBRIS_ORDER) expect(Math.abs((counts[id] / n) * 100 - DEBRIS[id].weight), id).toBeLessThan(1.5);
  });

  it('keeps the field at the target population, one spawn per 0.25 s at most', () => {
    const w = createSalvageWorld(travelingState({ segment: 3, weather: 'fair' }));
    run(w, 0.25 * 3 + 0.01);
    expect(w.debris.length).toBe(4);
    run(w, 10);
    expect(w.debris.length).toBeLessThanOrEqual(10);
  });
});

describe('determinism', () => {
  const trace = (seed: number) => {
    const w = createSalvageWorld(travelingState({ segment: 8, weather: 'unsettled', supplies: { charges: 20 } }));
    const rng = createRng(seed);
    const seen = new Set<number>();
    const out: string[] = [];
    for (let i = 0; i < 40 * HZ; i++) {
      stepSalvage(w, { dirX: i % 240 < 120 ? 1 : -1, dirY: 0, fire: i % 50 === 0 }, rng);
      for (const d of w.debris) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push(`${d.id}:${d.type}:${d.y.toFixed(3)}`);
      }
    }
    return { out, result: salvageOutcome(w).result };
  };

  it('same seed + same inputs = same spawns and result; another seed differs', () => {
    const seed = minigameSeed({ seed: 'OREGON', day: 12 }, 'salvage');
    expect(trace(seed)).toEqual(trace(seed));
    expect(trace(seed).out).not.toEqual(trace(seed + 1).out);
    expect(resultError(trace(seed).result, 'salvage')).toBeNull();
  });
});

describe('drone', () => {
  it('caps speed at 160 px/s, coasts to a stop in about 0.5 s, and stays inside the field', () => {
    const w = quietWorld();
    run(w, 1, { dirX: 0, dirY: 1 });
    expect(Math.hypot(w.drone.vx, w.drone.vy)).toBeLessThanOrEqual(160 + 1e-9);
    w.drone.y = 200;
    w.drone.vy = 160;
    run(w, 0.55);
    expect(w.drone.vy).toBe(0);
    run(w, 5, { dirX: -1, dirY: -1 });
    expect(w.drone.x).toBe(SALVAGE_RUN.drone.radius);
    expect(w.drone.y).toBe(SALVAGE_RUN.field.top + SALVAGE_RUN.drone.radius);
  });

  it('3 HP: a tumbler hit costs 1, knocks back, then 1 s of invulnerability; HP 0 wrecks and halves the haul', () => {
    const w = quietWorld();
    const tb = place(w, 'tumbler', w.drone.x + 5, w.drone.y);
    stepSalvage(w, IDLE, createRng(1));
    expect(w.drone.hp).toBe(2);
    expect(w.drone.vx).toBeLessThan(-100);
    tb.x = w.drone.x;
    tb.y = w.drone.y;
    run(w, 0.05);
    expect(w.drone.hp).toBe(2);
    w.haul = { rations: 45, plates: 1, pumps: 0, gyros: 3 };
    for (let hit = 0; hit < 2; hit++) {
      run(w, 1.0);
      tb.x = w.drone.x;
      tb.y = w.drone.y;
      run(w, 1 / HZ);
    }
    expect(w.wrecked).toBe(true);
    expect(salvageOver(w)).toBe(true);
    expect(salvageOutcome(w).result).toMatchObject({ rations: 22, plates: 0, gyros: 1, droneWrecked: true });
  });

  it('a hot chunk on contact hurts one crew and vanishes', () => {
    const w = quietWorld();
    place(w, 'hot', w.drone.x + 4, w.drone.y);
    stepSalvage(w, IDLE, createRng(1));
    expect(w.crewHurt).toBe(1);
    expect(w.debris).toHaveLength(0);
  });

  it('ends after 40 s of steps', () => {
    const w = quietWorld();
    run(w, 39.99);
    expect(salvageOver(w)).toBe(false);
    run(w, 1);
    expect(elapsedOf(w)).toBeCloseTo(40);
    expect(salvageOver(w)).toBe(true);
  });
});

describe('grapple', () => {
  const fire = (w: SalvageWorld, at?: { x: number; y: number }) => stepSalvage(w, { dirX: 0, dirY: 0, fire: true, fireAt: at ?? null }, createRng(1));

  it('hooks within 140 px (1 charge), reels in over 0.5 s, and adds the yield', () => {
    const w = quietWorld(10);
    place(w, 'pallet', w.drone.x + 135, w.drone.y);
    fire(w);
    expect(w.chargesUsed).toBe(1);
    run(w, 0.3);
    expect(w.grapple?.phase).toBe('reeling');
    run(w, 0.5);
    expect(w.haul.rations).toBe(15);
    expect(w.debris).toHaveLength(0);
  });

  it('misses beyond range but still spends the charge; cooldown 0.8 s; 0 charges just clicks', () => {
    const w = quietWorld(2);
    place(w, 'crate', w.drone.x + 150, w.drone.y);
    fire(w);
    run(w, 0.4);
    expect(w.grapple).toBeNull();
    expect(w.chargesUsed).toBe(1);
    fire(w);
    expect(w.chargesUsed).toBe(1);
    run(w, 0.5);
    fire(w);
    expect(w.chargesUsed).toBe(2);
    run(w, 1);
    fire(w);
    expect(w.events).toContain('click');
    expect(w.chargesUsed).toBe(2);
  });

  it('aims at a tap point; tumblers snap the cable; a full hold leaves the part', () => {
    const w = quietWorld(5, { plates: 3 });
    place(w, 'tumbler', w.drone.x, w.drone.y + 60);
    fire(w, { x: w.drone.x, y: w.drone.y + 100 });
    run(w, 0.3);
    expect(w.grapple).toBeNull();
    expect(w.debris).toHaveLength(1);
    run(w, 0.6);
    w.debris = [];
    place(w, 'plate', w.drone.x + 60, w.drone.y);
    fire(w);
    run(w, 0.3);
    expect(w.haul.plates).toBe(0);
    expect(w.debris).toHaveLength(1);
    expect(w.chargesUsed).toBe(2);
  });

  it('charges available = min(charges, 20)', () => {
    expect(quietWorld(57).chargesLeft).toBe(20);
    expect(quietWorld(3).chargesLeft).toBe(3);
  });
});

describe('tow (100 units, parts first)', () => {
  it('keeps everything under the limit', () => {
    expect(towHaul({ rations: 60, plates: 1, pumps: 1, gyros: 1 })).toEqual({ kept: { rations: 60, plates: 1, pumps: 1, gyros: 1 }, dropped: 0 });
  });

  it('truncates rations after gyros, pumps, plates', () => {
    expect(towHaul({ rations: 80, plates: 1, pumps: 1, gyros: 1 })).toEqual({ kept: { rations: 70, plates: 1, pumps: 1, gyros: 1 }, dropped: 10 });
    expect(towHaul({ rations: 50, plates: 3, pumps: 3, gyros: 3 })).toEqual({ kept: { rations: 10, plates: 3, pumps: 3, gyros: 3 }, dropped: 40 });
    expect(towHaul({ rations: 135, plates: 0, pumps: 0, gyros: 0 }).dropped).toBe(35);
  });

  it('finishHaul halves on a wreck before the clamp and caps crew hurt / charges to the schema', () => {
    const { result, overweight } = finishHaul({ rations: 230, plates: 1, pumps: 0, gyros: 2 }, { wrecked: true, chargesUsed: 9, crewHurt: 5 });
    expect(result).toEqual({ kind: 'salvage', rations: 90, plates: 0, pumps: 0, gyros: 1, chargesUsed: 9, crewHurt: 3, droneWrecked: true });
    expect(overweight).toBe(25);
    expect(resultError(result, 'salvage')).toBeNull();
    expect(finishHaul({ rations: 5, plates: 0, pumps: 0, gyros: 0 }, { wrecked: false, chargesUsed: 1, crewHurt: 0 }).result).not.toHaveProperty('droneWrecked');
  });
});
