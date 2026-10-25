/** Title screen: name, tagline, menu (only "Travel the Trail" is live in M1), shareable seed. */
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { session } from '@/game/session';
import { list, t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { COLORS, textStyle } from '@/ui/theme';
import { BaseScene } from './BaseScene';

export class TitleScene extends BaseScene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.begin();
    session.reset();
    this.drawStars();
    this.heading(70, t('title.name'), 32, COLORS.text);
    this.heading(116, t('title.tagline'), 14, COLORS.dim);
    const labels = list('title.menu');
    const menu = new Menu(this, labels.map((label) => ({ label })), {
      x: 210,
      y: 170,
      numbered: true,
      lineHeight: 24,
      onSelect: (i) => this.choose(i),
    });
    this.router.push(menu);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 52, t('title.hint'), textStyle(COLORS.dim)).setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, t('title.seed', { seed: session.seedLabel }), textStyle(COLORS.dim)).setOrigin(0.5, 0);
  }

  private choose(i: number): void {
    if (i === 0) this.go('Setup');
    else if (i === 1) this.modal(`${t('guide.title')}\n\n${t('guide.body')}`);
    else this.modal(t('title.comingSoon'));
  }

  /** A cosmetic starfield from the UI rng (art arrives in M4). */
  private drawStars(): void {
    for (let i = 0; i < 70; i++) {
      const x = session.uiRng.int(0, GAME_WIDTH);
      const y = session.uiRng.int(0, GAME_HEIGHT);
      this.add.rectangle(x, y, 1, 1, session.uiRng.chance(0.3) ? 0xc8ffc8 : 0x2e8a2e);
    }
  }
}
