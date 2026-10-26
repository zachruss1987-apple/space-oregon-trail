/**
 * The `?` controls overlay (ui.md "Controls"): a centered panel listing every key (`help.title`, `help.lines`,
 * `help.close`). Opened and closed by KeyRouter; any key or a click closes it. Sets `body[data-help="1"]` while open
 * and reads its text into the live region.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, inHintBand } from '@/config';
import { announce } from '@/game/a11y';
import { markFlag } from '@/game/contract';
import { panel } from './chrome';
import { list, t } from './copy';
import { addText } from './text';
import { CHAR_W, COLORS, LINE_HEIGHT } from './theme';

const DEPTH = 200;
const W = 560;

/** Key hints set while the overlay is open (keyhints.md): any key closes it. */
export const HELP_HINTS = 'help';

export interface HelpOverlay {
  destroy(): void;
}

export function openHelp(scene: Phaser.Scene, onClickClose: () => void): HelpOverlay {
  const title = t('help.title');
  const lines = list('help.lines');
  const close = t('help.close');
  const h = 48 + lines.length * (LINE_HEIGHT + 2) + 40;
  const x = (GAME_WIDTH - W) / 2;
  const y = Math.max(8, Math.floor((GAME_HEIGHT - h) / 2));
  const objects: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.7).setOrigin(0, 0).setDepth(DEPTH).setInteractive(),
    ...panel(scene, x, y, W, h, false, DEPTH + 1),
    addText(scene, Math.floor(GAME_WIDTH / 2 - title.length * CHAR_W), y + 14, title, { color: COLORS.bright, scale: 2, depth: DEPTH + 2 }),
    ...lines.map((line, i) => addText(scene, x + 20, y + 44 + i * (LINE_HEIGHT + 2), line, { color: COLORS.text, depth: DEPTH + 2 })),
    addText(scene, x + 20, y + h - 22, close, { color: COLORS.dim, depth: DEPTH + 2 }),
  ];
  // Registered next tick so the click that opened nothing else does not close it at once.
  const click = (p: Phaser.Input.Pointer): void => {
    if (!inHintBand(p)) onClickClose();
  };
  scene.time.delayedCall(50, () => objects[0]?.active && scene.input.on('pointerdown', click));
  markFlag('help', true);
  announce([title, ...lines, close].join('\n\n'));
  return {
    destroy: () => {
      scene.input.off('pointerdown', click);
      objects.forEach((o) => o.destroy());
      markFlag('help', false);
    },
  };
}
