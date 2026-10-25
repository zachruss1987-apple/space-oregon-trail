/**
 * Pure (Phaser-free) tables and math for the travel band and title hero (docs/design/art.md
 * "Travel scene band"). Unit-tested in tests/unit/gfx/travelMath.test.ts.
 */
import type { PaletteKey } from './palette';
import type { WeatherId } from '@/content/windows';

export const BAND_W = 640;
export const BAND_H = 140;

export type LayerName = 'far' | 'mid' | 'near';

export interface StarLayerSpec {
  name: LayerName;
  count: number;
  /** Pixels per second at ship speed factor 1. */
  speed: number;
  /** Square star size in logical pixels. */
  size: number;
  colors: readonly PaletteKey[];
}

/** art.md star layers: far 90 x 1px @ 4 px/s, mid 40 x 1px @ 12 px/s, near 12 x 2px @ 36 px/s. */
export const STAR_LAYERS: readonly StarLayerSpec[] = [
  { name: 'far', count: 90, speed: 4, size: 1, colors: ['grey', 'navy'] },
  { name: 'mid', count: 40, speed: 12, size: 1, colors: ['silver'] },
  { name: 'near', count: 12, speed: 36, size: 2, colors: ['white', 'cyan'] },
];

/** Layer speed table in px/s (convenience for tests and callers). */
export const LAYER_SPEEDS: Readonly<Record<LayerName, number>> = { far: 4, mid: 12, near: 36 };

/** Thrust multipliers for the star scroll: Cruise 1, Hard burn 1.5, Overburn 2. */
export const THRUST_SPEED: Readonly<Record<'cruise' | 'burn' | 'over', number>> = { cruise: 1, burn: 1.5, over: 2 };

/** New x after scrolling left; wraps to the right edge when x < 0. */
export function scrollX(x: number, speedPxPerSec: number, dtMs: number, factor: number, width = BAND_W): number {
  let nx = x - (speedPxPerSec * factor * dtMs) / 1000;
  while (nx < 0) nx += width;
  return nx;
}

export type ApproachTier = 'none' | 'blip' | 'far' | 'full';

export interface LandmarkApproach {
  tier: ApproachTier;
  /** Anchor x in the band; 600 when nothing (or the blip) is shown. */
  x: number;
  /** Integer sprite scale. Always 1: sizes never scale; the tier change is the "growth". */
  scale: 1;
}

/**
 * Next-waypoint approach by Mk remaining (art.md): >120 nothing; 120-61 blip at 600; 60-21 far icon
 * 600 -> 520; 20-0 full sprite 520 -> 440. x is non-decreasing in mkRemaining and clamped to [440, 600].
 */
export function landmarkScale(mkRemaining: number): LandmarkApproach {
  const mk = Math.max(0, mkRemaining);
  if (mk > 120) return { tier: 'none', x: 600, scale: 1 };
  if (mk > 60) return { tier: 'blip', x: 600, scale: 1 };
  if (mk > 20) return { tier: 'far', x: Math.round(520 + (80 * (mk - 20)) / 40), scale: 1 };
  return { tier: 'full', x: Math.round(440 + (80 * mk) / 20), scale: 1 };
}

export interface WeatherArt {
  /** Overlay texture key, or null. */
  overlay: 'overlay.static' | 'overlay.fog' | 'overlay.glow' | null;
  overlayAlpha: number;
  /** Extra static overlay (flare uses static at 10%). */
  extraStaticAlpha: number;
  /** Streak overlay: one every N ms (0 = none). */
  streakEveryMs: number;
  /** Amber border flash period in ms (0 = none). */
  borderFlashMs: number;
  borderColor: PaletteKey;
  /** Star layers hidden entirely. */
  hideLayers: readonly LayerName[];
  /** Star layer speed multipliers (default 1). */
  layerMul: Partial<Record<LayerName, number>>;
  /** Horizontal overlay scroll in px/s (negative = left). */
  scrollPxPerSec: number;
  /** Tint wash palette key and alpha (null = none). */
  tint: PaletteKey | null;
  tintAlpha: number;
}

const NONE: WeatherArt = {
  overlay: null, overlayAlpha: 0, extraStaticAlpha: 0, streakEveryMs: 0, borderFlashMs: 0, borderColor: 'amber',
  hideLayers: [], layerMul: {}, scrollPxPerSec: 0, tint: null, tintAlpha: 0,
};

/** Weather visual table; covers every WeatherId. */
export const WEATHER_ART: Readonly<Record<WeatherId, WeatherArt>> = {
  calm: NONE,
  fair: NONE,
  unsettled: { ...NONE, streakEveryMs: 2000 },
  storm: { ...NONE, overlay: 'overlay.static', overlayAlpha: 0.25, borderFlashMs: 2000, tint: 'navy', tintAlpha: 0.12 },
  fog: { ...NONE, overlay: 'overlay.fog', overlayAlpha: 0.25, hideLayers: ['far'], layerMul: { mid: 0.5 }, scrollPxPerSec: -6, tint: 'cyan', tintAlpha: 0.06 },
  flare: { ...NONE, overlay: 'overlay.glow', overlayAlpha: 1, extraStaticAlpha: 0.1, tint: 'orange', tintAlpha: 0.1 },
};

export function weatherTint(weather: WeatherId): WeatherArt {
  return WEATHER_ART[weather];
}

export type PhaseTint = 'none' | 'mid' | 'post';

/** Background wash by segment: early 1-5 none, mid 6-11 plum edges, post-gate 12-16 red bands. */
export function phaseTint(segment: number): PhaseTint {
  if (segment <= 5) return 'none';
  if (segment <= 11) return 'mid';
  return 'post';
}

/** Hero Lane: perspective dotted line from (x0,y0) to the vanishing point (x1,y1); dots bunch up toward x1. */
export function lanePoints(x0: number, y0: number, x1: number, y1: number, n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = 1 - Math.pow(1 - (i + 1) / (n + 1), 1.7);
    out.push({ x: Math.round(x0 + (x1 - x0) * t), y: Math.round(y0 + (y1 - y0) * t) });
  }
  return out;
}
