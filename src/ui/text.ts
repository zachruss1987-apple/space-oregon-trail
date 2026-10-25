/**
 * Bitmap text for every scene (art.md "Pixel font"): `retro8` body text, `retro6` HUD. No Phaser Text objects.
 * `wrap` is a pixel width; wrapping follows Phaser's BitmapText rule, mirrored by `wrapLines` for line counts.
 */
import type Phaser from 'phaser';
import type { FontName } from '@/gfx/font';
import { COLORS, GLYPH_H } from './theme';

/** Leading in font pixels (scaled with the text). */
export const LEADING = 4;

export interface TextOptions {
  color?: number;
  font?: FontName;
  /** Integer scale (x1 body, x2 headings, x4 logo / countdown). */
  scale?: number;
  /** Word-wrap width in pixels. */
  wrap?: number;
  depth?: number;
  /** 0 left, 1 center, 2 right (multi-line alignment). */
  align?: 0 | 1 | 2;
  /** Leading override in font pixels. */
  leading?: number;
}

/** Cell width of a font at x1. */
export const cellW = (font: FontName = 'retro8'): number => (font === 'retro6' ? 6 : 8);

/** retro6 has only uppercase; text drawn in it is uppercased. */
const fit = (s: string, font: FontName): string => (font === 'retro6' ? s.toUpperCase() : s);

/** Add a BitmapText at (x, y) (origin top-left). */
export function addText(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOptions = {}): Phaser.GameObjects.BitmapText {
  const font = o.font ?? 'retro8';
  const scale = o.scale ?? 1;
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), font, fit(s, font), cellW(font) * scale, o.align ?? 0);
  t.setTint(o.color ?? COLORS.text).setLineSpacing(o.leading ?? LEADING).setOrigin(0, 0);
  if (o.wrap) t.setMaxWidth(o.wrap);
  if (o.depth !== undefined) t.setDepth(o.depth);
  return t;
}

/** Set text (uppercased for retro6). */
export function setText(t: Phaser.GameObjects.BitmapText, s: string): Phaser.GameObjects.BitmapText {
  return t.setText(fit(s, t.font as FontName));
}

/** Line pitch in pixels for a scale (glyph + leading). */
export const linePitch = (scale = 1, leading = LEADING): number => (GLYPH_H + leading) * scale;

/**
 * The lines Phaser's BitmapText wrap produces for `text` at `cols` columns: greedy on spaces, a word (with its trailing
 * space) must fit, words longer than a line stay whole.
 */
export function wrapLines(text: string, cols: number): string[] {
  if (cols <= 0) return text.split('\n');
  const out: string[] = [];
  for (const line of text.split('\n')) {
    let cur = '';
    let word = '';
    for (let j = 0; j < line.length; j++) {
      word += line[j];
      if (line[j] === ' ' || j === line.length - 1) {
        if ((cur + word).length <= cols) cur += word;
        else {
          if (cur) out.push(cur.replace(/ $/, ''));
          cur = word;
        }
        word = '';
      }
    }
    out.push(cur.replace(/ $/, ''));
  }
  return out;
}

/** Wrapped line count of `text` in a box `widthPx` wide at a scale. */
export function lineCount(text: string, widthPx: number, scale = 1, font: FontName = 'retro8'): number {
  return wrapLines(text, Math.floor(widthPx / (cellW(font) * scale))).length;
}
