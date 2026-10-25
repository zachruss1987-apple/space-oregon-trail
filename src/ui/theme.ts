/** Text-first theme: phosphor green monospace on black (pixel font and palette arrive in M4). */
import type Phaser from 'phaser';

export const COLORS = {
  text: '#5cff5c',
  dim: '#2e8a2e',
  bright: '#c8ffc8',
  warn: '#ffd75c',
  bg: 0x000000,
  panel: 0x001a00,
  border: 0x5cff5c,
  borderDim: 0x2e8a2e,
} as const;

export const FONT_SIZE = 14;
export const LINE_HEIGHT = 18;
/** Approximate monospace advance at FONT_SIZE, used for column layout. */
export const CHAR_W = 8.4;

/** Standard text style; `wrap` is a pixel width for word-wrap. */
export function textStyle(color: string = COLORS.text, wrap?: number, size = FONT_SIZE): Phaser.Types.GameObjects.Text.TextStyle {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: `${size}px`,
    color,
    resolution: 2,
    lineSpacing: LINE_HEIGHT - size,
  };
  if (wrap !== undefined) style.wordWrap = { width: wrap, useAdvancedWrap: true };
  return style;
}

/** Draw a bordered panel rectangle. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, dim = false): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(x, y, w, h, COLORS.panel)
    .setOrigin(0, 0)
    .setStrokeStyle(1, dim ? COLORS.borderDim : COLORS.border);
}

/** Integer with thousands separators. */
export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/** Pad/truncate to a fixed column width. */
export function col(s: string, width: number, right = false): string {
  const t = s.length > width ? s.slice(0, width) : s;
  return right ? t.padStart(width) : t.padEnd(width);
}

/** Credits with separators and cents only when present ("1,040", "0.30"). */
export function money(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}
