import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

// The game is rendered at a fixed retro resolution and scaled up with integer
// nearest-neighbour scaling so pixel art stays crisp.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene],
};

declare global {
  interface Window {
    /** Exposed for Playwright tests and debugging. */
    __PROXIMA__?: { game: Phaser.Game; version: string };
  }
}

const game = new Phaser.Game(config);
window.__PROXIMA__ = { game, version: __APP_VERSION__ };
