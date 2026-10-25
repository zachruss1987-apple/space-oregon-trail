/** Logical game view. A 16:10 retro view; scenes draw in 0..640 x 0..400. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 400;
/** The key hints band under the view (keyhints.md "Placement"). */
export const HINT_BAR_H = 16;
/** Logical canvas height: the view plus the hints band (640x416, 40:26), scaled by Phaser to fit the window. */
export const CANVAS_HEIGHT = GAME_HEIGHT + HINT_BAR_H;

export const GAME_TITLE = 'The Proxima Trail';

/**
 * Backing-store scale: the canvas is drawn at 2x the logical size (1280x832) and every camera zooms 2x, so the CRT
 * pass has two device rows per logical row for its scanline. Game code keeps using logical 640x400 coordinates (the band below is the KeyHints scene).
 */
export const RENDER_SCALE = 2;
