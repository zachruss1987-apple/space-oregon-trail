/** Mini-game arena tables (minigames.md). Data only; the sim-side numbers (carry limit, caps) live in rules.ts `MINIGAME`. */
import type { WeatherId } from './windows';

/** Shared mini-game scene numbers (minigames.md "Shared rules"). */
export const MINIGAME_SCENE = {
  /** Fixed simulation rate (steps per second). */
  stepHz: 60,
  /** 3-2-1 countdown before play (not counted in `elapsed`). */
  countdownS: 1.5,
  /** HUD strip height; the play field is the canvas below it. */
  hudH: 24,
  /** Touch pause icon size (top-right). */
  pauseIcon: 24,
  /** Touch drag: the craft steers toward a point this far above the finger. */
  touchOffsetY: 40,
  /** A tap is a press shorter than this that moved less than `tapMovePx`. */
  tapMs: 200,
  tapMovePx: 10,
  /** Penalty added to the auto-resolve roll on Skip (salvage: d100 - 10). */
  skipPenalty: 10,
} as const;

/** Salvage Run debris types. */
export type DebrisId = 'crate' | 'pallet' | 'galley' | 'plate' | 'pump' | 'gyro' | 'scrap' | 'tumbler' | 'hot';

/** One debris row: what reeling it in yields, spawn weight, radius and drift ranges (px, px/s). */
export interface DebrisSpec {
  rations: number;
  /** Spare part yielded (1), if any. */
  part: 'plates' | 'pumps' | 'gyros' | null;
  weight: number;
  radius: readonly [number, number];
  drift: readonly [number, number];
  hazard: 'tumbler' | 'hot' | null;
}

const D = (rations: number, part: DebrisSpec['part'], weight: number, radius: [number, number], drift: [number, number], hazard: DebrisSpec['hazard'] = null): DebrisSpec =>
  ({ rations, part, weight, radius, drift, hazard });

/** Debris spawn table (weights sum to 100). */
export const DEBRIS: Readonly<Record<DebrisId, DebrisSpec>> = {
  crate: D(5, null, 30, [6, 6], [30, 50]),
  pallet: D(15, null, 15, [10, 10], [15, 30]),
  galley: D(30, null, 5, [14, 14], [10, 20]),
  plate: D(0, 'plates', 4, [10, 10], [20, 35]),
  pump: D(0, 'pumps', 3, [7, 7], [25, 40]),
  gyro: D(0, 'gyros', 3, [6, 6], [30, 50]),
  scrap: D(0, null, 25, [5, 12], [20, 45]),
  tumbler: D(0, null, 10, [12, 12], [40, 70], 'tumbler'),
  hot: D(0, null, 5, [8, 8], [20, 40], 'hot'),
};

export const DEBRIS_ORDER: readonly DebrisId[] = ['crate', 'pallet', 'galley', 'plate', 'pump', 'gyro', 'scrap', 'tumbler', 'hot'];

/** Salvage Run arena (canvas coordinates; the field is y 24..400). */
export const SALVAGE_RUN = {
  durationS: 40,
  field: { left: 0, right: 640, top: 24, bottom: 400 },
  /** Docked ship art occupies x 0..40. */
  shipW: 40,
  droneStart: { x: 64, y: 200 },
  drone: { maxSpeed: 160, accel: 420, drag: 300, radius: 6, hp: 3, knockback: 120, invulnS: 1.0 },
  grapple: { speed: 500, range: 140, reelS: 0.5, reelSpeedFactor: 0.5, cooldownS: 0.8 },
  spawn: { minIntervalS: 0.25, yMin: 40, yMax: 376, headingSpreadDeg: 20 },
  /** By `state.segment` (next waypoint): target population and multipliers. */
  phases: [
    { maxSegment: 5, population: 10, partWeight: 1, drift: 1 },
    { maxSegment: 13, population: 12, partWeight: 1.5, drift: 1 },
    { maxSegment: 99, population: 8, partWeight: 1, drift: 1.2 },
  ],
  /** Weather multipliers; `blipRange` = ion fog draws items beyond this distance as grey blips. */
  weather: {
    unsettled: { tumbler: 1.5 },
    storm: { hot: 3, drift: 1.2 },
    flare: { hot: 3, drift: 1.2 },
    fog: { blipRange: 150 },
  } as Partial<Record<WeatherId, { tumbler?: number; hot?: number; drift?: number; blipRange?: number }>>,
} as const;

/** Debris Threading arena (minigames.md section 2). Field is y 24..400; the ship's center stays in `shipY`. */
export const THREADING_RUN = {
  durationS: 25,
  field: { left: 0, right: 640, top: 24, bottom: 400 },
  shipX: 96,
  shipY: [32, 368] as const,
  ship: { maxSpeed: 200, accel: 1200, drag: 1500, w: 20, h: 10, invulnS: 1.0 },
  /** Touch steering: desired speed = gain × distance to the steer point (capped at maxSpeed). */
  steerGain: 8,
  rocks: {
    /** R = clamp(round(T / perRock), min, max) from the option's incident chance T. */
    perRock: 3, min: 4, max: 32,
    /** Spawn times spread evenly over [from, to] s, each ± jitter. */
    from: 1, to: 24, jitterS: 0.3,
    /** Radius = base + perDensity × density ± jitter. */
    radiusBase: 10, radiusPerDensity: 2, radiusJitter: 4,
    /** Scroll = base + perDensity × density (px/s). */
    scrollBase: 150, scrollPerDensity: 15,
    /** Any `windowPx` of x holds at most `maxPerWindow` rocks and leaves a vertical gap ≥ `minGap`. */
    windowPx: 120, maxPerWindow: 2, minGap: 60,
    /** Rocks enter at this y range (uniform). */
    yMin: 40, yMax: 384,
  },
  /** Harmless parallax specks: count = perDensity × density. */
  dustPerDensity: 20,
} as const;

/** Flare Belt Finale arena (minigames.md section 3). */
export const FLARE_RUN = {
  durationS: 45,
  field: { left: 0, right: 640, top: 24, bottom: 400 },
  ship: { maxSpeed: 170, accel: 900, drag: 1100, radius: 7, invulnS: 1.0, start: { x: 320, y: 212 } },
  steerGain: 6,
  arc: {
    /** Band thickness (px); a hit is ship-center distance to the curve < thickness / 2 + ship radius. */
    thickness: 24,
    telegraphS: 1.0, activeS: 0.5, fadeS: 0.3,
    /** Spawn interval: linear from `intervalStart` (t = 0) to `intervalEnd` (t = duration). */
    intervalStart: 2.0, intervalEnd: 1.0,
    /** First telegraph starts at this time. */
    firstS: 0.5,
    /** Arcs overlapping in time leave a safe circle of this diameter. */
    minGap: 64,
    /** Curve samples for drawing and collision. */
    samples: 24,
  },
  /** Flare season (≥ 15 Sep 2184): interval × factor, telegraph shorter. */
  season: { intervalFactor: 0.8, telegraphS: 0.8 },
  /** Flare weather today: arcs stay active longer. */
  flareWeatherActiveS: 0.7,
} as const;
