/** T-041: every color the UI draws text in meets WCAG AA (4.5:1) on black and on the panel fill, in both palettes. */
import { afterEach, describe, expect, it } from 'vitest';
import { COLORBLIND, hexToNumber, setColorblind, STANDARD, type PaletteTable } from '@/gfx/palette';
import { COLORS } from '@/ui/theme';

function luminance(rgb: number): number {
  const ch = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: number, b: number): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** COLORS roles used as text tints (shadow is the logo's drop shadow; danger is not used for text). */
const TEXT_ROLES = ['text', 'dim', 'bright', 'warn'] as const;
const PALETTES: [string, Readonly<PaletteTable>, boolean][] = [['standard', STANDARD, false], ['colorblind', COLORBLIND, true]];

afterEach(() => setColorblind(false));

describe('text contrast >= 4.5:1', () => {
  it.each(PALETTES)('%s: every text role on black and on panel', (_name, table, cb) => {
    setColorblind(cb);
    const backgrounds: [string, number][] = [['black', hexToNumber(table.black)], ['panel', hexToNumber(table.panel)]];
    for (const role of TEXT_ROLES) {
      for (const [bgName, bg] of backgrounds) expect(contrast(COLORS[role], bg), `${role} on ${bgName}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dim text uses phosphorDim, since forest misses 4.5:1 on the panel fill', () => {
    expect(contrast(hexToNumber(STANDARD.forest), hexToNumber(STANDARD.panel))).toBeLessThan(4.5);
    expect(COLORS.dim).toBe(hexToNumber(STANDARD.phosphorDim));
  });

  it('the save-string TextArea (#7dff9a on #000) passes too', () => {
    expect(contrast(0x7dff9a, 0x000000)).toBeGreaterThanOrEqual(4.5);
  });
});
