/** Shared scene plumbing: e2e marker, key router, modal helper, heading text. */
import Phaser from 'phaser';
import { GAME_WIDTH } from '@/config';
import { markScene } from '@/game/contract';
import { KeyRouter } from '@/ui/keys';
import { Modal, resetModals, type ModalOptions } from '@/ui/Modal';
import { COLORS, textStyle } from '@/ui/theme';

/** Scene keys (the `data-scene` values). */
export type SceneKey = 'Title' | 'Setup' | 'Store' | 'Travel' | 'Supplies' | 'Map' | 'Waypoint' | 'Death' | 'Arrival';

export abstract class BaseScene extends Phaser.Scene {
  protected router!: KeyRouter;

  constructor(readonly sceneKey: SceneKey) {
    super({ key: sceneKey });
  }

  /** Call first in create(). */
  protected begin(): void {
    resetModals();
    this.router = new KeyRouter(this);
    this.cameras.main.setBackgroundColor(COLORS.bg);
    markScene(this.sceneKey);
  }

  protected modal(message: string, opts?: ModalOptions): Modal {
    return new Modal(this, this.router, message, opts);
  }

  protected go(key: SceneKey): void {
    this.scene.start(key);
  }

  /** Centered heading line. */
  protected heading(y: number, text: string, size = 14, color: string = COLORS.bright): Phaser.GameObjects.Text {
    return this.add.text(GAME_WIDTH / 2, y, text, textStyle(color, undefined, size)).setOrigin(0.5, 0);
  }
}
