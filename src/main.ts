import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config';
import './game/contract';
import { debugLoadState } from './game/debugLoad';
import { session } from './game/session';
import { audioBoot } from './audio/boot';
import { SCENES } from './scenes';
import { GfxPreviewScene } from './gfx/previewScene';

// `?seed=` (string or number) makes runs reproducible; without it a random seed is shown on the title.
session.init(window.location.search);

// The game is rendered at a fixed retro resolution and scaled to fit.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // BootScene (first) builds fonts and textures, then opens Title or a `?scene=` debug scene.
  scene: [...audioBoot(SCENES), GfxPreviewScene],
};

const game = new Phaser.Game(config);
window.__PROXIMA__ = {
  game,
  version: __APP_VERSION__,
  seed: session.seedLabel,
  get state() {
    return session.state;
  },
  minigame: null,
  ...(session.debug ? { loadState: (json: string) => debugLoadState(game, json) } : {}),
};

// Keys are read from window, so they work on load; still give the canvas focus on load and first click.
game.events.once(Phaser.Core.Events.READY, () => {
  game.canvas.setAttribute('tabindex', '0');
  game.canvas.focus();
});
document.addEventListener('pointerdown', (e) => {
  // A save-string TextArea keeps focus so the player can select and paste.
  if ((e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
  window.focus();
  game.canvas?.focus();
});
