/**
 * Dev-only sprite and font gallery (`?scene=gfxpreview`). Page 0 shows both fonts' glyph sets;
 * later pages tile every registered sprite (all frames). Left/Right (or click) changes page;
 * `body[data-pages]` holds the page count and `body[data-page]` the current one.
 */
import Phaser from 'phaser';
import { buildFonts, FONTS } from './font';
import { activeNumbers, PALETTE_KEYS, type PaletteNumbers } from './palette';
import { ALL_SPRITES, registerAll } from './sprites';
import { heroPage, travelPage } from './previewPages';
import { enableCrt } from './crt';

const W = 640;
const H = 400;

export class GfxPreviewScene extends Phaser.Scene {
  private pages: Phaser.GameObjects.GameObject[][] = [];
  private page = 0;
  private updaters: ((dtMs: number) => void)[] = [];

  constructor() {
    super('GfxPreview');
  }

  create(): void {
    buildFonts(this);
    registerAll(this);
    const pal = activeNumbers();
    this.cameras.main.setBackgroundColor(pal.navy);
    this.pages.push(this.fontPage(pal));
    this.spritePages(pal).forEach((p) => this.pages.push(p));
    this.pages.push(travelPage(this, pal, this.updaters));
    this.pages.push(heroPage(this, pal, this.updaters));
    // ?crt=1 turns the CRT pipeline on so a screenshot can show it
    const crt = new URLSearchParams(window.location.search).get('crt') === '1' && enableCrt(this.game, true);
    document.body.dataset['crt'] = crt ? 'on' : 'off';
    this.input.keyboard?.on('keydown-RIGHT', () => this.show(this.page + 1));
    this.input.keyboard?.on('keydown-LEFT', () => this.show(this.page - 1));
    this.input.on('pointerdown', () => this.show(this.page + 1));
    document.body.dataset['pages'] = String(this.pages.length);
    this.show(0);
    document.body.dataset['scene'] = 'GfxPreview';
  }

  override update(_time: number, delta: number): void {
    for (const u of this.updaters) u(delta);
  }

  private show(n: number): void {
    this.page = (n + this.pages.length) % this.pages.length;
    this.pages.forEach((objs, i) => objs.forEach((o) => (o as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(i === this.page)));
    document.body.dataset['page'] = String(this.page);
  }

  private text(font: 'retro8' | 'retro6', x: number, y: number, s: string, color: number, scale = 1): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(x, y, font, s).setTint(color).setScale(scale).setOrigin(0, 0);
  }

  private fontPage(pal: PaletteNumbers): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    out.push(this.text('retro8', 8, 4, 'retro8 8x8 (x1): 95 glyphs', pal.phosphorHi));
    const rows8 = [32, 48, 64, 80, 96, 112].map((start) => Array.from({ length: 16 }, (_, i) => String.fromCharCode(start + i)).join(''));
    rows8[5] = rows8[5]?.slice(0, 15) ?? '';
    rows8.forEach((r, i) => out.push(this.text('retro8', 8, 16 + i * 10, r, pal.phosphor)));
    // same glyphs at x2 for a closer look
    rows8.forEach((r, i) => out.push(this.text('retro8', 8, 84 + i * 18, r, pal.phosphor, 2)));
    out.push(this.text('retro8', 8, 200, 'The quick brown fox jumps over the lazy dog. 0123456789', pal.phosphor));
    out.push(this.text('retro8', 8, 210, 'PACK MY BOX WITH FIVE DOZEN LIQUOR JUGS: gjpqy,; descend', pal.amber));
    out.push(this.text('retro6', 8, 232, 'RETRO6 HUD (X1):  ' + FONTS.retro6.chars, pal.phosphorHi));
    out.push(this.text('retro6', 8, 244, 'HP 100%  CHARGE 12:30  +5 -3 7/9 4.5', pal.phosphor));
    out.push(this.text('retro6', 8, 260, 'RETRO6 X2: 0123456789 ABCXYZ :%/.-+', pal.phosphor, 2));
    // palette swatches
    PALETTE_KEYS.forEach((k, i) => out.push(this.add.rectangle(8 + i * 20, 300, 18, 18, pal[k]).setOrigin(0, 0).setStrokeStyle(1, pal.phosphor)));
    out.push(this.text('retro6', 8, 322, 'PALETTE 0-9 A-F', pal.phosphor));
    out.push(this.text('retro6', 8, 380, 'LEFT/RIGHT OR CLICK: NEXT PAGE', pal.phosphor));
    return out;
  }

  private spritePages(pal: PaletteNumbers): Phaser.GameObjects.GameObject[][] {
    const pages: Phaser.GameObjects.GameObject[][] = [];
    let cur: Phaser.GameObjects.GameObject[] = [];
    let x = 4;
    let y = 4;
    let rowH = 0;
    const flush = (): void => {
      pages.push(cur);
      cur = [];
      x = 4;
      y = 4;
      rowH = 0;
    };
    for (const def of ALL_SPRITES) {
      const cellW = Math.max(def.frames * (def.w + 3), def.name.length * 6 + 2);
      const cellH = def.h + 12;
      if (x + cellW > W - 4) {
        x = 4;
        y += rowH + 4;
        rowH = 0;
      }
      if (y + cellH > H - 4) flush();
      cur.push(this.text('retro6', x, y, def.name.toUpperCase(), pal.phosphor));
      for (let f = 0; f < def.frames; f++) cur.push(this.add.image(x + f * (def.w + 3), y + 10, def.name, f).setOrigin(0, 0));
      x += cellW + 6;
      rowH = Math.max(rowH, cellH);
    }
    if (cur.length) flush();
    return pages;
  }
}
