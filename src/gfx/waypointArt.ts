/**
 * Waypoint art for the bands (art.md "Stations", "Landmarks, planets, waypoints", hazard compositions): one function
 * draws the full-size art of any waypoint at an anchor point, one picks the `far.*` icon for the approach tier.
 */
import Phaser from 'phaser';
import { activeNumbers } from './palette';
import { addSprite } from './travelArt';
import { drawGlow } from './weatherArt';

/** Full sprite per waypoint index (stations, landmarks); hazards use compositions instead. */
const SPRITE_BY_INDEX: Readonly<Record<number, string>> = {
  0: 'station.independence', 3: 'station.mars', 4: 'landmark.spire', 5: 'station.ceres', 6: 'landmark.eye',
  8: 'station.europa', 10: 'station.titan', 11: 'landmark.gate', 12: 'station.oort', 14: 'station.terminus', 16: 'landmark.proxima',
};

export type HazardComposition = 'lunar' | 'shoals' | 'belt' | 'saturn' | 'shock' | 'flare';
const HAZARD_BY_INDEX: Readonly<Record<number, HazardComposition>> = { 1: 'lunar', 2: 'shoals', 7: 'belt', 9: 'saturn', 13: 'shock', 15: 'flare' };

/** Sprite name for a waypoint's full art, or null for hazards (compositions). */
export const waypointSprite = (index: number): string | null => SPRITE_BY_INDEX[index] ?? null;
export const hazardComposition = (index: number): HazardComposition | null => HAZARD_BY_INDEX[index] ?? null;

/** `far.*` icon for the mid-range approach tier by waypoint type. */
export function farIcon(type: string): string {
  if (type === 'hazard') return 'far.hazard';
  if (type === 'gate') return 'far.ring';
  if (type === 'station' || type === 'start') return 'far.station';
  return 'far.planet';
}

/** Small deterministic sequence for composition layouts (no run Rng involved). */
function seq(seed: number): () => number {
  let a = seed * 2654435761 >>> 0;
  return () => {
    a = (a ^ (a << 13)) >>> 0;
    a = (a ^ (a >>> 17)) >>> 0;
    a = (a ^ (a << 5)) >>> 0;
    return a / 4294967296;
  };
}

/**
 * Draw a hazard composition centred on (cx, cy) inside a band `w` x `h` (art.md "Hazards reuse parts"). Returns the
 * objects so the caller can destroy or hide them.
 */
export function drawHazard(scene: Phaser.Scene, kind: HazardComposition, cx: number, cy: number, w: number, h: number, reduced = false): Phaser.GameObjects.GameObject[] {
  const pal = activeNumbers();
  const out: Phaser.GameObjects.GameObject[] = [];
  const rnd = seq(kind.length * 97 + w);
  const left = cx - w / 2, top = cy - h / 2;
  const img = (x: number, y: number, name: string, frame = 0): Phaser.GameObjects.Image => {
    const o = scene.add.image(Math.round(x), Math.round(y), name, frame);
    out.push(o);
    return o;
  };
  const g = scene.add.graphics();
  out.push(g);
  switch (kind) {
    case 'lunar': {
      img(left + 40, cy, 'planet.luna');
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        img(left + 70 + t * (w - 90), top + 10 + t * (h - 20) + (rnd() - 0.5) * 16, i % 3 === 0 ? 'debris.scrap.s' : 'rock.16');
      }
      break;
    }
    case 'shoals': {
      for (const [y0, flip] of [[top + h * 0.3, 0], [top + h * 0.62, 1]] as const) {
        for (let y = 0; y < 10; y++) for (let x = 0; x < w; x += 2) {
          if (rnd() < 0.55) continue;
          g.fillStyle((x + y + flip) % 4 === 0 ? pal.grey : pal.brown, 1).fillRect(left + x + ((y + flip) % 2), y0 + y, 1, 1);
        }
      }
      break;
    }
    case 'belt': {
      const sizes = ['rock.24', 'rock.32', 'rock.48'];
      for (let row = 0; row < 3; row++) {
        const n = 4 + row;
        for (let i = 0; i < n; i++) img(left + (i + 0.5 + (rnd() - 0.5) * 0.6) * (w / n), top + h * (0.25 + row * 0.25) + (rnd() - 0.5) * 10, sizes[row] as string);
      }
      break;
    }
    case 'saturn': {
      g.fillStyle(pal.peach, 1).fillRect(left, cy, w, 1);
      g.fillStyle(pal.grey, 1).fillRect(left, cy + 1, w, 1);
      img(left + 56, cy, 'planet.saturn');
      for (let i = 0; i < 8; i++) img(left + 120 + rnd() * (w - 140), cy + (rnd() - 0.5) * 20, 'rock.16');
      break;
    }
    case 'shock': {
      const wall = scene.add.graphics();
      out.push(wall);
      const paint = (off: number): void => {
        wall.clear();
        for (let y = 0; y < h; y++) for (let x = 0; x < 48; x++) {
          if ((x + y + off) % 2) continue;
          wall.fillStyle(x < 24 ? pal.plum : pal.cyan, 1).fillRect(cx - 24 + x + Math.round(Math.sin((y + off * 3) / 6) * 3), top + y, 1, 1);
        }
      };
      paint(0);
      if (!reduced) {
        let f = 0;
        scene.time.addEvent({ delay: 400, loop: true, callback: () => wall.active && paint((f = 1 - f)) });
      }
      break;
    }
    case 'flare': {
      const glow = scene.add.graphics({ x: left, y: top });
      drawGlow(glow, w, h);
      out.push(glow);
      out.push(addSprite(scene, left + w - 40, cy, 'star.proxima', reduced));
      for (const dy of [-18, 14]) {
        const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(left + w - 60, cy + dy), new Phaser.Math.Vector2(left + w * 0.45, cy + dy * 3), new Phaser.Math.Vector2(left + 20, cy + dy * 0.5));
        g.lineStyle(3, pal.orange, 0.6);
        c.draw(g, 32);
        g.lineStyle(1, pal.amber, 0.8);
        c.draw(g, 32);
      }
      break;
    }
  }
  return out;
}

/**
 * Full-size art for waypoint `index` anchored at (x, y) (sprites by their anchor; hazard compositions centred in a
 * `w` x `h` box). Returns the objects.
 */
export function drawWaypointArt(scene: Phaser.Scene, index: number, x: number, y: number, w = 200, h = 120, reduced = false): Phaser.GameObjects.GameObject[] {
  const name = waypointSprite(index);
  if (name) return [addSprite(scene, x, y, name, reduced)];
  const kind = hazardComposition(index);
  return kind ? drawHazard(scene, kind, x, y, w, h, reduced) : [];
}
