import { describe, expect, it } from 'vitest';
import { parseSprite, SpriteError, type SpriteDef } from '@/gfx/spriteParse';
import { ALL_SPRITES } from '@/gfx/sprites/index';

const base = (over: Partial<SpriteDef> = {}): SpriteDef => ({
  name: 'test.dot', w: 3, h: 2, frames: 1, anchor: [1, 1], fps: 0,
  grid: [['.0F', 'A..']],
  ...over,
});

describe('parseSprite', () => {
  it('parses indices and transparency', () => {
    const p = parseSprite(base());
    expect(Array.from(p.pixels[0] as Int8Array)).toEqual([-1, 0, 15, 10, -1, -1]);
  });
  it('rejects ragged rows, bad chars, bad frame counts', () => {
    expect(() => parseSprite(base({ grid: [['.0F', 'A.']] }))).toThrow(/row 1: expected 3 chars/);
    expect(() => parseSprite(base({ grid: [['.0Z', 'A..']] }))).toThrow(/bad char 'Z'/);
    expect(() => parseSprite(base({ frames: 2 }))).toThrow(/frame count mismatch/);
    expect(() => parseSprite(base({ grid: [['.0F']] }))).toThrow(/expected 2 rows/);
    expect(() => parseSprite(base({ name: 'Bad Name' }))).toThrow(SpriteError);
  });
  it('allows P/H only for ui sprites', () => {
    expect(() => parseSprite(base({ grid: [['P.H', '...']] }))).toThrow(/bad char/);
    const p = parseSprite(base({ grid: [['P.H', '...']], ui: true }));
    expect(Array.from(p.pixels[0] as Int8Array).slice(0, 3)).toEqual([16, -1, 17]);
  });
  it('mirrors the left half with mirrorX (odd width shares the centre)', () => {
    const p = parseSprite(base({ w: 5, h: 1, grid: [['123']], mirrorX: true }));
    expect(Array.from(p.pixels[0] as Int8Array)).toEqual([1, 2, 3, 2, 1]);
  });
});

describe('registered sprites', () => {
  it('has unique names and the expected core set', () => {
    const names = ALL_SPRITES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ['ship.hauler', 'drone', 'tug', 'beacon', 'ui.cursor', 'ui.panel', 'ui.scroll', 'portrait.1', 'portrait.5', 'debris.crate'])
      expect(names).toContain(n);
  });
  it('hauler has 3 damage states x 2 flare frames; portraits have healthy/sick/dead at 32x32', () => {
    const hauler = ALL_SPRITES.find((s) => s.name === 'ship.hauler');
    expect([hauler?.w, hauler?.h, hauler?.frames]).toEqual([64, 32, 6]);
    for (let i = 1; i <= 5; i++) {
      const p = ALL_SPRITES.find((s) => s.name === `portrait.${i}`);
      expect([p?.w, p?.h, p?.frames]).toEqual([32, 32, 3]);
    }
  });
  it.each(ALL_SPRITES.map((s) => [s.name, s] as const))('%s parses with declared size and valid indices', (_n, def) => {
    const p = parseSprite(def);
    expect(p.pixels).toHaveLength(def.frames);
    for (const px of p.pixels) {
      expect(px).toHaveLength(def.w * def.h);
      expect(px.some((v) => v >= 0)).toBe(true);
      for (const v of px) expect(v).toBeLessThanOrEqual(def.ui ? 17 : 15);
    }
    expect(def.anchor[0]).toBeGreaterThanOrEqual(0);
    expect(def.anchor[0]).toBeLessThanOrEqual(def.w);
    expect(def.anchor[1]).toBeLessThanOrEqual(def.h);
  });
  it('dead portraits use only 0/C/D/E', () => {
    for (let i = 1; i <= 5; i++) {
      const def = ALL_SPRITES.find((s) => s.name === `portrait.${i}`) as SpriteDef;
      const chars = new Set((def.grid[2] as string[]).join(''));
      for (const c of chars) expect('0CDE').toContain(c);
    }
  });
});
