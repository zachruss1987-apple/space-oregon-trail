/**
 * The Travel scene's 640x140 band (art.md "Travel scene band"): phase tint, parallax starfield, the hauler with its
 * damage state and drive flares, the next waypoint's approach (blip / far icon / full art) and the weather overlay.
 */
import type Phaser from 'phaser';
import { WAYPOINTS } from '@/content';
import { activeNumbers } from '@/gfx/palette';
import { ALL_SPRITES } from '@/gfx/sprites';
import { addSprite, BAND_H, BAND_W, createStarfield, landmarkScale, type Starfield } from '@/gfx/travelArt';
import { drawWaypointArt, farIcon, waypointSprite } from '@/gfx/waypointArt';
import { createWeatherOverlay, drawPhaseTint, type WeatherOverlay } from '@/gfx/weatherArt';
import { session } from '@/game/session';
import { brokenParts, remainingInSegment, workingDrives, type GameState } from '@/sim';

const SHIP_X = 160;
const SHIP_Y = 80;
/** Nozzle rows of ship.hauler relative to its anchor (x at the left edge). */
const NOZZLES = [-6, 1, 8];
const FLARE_BY_THRUST = { cruise: 'ship.flare.cruise', hard: 'ship.flare.burn', overburn: 'ship.flare.over' } as const;
/** Star scroll factor by thrust (Cruise 1, Hard burn 1.5, Overburn 2). */
const SPEED_BY_THRUST = { cruise: 1, hard: 1.5, overburn: 2 } as const;

/** 0 intact, 1 damaged (one broken part or an offline drive), 2 critical (hull broken or two or more problems). */
export function damageState(s: GameState): 0 | 1 | 2 {
  const broken = brokenParts(s);
  const offline = s.supplies.drives - workingDrives(s);
  const problems = broken.length + (offline > 0 ? 1 : 0);
  if (s.broken.hull || problems >= 2) return 2;
  return problems === 1 ? 1 : 0;
}

export class TravelBand {
  private readonly stars: Starfield;
  private readonly weather: WeatherOverlay;
  private readonly tint: Phaser.GameObjects.Graphics;
  private readonly ship: Phaser.GameObjects.Image;
  private flares: Phaser.GameObjects.Sprite[] = [];
  private approach: Phaser.GameObjects.GameObject[] = [];
  private approachKey = '';
  private blip: Phaser.GameObjects.Rectangle | null = null;
  private t = 0;
  private state: 0 | 1 | 2 = 0;
  private flareOn = false;
  private reduced: boolean;

  constructor(private readonly scene: Phaser.Scene, s: GameState) {
    const pal = activeNumbers();
    this.reduced = session.settings.reducedMotion;
    scene.add.rectangle(0, 0, BAND_W, BAND_H, pal.black).setOrigin(0, 0);
    this.tint = scene.add.graphics();
    this.stars = createStarfield(scene, { random: () => session.uiRng.next(), reducedMotion: this.reduced });
    this.ship = scene.add.image(SHIP_X, SHIP_Y, 'ship.hauler', 0).setDepth(5);
    this.weather = createWeatherOverlay(scene, s.weather, { random: () => session.uiRng.next(), reducedMotion: this.reduced, depth: 6 });
    scene.add.rectangle(0, BAND_H - 1, BAND_W, 1, pal.forest).setOrigin(0, 0).setDepth(7);
    this.refresh(s);
  }

  /** Re-read the state: tint, weather, damage frame, flares, approach. */
  refresh(s: GameState): void {
    drawPhaseTint(this.tint, s.segment);
    this.weather.setWeather(s.weather);
    this.stars.setLayerVisible('far', s.weather !== 'fog');
    this.stars.setLayerMul('mid', s.weather === 'fog' ? 0.5 : 1);
    this.state = damageState(s);
    this.flareOn = s.arrivedAt === null && workingDrives(s) > 0;
    this.flares.forEach((f) => f.destroy());
    const name = FLARE_BY_THRUST[s.thrust];
    this.flares = this.flareOn
      ? NOZZLES.slice(0, Math.min(3, workingDrives(s))).map((dy) => addSprite(this.scene, SHIP_X - 32, SHIP_Y + dy, name, this.reduced).setOrigin(1, 0.5).setDepth(4))
      : [];
    this.ship.setFrame(this.state * 2);
    this.drawApproach(s);
  }

  /** Per frame: scroll while a day animates (`moving`), animate the overlay, flare frame and bob. */
  update(dtMs: number, s: GameState, moving: boolean): void {
    this.t += dtMs;
    this.stars.update(dtMs, moving ? SPEED_BY_THRUST[s.thrust] : 0);
    this.weather.update(dtMs);
    if (this.blip) this.blip.setVisible(this.reduced || Math.floor(this.t / 500) % 2 === 0);
    if (this.reduced) return;
    const flareFrame = this.flareOn ? Math.floor(this.t / 125) % 2 : 0;
    this.ship.setFrame(this.state * 2 + flareFrame);
    this.ship.setY(SHIP_Y + (moving && Math.floor(this.t / 500) % 2 === 1 ? 1 : 0));
  }

  private drawApproach(s: GameState): void {
    const parked = s.arrivedAt !== null;
    const index = parked ? (s.arrivedAt as number) : s.segment;
    const w = WAYPOINTS[index];
    const a = parked ? { tier: 'full' as const, x: 440 } : landmarkScale(remainingInSegment(s));
    const key = `${index}:${a.tier}:${a.x}`;
    if (key === this.approachKey) return;
    this.approachKey = key;
    this.approach.forEach((o) => o.destroy());
    this.approach = [];
    this.blip = null;
    if (!w || a.tier === 'none') return;
    const pal = activeNumbers();
    if (a.tier === 'blip') {
      this.blip = this.scene.add.rectangle(a.x, 70, 2, 2, w.type === 'hazard' ? pal.red : pal.amber).setDepth(3);
      this.approach.push(this.blip);
    } else if (a.tier === 'far') {
      this.approach.push(this.scene.add.image(a.x, 70, farIcon(w.type)).setDepth(3));
    } else {
      this.approach = drawWaypointArt(this.scene, index, a.x, this.artY(index), 300, BAND_H - 8, this.reduced);
      this.approach.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(3));
    }
  }

  /** Anchor y in the band: bottom-anchored sprites (spire, needles) stand near the band floor, others centre. */
  private artY(index: number): number {
    const def = ALL_SPRITES.find((d) => d.name === waypointSprite(index));
    return def && def.anchor[1] === def.h - 1 ? BAND_H - 6 : 70;
  }

  destroy(): void {
    this.stars.destroy();
    this.weather.destroy();
  }
}
