/**
 * Applies the persisted Options to the running game: palette (re-rasterize sprites), CRT post-effect, audio volumes.
 * Called by the Boot scene and the Options scene.
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { crtDefaultOn, detectCrtEnv, enableCrt, isWebGL } from '@/gfx/crt';
import { setColorblind } from '@/gfx/palette';
import { registerAll } from '@/gfx/sprites';
import { addChromeFrames } from '@/ui/chrome';
import { crtWanted } from './options';
import { session } from './session';

/** CRT row value: is the shader available at all (WebGL)? */
export const crtAvailable = (game: Phaser.Game): boolean => isWebGL(game);

/**
 * Turn the CRT on/off from the options (art.md defaults when never chosen; reduced motion forces it off).
 * `body[data-crt]` mirrors it (`on` / `off`) and `body[data-reduced]` the reduced-motion setting (`1` / `0`).
 */
export function applyCrt(game: Phaser.Game): boolean {
  const reduced = session.settings.reducedMotion;
  const want = crtWanted(session.options, crtDefaultOn(detectCrtEnv(game, reduced)), reduced);
  const on = enableCrt(game, want, undefined, reduced);
  document.body.dataset['crt'] = on ? 'on' : 'off';
  document.body.dataset['reduced'] = reduced ? '1' : '0';
  return on;
}

/** The CRT value the Options row shows (saved choice, else the environment default). */
export function crtShown(game: Phaser.Game): boolean {
  const reduced = session.settings.reducedMotion;
  return crtWanted(session.options, crtDefaultOn(detectCrtEnv(game, reduced)), reduced);
}

/**
 * Switch palette tables and re-rasterize every sprite (Graphics and text re-tint when redrawn: scenes read
 * `activePalette()` on create, and Options restarts itself). `body[data-palette]` = `standard` / `cb`.
 */
export function applyPalette(scene: Phaser.Scene): void {
  setColorblind(session.options.palette === 'cb');
  document.body.dataset['palette'] = session.options.palette;
  registerAll(scene);
  addChromeFrames(scene);
}

/** Music / SFX bus gains from the 0..10 steps. */
export function applyVolumes(): void {
  audio().setVolumes({ music: session.options.music / 10, sfx: session.options.sfx / 10 });
}
