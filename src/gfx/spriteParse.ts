/** Pure sprite grid parser (no Phaser). See docs/design/art.md "Sprite grid format". */
import { SPRITE_CHARS, UI_CHARS } from './palette';

export interface SpriteDef {
  /** Dotted lowercase id, unique: `ship.hauler`, `portrait.3`. */
  name: string;
  w: number;
  h: number;
  frames: number;
  anchor: [number, number];
  /** 0 = static / frame chosen by code. */
  fps: number;
  /** frames x h row strings of w chars; '.' transparent. */
  grid: string[][];
  loop?: boolean;
  /** Rows hold the left half; the rasterizer mirrors. */
  mirrorX?: boolean;
  /** Allows P/H chars. */
  ui?: boolean;
}

export interface ParsedSprite {
  def: SpriteDef;
  /** Per frame, w*h palette indices (0-15, P=16, H=17); -1 = transparent. */
  pixels: Int8Array[];
}

export class SpriteError extends Error {}

export const P_INDEX = 16;
export const H_INDEX = 17;

export function parseSprite(def: SpriteDef): ParsedSprite {
  const id = def.name;
  const fail = (msg: string): never => {
    throw new SpriteError(`${id}: ${msg}`);
  };
  if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(id)) fail('name must be dotted lowercase');
  if (!Number.isInteger(def.w) || !Number.isInteger(def.h) || def.w < 1 || def.h < 1) fail('bad w/h');
  if (!Number.isInteger(def.frames) || def.frames < 1 || def.frames > 6) fail('frames must be 1-6');
  if (def.grid.length !== def.frames) fail(`frame count mismatch: frames=${def.frames}, grid has ${def.grid.length}`);
  if (def.anchor.length !== 2 || !def.anchor.every(Number.isInteger)) fail('anchor must be integer [x, y]');
  const rowLen = def.mirrorX ? Math.ceil(def.w / 2) : def.w;
  const pixels: Int8Array[] = [];
  def.grid.forEach((rows, f) => {
    if (rows.length !== def.h) fail(`frame ${f}: expected ${def.h} rows, got ${rows.length}`);
    const px = new Int8Array(def.w * def.h).fill(-1);
    rows.forEach((row, y) => {
      if (row.length !== rowLen) fail(`frame ${f} row ${y}: expected ${rowLen} chars, got ${row.length}`);
      for (let x = 0; x < row.length; x++) {
        const ch = row.charAt(x);
        let idx: number;
        if (ch === '.') idx = -1;
        else if (SPRITE_CHARS.includes(ch)) idx = SPRITE_CHARS.indexOf(ch);
        else if (UI_CHARS.includes(ch) && def.ui) idx = ch === 'P' ? P_INDEX : H_INDEX;
        else return fail(`frame ${f} row ${y} col ${x}: bad char '${ch}'`);
        px[y * def.w + x] = idx;
        if (def.mirrorX) px[y * def.w + (def.w - 1 - x)] = idx;
      }
    });
    pixels.push(px);
  });
  return { def, pixels };
}
