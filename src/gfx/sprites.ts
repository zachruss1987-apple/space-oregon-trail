/**
 * Sprite factory. The pure parser lives in spriteParse.ts (node-testable); this file rasterizes
 * parsed sprites into Phaser Canvas textures (one texture per sprite, one frame per animation frame).
 */
import Phaser from 'phaser';
import { activeNumbers, type PaletteNumbers, PALETTE_KEYS } from './palette';
import { H_INDEX, P_INDEX, parseSprite, type ParsedSprite, type SpriteDef } from './spriteParse';
import { ALL_SPRITES } from './sprites/index';

export { parseSprite, SpriteError } from './spriteParse';
export type { ParsedSprite, SpriteDef } from './spriteParse';

function indexRgb(i: number, pal: PaletteNumbers): number {
  if (i === P_INDEX) return pal.phosphor;
  if (i === H_INDEX) return pal.phosphorHi;
  return pal[PALETTE_KEYS[i] as keyof PaletteNumbers];
}

/** Create (or replace) the texture for one sprite; frames are keyed 0..frames-1. */
export function rasterize(scene: Phaser.Scene, sprite: SpriteDef | ParsedSprite): Phaser.Textures.CanvasTexture {
  const parsed = 'pixels' in sprite ? sprite : parseSprite(sprite);
  const { def, pixels } = parsed;
  const pal = activeNumbers();
  if (scene.textures.exists(def.name)) scene.textures.remove(def.name);
  const tex = scene.textures.createCanvas(def.name, def.w * def.frames, def.h);
  if (!tex) throw new Error(`could not create texture ${def.name}`);
  const ctx = tex.getContext();
  const img = ctx.createImageData(def.w * def.frames, def.h);
  pixels.forEach((px, f) => {
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        const idx = px[y * def.w + x] as number;
        if (idx < 0) continue;
        const rgb = indexRgb(idx, pal);
        const o = (y * def.w * def.frames + f * def.w + x) * 4;
        img.data[o] = (rgb >> 16) & 255;
        img.data[o + 1] = (rgb >> 8) & 255;
        img.data[o + 2] = rgb & 255;
        img.data[o + 3] = 255;
      }
    }
    tex.add(f, 0, f * def.w, 0, def.w, def.h);
  });
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

/** Rasterize every registered sprite (call at boot and again after a palette switch). */
export function registerAll(scene: Phaser.Scene): number {
  for (const def of ALL_SPRITES) rasterize(scene, def);
  return ALL_SPRITES.length;
}

/** Texture key and frame for a sprite (frame 0 unless animated by code). */
export const spriteKey = (name: string): string => name;
export { ALL_SPRITES };
