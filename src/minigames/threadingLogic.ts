/**
 * Debris Threading simulation (minigames.md section 2), pure and Phaser-free. The rock field is laid out at creation
 * from the scene's own Rng; `stepThreading` = one fixed 1/60 s step and draws nothing from any Rng.
 */
import { MINIGAME, MINIGAME_SCENE, THREADING_RUN as TR } from '@/content';
import { crossChance, type GameState, type Rng, type ThreadingResult } from '@/sim';
import { desiredVelocity, steer, type Vec } from './steer';

const DT = 1 / MINIGAME_SCENE.stepHz;
const RK = TR.rocks;
const EPS = 1e-6;
/** Vertical span the ship's hull can occupy (center bounds ± half height): gaps are measured inside it. */
const LANE: readonly [number, number] = [TR.shipY[0] - TR.ship.h / 2, TR.shipY[1] + TR.ship.h / 2];

/** A rock: enters at the right edge at time `t` and scrolls left. `hit` rocks have shattered. */
export interface Rock { id: number; t: number; y: number; r: number; hit: boolean }

/** A harmless dust speck (parallax). */
export interface Dust { x: number; y: number; speed: number }

export interface ThreadingWorld {
  steps: number;
  /** The option's incident chance (percent) the field was built from. */
  incident: number;
  density: number;
  /** Scroll speed (px/s). */
  scroll: number;
  rocks: Rock[];
  dust: Dust[];
  ship: { y: number; vy: number; invuln: number };
  hits: number;
  /** Things that happened this step (flash / sound). */
  events: 'hit'[];
}

/** Per-step input: vertical keyboard direction (-1..1) or a steer point. */
export interface ThreadingInput { dirY: number; target?: Vec | null }

/** Rocks per run: R = clamp(round(T / 3), 4, 32). */
export function rockCount(incident: number): number {
  return Math.max(RK.min, Math.min(RK.max, Math.round(incident / RK.perRock)));
}

/** Scroll speed for a density: 150 + 15 × density px/s. */
export const scrollSpeed = (density: number): number => RK.scrollBase + RK.scrollPerDensity * density;

/** Largest free vertical interval in the ship's lane once the given rocks' spans are removed. */
export function largestGap(rocks: readonly Pick<Rock, 'y' | 'r'>[]): number {
  const spans = rocks.map((k) => [k.y - k.r, k.y + k.r] as const).sort((a, b) => a[0] - b[0]);
  let best = 0;
  let edge = LANE[0];
  for (const [lo, hi] of spans) {
    best = Math.max(best, lo - edge);
    edge = Math.max(edge, hi);
  }
  return Math.max(best, LANE[1] - edge);
}

/**
 * Lay out `count` rocks for `density`: spawn times spread evenly over 1–24 s (± 0.3 s), y uniform, radius
 * 10 + 2 × density ± 4. Any 120 px of x (= 120 / scroll seconds) holds at most 2 rocks, and rocks sharing a window
 * always leave a vertical gap ≥ 60 px (y is redrawn until it does).
 */
export function makeRocks(count: number, density: number, rng: Rng): Rock[] {
  const scroll = scrollSpeed(density);
  const windowS = RK.windowPx / scroll;
  const times = Array.from({ length: count }, (_, i) => {
    const base = count === 1 ? (RK.from + RK.to) / 2 : RK.from + ((RK.to - RK.from) * i) / (count - 1);
    return Math.min(RK.to, Math.max(RK.from, base + (rng.next() * 2 - 1) * RK.jitterS));
  }).sort((a, b) => a - b);
  for (let i = RK.maxPerWindow; i < times.length; i++) {
    times[i] = Math.max(times[i]!, times[i - RK.maxPerWindow]! + windowS);
  }
  const rocks: Rock[] = [];
  times.forEach((t, i) => {
    const r = RK.radiusBase + RK.radiusPerDensity * density + rng.int(-RK.radiusJitter, RK.radiusJitter);
    const near = rocks.filter((k) => t - k.t < windowS);
    let y = rng.int(RK.yMin, RK.yMax);
    for (let tries = 0; tries < 12 && largestGap([...near, { y, r }]) < RK.minGap; tries++) y = rng.int(RK.yMin, RK.yMax);
    rocks.push({ id: i + 1, t, y, r, hit: false });
  });
  return rocks;
}

/** A fresh run for the pending crossing (incident from the sim's `crossChance`, density from `state.crossing`). */
export function createThreadingWorld(state: GameState, rng: Rng): ThreadingWorld {
  const incident = crossChance(state, 'thread') ?? 0;
  const density = state.crossing?.density ?? 1;
  const scroll = scrollSpeed(density);
  const rocks = makeRocks(rockCount(incident), density, rng);
  const f = TR.field;
  const dust = Array.from({ length: TR.dustPerDensity * density }, () => ({
    x: rng.next() * f.right,
    y: f.top + rng.next() * (f.bottom - f.top),
    speed: scroll * (0.3 + rng.next() * 0.5),
  }));
  return { steps: 0, incident, density, scroll, rocks, dust, ship: { y: (TR.shipY[0] + TR.shipY[1]) / 2, vy: 0, invuln: 0 }, hits: 0, events: [] };
}

/** Seconds of play so far. */
export const threadingElapsed = (w: ThreadingWorld): number => w.steps * DT;

/** A rock's x at the current time (it enters just off the right edge). */
export function rockX(w: ThreadingWorld, k: Rock): number {
  return TR.field.right + k.r - (threadingElapsed(w) - k.t) * w.scroll;
}

/** True while the rock is on the field (spawned, not yet off the left edge, not shattered). */
export function rockLive(w: ThreadingWorld, k: Rock): boolean {
  return !k.hit && threadingElapsed(w) >= k.t && rockX(w, k) > -k.r;
}

/** Ship hull (20 × 10 rectangle at x 96) against a rock circle. */
export function shipTouches(shipY: number, x: number, y: number, r: number): boolean {
  const dx = Math.max(Math.abs(x - TR.shipX) - TR.ship.w / 2, 0);
  const dy = Math.max(Math.abs(y - shipY) - TR.ship.h / 2, 0);
  return dx * dx + dy * dy < r * r;
}

/** One fixed step: steer, scroll, collide (a hit shatters the rock and grants 1 s of invulnerability). */
export function stepThreading(w: ThreadingWorld, input: ThreadingInput): void {
  w.events = [];
  w.steps += 1;
  const s = w.ship;
  const want = desiredVelocity({ x: TR.shipX, y: s.y }, { x: 0, y: input.dirY }, input.target ?? null, TR.ship, TR.steerGain, { x: false, y: true });
  s.vy = steer({ x: 0, y: s.vy }, want, TR.ship, DT).y;
  s.y += s.vy * DT;
  if (s.y < TR.shipY[0] || s.y > TR.shipY[1]) {
    s.y = Math.min(TR.shipY[1], Math.max(TR.shipY[0], s.y));
    s.vy = 0;
  }
  s.invuln = Math.max(0, s.invuln - DT);
  for (const k of w.rocks) {
    if (!rockLive(w, k) || !shipTouches(s.y, rockX(w, k), k.y, k.r) || s.invuln > EPS) continue;
    k.hit = true;
    w.hits += 1;
    s.invuln = TR.ship.invulnS;
    w.events.push('hit');
  }
  for (const d of w.dust) {
    d.x -= d.speed * DT;
    if (d.x < 0) d.x += TR.field.right;
  }
}

/** True once the 25 s are up (Threading never ends early). */
export function threadingOver(w: ThreadingWorld): boolean {
  return threadingElapsed(w) >= TR.durationS - 1e-9;
}

/** The result: hits (capped at the schema max) and the bonus pick, kept only on a clean run. */
export function threadingResult(w: ThreadingWorld, bonus: ThreadingResult['bonus'] = null): ThreadingResult {
  const hits = Math.min(w.hits, MINIGAME.threading.maxHits);
  return { kind: 'threading', hits, bonus: hits === 0 ? bonus : null };
}

/** Severity rolls the sim will make for `hits` (at most 4; hits beyond that count but do nothing). */
export const severityRolls = (hits: number): number => Math.min(hits, MINIGAME.threading.maxRolls);
