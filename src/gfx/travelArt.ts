/**
 * Phaser-facing travel and title art for T-037: starfield, title hero band, sprite animation helper.
 * Pure math and tables live in travelMath.ts (re-exported here); weather overlays in weatherArt.ts.
 */
import Phaser from 'phaser';
import { activeNumbers, type PaletteKey } from './palette';
import { ALL_SPRITES } from './sprites/index';
import {
  BAND_H, BAND_W, LAYER_SPEEDS, STAR_LAYERS, lanePoints, scrollX, type LayerName, type StarLayerSpec,
} from './travelMath';

export * from './travelMath';

/** Create (once) and return the looping animation key for a multi-frame sprite texture. */
export function ensureAnim(scene: Phaser.Scene, name: string): string {
  const key = `${name}.loop`;
  const def = ALL_SPRITES.find((s) => s.name === name);
  if (!def || def.frames < 2 || def.fps <= 0 || scene.anims.exists(key)) return key;
  scene.anims.create({
    key,
    frames: Array.from({ length: def.frames }, (_, f) => ({ key: name, frame: f })),
    frameRate: def.fps,
    repeat: def.loop === false ? 0 : -1,
  });
  return key;
}

/** Add an image for a sprite, playing its loop animation when it has one (reduced motion: frame 0). */
export function addSprite(scene: Phaser.Scene, x: number, y: number, name: string, reduced = false): Phaser.GameObjects.Sprite {
  const spr = scene.add.sprite(x, y, name, 0);
  const def = ALL_SPRITES.find((s) => s.name === name);
  if (def) spr.setOrigin(def.anchor[0] / def.w, def.anchor[1] / def.h);
  if (!reduced && def && def.frames > 1 && def.fps > 0) spr.play(ensureAnim(scene, name));
  return spr;
}

export interface StarfieldOptions {
  /** Layer specs (default art.md STAR_LAYERS). */
  layers?: readonly StarLayerSpec[];
  /** Speed overrides in px/s by layer name. */
  speeds?: Partial<Record<LayerName, number>>;
  /** Position of the band's top-left. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Source of [0,1) numbers (pass `() => session.uiRng.next()`); default is deterministic. */
  random?: () => number;
  reducedMotion?: boolean;
  depth?: number;
}

export interface Starfield {
  /** Advance by dtMs; shipSpeedFactor is the thrust multiplier (0 = halted). */
  update(dtMs: number, shipSpeedFactor: number): void;
  setLayerVisible(name: LayerName, visible: boolean): void;
  /** Per-layer extra speed multiplier (ion fog: mid 0.5). */
  setLayerMul(name: LayerName, mul: number): void;
  setReducedMotion(on: boolean): void;
  readonly layers: Record<LayerName, Phaser.GameObjects.Graphics>;
  destroy(): void;
}

function defaultRandom(): () => number {
  let a = 0x2f6e2b1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three-layer parallax starfield; positions wrap at x < 0. Scroll only advances through `update`. */
export function createStarfield(scene: Phaser.Scene, opts: StarfieldOptions = {}): Starfield {
  const specs = opts.layers ?? STAR_LAYERS;
  const w = opts.width ?? BAND_W;
  const h = opts.height ?? BAND_H;
  const rnd = opts.random ?? defaultRandom();
  const pal = activeNumbers();
  let reduced = opts.reducedMotion ?? false;
  const layers = {} as Record<LayerName, Phaser.GameObjects.Graphics>;
  const mul: Record<LayerName, number> = { far: 1, mid: 1, near: 1 };
  const stars = new Map<LayerName, { x: number; y: number; c: PaletteKey }[]>();
  for (const spec of specs) {
    const g = scene.add.graphics({ x: opts.x ?? 0, y: opts.y ?? 0 });
    if (opts.depth !== undefined) g.setDepth(opts.depth);
    layers[spec.name] = g;
    stars.set(spec.name, Array.from({ length: spec.count }, () => ({
      x: Math.floor(rnd() * w), y: Math.floor(rnd() * h), c: spec.colors[Math.floor(rnd() * spec.colors.length)] as PaletteKey,
    })));
  }
  const draw = (): void => {
    for (const spec of specs) {
      const g = layers[spec.name];
      g.clear();
      for (const s of stars.get(spec.name) ?? []) {
        g.fillStyle(pal[s.c], 1);
        g.fillRect(Math.floor(s.x), s.y, spec.size, spec.size);
      }
    }
  };
  draw();
  return {
    layers,
    update(dtMs, factor) {
      if (reduced || factor <= 0) return;
      for (const spec of specs) {
        const speed = (opts.speeds?.[spec.name] ?? LAYER_SPEEDS[spec.name] ?? spec.speed) * mul[spec.name];
        for (const s of stars.get(spec.name) ?? []) s.x = scrollX(s.x, speed, dtMs, factor, w);
      }
      draw();
    },
    setLayerVisible(name, visible) {
      layers[name]?.setVisible(visible);
    },
    setLayerMul(name, m) {
      mul[name] = m;
    },
    setReducedMotion(on) {
      reduced = on;
    },
    destroy() {
      for (const spec of specs) layers[spec.name]?.destroy();
    },
  };
}

export interface TitleHero {
  objects: Phaser.GameObjects.GameObject[];
  starfield: Starfield;
  /** Call from scene update for the slow star scroll (no-op under reduced motion). */
  update(dtMs: number): void;
  destroy(): void;
}

/**
 * Title hero band (640x140 at x,y; art.md "Title hero"): hauler x2 with cruise flares at left, the
 * Lane as a dotted amber line with 3 blinking buoys, landmark.proxima half-risen behind star.proxima
 * at right, magenta/plum nebula smear upper right, three slow star layers. The logo is drawn by the scene.
 */
export function drawTitleHero(scene: Phaser.Scene, x: number, y: number, reducedMotion = false): TitleHero {
  const pal = activeNumbers();
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };
  add(scene.add.rectangle(x, y, BAND_W, BAND_H, pal.black).setOrigin(0, 0));
  // nebula: dithered magenta/plum smear, upper right
  const neb = add(scene.add.graphics({ x, y }));
  for (let py = 0; py < 70; py += 2) {
    for (let px = 340; px < BAND_W; px += 2) {
      const dx = (px - 520) / 190, dy = (py - 20) / 60;
      const d = dx * dx + dy * dy + Math.sin(px / 13 + py / 7) * 0.12;
      if (d > 1) continue;
      const on = ((px + py) / 2) % 2 === 0;
      if (d > 0.55 && !on) continue;
      neb.fillStyle(d < 0.45 ? pal.plum : (on ? pal.magenta : pal.plum), 1);
      neb.fillRect(px, py, 2, 2);
    }
  }
  const starfield = createStarfield(scene, { x, y, speeds: { far: 4, mid: 12, near: 36 }, reducedMotion });
  Object.values(starfield.layers).forEach((g) => objs.push(g));
  // Proxima: star behind, world half-risen (cropped to its top 56 rows)
  add(addSprite(scene, x + 556, y + 50, 'star.proxima', reducedMotion).setScale(2));
  const world = add(scene.add.image(x + 540, y + BAND_H - 56, 'landmark.proxima').setOrigin(0.5, 0));
  world.setCrop(0, 0, 96, 56);
  // the Lane: dotted amber line converging on the right, 3 blinking buoys
  const lane = add(scene.add.graphics({ x, y }));
  const pts = lanePoints(176, 128, 486, 86, 26);
  pts.forEach((p, i) => {
    lane.fillStyle(i % 3 === 2 ? pal.orange : pal.amber, 1);
    lane.fillRect(p.x, p.y, i < 14 ? 2 : 1, i < 14 ? 2 : 1);
  });
  [5, 13, 21].forEach((idx, i) => {
    const p = pts[idx] as { x: number; y: number };
    const size = 4 - i;
    const buoy = add(scene.add.rectangle(x + p.x - 1, y + p.y - size, size, size, pal.amber).setOrigin(0, 0));
    if (!reducedMotion) scene.tweens.add({ targets: buoy, alpha: 0.15, duration: 500, yoyo: true, repeat: -1, delay: i * 330, hold: 200 });
  });
  // ship x2 with three cruise flares
  const ship = add(scene.add.image(x + 90, y + 68, 'ship.hauler', 0).setScale(2));
  [-14, 0, 14].forEach((dy) => {
    add(addSprite(scene, x + 90 - 64 - 2, y + 68 + dy, 'ship.flare.cruise', reducedMotion).setScale(2).setOrigin(1, 0.5));
  });
  void ship;
  return {
    objects: objs,
    starfield,
    update(dtMs) {
      starfield.update(dtMs, 0.35);
    },
    destroy() {
      starfield.destroy();
      objs.forEach((o) => o.destroy());
    },
  };
}
