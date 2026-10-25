/** Camera setup shared by every scene: logical 640x400 world drawn at RENDER_SCALE on the backing canvas. */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '@/config';

/** Zoom the main camera so world (0..640, 0..400) fills the canvas. Call first in create(). */
export function fitCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  return scene.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
