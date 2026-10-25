/** Logical render size. A 16:10 retro canvas, scaled by Phaser to fit the window. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 400;

export const GAME_TITLE = 'The Proxima Trail';

/**
 * Backing-store scale: the canvas is drawn at 2x the logical size (1280x800) and every camera zooms 2x, so the CRT
 * pass has two device rows per logical row for its scanline. Game code keeps using logical 640x400 coordinates.
 */
export const RENDER_SCALE = 2;
