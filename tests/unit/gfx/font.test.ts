import { describe, expect, it } from 'vitest';
import { FONTS, glyphPixel, measureText } from '@/gfx/font';
import { CHARS_6, GLYPHS_6, GLYPHS_8 } from '@/gfx/fontData';

describe('retro8 table', () => {
  it('covers ASCII 32-126 with 8 rows of 8 bits', () => {
    for (let c = 32; c <= 126; c++) {
      const g = GLYPHS_8[c];
      expect(g, `glyph ${c}`).toHaveLength(8);
      for (const row of g as number[]) expect(Number.isInteger(row) && row >= 0 && row <= 255).toBe(true);
    }
    expect(Object.keys(GLYPHS_8)).toHaveLength(95);
  });
  it('spot glyphs', () => {
    expect(GLYPHS_8[32]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(GLYPHS_8[65]?.slice(0, 7).some((r) => r !== 0)).toBe(true);
    expect(GLYPHS_8[65]?.[7]).toBe(0);
    for (const ch of 'gjpqy,;_') expect(GLYPHS_8[ch.charCodeAt(0)]?.[7], ch).not.toBe(0);
    for (const ch of 'AEHabcdeo0123') expect(GLYPHS_8[ch.charCodeAt(0)]?.[7], ch).toBe(0);
    expect(GLYPHS_8[103]?.[2]).not.toBe(0);
  });
  it('visible glyphs are all distinct', () => {
    const seen = new Set<string>();
    for (let c = 33; c <= 126; c++) {
      const k = (GLYPHS_8[c] as number[]).join(',');
      expect(seen.has(k), String.fromCharCode(c)).toBe(false);
      seen.add(k);
    }
  });
});

describe('retro6 subset', () => {
  it('has digits, uppercase and : % / . - + only (plus space), 8 rows', () => {
    expect([...CHARS_6].sort().join('')).toBe([...' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:%/.-+'].sort().join(''));
    for (const [code, rows] of Object.entries(GLYPHS_6)) {
      expect(rows, code).toHaveLength(8);
      expect(rows[7], code).toBe(0);
      for (const r of rows) expect(r & 0b00000111, `${code} ink within 5 columns`).toBe(0);
    }
  });
  it('digit glyphs are non-empty', () => {
    for (const ch of '0123456789') expect(GLYPHS_6[ch.charCodeAt(0)]?.some((r) => r !== 0)).toBe(true);
  });
});

describe('measureText / glyphPixel', () => {
  it('measures at x1', () => {
    expect(measureText('hello', 'retro8')).toEqual({ width: 40, height: 8, lines: 1 });
    expect(measureText('ab\ncdef', 'retro6')).toEqual({ width: 24, height: 16, lines: 2 });
    expect(measureText('x'.repeat(80), FONTS.retro8).width).toBe(640);
  });
  it('reads glyph bits left to right', () => {
    expect(glyphPixel(FONTS.retro8, 45, 3, 3)).toBe(true);
    expect(glyphPixel(FONTS.retro8, 45, 7, 3)).toBe(false);
    expect(glyphPixel(FONTS.retro8, 32, 0, 0)).toBe(false);
  });
});
