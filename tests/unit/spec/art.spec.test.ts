/** Spec-driven art tests: every number below is typed from docs/design/art.md, not read from src/. */
import { describe, expect, it } from 'vitest';
import { COLORBLIND, PALETTE_KEYS, STANDARD, TEXT_KEYS, SPRITE_CHARS, charColor } from '@/gfx/palette';
import { ALL_SPRITES } from '@/gfx/sprites/index';
import { parseSprite } from '@/gfx/spriteParse';
import { FONTS } from '@/gfx/font';
import { CHARS_6, GLYPHS_6, GLYPHS_8 } from '@/gfx/fontData';
import { landmarkScale } from '@/gfx/travelMath';
import { CRT_RANGES, crtDefaultOn, crtDefaults } from '@/gfx/crtCore';

/** art.md "Palette" table: key, sprite char, hex. */
const PALETTE: [string, string, string][] = [
  ['black', '0', '#000000'], ['navy', '1', '#1c2860'], ['blue', '2', '#3a6ee0'], ['cyan', '3', '#7ad8f0'],
  ['plum', '4', '#6d2b79'], ['brown', '5', '#8a4a24'], ['red', '6', '#d83a2a'], ['orange', '7', '#f08a24'],
  ['amber', '8', '#ffd75c'], ['peach', '9', '#f0b890'], ['lime', 'A', '#a8e040'], ['forest', 'B', '#2e8a2e'],
  ['grey', 'C', '#6e7080'], ['silver', 'D', '#b8bcc8'], ['white', 'E', '#ffffff'], ['magenta', 'F', '#c04fa0'],
];
const TEXT_THEME: [string, string][] = [['phosphor', '#5cff5c'], ['phosphorHi', '#c8ffc8'], ['panel', '#001a00']];
/** art.md "Colorblind-safe variant" table. */
const CB: Record<string, string> = {
  black: '#000000', navy: '#1c2860', blue: '#0072b2', cyan: '#56b4e9', plum: '#5a3a8a', brown: '#8c5a3c', red: '#d55e00',
  orange: '#e69f00', amber: '#f0e442', peach: '#f0b890', lime: '#cc79a7', forest: '#009e73', grey: '#6e7080', silver: '#b8bcc8',
  white: '#ffffff', magenta: '#f5b0d8', phosphor: '#5cff5c', phosphorHi: '#c8ffc8',
};

describe('art.md palette', () => {
  it('has exactly the 16 world keys in char order', () => {
    expect([...PALETTE_KEYS]).toEqual(PALETTE.map((p) => p[0]));
    expect(SPRITE_CHARS).toBe('0123456789ABCDEF');
  });
  it.each(PALETTE)('%s (%s) is %s', (key, ch, hex) => {
    expect(STANDARD[key as keyof typeof STANDARD]).toBe(hex);
    expect(charColor(ch, STANDARD)).toBe(hex);
  });
  it.each(TEXT_THEME)('text theme %s is %s', (key, hex) => {
    expect(STANDARD[key as keyof typeof STANDARD]).toBe(hex);
    expect([...TEXT_KEYS]).toContain(key);
  });
  it('P and H sprite chars map to phosphor and phosphorHi', () => {
    expect(charColor('P', STANDARD)).toBe('#5cff5c');
    expect(charColor('H', STANDARD)).toBe('#c8ffc8');
    expect(charColor('.', STANDARD)).toBeUndefined();
  });
});

describe('art.md colorblind variant', () => {
  it('has identical keys to the standard palette', () => {
    expect(Object.keys(COLORBLIND).sort()).toEqual(Object.keys(STANDARD).sort());
  });
  it.each(Object.entries(CB))('%s is %s', (key, hex) => {
    expect(COLORBLIND[key as keyof typeof COLORBLIND]).toBe(hex);
  });
  it('differs from standard only where the table swaps hues', () => {
    const changed = Object.keys(STANDARD)
      .filter((k) => STANDARD[k as keyof typeof STANDARD] !== COLORBLIND[k as keyof typeof COLORBLIND])
      .sort();
    expect(changed).toEqual(['amber', 'blue', 'brown', 'cyan', 'forest', 'lime', 'magenta', 'orange', 'plum', 'red']);
  });
});

/** [id, w, h, frames] from the art.md sprite tables (ships, debris, stations, landmarks, portraits, planets, UI). */
const SIZES: [string, number, number, number][] = [
  ['ship.hauler', 64, 32, 6], ['ship.flare.cruise', 12, 8, 2], ['ship.flare.burn', 20, 10, 2], ['ship.flare.over', 28, 12, 2],
  ['ship.mini', 24, 12, 2], ['ship.dock', 40, 120, 1], ['tug', 48, 24, 2], ['skiff', 32, 16, 2], ['drone', 12, 12, 2],
  ['grapple.hook', 6, 6, 2],
  ['debris.crate', 12, 12, 1], ['debris.pallet', 20, 20, 1], ['debris.galley', 28, 28, 2], ['debris.plate', 20, 20, 1],
  ['debris.pump', 14, 14, 1], ['debris.gyro', 12, 12, 2], ['debris.scrap.s', 10, 10, 1], ['debris.scrap.m', 16, 16, 1],
  ['debris.scrap.l', 24, 24, 1], ['debris.tumbler', 24, 24, 4], ['debris.hot', 16, 16, 2], ['debris.blip', 4, 4, 1],
  ['rock.16', 16, 16, 1], ['rock.24', 24, 24, 1], ['rock.32', 32, 32, 1], ['rock.48', 48, 48, 1], ['rock.shard', 6, 6, 3],
  ['station.independence', 96, 64, 2], ['station.mars', 96, 64, 2], ['station.ceres', 96, 64, 2], ['station.europa', 96, 64, 2],
  ['station.titan', 96, 64, 2], ['station.oort', 96, 64, 2], ['station.terminus', 96, 64, 2],
  ['landmark.spire', 48, 96, 1], ['landmark.eye', 96, 96, 2], ['landmark.gate', 96, 96, 4], ['landmark.oort', 32, 64, 2],
  ['landmark.proxima', 96, 96, 1],
  ['planet.earth', 64, 64, 1], ['planet.luna', 24, 24, 1], ['planet.mars', 48, 48, 1], ['planet.saturn', 96, 48, 1],
  ['planet.titan', 32, 32, 1], ['planet.europa', 32, 32, 1], ['star.proxima', 32, 32, 2],
  ['far.station', 16, 16, 1], ['far.planet', 16, 16, 1], ['far.ring', 16, 16, 1], ['far.hazard', 16, 16, 1],
  ['beacon', 16, 24, 2],
  ['overlay.static', 64, 64, 4], ['overlay.fog', 64, 64, 2], ['overlay.streak', 8, 1, 1],
  ['portrait.1', 32, 32, 3], ['portrait.2', 32, 32, 3], ['portrait.3', 32, 32, 3], ['portrait.4', 32, 32, 3], ['portrait.5', 32, 32, 3],
  ['ui.panel', 24, 24, 2], ['ui.cursor', 8, 8, 2], ['ui.scroll', 4, 24, 1], ['ui.toggle', 16, 8, 2],
  ['ui.icon.hp', 8, 8, 1], ['ui.icon.charge', 8, 8, 1], ['ui.icon.haul', 8, 8, 1], ['ui.icon.hit', 8, 8, 1],
  ['ui.icon.sound', 8, 8, 1], ['ui.icon.mute', 8, 8, 1], ['ui.icon.pause', 24, 24, 1],
];

describe('art.md sprite sizes', () => {
  const by = new Map(ALL_SPRITES.map((s) => [s.name, s]));
  it.each(SIZES)('%s is %i x %i with %i frame(s)', (id, w, h, frames) => {
    const s = by.get(id);
    expect(s, `${id} registered`).toBeDefined();
    expect([s?.w, s?.h, s?.frames]).toEqual([w, h, frames]);
    parseSprite(s as NonNullable<typeof s>); // grid agrees with the declared size
  });
  it('hauler is the only 6-frame sprite and no sprite has more than 6', () => {
    expect(ALL_SPRITES.filter((s) => s.frames === 6).map((s) => s.name)).toEqual(['ship.hauler']);
    expect(Math.max(...ALL_SPRITES.map((s) => s.frames))).toBe(6);
  });
  it('rock.shard plays once; stations run at 2 fps; hauler at 8 fps', () => {
    expect(by.get('rock.shard')?.loop).toBe(false);
    for (const s of ALL_SPRITES.filter((x) => x.name.startsWith('station.'))) expect(s.fps, s.name).toBe(2);
    expect(by.get('ship.hauler')?.fps).toBe(8);
  });
  it('only ui sprites use P/H chars', () => {
    for (const s of ALL_SPRITES.filter((x) => !x.ui)) for (const f of s.grid) for (const row of f) expect(/[PH]/.test(row), s.name).toBe(false);
  });
  it('dead portraits (frame 2) use only 0/C/D/E and transparency', () => {
    for (let i = 1; i <= 5; i++) {
      const p = by.get(`portrait.${i}`);
      for (const row of p?.grid[2] ?? []) expect(row.replace(/[.0CDE]/g, ''), `portrait.${i} dead frame`).toBe('');
    }
  });
});

describe('art.md pixel font', () => {
  it('retro8 covers printable ASCII 32-126 (95 glyphs, 8x8 cell)', () => {
    for (let c = 32; c <= 126; c++) expect(GLYPHS_8[c], `glyph ${c}`).toHaveLength(8);
    expect(Object.keys(GLYPHS_8)).toHaveLength(95);
    expect([FONTS.retro8.cellW, FONTS.retro8.cellH]).toEqual([8, 8]);
  });
  it('retro8 descenders use row 7 and caps/digits stay above it (PM amendment)', () => {
    for (const ch of 'gjpqy,;_') expect(GLYPHS_8[ch.charCodeAt(0)]?.[7], ch).not.toBe(0);
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') expect(GLYPHS_8[ch.charCodeAt(0)]?.[7], ch).toBe(0);
  });
  it('retro6 is the 6x8 HUD subset: space, digits, caps and : % / . - +', () => {
    expect([FONTS.retro6.cellW, FONTS.retro6.cellH]).toEqual([6, 8]);
    expect([...CHARS_6].sort().join('')).toBe([...' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:%/.-+'].sort().join(''));
    for (const rows of Object.values(GLYPHS_6)) {
      expect(rows).toHaveLength(8);
      for (const r of rows) expect(r & 0b111, 'ink only in columns 0-4').toBe(0);
    }
  });
});

describe('art.md landmark approach tiers', () => {
  it.each([
    [300, 'none', 600], [121, 'none', 600], [120, 'blip', 600], [90, 'blip', 600], [61, 'blip', 600],
    [60, 'far', 600], [40, 'far', 560], [21, 'far', 522], [20, 'full', 520], [10, 'full', 480], [0, 'full', 440],
  ])('%i Mk remaining shows %s at x=%i', (mk, tier, x) => {
    expect(landmarkScale(mk)).toEqual({ tier, x, scale: 1 });
  });
});

describe('art.md CRT shader', () => {
  it('defaults: scanlines 0.18, curvature 0.04, vignette 0.30, glow 1.0 px at 0.30, flicker off', () => {
    expect(crtDefaults()).toEqual({ scanlines: 0.18, curvature: 0.04, vignette: 0.3, glowRadius: 1, glowStrength: 0.3, flicker: 0 });
  });
  it('ranges match the table', () => {
    expect(CRT_RANGES).toEqual({
      scanlines: [0, 0.5], curvature: [0, 0.12], vignette: [0, 0.6], glowRadius: [0, 2], glowStrength: [0, 0.6], flicker: [0, 0.03],
    });
  });
  it('default-on matrix: desktop WebGL on; touch, Canvas and reduced motion off', () => {
    const env = { webgl: true, coarsePointer: false, reducedMotion: false };
    expect(crtDefaultOn(env)).toBe(true);
    expect(crtDefaultOn({ ...env, coarsePointer: true })).toBe(false);
    expect(crtDefaultOn({ ...env, webgl: false })).toBe(false);
    expect(crtDefaultOn({ ...env, reducedMotion: true })).toBe(false);
    for (const webgl of [true, false]) for (const coarsePointer of [true, false]) for (const reducedMotion of [true, false])
      expect(crtDefaultOn({ webgl, coarsePointer, reducedMotion })).toBe(webgl && !coarsePointer && !reducedMotion);
  });
});
