/**
 * The one palette. 16 world colors (sprite chars 0-9, A-F), plus text/UI colors (P, H, panel).
 * Every color in the game is read from here by key. Colorblind-safe variant has identical keys.
 * Pure TypeScript: no Phaser imports.
 */

export const PALETTE_KEYS = [
  'black', 'navy', 'blue', 'cyan', 'plum', 'brown', 'red', 'orange',
  'amber', 'peach', 'lime', 'forest', 'grey', 'silver', 'white', 'magenta',
] as const;
export type WorldColorKey = (typeof PALETTE_KEYS)[number];
export const TEXT_KEYS = ['phosphor', 'phosphorHi', 'panel'] as const;
export type TextColorKey = (typeof TEXT_KEYS)[number];
export type PaletteKey = WorldColorKey | TextColorKey;
export type PaletteTable = Record<PaletteKey, string>;
export type PaletteNumbers = Record<PaletteKey, number>;

/** Sprite grid char for each world color index, plus P/H for UI sprites. */
export const SPRITE_CHARS = '0123456789ABCDEF';
export const UI_CHARS = 'PH';

export const STANDARD: Readonly<PaletteTable> = {
  black: '#000000', navy: '#1c2860', blue: '#3a6ee0', cyan: '#7ad8f0',
  plum: '#6d2b79', brown: '#8a4a24', red: '#d83a2a', orange: '#f08a24',
  amber: '#ffd75c', peach: '#f0b890', lime: '#a8e040', forest: '#2e8a2e',
  grey: '#6e7080', silver: '#b8bcc8', white: '#ffffff', magenta: '#c04fa0',
  phosphor: '#5cff5c', phosphorHi: '#c8ffc8', panel: '#001a00',
};

export const COLORBLIND: Readonly<PaletteTable> = {
  black: '#000000', navy: '#1c2860', blue: '#0072b2', cyan: '#56b4e9',
  plum: '#5a3a8a', brown: '#8c5a3c', red: '#d55e00', orange: '#e69f00',
  amber: '#f0e442', peach: '#f0b890', lime: '#cc79a7', forest: '#009e73',
  grey: '#6e7080', silver: '#b8bcc8', white: '#ffffff', magenta: '#f5b0d8',
  phosphor: '#5cff5c', phosphorHi: '#c8ffc8', panel: '#001a00',
};

export const hexToNumber = (hex: string): number => parseInt(hex.slice(1), 16);

export function toNumbers(table: Readonly<PaletteTable>): PaletteNumbers {
  const out = {} as PaletteNumbers;
  for (const k of [...PALETTE_KEYS, ...TEXT_KEYS]) out[k] = hexToNumber(table[k]);
  return out;
}

let colorblind = false;
/** Module-level switch (src/game/session.ts settings have no palette flag yet). */
export function setColorblind(on: boolean): void {
  colorblind = on;
}
export function isColorblind(): boolean {
  return colorblind;
}

/** Active table as hex strings. */
export function activePalette(): Readonly<PaletteTable> {
  return colorblind ? COLORBLIND : STANDARD;
}
/** Active table as 0xRRGGBB numbers. */
export function activeNumbers(): PaletteNumbers {
  return toNumbers(activePalette());
}

/** Hex string for a sprite-grid char ('0'-'9','A'-'F','P','H'), or undefined for '.'/unknown. */
export function charColor(ch: string, table: Readonly<PaletteTable> = activePalette()): string | undefined {
  const i = SPRITE_CHARS.indexOf(ch);
  if (i >= 0) return table[PALETTE_KEYS[i] as WorldColorKey];
  if (ch === 'P') return table.phosphor;
  if (ch === 'H') return table.phosphorHi;
  return undefined;
}
