/**
 * Title screen (art.md "Title hero"): hero band, x4 logo, tagline, x2 menu with the cursor ship, seed line, title theme.
 * With a valid autosave the menu starts with "Continue journey" and its `describeSave` line shows under the menu.
 */
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';
import { readAutosave, resumeScene } from '@/game/saveStore';
import { session } from '@/game/session';
import { drawTitleHero, type TitleHero } from '@/gfx/travelArt';
import { mt } from '@/minigames/copy';
import { describeSave } from '@/sim';
import { list, t } from '@/ui/copy';
import { Menu } from '@/ui/Menu';
import { muteIcon, type MuteIcon } from '@/ui/muteIcon';
import { addText, setText } from '@/ui/text';
import { CHAR_W, COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';

const centerX = (s: string, scale: number): number => Math.floor((GAME_WIDTH - s.length * CHAR_W * scale) / 2);

/** Title menu actions, in `title.menu` order after the optional Continue. */
type TitleAction = 'continue' | 'travel' | 'guide' | 'topTen' | 'options';
const BASE_ACTIONS: readonly TitleAction[] = ['travel', 'guide', 'topTen', 'options'];

export class TitleScene extends BaseScene {
  private hero: TitleHero | null = null;
  private mute: MuteIcon | null = null;

  constructor() {
    super('Title');
  }

  protected override music(): string {
    return 'title';
  }

  create(data?: { imported?: boolean }): void {
    this.begin();
    session.reset();
    this.hero = drawTitleHero(this, 0, 20, session.settings.reducedMotion);
    const name = t('title.name');
    addText(this, centerX(name, 4) + 1, 169, name, { color: COLORS.shadow, scale: 4 });
    addText(this, centerX(name, 4), 168, name, { color: COLORS.warn, scale: 4 });
    const tagline = t('title.tagline');
    addText(this, centerX(tagline, 1), 210, tagline, { color: COLORS.text });
    const saved = readAutosave();
    const actions: TitleAction[] = saved.ok ? ['continue', ...BASE_ACTIONS] : [...BASE_ACTIONS];
    const labels = saved.ok ? [t('title.continue'), ...list('title.menu')] : list('title.menu');
    const widest = Math.max(...labels.map((l) => l.length)) + 5;
    const lineHeight = saved.ok ? 18 : 22;
    const menu = new Menu(this, labels.map((label) => ({ label })), {
      x: centerX(' '.repeat(widest), 2),
      y: saved.ok ? 228 : 232,
      numbered: true,
      lineHeight,
      scale: 2,
      onSelect: (i) => this.choose(actions[i]),
    });
    // Hidden key M toggles mini-game auto-resolve (also a row in Options).
    const note = addText(this, 0, 326, '', { color: COLORS.warn });
    if (saved.ok) {
      const line = describeSave(saved.slot);
      addText(this, centerX(line, 1), 228 + labels.length * lineHeight + 2, line, { color: COLORS.dim });
      note.setY(340);
    }
    if (data?.imported) {
      const msg = t('save.imported');
      setText(note, msg).setX(centerX(msg, 1));
    }
    this.router.push({
      hints: 'title',
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
    // Muted speaker until the first gesture unlocks audio (audio.md "Autoplay unlock") and while muted.
    this.mute = muteIcon(this, GAME_WIDTH - 12, 6);
    this.events.once('shutdown', () => {
      this.hero = null;
      this.mute = null;
    });
  }

  override update(_time: number, delta: number): void {
    this.hero?.update(delta);
    this.mute?.update();
  }

  private choose(action: TitleAction | undefined): void {
    switch (action) {
      case 'continue': return this.resume();
      case 'travel': return this.go('Setup');
      case 'guide': return this.go('Guide');
      case 'topTen': return this.go('TopTen');
      case 'options': return this.go('Options');
    }
  }

  /** Continue journey: re-read the autosave (it may have changed in another tab), restore the run, open its scene. */
  private resume(): void {
    const saved = readAutosave();
    if (!saved.ok) {
      this.scene.restart();
      return;
    }
    session.resume(saved.slot, saved.state);
    if (window.__PROXIMA__) window.__PROXIMA__.seed = session.seedLabel;
    this.go(resumeScene(saved.state));
  }
}
