/** Mini-game overlays: centered bitmap-text panels (instructions, result) and the pause menu. Presentation only. */
import Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { announce } from '@/game/a11y';
import { markFlag } from '@/game/contract';
import { session } from '@/game/session';
import { panel } from '@/ui/chrome';
import type { KeyRouter } from '@/ui/keys';
import { Menu } from '@/ui/Menu';
import { addText, lineCount, linePitch } from '@/ui/text';
import { CHAR_W, COLORS, LINE_HEIGHT } from '@/ui/theme';
import { mlist, mt } from './copy';
import { t } from '@/ui/copy';
import { addAnchored } from './pool';

const DEPTH = 80;
/** Paragraph break: each panel line is its own live-region line. */
const PARA = '\n\n';
const W = 520;

/** One panel line (`scale` 2 for titles). */
export interface PanelLine { text: string; color?: number; scale?: number }

/** A bordered, centered panel of lines over a dimmed field. `destroy()` removes it. */
export class Panel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, lines: PanelLine[]) {
    const x = (GAME_WIDTH - W) / 2;
    const wrap = W - 32;
    this.objects.push(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.55).setOrigin(0, 0).setDepth(DEPTH));
    const heights = lines.map((l) => Math.max(1, lineCount(l.text, wrap, l.scale ?? 1)) * linePitch(l.scale ?? 1));
    const h = heights.reduce((s, hh) => s + hh + 6, 0) + 30;
    let y = Math.max(28, Math.floor((GAME_HEIGHT - h) / 2));
    this.objects.push(...panel(scene, x, y, W, h, false, DEPTH + 1));
    y += 16;
    lines.forEach((l, i) => {
      const scale = l.scale ?? 1;
      const oneLine = lineCount(l.text, wrap, scale) <= 1;
      // single lines are centred by position; wrapped ones by BitmapText alignment
      const lx = oneLine ? Math.floor(GAME_WIDTH / 2 - (l.text.length * CHAR_W * scale) / 2) : x + 16;
      this.objects.push(addText(scene, lx, y, l.text, { color: l.color ?? COLORS.text, scale, wrap, align: oneLine ? 0 : 1, depth: DEPTH + 2 }));
      y += (heights[i] ?? 0) + 6;
    });
    announce(lines.map((l) => l.text).filter((s) => s.trim()).join(PARA), true);
  }

  destroy(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
  }
}

/**
 * Instruction screen: `minigame.<kind>.title / howto / start`. With reduced motion on, a line notes that Options can
 * auto-resolve mini-games (the games themselves are unchanged).
 */
export function introPanel(scene: Phaser.Scene, kind: string): Panel {
  const k = `minigame.${kind}`;
  return new Panel(scene, [
    { text: t(`${k}.title`), color: COLORS.bright, scale: 2 },
    ...mlist(`${k}.howto`).map((text) => ({ text })),
    ...(session.settings.reducedMotion ? [{ text: t('minigame.common.autoAvailable'), color: COLORS.dim }] : []),
    { text: t(`${k}.start`), color: COLORS.warn },
  ]);
}

/** Result panel: title, the game's lines, an optional refusal, and the continue hint. */
export function resultPanel(scene: Phaser.Scene, lines: PanelLine[], error: string | null): Panel {
  return new Panel(scene, [
    { text: t('minigame.resultTitle'), color: COLORS.bright, scale: 2 },
    ...lines,
    ...(error ? [{ text: error, color: COLORS.warn }] : []),
    { text: t('minigame.common.continue'), color: COLORS.dim },
  ]);
}

/** Pause menu: Resume / Skip (penalty) / Controls. Esc resumes. Sets `body[data-paused]` while open. */
export class PauseMenu {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly menu: Menu;
  private controls: Panel | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly router: KeyRouter, private readonly on: { resume: () => void; skip: () => void }) {
    const y = 120;
    audio().sfx('pause');
    this.objects.push(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.6).setOrigin(0, 0).setDepth(DEPTH).setInteractive());
    this.objects.push(...panel(scene, GAME_WIDTH / 2 - 130, y - 16, 260, 120, false, DEPTH + 1));
    const title = t('minigame.paused');
    this.objects.push(addText(scene, GAME_WIDTH / 2 - title.length * CHAR_W, y, title, { color: COLORS.bright, scale: 2, depth: DEPTH + 2 }));
    const items = [t('minigame.common.resume'), t('minigame.skip'), t('minigame.controls')].map((label) => ({ label }));
    this.menu = new Menu(scene, items, { x: GAME_WIDTH / 2 - 100, y: y + 32, depth: DEPTH + 2, lineHeight: LINE_HEIGHT + 6, onSelect: (i) => this.select(i), onBack: () => this.close(on.resume) });
    router.push(this.menu);
    markFlag('paused', true);
  }

  private select(i: number): void {
    if (i === 0) return this.close(this.on.resume);
    if (i === 1) return this.close(this.on.skip);
    this.showControls();
  }

  /** Controls text over the menu; any key or tap returns. */
  private showControls(): void {
    if (this.controls) return;
    this.controls = new Panel(this.scene, [{ text: t('minigame.controls'), color: COLORS.bright }, { text: t('minigame.common.controlsBody') }, { text: t('minigame.common.continue'), color: COLORS.dim }]);
    const back = (): void => {
      this.router.remove(handler);
      this.scene.input.off('pointerdown', back);
      this.controls?.destroy();
      this.controls = null;
    };
    const handler = { onKey: back, hints: 'help' };
    this.router.push(handler);
    // Registered next tick so the tap that chose "Controls" does not close it at once.
    this.scene.time.delayedCall(50, () => this.controls && this.scene.input.once('pointerdown', back));
  }

  private close(then: () => void): void {
    this.router.remove(this.menu);
    this.menu.destroy();
    this.objects.forEach((o) => o.destroy());
    markFlag('paused', false);
    then();
  }
}

/** Skip confirmation (minigame.common.skipConfirm): `onYes` or back to the pause menu via `onNo`. */
export function confirmSkip(scene: Phaser.Scene, router: KeyRouter, onYes: () => void, onNo: () => void): void {
  const panel = new Panel(scene, [{ text: t('minigame.common.skipConfirm') }, { text: '' }, { text: '' }]);
  const menu = new Menu(scene, [{ label: t('minigame.common.skipNo') }, { label: t('minigame.common.skipYes') }], {
    x: GAME_WIDTH / 2 - 80,
    y: GAME_HEIGHT / 2 + 4,
    depth: DEPTH + 3,
    onSelect: (i) => done(i === 1),
    onBack: () => done(false),
  });
  const done = (yes: boolean): void => {
    router.remove(menu);
    menu.destroy();
    panel.destroy();
    markFlag('paused', false);
    if (yes) onYes();
    else onNo();
  };
  markFlag('paused', true);
  router.push(menu);
}

/** `ui.icon.pause` (top-right) and, for touch UIs, an action button; returns their hit rectangles. */
export function touchButtons(scene: Phaser.Scene, size: number, action: string | null): { pause: Phaser.Geom.Rectangle; action: Phaser.Geom.Rectangle | null } {
  const pause = new Phaser.Geom.Rectangle(GAME_WIDTH - size, 0, size, size);
  if (scene.textures.exists('ui.icon.pause')) addAnchored(scene, pause.centerX, pause.centerY, 'ui.icon.pause').setDepth(DEPTH - 10);
  else addText(scene, pause.x + 4, 8, mt('minigame.common.pauseIcon'), { depth: DEPTH - 10 });
  if (action === null) return { pause, action: null };
  const r = new Phaser.Geom.Rectangle(GAME_WIDTH - 84, GAME_HEIGHT - 60, 72, 48);
  panel(scene, r.x, r.y, r.width, r.height, false, DEPTH - 10);
  addText(scene, Math.floor(r.centerX - (action.length * CHAR_W) / 2), r.centerY - 4, action, { color: COLORS.bright, depth: DEPTH - 10 });
  return { pause, action: r };
}
