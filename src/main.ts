import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import './game/contract';
import { session } from './game/session';
import { SCENES } from './scenes';

// `?seed=` (string or number) makes runs reproducible; without it a random seed is shown on the title.
session.init(window.location.search);

// The game is rendered at a fixed retro resolution and scaled to fit.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: SCENES,
};

const game = new Phaser.Game(config);
window.__PROXIMA__ = {
  game,
  version: __APP_VERSION__,
  seed: session.seedLabel,
  get state() {
    return session.state;
  },
};

// Keys are read from window, so they work on load; still give the canvas focus on load and first click.
game.events.once(Phaser.Core.Events.READY, () => {
  game.canvas.setAttribute('tabindex', '0');
  game.canvas.focus();
});
document.addEventListener('pointerdown', () => {
  window.focus();
  game.canvas?.focus();
});
