/** Memorial beacon prompt for one crew death (beacons.md): 40-char epitaph field; Enter on empty, Esc or Skip = none. */
import type Phaser from 'phaser';
import { GAME_HEIGHT as GAME_H, GAME_WIDTH as GAME_W } from '@/config';
import { markFlag } from '@/game/contract';
import { BEACONS } from '@/sim';
import { t } from './copy';
import type { KeyRouter } from './keys';
import { NameInput } from './NameInput';
import { audio } from '@/audio/AudioManager';
import { panel } from './chrome';
import { addText } from './text';
import { COLORS } from './theme';

const DEPTH = 110;

/** Show the prompt for `name` (with their `portrait.N` texture, dead frame); `onDone(text)` gets the epitaph, or null when skipped. */
export function promptBeacon(scene: Phaser.Scene, router: KeyRouter, name: string, onDone: (text: string | null) => void, portrait?: string): void {
  const w = 480;
  const h = 110;
  const x = (GAME_W - w) / 2;
  const y = (GAME_H - h) / 2;
  const objects: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setDepth(DEPTH).setInteractive(),
    ...panel(scene, x, y, w, h, false, DEPTH + 1),
    addText(scene, x + 56, y + 16, t('travel.beaconPrompt', { name }), { color: COLORS.bright, wrap: w - 72, depth: DEPTH + 2 }),
  ];
  // The crew member's portrait (dead frame) beside the prompt, and the memorial beacon in the corner.
  if (portrait && scene.textures.exists(portrait)) objects.push(scene.add.image(x + 14, y + 14, portrait, 2).setOrigin(0, 0).setDepth(DEPTH + 2));
  if (scene.textures.exists('beacon')) objects.push(scene.add.image(x + w - 28, y + h - 32, 'beacon', 0).setOrigin(0, 0).setDepth(DEPTH + 2));
  audio().sfx('death.toll');
  const input: NameInput = new NameInput(scene, x + 56, y + 52, {
    maxLength: BEACONS.textMax,
    depth: DEPTH + 2,
    onCommit: (v) => close(v.trim() || null),
    onCancel: () => close(null),
  });
  const skip = addText(scene, x + 56, y + 80, t('travel.beaconSkip'), { color: COLORS.dim, depth: DEPTH + 2 }).setInteractive({ useHandCursor: true });
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
    if (text) audio().sfx('beacon.chime');
    onDone(text);
  }
  router.push(input);
  markFlag('modal', true);
  markFlag('beacon', true);
}
