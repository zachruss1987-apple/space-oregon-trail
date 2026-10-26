/**
 * Camera setup shared by every scene: logical 640x416 world (the 640x400 view plus the key hints band, keyhints.md)
 * drawn at RENDER_SCALE on the backing canvas.
 */
import type Phaser from 'phaser';
import { canvasHeight, GAME_WIDTH, RENDER_SCALE } from '@/config';

/** Zoom the main camera so world (0..640, 0..400 + band) fills the canvas; scenes draw in 0..400. Call first in create(). */
export function fitCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  return scene.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, canvasHeight() / 2);
}
