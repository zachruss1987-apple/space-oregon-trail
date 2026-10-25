/** Title screen (art.md "Title hero"): hero band, x4 logo, tagline, x2 menu with the cursor ship, seed line, title theme. */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { session } from '@/game/session';
import { drawTitleHero, type TitleHero } from '@/gfx/travelArt';
import { mt } from '@/minigames/copy';
import { list, t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { addText, setText } from '@/ui/text';
import { CHAR_W, COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const centerX = (s: string, scale: number): number => Math.floor((GAME_WIDTH - s.length * CHAR_W * scale) / 2);

export class TitleScene extends BaseScene {
  private hero: TitleHero | null = null;
  private mute: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('Title');
  }

  protected override music(): string {
    return 'title';
  }

  create(): void {
    this.begin();
    session.reset();
    this.hero = drawTitleHero(this, 0, 20, session.settings.reducedMotion);
    const name = t('title.name');
    addText(this, centerX(name, 4) + 1, 169, name, { color: COLORS.shadow, scale: 4 });
    addText(this, centerX(name, 4), 168, name, { color: COLORS.warn, scale: 4 });
    const tagline = t('title.tagline');
    addText(this, centerX(tagline, 1), 210, tagline, { color: COLORS.text });
    const labels = list('title.menu');
    const widest = Math.max(...labels.map((l) => l.length)) + 5;
    const menu = new Menu(this, labels.map((label) => ({ label })), {
      x: centerX(' '.repeat(widest), 2),
      y: 232,
      numbered: true,
      lineHeight: 22,
      scale: 2,
      onSelect: (i) => this.choose(i),
    });
    // Hidden key M toggles mini-game auto-resolve (also a row in Options).
    const note = addText(this, 0, 326, '', { color: COLORS.warn });
    this.router.push({
      onKey: (e) => {
        if (e.key !== 'm' && e.key !== 'M') return menu.onKey(e);
        session.setOption('autoResolveMiniGames', !session.options.autoResolveMiniGames);
        const msg = mt(session.autoResolveMiniGames ? 'title.miniAuto' : 'title.miniPlay');
        setText(note, msg).setX(centerX(msg, 1));
      },
    });
    const hint = t('title.hint');
    addText(this, centerX(hint, 1), GAME_HEIGHT - 36, hint, { color: COLORS.dim });
    const seed = t('title.seed', { seed: session.seedLabel });
    addText(this, centerX(seed, 1), GAME_HEIGHT - 20, seed, { color: COLORS.dim });
    // Muted-speaker icon until the first gesture unlocks audio (audio.md "Autoplay unlock").
    this.mute = this.add.image(GAME_WIDTH - 12, 6, 'ui.icon.mute', 0).setOrigin(0, 0).setDepth(10);
    this.events.once('shutdown', () => {
      this.hero = null;
      this.mute = null;
    });
  }

  override update(_time: number, delta: number): void {
    this.hero?.update(delta);
    this.mute?.setVisible(audio().state === 'locked');
  }

  private choose(i: number): void {
    if (i === 0) this.go('Setup');
    else if (i === 1) this.modal(`${t('guide.title')}\n\n${t('guide.body')}`);
    else if (i === 3) this.go('Options');
    else this.modal(t('title.comingSoon'));
  }
}
