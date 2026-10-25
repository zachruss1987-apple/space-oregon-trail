/** Centered dialog: prose plus a vertical button list. Blocks input beneath it until closed. */
import Phaser from 'phaser';
import { announce } from '@/game/a11y';
import { markFlag } from '@/game/contract';
import { t } from './copy';
import type { KeyRouter } from './keys';
import { Menu, type MenuItem } from './Menu';
import { TextBox } from './TextBox';
import { GAME_HEIGHT as GAME_H, GAME_WIDTH as GAME_W } from '@/config';
import { panel } from './chrome';
import { LINE_HEIGHT } from './theme';

export interface ModalOptions {
  /** Button labels (default: a single OK). */
  buttons?: (string | MenuItem)[];
  /** Called with the chosen button index (Esc picks the last button when `escCloses`). */
  onClose?: (index: number) => void;
  /** Esc chooses the last button (default true). */
  escCloses?: boolean;
  width?: number;
}

const DEPTH = 100;
let openCount = 0;

export class Modal {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly body: TextBox;
  private readonly menu: Menu;

  constructor(scene: Phaser.Scene, private readonly router: KeyRouter, message: string, opts: ModalOptions = {}) {
    const w = opts.width ?? 480;
    const x = (GAME_W - w) / 2;
    const buttons = (opts.buttons ?? [t('common.ok')]).map((b) => (typeof b === 'string' ? { label: b } : b));
    const blocker = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setDepth(DEPTH).setInteractive();
    this.objects.push(blocker);
    this.body = new TextBox(scene, x + 16, 0, w - 32, message, { depth: DEPTH + 2, typewriter: false });
    const textH = this.body.lineCount() * LINE_HEIGHT;
    const h = Math.min(GAME_H - 20, textH + buttons.length * (LINE_HEIGHT + 4) + 52);
    const y = Math.max(10, (GAME_H - h) / 2);
    this.objects.push(...panel(scene, x, y, w, h, false, DEPTH + 1));
    this.body.text.setY(y + 16);
    const close = (i: number): void => {
      this.destroy();
      opts.onClose?.(i);
    };
    this.menu = new Menu(scene, buttons, {
      x: x + 16,
      y: y + 26 + textH,
      lineHeight: LINE_HEIGHT + 4,
      depth: DEPTH + 2,
      onSelect: close,
      onBack: opts.escCloses === false ? undefined : () => close(buttons.length - 1),
    });
    announce(message, true);
    // Enter while the typewriter runs reveals the rest and acts on the button at once.
    this.router.push(this.handler);
    openCount += 1;
    markFlag('modal', true);
  }

  private readonly handler = {
    onKey: (e: KeyboardEvent): void => {
      if (this.body.typing) this.body.finish();
      this.menu.onKey(e);
    },
  };

  destroy(): void {
    this.router.remove(this.handler);
    this.menu.destroy();
    this.body.destroy();
    this.objects.forEach((o) => o.destroy());
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) markFlag('modal', false);
  }
}

/** Reset the open-modal count (called when a scene starts). */
export function resetModals(): void {
  openCount = 0;
}
