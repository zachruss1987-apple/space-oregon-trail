/** A small modal panel asking for a number (Rest 1–9). Enter commits, Esc cancels. */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { markFlag } from '@/game/contract';
import type { KeyRouter } from './keys';
import { NumberInput } from './NumberInput';
import { COLORS, textStyle } from './theme';

export function promptNumber(
  scene: Phaser.Scene,
  router: KeyRouter,
  message: string,
  range: { min: number; max: number; value?: number },
  onDone: (value: number | null) => void,
): void {
  const w = 360;
  const h = 84;
  const x = (GAME_WIDTH - w) / 2;
  const y = (GAME_HEIGHT - h) / 2;
  const objects: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0).setDepth(100).setInteractive(),
    scene.add.rectangle(x, y, w, h, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.border).setDepth(101),
    scene.add.text(x + 16, y + 14, message, textStyle(COLORS.text, w - 32)).setDepth(102),
  ];
  markFlag('modal', true);
  const close = (v: number | null): void => {
    router.remove(input);
    input.destroy();
    objects.forEach((o) => o.destroy());
    markFlag('modal', false);
    onDone(v);
  };
  const input: NumberInput = new NumberInput(scene, x + 16, y + 46, {
    min: range.min,
    max: range.max,
    value: range.value ?? range.min,
    depth: 102,
    onCommit: (v) => close(v),
    onCancel: () => close(null),
  });
  router.push(input);
}
