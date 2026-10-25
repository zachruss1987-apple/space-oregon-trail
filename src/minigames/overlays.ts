/** Mini-game overlays: centered text panels (instructions, result) and the pause menu. Presentation only. */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { markFlag } from '@/game/contract';
import type { KeyRouter } from '@/ui/keys';
import { Menu } from '@/ui/Menu';
import { COLORS, LINE_HEIGHT, textStyle } from '@/ui/theme';
import { mlist, mt } from './copy';
import { t } from '@/ui/copy';

const DEPTH = 80;
const W = 520;

/** One panel line. */
export interface PanelLine { text: string; color?: string; size?: number }

/** A bordered, centered panel of lines over a dimmed field. `destroy()` removes it. */
export class Panel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, lines: PanelLine[]) {
    const x = (GAME_WIDTH - W) / 2;
    this.objects.push(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0).setDepth(DEPTH));
    const texts = lines.map((l) => scene.add.text(GAME_WIDTH / 2, 0, l.text, textStyle(l.color ?? COLORS.text, W - 32, l.size)).setOrigin(0.5, 0).setAlign('center').setDepth(DEPTH + 2));
    const h = texts.reduce((s, tx) => s + tx.height + 6, 0) + 28;
    let y = Math.max(28, (GAME_HEIGHT - h) / 2);
    this.objects.push(scene.add.rectangle(x, y, W, h, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.border).setDepth(DEPTH + 1));
    y += 14;
    for (const tx of texts) {
      tx.setY(y);
      y += tx.height + 6;
      this.objects.push(tx);
    }
  }

  destroy(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
  }
}

/** Instruction screen: `minigame.<kind>.title / howto / start`. */
export function introPanel(scene: Phaser.Scene, kind: string): Panel {
  const k = `minigame.${kind}`;
  return new Panel(scene, [
    { text: t(`${k}.title`), color: COLORS.bright, size: 18 },
    ...mlist(`${k}.howto`).map((text) => ({ text })),
    { text: t(`${k}.start`), color: COLORS.warn },
  ]);
}

/** Result panel: title, the game's lines, an optional refusal, and the continue hint. */
export function resultPanel(scene: Phaser.Scene, lines: PanelLine[], error: string | null): Panel {
  return new Panel(scene, [
    { text: t('minigame.resultTitle'), color: COLORS.bright, size: 18 },
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
    this.objects.push(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0).setDepth(DEPTH).setInteractive());
    this.objects.push(scene.add.rectangle(GAME_WIDTH / 2 - 130, y - 16, 260, 130, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.border).setDepth(DEPTH + 1));
    this.objects.push(scene.add.text(GAME_WIDTH / 2, y, t('minigame.paused'), textStyle(COLORS.bright, undefined, 16)).setOrigin(0.5, 0).setDepth(DEPTH + 2));
    const items = [t('minigame.common.resume'), t('minigame.skip'), t('minigame.controls')].map((label) => ({ label }));
    this.menu = new Menu(scene, items, { x: GAME_WIDTH / 2 - 100, y: y + 30, depth: DEPTH + 2, lineHeight: LINE_HEIGHT + 4, onSelect: (i) => this.select(i), onBack: () => this.close(on.resume) });
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
    const handler = { onKey: back };
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

/** "II" icon (top-right) and, for touch UIs, an action button; returns their hit rectangles. */
export function touchButtons(scene: Phaser.Scene, size: number, action: string | null): { pause: Phaser.Geom.Rectangle; action: Phaser.Geom.Rectangle | null } {
  const pause = new Phaser.Geom.Rectangle(GAME_WIDTH - size, 0, size, size);
  scene.add.rectangle(pause.x + 1, 1, size - 2, size - 2, COLORS.panel).setOrigin(0, 0).setStrokeStyle(1, COLORS.borderDim).setDepth(DEPTH - 10);
  scene.add.text(pause.centerX, pause.centerY, mt('minigame.common.pauseIcon'), textStyle(COLORS.text, undefined, 12)).setOrigin(0.5).setDepth(DEPTH - 10);
  if (action === null) return { pause, action: null };
  const r = new Phaser.Geom.Rectangle(GAME_WIDTH - 84, GAME_HEIGHT - 60, 72, 48);
  scene.add.rectangle(r.x, r.y, r.width, r.height, COLORS.panel, 0.6).setOrigin(0, 0).setStrokeStyle(1, COLORS.border).setDepth(DEPTH - 10);
  scene.add.text(r.centerX, r.centerY, action, textStyle(COLORS.bright)).setOrigin(0.5).setDepth(DEPTH - 10);
  return { pause, action: r };
}
