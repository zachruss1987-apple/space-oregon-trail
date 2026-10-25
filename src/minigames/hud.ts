/** Mini-game HUD strip (y 0-23): slot texts left to right, the timer `TIME 0:27`, a flash line and the big center text. */
import type Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { MINIGAME_SCENE } from '@/content';
import { t } from '@/ui/copy';
import { COLORS, textStyle } from '@/ui/theme';

const SLOT_W = 128;
const FLASH_MS = 1200;

export class MiniGameHud {
  private readonly slots: Phaser.GameObjects.Text[];
  private readonly timer: Phaser.GameObjects.Text;
  private readonly bigText: Phaser.GameObjects.Text;
  private readonly flashText: Phaser.GameObjects.Text;
  private flashUntil = 0;

  constructor(private readonly scene: Phaser.Scene, slotCount: number) {
    const h = MINIGAME_SCENE.hudH;
    scene.add.rectangle(0, 0, GAME_WIDTH, h, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.borderDim).setDepth(60);
    this.slots = Array.from({ length: slotCount }, (_, i) => scene.add.text(8 + i * SLOT_W, 4, '', textStyle(COLORS.text, undefined, 12)).setDepth(61));
    this.timer = scene.add.text(GAME_WIDTH - MINIGAME_SCENE.pauseIcon - 8, 4, '', textStyle(COLORS.bright, undefined, 12)).setOrigin(1, 0).setDepth(61);
    this.bigText = scene.add.text(GAME_WIDTH / 2, 170, '', textStyle(COLORS.bright, 500, 28)).setOrigin(0.5).setAlign('center').setDepth(70).setVisible(false);
    this.flashText = scene.add.text(GAME_WIDTH / 2, h + 6, '', textStyle(COLORS.warn, undefined, 12)).setOrigin(0.5, 0).setDepth(61).setVisible(false);
  }

  /** Per frame: slot strings and whole seconds left. */
  update(slots: string[], secondsLeft: number): void {
    slots.forEach((txt, i) => this.slots[i]?.setText(txt));
    const left = Math.max(0, Math.ceil(secondsLeft - 1e-9));
    this.timer.setText(t('minigame.common.time', { n: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` }));
    if (this.flashUntil && this.scene.time.now > this.flashUntil) {
      this.flashUntil = 0;
      this.flashText.setVisible(false);
    }
  }

  /** A short message under the HUD for ~1.2 s. */
  flash(text: string, color: string): void {
    this.flashText.setText(text).setColor(color).setVisible(true);
    this.flashUntil = this.scene.time.now + FLASH_MS;
  }

  /** Big centered text (countdown / GO); null hides it. */
  big(text: string | null): void {
    this.bigText.setVisible(text !== null);
    if (text !== null) this.bigText.setText(text);
  }
}
