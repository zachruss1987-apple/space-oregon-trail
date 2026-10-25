/**
 * Options "Export save" / "Import save" panels: a dimmed overlay, a heading, a help line and a DOM TextArea holding the
 * save string (`exportSave` / `importSave`). Sets `body[data-modal="1"]` while open. Esc closes; Enter imports.
 */
import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { markFlag } from '@/game/contract';
import { readAutosave, storeAutosave } from '@/game/saveStore';
import { exportSave, importSave } from '@/sim';
import { panel } from '@/ui/chrome';
import { t } from '@/ui/copy';
import { isBack, type KeyRouter } from '@/ui/keys';
import { TextArea } from '@/ui/TextArea';
import { addText } from '@/ui/text';
import { COLORS } from '@/ui/theme';

/** Paste field cap. Exports run ~10-40k characters (the state includes the whole log). */
export const IMPORT_MAX_CHARS = 200_000;
const DEPTH = 100;
const BOX = { x: 40, y: 92, w: 560, h: 220 };

function overlay(scene: Phaser.Scene, router: KeyRouter, title: string, help: string, onKey: (e: KeyboardEvent, close: () => void) => void, onClose: () => void) {
  const objects: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0, 0).setDepth(DEPTH).setInteractive(),
    ...panel(scene, 24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48, false, DEPTH + 1),
    addText(scene, 40, 40, title, { color: COLORS.bright, scale: 2, depth: DEPTH + 2 }),
    addText(scene, 40, 68, help, { color: COLORS.dim, wrap: 560, depth: DEPTH + 2 }),
  ];
  const status = addText(scene, 40, BOX.y + BOX.h + 12, '', { color: COLORS.warn, wrap: 560, depth: DEPTH + 2 });
  objects.push(status);
  let area: TextArea | null = null;
  const close = (): void => {
    router.remove(handler);
    area?.destroy();
    objects.forEach((o) => o.destroy());
    markFlag('modal', false);
    onClose();
  };
  const handler = {
    onKey: (e: KeyboardEvent): void => {
      if (isBack(e)) close();
      else onKey(e, close);
    },
  };
  router.push(handler);
  markFlag('modal', true);
  return {
    status,
    attach: (a: TextArea): void => {
      area = a;
    },
  };
}

/** Show the autosave as an export string in a selectable field (and try the clipboard). */
export function openExport(scene: Phaser.Scene, router: KeyRouter, onClose: () => void): void {
  const saved = readAutosave();
  if (!saved.ok) return;
  const text = exportSave(saved.slot);
  const o = overlay(scene, router, t('save.exportTitle'), t('save.exportHelp'), () => undefined, onClose);
  o.attach(new TextArea(scene, BOX, { id: 'proxima-export', value: text, readOnly: true }));
  void navigator.clipboard?.writeText(text).then(
    () => o.status.active && o.status.setText(t('save.copied')).setTint(COLORS.dim),
    () => undefined,
  );
}

/** Paste field: Enter validates with `importSave`; a good save becomes the autosave (`done(true)`), a bad one shows why. */
export function openImport(scene: Phaser.Scene, router: KeyRouter, done: (imported: boolean) => void): void {
  let imported = false;
  const o = overlay(scene, router, t('save.importTitle'), t('save.importHelp'), (e, close) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const r = importSave(area.value);
    if (!r.ok) {
      o.status.setText(`${t('save.invalid')} ${r.error}`).setTint(COLORS.warn);
      return;
    }
    if (r.state.status !== 'traveling') {
      o.status.setText(t('save.over')).setTint(COLORS.warn);
      return;
    }
    storeAutosave(JSON.stringify(r.slot));
    imported = true;
    close();
  }, () => done(imported));
  const area = new TextArea(scene, BOX, { id: 'proxima-import', maxLength: IMPORT_MAX_CHARS });
  o.attach(area);
}
