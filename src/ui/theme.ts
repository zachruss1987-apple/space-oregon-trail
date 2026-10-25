/**
 * UI theme: a thin layer over src/gfx/palette.ts (text roles -> palette keys), the 8x8 text grid, and number formatting.
 * Colors are getters so a palette switch (colorblind) applies to everything drawn after it.
 */
import { activeNumbers } from '@/gfx/palette';

/** Text and chrome roles as 0xRRGGBB, read from the active palette. */
export const COLORS = {
  /** Default text (phosphor). */
  get text(): number { return activeNumbers().phosphor; },
  /** Hints and disabled rows (phosphorDim: forest misses 4.5:1 on the panel fill; borders keep forest). */
  get dim(): number { return activeNumbers().phosphorDim; },
  /** Selected rows and headings (phosphorHi). */
  get bright(): number { return activeNumbers().phosphorHi; },
  /** Warnings (amber). */
  get warn(): number { return activeNumbers().amber; },
  /** Danger (red). */
  get danger(): number { return activeNumbers().red; },
  /** Drop shadow under the logo (brown). */
  get shadow(): number { return activeNumbers().brown; },
  get bg(): number { return activeNumbers().black; },
  get panel(): number { return activeNumbers().panel; },
  get border(): number { return activeNumbers().phosphor; },
  get borderDim(): number { return activeNumbers().forest; },
};

/** Glyph cell at x1 (retro8): 80 columns on the 640 px canvas. */
export const CHAR_W = 8;
export const GLYPH_H = 8;
/** Default line pitch for body text at x1 (8 px glyph + 4 px leading). */
export const LINE_HEIGHT = 12;

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
