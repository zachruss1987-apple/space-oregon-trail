/**
 * Pixel fonts. `retro8` (8x8, body text at x1, 80 columns on 640 px) and `retro6` (6x8 HUD subset).
 * Glyph sheets are drawn to Canvas textures at boot (white ink, tintable) and registered as
 * Phaser BitmapText fonts. This file only type-imports Phaser so `measureText` runs in node tests.
 */
import type Phaser from 'phaser';
import { CHARS_6, FIRST_CHAR, GLYPHS_6, GLYPHS_8, LAST_CHAR } from './fontData';

export type FontName = 'retro8' | 'retro6';

export interface FontSpec {
  key: FontName;
  cellW: number;
  cellH: number;
  /** Characters on the sheet, in order. */
  chars: string;
  glyphs: Record<number, number[]>;
}

const ASCII = Array.from({ length: LAST_CHAR - FIRST_CHAR + 1 }, (_, i) => String.fromCharCode(FIRST_CHAR + i)).join('');

/** Extra retro8 glyphs drawn on the sheet: the ellipsis used in UI copy. */
const ELLIPSIS = 0x2026;
const EXTRA_8: Record<number, number[]> = { [ELLIPSIS]: [0, 0, 0, 0, 0, 0, 0x92, 0] };

/**
 * Non-ASCII characters that appear in copy, drawn with an existing glyph (dashes, curly quotes, math signs), so text
 * from content tables never renders as a gap. Targets missing from a font (retro6 has no lowercase) are skipped.
 */
export const GLYPH_ALIASES: Readonly<Record<string, string>> = {
  '—': '-', '–': '-', '−': '-', '‘': "'", '’': "'", '“': '"', '”': '"',
  '×': 'x', '≤': '<', '≥': '>', '→': '>', '±': '+', ' ': ' ',
};

export const FONTS: Record<FontName, FontSpec> = {
  retro8: { key: 'retro8', cellW: 8, cellH: 8, chars: ASCII + String.fromCharCode(ELLIPSIS), glyphs: { ...GLYPHS_8, ...EXTRA_8 } },
  retro6: { key: 'retro6', cellW: 6, cellH: 8, chars: CHARS_6, glyphs: GLYPHS_6 },
};

const PER_ROW = 16;

/** Pixel size of a text block (newline-aware) at x1. Characters outside the font count as a cell. */
export function measureText(text: string, font: FontName | FontSpec): { width: number; height: number; lines: number } {
  const spec = typeof font === 'string' ? FONTS[font] : font;
  const lines = text.split('\n');
  const cols = Math.max(...lines.map((l) => l.length));
  return { width: cols * spec.cellW, height: lines.length * spec.cellH, lines: lines.length };
}

/** True when the glyph bit at (col, row) is set. */
export function glyphPixel(spec: FontSpec, code: number, col: number, row: number): boolean {
  const rows = spec.glyphs[code];
  if (!rows) return false;
  return (((rows[row] ?? 0) >> (7 - col)) & 1) === 1;
}

/** Draw one font's glyph sheet to a Canvas texture and register it as a BitmapText font. */
export function buildFont(scene: Phaser.Scene, name: FontName): void {
  const spec = FONTS[name];
  const rowsOfCells = Math.ceil(spec.chars.length / PER_ROW);
  const w = PER_ROW * spec.cellW;
  const h = rowsOfCells * spec.cellH;
  if (scene.textures.exists(spec.key)) scene.textures.remove(spec.key);
  const tex = scene.textures.createCanvas(spec.key, w, h);
  if (!tex) throw new Error(`could not create font texture ${spec.key}`);
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  const chars: Record<number, unknown> = {};
  [...spec.chars].forEach((ch, i) => {
    const code = ch.charCodeAt(0);
    const cx = (i % PER_ROW) * spec.cellW;
    const cy = Math.floor(i / PER_ROW) * spec.cellH;
    for (let row = 0; row < spec.cellH; row++) {
      for (let col = 0; col < spec.cellW; col++) {
        if (!glyphPixel(spec, code, col, row)) continue;
        const o = ((cy + row) * w + cx + col) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = img.data[o + 3] = 255;
      }
    }
    chars[code] = {
      x: cx, y: cy, width: spec.cellW, height: spec.cellH, centerX: spec.cellW / 2, centerY: spec.cellH / 2,
      xOffset: 0, yOffset: 0, xAdvance: spec.cellW, data: {}, kerning: {},
      u0: cx / w, v0: cy / h, u1: (cx + spec.cellW) / w, v1: (cy + spec.cellH) / h,
    };
  });
  for (const [from, to] of Object.entries(GLYPH_ALIASES)) {
    const target = chars[to.charCodeAt(0)];
    if (target) chars[from.charCodeAt(0)] = target;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  tex.setFilter(1); // Phaser.Textures.FilterMode.NEAREST
  scene.cache.bitmapFont.add(spec.key, {
    data: { retroFont: true, font: spec.key, size: spec.cellW, lineHeight: spec.cellH, chars },
    texture: spec.key,
    frame: null,
  });
}

/** Build both fonts (call once at boot). */
export function buildFonts(scene: Phaser.Scene): void {
  buildFont(scene, 'retro8');
  buildFont(scene, 'retro6');
}
