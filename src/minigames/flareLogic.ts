/**
 * Flare Belt Finale simulation (minigames.md section 3), pure and Phaser-free. Arcs are scheduled at creation from the
 * scene's own Rng; `stepFlare` = one fixed 1/60 s step and draws nothing.
 */
import { FLARE_RUN as FR, MINIGAME, MINIGAME_SCENE } from '@/content';
import { isFlareSeason, type FlareResult, type GameState, type Rng } from '@/sim';
import { desiredVelocity, steer, type Vec } from './steer';

const DT = 1 / MINIGAME_SCENE.stepHz;
const F = FR.field;
const EPS = 1e-6;
const GRID = 16;

/** Timing for today's arcs. */
export interface FlareParams { season: boolean; telegraphS: number; activeS: number; intervalFactor: number }

/** A flare arc: telegraph from `t0`, active for `activeS`, then fades. `pts` samples the quadratic Bezier. */
export interface Arc { id: number; t0: number; pts: Vec[] }

/** Where an arc is in its life at time t. */
export type ArcPhase = 'pending' | 'telegraph' | 'active' | 'fade' | 'gone';

export interface FlareWorld {
  steps: number;
  params: FlareParams;
  arcs: Arc[];
  ship: { x: number; y: number; vx: number; vy: number; invuln: number };
  hits: number;
  crashed: boolean;
  events: ('hit' | 'crash')[];
}

/** Per-step input: keyboard direction (-1..1 each axis) or a steer point. */
export interface FlareInput { dirX: number; dirY: number; target?: Vec | null }

/** Flare season (sim's `isFlareSeason`): shorter interval and telegraph; flare weather today: longer active time. */
export function flareParams(state: Pick<GameState, 'date' | 'weather'>): FlareParams {
  const season = isFlareSeason(state.date);
  return {
    season,
    telegraphS: season ? FR.season.telegraphS : FR.arc.telegraphS,
    activeS: state.weather === 'flare' ? FR.flareWeatherActiveS : FR.arc.activeS,
    intervalFactor: season ? FR.season.intervalFactor : 1,
  };
}

/** Telegraph start times: the interval runs linearly 2.0 s -> 1.0 s over the 45 s (× 0.8 in season); ~30 / ~37 arcs. */
export function arcTimes(p: FlareParams): number[] {
  const a = FR.arc;
  const out: number[] = [];
  for (let t = a.firstS; t + p.telegraphS < FR.durationS; ) {
    out.push(t);
    const interval = a.intervalStart + ((a.intervalEnd - a.intervalStart) * t) / FR.durationS;
    t += interval * p.intervalFactor;
  }
  return out;
}

/** Point on the quadratic Bezier a-c-b at u. */
function bezier(a: Vec, c: Vec, b: Vec, u: number): Vec {
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
}

/** A random point on field edge `e` (0 top, 1 right, 2 bottom, 3 left). */
function edgePoint(e: number, rng: Rng): Vec {
  const fx = F.left + rng.next() * (F.right - F.left);
  const fy = F.top + rng.next() * (F.bottom - F.top);
  return [{ x: fx, y: F.top }, { x: F.right, y: fy }, { x: fx, y: F.bottom }, { x: F.left, y: fy }][e]!;
}

/** Curve from one edge to the opposite or an adjacent edge, control point inside the field. */
function randomCurve(rng: Rng): Vec[] {
  const e = rng.int(0, 3);
  const a = edgePoint(e, rng);
  const b = edgePoint((e + rng.pick([1, 2, 3])) % 4, rng);
  const c = { x: F.left + 80 + rng.next() * (F.right - F.left - 160), y: F.top + 80 + rng.next() * (F.bottom - F.top - 160) };
  return Array.from({ length: FR.arc.samples + 1 }, (_, i) => bezier(a, c, b, i / FR.arc.samples));
}

/** Shortest distance from (x, y) to the arc's sampled curve. */
export function distToArc(arc: Pick<Arc, 'pts'>, x: number, y: number): number {
  let best = Infinity;
  for (let i = 1; i < arc.pts.length; i++) {
    const p = arc.pts[i - 1]!;
    const q = arc.pts[i]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - (p.x + u * dx), y - (p.y + u * dy)));
  }
  return best;
}

/** True if some point of the field is at least minGap / 2 clear of every arc's band (a 64 px safe circle). */
export function hasSafeGap(arcs: readonly Pick<Arc, 'pts'>[]): boolean {
  const clear = FR.arc.thickness / 2 + FR.arc.minGap / 2;
  const m = FR.arc.minGap / 2;
  for (let x = F.left + m; x <= F.right - m; x += GRID) {
    for (let y = F.top + m; y <= F.bottom - m; y += GRID) {
      if (arcs.every((a) => distToArc(a, x, y) >= clear)) return true;
    }
  }
  return false;
}

/** Seconds an arc is dangerous or about to be (telegraph + active). */
const dangerS = (p: FlareParams): number => p.telegraphS + p.activeS;

/** The whole run's arcs; an arc overlapping others in time is redrawn (up to 12 times) until a safe gap remains. */
export function makeArcs(p: FlareParams, rng: Rng): Arc[] {
  const arcs: Arc[] = [];
  arcTimes(p).forEach((t0, i) => {
    const overlap = arcs.filter((a) => t0 < a.t0 + dangerS(p));
    let pts = randomCurve(rng);
    for (let tries = 0; tries < 12 && overlap.length > 0 && !hasSafeGap([...overlap, { pts }]); tries++) pts = randomCurve(rng);
    arcs.push({ id: i + 1, t0, pts });
  });
  return arcs;
}

/** A fresh run for this state (season and weather from the sim). */
export function createFlareWorld(state: Pick<GameState, 'date' | 'weather'>, rng: Rng): FlareWorld {
  const params = flareParams(state);
  return { steps: 0, params, arcs: makeArcs(params, rng), ship: { ...FR.ship.start, vx: 0, vy: 0, invuln: 0 }, hits: 0, crashed: false, events: [] };
}

/** Seconds of play so far. */
export const flareElapsed = (w: FlareWorld): number => w.steps * DT;

/** Phase of an arc at time t. */
export function arcPhase(p: FlareParams, arc: Arc, t: number): ArcPhase {
  const dt = t - arc.t0;
  if (dt < 0) return 'pending';
  if (dt < p.telegraphS) return 'telegraph';
  if (dt < p.telegraphS + p.activeS) return 'active';
  return dt < dangerS(p) + FR.arc.fadeS ? 'fade' : 'gone';
}

/** One fixed step: steer in 2D, then active arcs hit (1 s invulnerable after a hit; 5 hits = crash). */
export function stepFlare(w: FlareWorld, input: FlareInput): void {
  w.events = [];
  w.steps += 1;
  const s = w.ship;
  const want = desiredVelocity(s, { x: input.dirX, y: input.dirY }, input.target ?? null, FR.ship, FR.steerGain);
  const v = steer({ x: s.vx, y: s.vy }, want, FR.ship, DT);
  s.vx = v.x;
  s.vy = v.y;
  s.x += s.vx * DT;
  s.y += s.vy * DT;
  const r = FR.ship.radius;
  if (s.x < F.left + r || s.x > F.right - r) { s.x = Math.min(F.right - r, Math.max(F.left + r, s.x)); s.vx = 0; }
  if (s.y < F.top + r || s.y > F.bottom - r) { s.y = Math.min(F.bottom - r, Math.max(F.top + r, s.y)); s.vy = 0; }
  s.invuln = Math.max(0, s.invuln - DT);
  const t = flareElapsed(w);
  const reach = FR.arc.thickness / 2 + r;
  for (const arc of w.arcs) {
    if (s.invuln > EPS || w.crashed) break;
    if (arcPhase(w.params, arc, t) !== 'active' || distToArc(arc, s.x, s.y) >= reach) continue;
    w.hits += 1;
    s.invuln = FR.ship.invulnS;
    w.events.push('hit');
    if (w.hits >= MINIGAME.flare.crashHits) {
      w.crashed = true;
      w.events.push('crash');
    }
  }
}

/** True once the run is over: crashed, or the 45 s are up. */
export function flareOver(w: FlareWorld): boolean {
  return w.crashed || flareElapsed(w) >= FR.durationS - 1e-9;
}

/** The result: hits 0..5 (5 = crash). */
export function flareResult(w: FlareWorld): FlareResult {
  return { kind: 'flare', hits: Math.min(w.hits, MINIGAME.flare.crashHits) };
}
