/**
 * Per-frame sprite pool for mini-game objects (debris, rocks): sprites are created once per texture slot and reused
 * every frame; slots not claimed this frame are hidden. Origins follow each sprite's grid anchor (art.md).
 */
import type Phaser from 'phaser';
import { ALL_SPRITES } from '@/gfx/sprites';

/** Set a sprite's origin from its SpriteDef anchor. */
export function anchorOf<T extends Phaser.GameObjects.Components.Origin>(obj: T, name: string): T {
  const def = ALL_SPRITES.find((s) => s.name === name);
  if (def) obj.setOrigin(def.anchor[0] / def.w, def.anchor[1] / def.h);
  return obj;
}

/** Add a static sprite image with its anchor origin. */
export function addAnchored(scene: Phaser.Scene, x: number, y: number, name: string, frame = 0): Phaser.GameObjects.Image {
  return anchorOf(scene.add.image(x, y, name, frame), name);
}

export class SpritePool {
  private readonly slots = new Map<string, Phaser.GameObjects.Image[]>();
  private readonly used = new Map<string, number>();

  constructor(private readonly scene: Phaser.Scene, private readonly depth = 10) {}

  /** Start a frame: every slot becomes free. */
  begin(): void {
    this.used.clear();
  }

  /** Claim a visible image of texture `name` (frame 0, no tint, alpha 1, angle 0). */
  get(name: string): Phaser.GameObjects.Image {
    const list = this.slots.get(name) ?? [];
    this.slots.set(name, list);
    const i = this.used.get(name) ?? 0;
    this.used.set(name, i + 1);
    let img = list[i];
    if (!img) {
      img = anchorOf(this.scene.add.image(0, 0, name, 0), name).setDepth(this.depth);
      list.push(img);
    }
    return img.setVisible(true).setFrame(0).clearTint().setAlpha(1).setAngle(0);
  }

  /** End a frame: hide every slot not claimed since `begin`. */
  end(): void {
    for (const [name, list] of this.slots) {
      const n = this.used.get(name) ?? 0;
      for (let i = n; i < list.length; i++) list[i]?.setVisible(false);
    }
  }
}
