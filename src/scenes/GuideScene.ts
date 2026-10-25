/** Learn about the Trail (M5): the writer's guidebook (guide.json), one page at a time. Left/Right page, Esc back. */
import type Phaser from 'phaser';
import { GUIDE_PAGES } from '@/content';
import { announceScreen } from '@/game/a11y';
import { t } from '@/ui/copy';
import { isBack } from '@/ui/keys';
import { addText } from '@/ui/text';
import { COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const LEFT = 48;
const BODY_Y = 80;
const LINE_H = 22;

export class GuideScene extends BaseScene {
  private page = 0;
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Guide');
  }

  protected override music(): string {
    return 'title';
  }

  create(data?: { page?: number }): void {
    this.begin();
    this.page = Math.min(Math.max(0, data?.page ?? 0), GUIDE_PAGES.length - 1);
    this.heading(16, t('guide.title').toUpperCase());
    addText(this, LEFT, 376, t('guide.hint'), { color: COLORS.dim });
    this.router.set({
      onKey: (e) => {
        if (isBack(e)) this.go('Title');
        else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'PageUp') this.turn(-1);
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'PageDown' || e.key === 'Enter' || e.key === ' ') this.turn(1);
      },
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.turn(p.worldX < 320 ? -1 : 1));
    this.paint();
  }

  private turn(dir: number): void {
    const next = this.page + dir;
    if (next < 0 || next >= GUIDE_PAGES.length) return;
    this.page = next;
    this.paint();
  }

  private paint(): void {
    this.objects.forEach((o) => o.destroy());
    const p = GUIDE_PAGES[this.page];
    if (!p) return;
    announceScreen([t('guide.pageOf', { n: this.page + 1, total: GUIDE_PAGES.length }), p.title, ...p.body]);
    this.objects = [
      addText(this, LEFT, 48, p.title, { color: COLORS.bright }),
      ...p.body.map((line, i) => addText(this, LEFT, BODY_Y + i * LINE_H, line, { color: line.trimStart().startsWith('>') ? COLORS.warn : COLORS.text })),
      addText(this, 440, 376, t('guide.pageOf', { n: this.page + 1, total: GUIDE_PAGES.length }), { color: COLORS.dim }),
    ];
  }
}
