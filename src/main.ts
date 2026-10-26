import Phaser from 'phaser';
import { canvasHeight, GAME_WIDTH, RENDER_SCALE, setHintBarH } from './config';
import './game/contract';
import { debugLoadState } from './game/debugLoad';
import { initA11y } from './game/a11y';
import { session } from './game/session';
import { audioBoot } from './audio/boot';
import { bindMuteKey } from './game/muteKey';
import { SCENES } from './scenes';
import { GfxPreviewScene } from './gfx/previewScene';
import { browserPlatform } from './ui/KeyHintsBand';
import { hintBarHeight } from './ui/keyHints';

// `?seed=` (string or number) makes runs reproducible; without it a random seed is shown on the title.
session.init(window.location.search);
// Hidden live region + listbox mirroring the canvas for screen readers (src/game/a11y.ts).
initA11y();
// `M` mutes anywhere except the Title (its `M` toggles mini-game auto-resolve) and while a text field takes input.
bindMuteKey();

// Key hints band: 16 px of key names, or 24 px of tappable keys on touch (keyhints.md), fixed for this page load.
setHintBarH(hintBarHeight(browserPlatform()));

// The game is rendered at a fixed retro resolution and scaled to fit.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH * RENDER_SCALE,
  height: canvasHeight() * RENDER_SCALE,
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
