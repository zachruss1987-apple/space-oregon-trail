/** Memorial beacon prompt for one crew death (beacons.md): 40-char epitaph field; Enter on empty, Esc or Skip = none. */
import type Phaser from 'phaser';
import { GAME_HEIGHT as GAME_H, GAME_WIDTH as GAME_W } from '@/config';
import { markFlag } from '@/game/contract';
import { BEACONS } from '@/sim';
import { t } from './copy';
import type { KeyRouter } from './keys';
import { NameInput } from './NameInput';
import { COLORS, textStyle } from './theme';

const DEPTH = 110;

/** Show the prompt for `name`; `onDone(text)` gets the epitaph, or null when skipped. */
export function promptBeacon(scene: Phaser.Scene, router: KeyRouter, name: string, onDone: (text: string | null) => void): void {
  const w = 480;
  const h = 110;
  const x = (GAME_W - w) / 2;
  const y = (GAME_H - h) / 2;
  const objects: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setDepth(DEPTH).setInteractive(),
    scene.add.rectangle(x, y, w, h, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.border).setDepth(DEPTH + 1),
    scene.add.text(x + 16, y + 12, t('travel.beaconPrompt', { name }), textStyle(COLORS.bright, w - 32)).setDepth(DEPTH + 2),
  ];
  const input: NameInput = new NameInput(scene, x + 16, y + 44, {
    maxLength: BEACONS.textMax,
    depth: DEPTH + 2,
    onCommit: (v) => close(v.trim() || null),
    onCancel: () => close(null),
  });
  const skip = scene.add.text(x + 16, y + 76, t('travel.beaconSkip'), textStyle(COLORS.dim)).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
  skip.on('pointerdown', () => close(null));
  objects.push(skip);
  let open = true;
  function close(text: string | null): void {
    if (!open) return;
    open = false;
    router.remove(input);
    input.destroy();
    objects.forEach((o) => o.destroy());
    markFlag('modal', false);
    markFlag('beacon', false);
    onDone(text);
  }
  router.push(input);
  markFlag('modal', true);
  markFlag('beacon', true);
}
