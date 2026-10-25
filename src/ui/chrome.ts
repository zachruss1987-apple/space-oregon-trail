/**
 * UI chrome from the `ui.*` sprites (art.md "UI chrome"): panels with `ui.panel` 9-slice corners and the double rule,
 * the `ui.cursor` ship, `ui.toggle`. `addChromeFrames` registers the corner frames once per rasterize.
 */
import type Phaser from 'phaser';
import { COLORS } from './theme';

const C = 8;
const CORNERS = { tl: [0, 0], tr: [16, 0], bl: [0, 16], br: [16, 16] } as const;

/** Register `tl0..br1` frames on the `ui.panel` texture (call after `registerAll`). */
export function addChromeFrames(scene: Phaser.Scene): void {
  const tex = scene.textures.get('ui.panel');
  if (!tex || tex.key === '__MISSING') return;
  for (const f of [0, 1]) {
    for (const [k, [cx, cy]] of Object.entries(CORNERS)) {
      if (!tex.has(`${k}${f}`)) tex.add(`${k}${f}`, 0, f * 24 + cx, cy, C, C);
    }
  }
}

/** A panel: fill, `ui.panel` corners, double-rule edges; `focused` uses the phosphor frame. Returns its objects. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, dim = true, depth?: number): Phaser.GameObjects.GameObject[] {
  const f = dim ? 0 : 1;
  const color = dim ? COLORS.borderDim : COLORS.border;
  const fill = scene.add.rectangle(x, y, w, h, COLORS.panel).setOrigin(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  // outer rule on row/col 0, inner on 3 (matches the sprite grid)
  for (const o of [0, 3]) {
    g.fillRect(x + C, y + o, w - 2 * C, 1);
    g.fillRect(x + C, y + h - 1 - o, w - 2 * C, 1);
    g.fillRect(x + o, y + C, 1, h - 2 * C);
    g.fillRect(x + w - 1 - o, y + C, 1, h - 2 * C);
  }
  const out: Phaser.GameObjects.GameObject[] = [fill, g];
  if (scene.textures.exists('ui.panel')) {
    out.push(
      scene.add.image(x, y, 'ui.panel', `tl${f}`).setOrigin(0, 0),
      scene.add.image(x + w - C, y, 'ui.panel', `tr${f}`).setOrigin(0, 0),
      scene.add.image(x, y + h - C, 'ui.panel', `bl${f}`).setOrigin(0, 0),
      scene.add.image(x + w - C, y + h - C, 'ui.panel', `br${f}`).setOrigin(0, 0),
    );
  }
  if (depth !== undefined) out.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth));
  return out;
}

/** The amber `ui.cursor` ship (anchor left-middle); blinks at 2 Hz unless `still`. */
export function cursor(scene: Phaser.Scene, depth = 0, still = false): Phaser.GameObjects.Image {
  const img = scene.add.image(0, 0, 'ui.cursor', 0).setOrigin(0, 0).setDepth(depth);
  if (!still) {
    scene.time.addEvent({ delay: 250, loop: true, callback: () => img.active && img.setFrame(img.frame.name === '0' ? 1 : 0) });
  }
  return img;
}

/** The `ui.toggle` switch (frame 1 = on). */
export function toggle(scene: Phaser.Scene, x: number, y: number, on: boolean): Phaser.GameObjects.Image {
  return scene.add.image(x, y, 'ui.toggle', on ? 1 : 0).setOrigin(0, 0);
}
