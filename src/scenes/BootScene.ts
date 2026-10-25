import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_TITLE, GAME_WIDTH } from '../config';

/**
 * Minimal boot scene for Milestone 0: proves the toolchain, build, and E2E
 * pipeline work end to end. Replaced by a real title screen in Milestone 1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, GAME_TITLE.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#5cff5c',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, 'PRESS SPACE BAR TO CONTINUE', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#5cff5c',
      })
      .setOrigin(0.5)
      .setName('prompt');
    // Marker read by the E2E smoke test to know the scene has rendered.
    document.body.dataset['scene'] = 'Boot';
  }
}
