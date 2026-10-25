/** Shared craft steering for the dodge games (pure): accelerate toward a desired velocity, drag to a stop without input. */

export interface Vec { x: number; y: number }

/** Movement tuning: top speed, acceleration toward input, drag with no input (px/s, px/s²). */
export interface Handling { maxSpeed: number; accel: number; drag: number }

/** Move `v` toward `target` by at most `rate × dt`. */
export function approach(v: number, target: number, rate: number, dt: number): number {
  const d = target - v;
  return Math.abs(d) <= rate * dt ? target : v + Math.sign(d) * rate * dt;
}

/**
 * Desired velocity from input: a keyboard direction (normalised, full speed), else a steer point (speed proportional
 * to the distance, capped), else null (no input: drag). Only the axes in `axes` count.
 */
export function desiredVelocity(
  pos: Vec, dir: Vec, target: Vec | null, h: Handling, gain: number, axes: { x: boolean; y: boolean } = { x: true, y: true },
): Vec | null {
  const dx = axes.x ? dir.x : 0;
  const dy = axes.y ? dir.y : 0;
  const len = Math.hypot(dx, dy);
  if (len > 0) return { x: (dx / len) * h.maxSpeed, y: (dy / len) * h.maxSpeed };
  if (!target) return null;
  const tx = axes.x ? (target.x - pos.x) * gain : 0;
  const ty = axes.y ? (target.y - pos.y) * gain : 0;
  const sp = Math.hypot(tx, ty);
  const k = sp > h.maxSpeed ? h.maxSpeed / sp : 1;
  return { x: tx * k, y: ty * k };
}

/** New velocity after one step toward `desired` (accel) or, with no input, toward rest (drag). */
export function steer(v: Vec, desired: Vec | null, h: Handling, dt: number): Vec {
  const goal = desired ?? { x: 0, y: 0 };
  const rate = desired ? h.accel : h.drag;
  const dx = goal.x - v.x;
  const dy = goal.y - v.y;
  const d = Math.hypot(dx, dy);
  if (d <= rate * dt) return { ...goal };
  return { x: v.x + (dx / d) * rate * dt, y: v.y + (dy / d) * rate * dt };
}
