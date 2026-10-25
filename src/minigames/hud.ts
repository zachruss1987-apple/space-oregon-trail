/**
 * Mini-game HUD strip (y 0-23): slot texts left to right in `retro6` with their `ui.icon.*` sprite, the timer
 * `TIME 0:27`, a flash line (retro8) and the big center text (countdown / GO, retro8 at x4).
 */
import type Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { MINIGAME_SCENE } from '@/content';
import { t } from '@/ui/copy';
import { panel } from '@/ui/chrome';
import { addText, setText } from '@/ui/text';
import { COLORS } from '@/ui/theme';

const SLOT_W = 128;
const FLASH_MS = 1200;
const BIG_SCALE = 4;

export class MiniGameHud {
  private readonly slots: Phaser.GameObjects.BitmapText[];
  private readonly timer: Phaser.GameObjects.BitmapText;
  private readonly bigText: Phaser.GameObjects.BitmapText;
  private readonly subText: Phaser.GameObjects.BitmapText;
  private readonly flashText: Phaser.GameObjects.BitmapText;
  private flashUntil = 0;

  /** `icons[i]` is the `ui.icon.*` texture drawn before slot i (null = none). */
  constructor(private readonly scene: Phaser.Scene, slotCount: number, icons: readonly (string | null)[] = []) {
    const h = MINIGAME_SCENE.hudH;
    panel(scene, 0, 0, GAME_WIDTH, h, true, 60);
    this.slots = Array.from({ length: slotCount }, (_, i) => {
      const x = 10 + i * SLOT_W;
      const icon = icons[i];
      if (icon && scene.textures.exists(icon)) scene.add.image(x, 8, icon, 0).setOrigin(0, 0).setDepth(61);
      return addText(scene, x + (icon ? 12 : 0), 8, '', { font: 'retro6', color: COLORS.text, depth: 61 });
    });
    this.timer = addText(scene, GAME_WIDTH - MINIGAME_SCENE.pauseIcon - 8, 8, '', { font: 'retro6', color: COLORS.bright, depth: 61 }).setOrigin(1, 0);
    this.bigText = addText(scene, GAME_WIDTH / 2, 170, '', { color: COLORS.bright, scale: BIG_SCALE, align: 1, depth: 70 }).setOrigin(0.5).setVisible(false);
    this.subText = addText(scene, GAME_WIDTH / 2, 130, '', { color: COLORS.text, scale: 2, align: 1, depth: 70 }).setOrigin(0.5).setVisible(false);
    this.flashText = addText(scene, GAME_WIDTH / 2, h + 6, '', { color: COLORS.warn, depth: 61 }).setOrigin(0.5, 0).setVisible(false);
  }

  /** Per frame: slot strings and whole seconds left. */
  update(slots: string[], secondsLeft: number): void {
    slots.forEach((txt, i) => {
      const s = this.slots[i];
      if (s) setText(s, txt);
    });
    const left = Math.max(0, Math.ceil(secondsLeft - 1e-9));
    setText(this.timer, t('minigame.common.time', { n: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` }));
    if (this.flashUntil && this.scene.time.now > this.flashUntil) {
      this.flashUntil = 0;
      this.flashText.setVisible(false);
    }
  }

  /** A short message under the HUD for ~1.2 s. */
  flash(text: string, color: number): void {
    this.flashText.setText(text).setTint(color).setVisible(true);
    this.flashUntil = this.scene.time.now + FLASH_MS;
  }

  /** Big centered text (countdown digit / GO, x4) with an optional line above it (x2); null hides both. */
  big(text: string | null, sub: string | null = null): void {
    this.bigText.setVisible(text !== null);
    if (text !== null) this.bigText.setText(text);
    this.subText.setVisible(text !== null && sub !== null);
    if (sub !== null) this.subText.setText(sub);
  }
}
