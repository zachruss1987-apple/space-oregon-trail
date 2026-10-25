import { describe, expect, it } from 'vitest';
import { activePalette, charColor, COLORBLIND, PALETTE_KEYS, setColorblind, STANDARD, TEXT_KEYS, toNumbers } from '@/gfx/palette';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
/** WCAG contrast ratio between two hex colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('palette', () => {
  it('has 16 unique world colors in valid hex', () => {
    expect(PALETTE_KEYS).toHaveLength(16);
    const hexes = PALETTE_KEYS.map((k) => STANDARD[k]);
    expect(new Set(hexes).size).toBe(16);
    for (const h of [...hexes, ...TEXT_KEYS.map((k) => STANDARD[k])]) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('matches art.md spot values', () => {
    expect(STANDARD.navy).toBe('#1c2860');
    expect(STANDARD.phosphor).toBe('#5cff5c');
    expect(toNumbers(STANDARD).amber).toBe(0xffd75c);
  });
  it('colorblind variant has identical keys and valid hex', () => {
    expect(Object.keys(COLORBLIND).sort()).toEqual(Object.keys(STANDARD).sort());
    for (const h of Object.values(COLORBLIND)) expect(h).toMatch(/^#[0-9a-f]{6}$/);
    expect(COLORBLIND.red).not.toBe(STANDARD.red);
  });
  it('text colors meet WCAG AA on black', () => {
    expect(contrast(STANDARD.phosphor, '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STANDARD.phosphorHi, '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STANDARD.phosphor, STANDARD.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STANDARD.forest, '#000000')).toBeGreaterThanOrEqual(3);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
  it('activePalette follows the setter', () => {
    expect(activePalette()).toBe(STANDARD);
    setColorblind(true);
    expect(activePalette()).toBe(COLORBLIND);
    expect(charColor('6')).toBe(COLORBLIND.red);
    setColorblind(false);
    expect(charColor('6')).toBe(STANDARD.red);
    expect(charColor('P')).toBe(STANDARD.phosphor);
    expect(charColor('.')).toBeUndefined();
  });
});
