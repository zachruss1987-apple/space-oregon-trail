/** Logical game view. A 16:10 retro view; scenes draw in 0..640 x 0..400. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 400;

/** Key hints band height: 16 (key names) or 24 (touch buttons), set once by main.ts before the game starts (keyhints.md). */
let hintBar = 16;

/** Set the band height (main.ts, from `hintBarHeight(browserPlatform())`, before `new Phaser.Game`). */
export function setHintBarH(h: number): void {
  hintBar = h;
}

/** The key hints band under the view (keyhints.md "Placement"). */
export const hintBarH = (): number => hintBar;
/** Logical canvas height: the view plus the hints band (640x416 on desktop, 640x424 on touch). */
export const canvasHeight = (): number => GAME_HEIGHT + hintBar;

/** True for a pointer on the key hints band (y >= 400): scene-wide tap handlers leave it to the band's buttons. */
export const inHintBand = (p: { worldY: number }): boolean => p.worldY >= GAME_HEIGHT;

export const GAME_TITLE = 'The Proxima Trail';

/**
 * Backing-store scale: the canvas is drawn at 2x the logical size (1280x832 on desktop) and every camera zooms 2x, so the CRT
 * pass has two device rows per logical row for its scanline. Game code keeps using logical 640x400 coordinates, the hints band below them.
 */
export const RENDER_SCALE = 2;
