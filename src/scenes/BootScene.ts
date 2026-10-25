/**
 * First scene (art.md checklist "Boot"): builds the bitmap fonts and rasterizes every sprite once (the texture cache
 * the other scenes share), applies palette / CRT / volumes from the saved options, then opens Title or a debug scene
 * (`?scene=gfxpreview`, `?scene=soundtest`).
 */
import Phaser from 'phaser';
import { markScene } from '@/game/contract';
import { applyCrt, applyPalette, applyVolumes } from '@/game/display';
import { buildFonts } from '@/gfx/font';
import { fitCamera } from '@/gfx/view';
import { addText } from '@/ui/text';
import { COLORS } from '@/ui/theme';

/** Debug scenes reachable with `?scene=<name>`. */
const DEBUG_SCENES: Readonly<Record<string, string>> = { gfxpreview: 'GfxPreview', soundtest: 'SoundTest' };

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    markScene('Boot');
    fitCamera(this).setBackgroundColor(0x000000);
    buildFonts(this);
    applyPalette(this);
    addText(this, 8, 388, 'LOADING...', { color: COLORS.dim });
    applyCrt(this.game);
    applyVolumes();
    const param = new URLSearchParams(window.location.search).get('scene')?.toLowerCase() ?? '';
    const next = DEBUG_SCENES[param];
    this.scene.start(next && this.scene.get(next) ? next : 'Title');
  }
}
