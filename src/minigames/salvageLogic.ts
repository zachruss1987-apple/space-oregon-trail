/**
 * Salvage Run simulation (minigames.md section 1), pure and Phaser-free so unit tests can drive it.
 * One call to `stepSalvage` = one fixed 1/60 s step. All randomness comes from the scene's own Rng.
 */
import { DEBRIS, MINIGAME, MINIGAME_SCENE, SALVAGE_RUN, SPARE_CAP, SPARE_KEYS, type DebrisId, type SpareKey } from '@/content';
import type { GameState, Rng } from '@/sim';
import { finishHaul, salvageParams, type Haul, type SalvageParams } from './salvageHaul';

export { finishHaul, salvageParams, towHaul, type Haul, type SalvageParams } from './salvageHaul';

const DT = 1 / MINIGAME_SCENE.stepHz;
const F = SALVAGE_RUN.field;
const DR = SALVAGE_RUN.drone;
const GR = SALVAGE_RUN.grapple;
/** Timers within this of zero count as expired (float steps of 1/60 never sum exactly). */
const EPS = 1e-6;

export interface Vec { x: number; y: number }

/** A drifting piece of debris. `hooked` pieces are being reeled in and ignore collisions. */
export interface Debris { id: number; type: DebrisId; x: number; y: number; vx: number; vy: number; r: number; spin: number; hooked: boolean }

/** The cable: flying from `origin` along `dir`, or reeling `target` in. */
export interface Grapple { phase: 'flying' | 'reeling'; origin: Vec; dir: Vec; dist: number; target: Debris | null; reelT: number; from: Vec }

/** Things that happened this step (the scene shows a flash line / plays a sound). */
export type SalvageEvent = 'fire' | 'click' | 'miss' | 'hook' | 'snap' | 'holdFull' | 'collect' | 'scrap' | 'hit' | 'hot' | 'wrecked';

/** Per-step input: keyboard direction (-1..1 each axis) or a steer point, and a fire edge (optionally aimed). */
export interface SalvageInput { dirX: number; dirY: number; target?: Vec | null; fire?: boolean; fireAt?: Vec | null }

export interface SalvageWorld {
  steps: number;
  params: SalvageParams;
  drone: { x: number; y: number; vx: number; vy: number; hp: number; invuln: number; facing: Vec };
  debris: Debris[];
  nextId: number;
  spawnCooldown: number;
  grapple: Grapple | null;
  cooldown: number;
  chargesLeft: number;
  chargesUsed: number;
  haul: Haul;
  crewHurt: number;
  /** Spares already in the ship's hold (for the cap of 3). */
  held: Record<SpareKey, number>;
  wrecked: boolean;
  events: SalvageEvent[];
}

/** Fresh arena for this state (charges, hold, segment, weather). */
export function createSalvageWorld(state: Pick<GameState, 'segment' | 'weather' | 'supplies'>): SalvageWorld {
  const held = { plates: state.supplies.plates, pumps: state.supplies.pumps, gyros: state.supplies.gyros };
  return {
    steps: 0,
    params: salvageParams(state.segment, state.weather),
    drone: { ...SALVAGE_RUN.droneStart, vx: 0, vy: 0, hp: DR.hp, invuln: 0, facing: { x: 1, y: 0 } },
    debris: [],
    nextId: 1,
    spawnCooldown: 0,
    grapple: null,
    cooldown: 0,
    chargesLeft: Math.min(state.supplies.charges, MINIGAME.salvage.maxCharges),
    chargesUsed: 0,
    haul: { rations: 0, plates: 0, pumps: 0, gyros: 0 },
    crewHurt: 0,
    held,
    wrecked: false,
    events: [],
  };
}

/** Seconds of play so far. */
export const elapsedOf = (w: SalvageWorld): number => w.steps * DT;

/** True once the run is over (time up or wrecked). */
export function salvageOver(w: SalvageWorld): boolean {
  return w.wrecked || elapsedOf(w) >= SALVAGE_RUN.durationS - 1e-9;
}

/** Spawn one piece at the right edge (weighted type, y uniform, heading 180 deg +- spread). */
export function spawnDebris(w: SalvageWorld, rng: Rng): Debris {
  const type = rng.weighted(w.params.weights);
  const spec = DEBRIS[type];
  const r = rng.int(spec.radius[0], spec.radius[1]);
  const speed = (spec.drift[0] + rng.next() * (spec.drift[1] - spec.drift[0])) * w.params.drift;
  const spread = SALVAGE_RUN.spawn.headingSpreadDeg;
  const heading = ((180 + (rng.next() * 2 - 1) * spread) * Math.PI) / 180;
  const y = SALVAGE_RUN.spawn.yMin + rng.next() * (SALVAGE_RUN.spawn.yMax - SALVAGE_RUN.spawn.yMin);
  const d: Debris = { id: w.nextId++, type, x: F.right + r, y, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed, r, spin: rng.next() * 2 - 1, hooked: false };
  w.debris.push(d);
  return d;
}

/** Snap a direction to the nearest of 8 unit directions. */
function eightWay(x: number, y: number): Vec {
  const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: Math.cos(a), y: Math.sin(a) };
}

function moveDrone(w: SalvageWorld, input: SalvageInput): void {
  const d = w.drone;
  let ix = input.dirX;
  let iy = input.dirY;
  if (input.target) {
    ix = input.target.x - d.x;
    iy = input.target.y - d.y;
    if (Math.hypot(ix, iy) < 4) ix = iy = 0;
  }
  const len = Math.hypot(ix, iy);
  const max = DR.maxSpeed * (w.grapple?.phase === 'reeling' ? GR.reelSpeedFactor : 1);
  if (len > 0) {
    d.vx += (ix / len) * DR.accel * DT;
    d.vy += (iy / len) * DR.accel * DT;
    d.facing = eightWay(ix, iy);
  } else {
    const sp = Math.hypot(d.vx, d.vy);
    const k = sp > 0 ? Math.max(0, sp - DR.drag * DT) / sp : 0;
    d.vx *= k;
    d.vy *= k;
  }
  const sp = Math.hypot(d.vx, d.vy);
  if (sp > max) {
    d.vx *= max / sp;
    d.vy *= max / sp;
  }
  d.x += d.vx * DT;
  d.y += d.vy * DT;
  const r = DR.radius;
  if (d.x < F.left + r || d.x > F.right - r) { d.x = Math.min(F.right - r, Math.max(F.left + r, d.x)); d.vx = 0; }
  if (d.y < F.top + r || d.y > F.bottom - r) { d.y = Math.min(F.bottom - r, Math.max(F.top + r, d.y)); d.vy = 0; }
  if (d.invuln > 0) d.invuln = Math.max(0, d.invuln - DT);
}

/** Can the hold take this piece (parts: hold + haul below the cap)? */
function holdFull(w: SalvageWorld, type: DebrisId): boolean {
  const part = DEBRIS[type].part;
  return part !== null && w.held[part] + w.haul[part] >= SPARE_CAP;
}

/** Fire the grapple toward `at` or the facing direction (1 charge, hit or miss). */
export function fireGrapple(w: SalvageWorld, at?: Vec | null): void {
  if (w.grapple || w.cooldown > 0) return;
  if (w.chargesLeft <= 0) { w.events.push('click'); return; }
  const d = w.drone;
  let dir = d.facing;
  if (at) {
    const len = Math.hypot(at.x - d.x, at.y - d.y);
    if (len > 0) dir = { x: (at.x - d.x) / len, y: (at.y - d.y) / len };
  }
  w.chargesLeft -= 1;
  w.chargesUsed += 1;
  w.cooldown = GR.cooldownS;
  w.grapple = { phase: 'flying', origin: { x: d.x, y: d.y }, dir, dist: 0, target: null, reelT: 0, from: { x: 0, y: 0 } };
  w.events.push('fire');
}

/** First debris the segment origin+dir*[a,b] crosses, by distance along the cable. */
function firstHit(w: SalvageWorld, g: Grapple, a: number, b: number): Debris | null {
  let best: Debris | null = null;
  let bestT = Infinity;
  for (const p of w.debris) {
    if (p.hooked) continue;
    const t = Math.max(a, Math.min(b, (p.x - g.origin.x) * g.dir.x + (p.y - g.origin.y) * g.dir.y));
    const cx = g.origin.x + g.dir.x * t;
    const cy = g.origin.y + g.dir.y * t;
    if (Math.hypot(p.x - cx, p.y - cy) <= p.r && t < bestT) { best = p; bestT = t; }
  }
  return best;
}

function removeDebris(w: SalvageWorld, p: Debris): void {
  w.debris = w.debris.filter((q) => q !== p);
}

/** Reeled in: add the yield (or hurt crew / nothing). */
function collect(w: SalvageWorld, p: Debris): void {
  const spec = DEBRIS[p.type];
  removeDebris(w, p);
  if (spec.hazard === 'hot') { w.crewHurt += 1; w.events.push('hot'); return; }
  if (spec.part) w.haul[spec.part] += 1;
  w.haul.rations += spec.rations;
  w.events.push(spec.part || spec.rations > 0 ? 'collect' : 'scrap');
}

function stepGrapple(w: SalvageWorld): void {
  if (w.cooldown > 0) w.cooldown = w.cooldown - DT < EPS ? 0 : w.cooldown - DT;
  const g = w.grapple;
  if (!g) return;
  if (g.phase === 'flying') {
    const next = Math.min(GR.range, g.dist + GR.speed * DT);
    const hit = firstHit(w, g, g.dist, next);
    g.dist = next;
    if (!hit) {
      if (next >= GR.range) { w.grapple = null; w.events.push('miss'); }
      return;
    }
    if (DEBRIS[hit.type].hazard === 'tumbler') { w.grapple = null; w.events.push('snap'); return; }
    if (holdFull(w, hit.type)) { w.grapple = null; w.events.push('holdFull'); return; }
    hit.hooked = true;
    Object.assign(g, { phase: 'reeling', target: hit, reelT: 0, from: { x: hit.x, y: hit.y } });
    w.events.push('hook');
    return;
  }
  const p = g.target!;
  g.reelT = Math.min(GR.reelS, g.reelT + DT);
  const k = g.reelT / GR.reelS;
  p.x = g.from.x + (w.drone.x - g.from.x) * k;
  p.y = g.from.y + (w.drone.y - g.from.y) * k;
  if (k >= 1) { w.grapple = null; collect(w, p); }
}

function stepDebris(w: SalvageWorld, rng: Rng): void {
  const d = w.drone;
  for (const p of [...w.debris]) {
    if (p.hooked) continue;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (p.x < F.left - p.r || p.y < F.top - p.r || p.y > F.bottom + p.r) { removeDebris(w, p); continue; }
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist > p.r + DR.radius) continue;
    const hazard = DEBRIS[p.type].hazard;
    if (hazard === 'hot') { removeDebris(w, p); w.crewHurt += 1; w.events.push('hot'); }
    else if (hazard === 'tumbler' && d.invuln <= 0) {
      d.hp -= 1;
      d.invuln = DR.invulnS;
      const nx = dist > 0 ? (d.x - p.x) / dist : -1;
      const ny = dist > 0 ? (d.y - p.y) / dist : 0;
      d.vx = nx * DR.knockback;
      d.vy = ny * DR.knockback;
      w.events.push('hit');
      if (d.hp <= 0) { w.wrecked = true; w.events.push('wrecked'); }
    }
  }
  w.spawnCooldown = w.spawnCooldown - DT < EPS ? 0 : w.spawnCooldown - DT;
  if (w.spawnCooldown <= 0 && w.debris.length < w.params.population) {
    spawnDebris(w, rng);
    w.spawnCooldown = SALVAGE_RUN.spawn.minIntervalS;
  }
}

/** Advance one fixed step. Clears and refills `w.events`. No-op once the run is over. */
export function stepSalvage(w: SalvageWorld, input: SalvageInput, rng: Rng): void {
  w.events = [];
  if (salvageOver(w)) return;
  w.steps += 1;
  moveDrone(w, input);
  if (input.fire) fireGrapple(w, input.fireAt);
  stepGrapple(w);
  stepDebris(w, rng);
}

/** The SalvageResult for the run as it stands (halving on a wreck, then the carry clamp). */
export function salvageOutcome(w: SalvageWorld): ReturnType<typeof finishHaul> {
  return finishHaul(w.haul, { wrecked: w.wrecked, chargesUsed: w.chargesUsed, crewHurt: w.crewHurt });
}

/** Parts the hold can still take this run (for the HUD). */
export function holdRoom(w: SalvageWorld): Record<SpareKey, number> {
  return Object.fromEntries(SPARE_KEYS.map((k) => [k, Math.max(0, SPARE_CAP - w.held[k] - w.haul[k])])) as Record<SpareKey, number>;
}
