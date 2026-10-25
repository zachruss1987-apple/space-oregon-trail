/**
 * Weather overlays and phase tint for the travel band (art.md "Weather overlays" / "Travel scene band").
 * Config comes from travelMath.weatherTint; this file only draws.
 */
import Phaser from 'phaser';
import type { WeatherId } from '@/content/windows';
import { activeNumbers } from './palette';
import { BAND_H, BAND_W, phaseTint, weatherTint } from './travelMath';

export interface WeatherOverlay {
  /** Every game object the overlay owns (so a scene can put them in a container). */
  readonly objects: Phaser.GameObjects.GameObject[];
  setWeather(w: WeatherId): void;
  /** dtMs of real time; steps animation frames, fog scroll, streaks and the border flash. */
  update(dtMs: number): void;
  setReducedMotion(on: boolean): void;
  destroy(): void;
}

export interface OverlayOptions {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  reducedMotion?: boolean;
  /** [0,1) numbers for streak heights. */
  random?: () => number;
  depth?: number;
}

/** 640x140 flare glow: three dithered orange bands from the right edge. */
export function drawGlow(g: Phaser.GameObjects.Graphics, w = BAND_W, h = BAND_H): void {
  const pal = activeNumbers();
  g.clear();
  const bands: [number, number][] = [[170, 0.16], [110, 0.22], [55, 0.3]];
  bands.forEach(([bw, a], i) => {
    g.fillStyle(i === 2 ? pal.amber : pal.orange, a);
    for (let y = 0; y < h; y++) for (let x = w - bw + (y % 2); x < w; x += 2) g.fillRect(x, y, 1, 1);
    g.fillStyle(pal.orange, a * 0.6);
    g.fillRect(w - bw, 0, bw, h);
  });
}

export function createWeatherOverlay(scene: Phaser.Scene, weather: WeatherId, opts: OverlayOptions = {}): WeatherOverlay {
  const x = opts.x ?? 0, y = opts.y ?? 0, w = opts.w ?? BAND_W, h = opts.h ?? BAND_H;
  const pal = activeNumbers();
  const rnd = opts.random ?? Math.random;
  let reduced = opts.reducedMotion ?? false;
  let cur = weather;
  const stat = scene.add.tileSprite(x, y, w, h, 'overlay.static', 0).setOrigin(0, 0).setVisible(false);
  const fog = scene.add.tileSprite(x, y, w, h, 'overlay.fog', 0).setOrigin(0, 0).setVisible(false);
  const glow = scene.add.graphics({ x, y }).setVisible(false);
  drawGlow(glow, w, h);
  const border = scene.add.graphics({ x, y }).setVisible(false);
  border.lineStyle(1, pal.amber, 1).strokeRect(0.5, 0.5, w - 1, h - 1);
  const streak = scene.add.image(x + w, y, 'overlay.streak').setOrigin(1, 0).setVisible(false);
  const all = [stat, fog, glow, border, streak];
  if (opts.depth !== undefined) all.forEach((o) => o.setDepth(opts.depth as number));
  let t = 0, frameT = 0, streakT = 0, streakX = -1;
  const apply = (): void => {
    const a = weatherTint(cur);
    fog.setVisible(a.overlay === 'overlay.fog').setAlpha(a.overlayAlpha);
    glow.setVisible(a.overlay === 'overlay.glow');
    stat.setVisible(a.overlay === 'overlay.static' || a.extraStaticAlpha > 0).setAlpha(a.overlay === 'overlay.static' ? a.overlayAlpha : a.extraStaticAlpha);
    border.setVisible(false);
    streak.setVisible(false);
    streakX = -1;
  };
  apply();
  return {
    objects: all,
    setWeather(wx) {
      cur = wx;
      apply();
    },
    setReducedMotion(on) {
      reduced = on;
      if (on) {
        stat.setFrame(0);
        fog.setFrame(0);
        streak.setVisible(false);
        border.setVisible(false);
      }
    },
    update(dtMs) {
      if (reduced) return;
      const a = weatherTint(cur);
      t += dtMs;
      frameT += dtMs;
      if (stat.visible) stat.setFrame(Math.floor(frameT / (1000 / 12)) % 4);
      if (fog.visible) {
        fog.setFrame(Math.floor(frameT / 500) % 2);
        fog.tilePositionX -= (a.scrollPxPerSec * dtMs) / 1000;
      }
      if (a.borderFlashMs > 0) border.setVisible(t % a.borderFlashMs < 200);
      if (a.streakEveryMs > 0) {
        streakT += dtMs;
        if (streakX < 0 && streakT >= a.streakEveryMs) {
          streakT = 0;
          streakX = w + 8;
          streak.setY(y + 8 + Math.floor(rnd() * (h - 16)));
        }
        if (streakX >= 0) {
          streakX -= (dtMs * 360) / 1000;
          streak.setX(x + streakX).setVisible(streakX > -8);
          if (streakX <= -8) streakX = -1;
        }
      }
    },
    destroy() {
      all.forEach((o) => o.destroy());
    },
  };
}

/** Phase wash by segment, drawn into `g` (cleared first): mid = plum 3-px dithered edges, post = red bands from the right. */
export function drawPhaseTint(g: Phaser.GameObjects.Graphics, segment: number, w = BAND_W, h = BAND_H): void {
  const pal = activeNumbers();
  g.clear();
  const kind = phaseTint(segment);
  if (kind === 'mid') {
    g.fillStyle(pal.plum, 1);
    for (let i = 0; i < 3; i++)
      for (let px = i % 2; px < w; px += 2) {
        g.fillRect(px, i, 1, 1);
        g.fillRect(px, h - 1 - i, 1, 1);
      }
  } else if (kind === 'post') {
    g.fillStyle(pal.red, 1);
    for (const [bw, off] of [[90, 0], [40, 1]] as const)
      for (let py = 0; py < h; py++) for (let px = w - bw + ((py + off) % 2); px < w; px += 2) g.fillRect(px, py, 1, 1);
  }
}
