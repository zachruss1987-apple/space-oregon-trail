/**
 * Options (ui.md "Options screen"): Up/Down choose a row, Left/Right or Enter change it, Esc or Back returns to Title.
 * Changes apply at once and persist in `localStorage['proxima.options']` (session.setOption); volumes go through
 * `audio().setVolumes`, CRT through `enableCrt`, the palette re-rasterizes sprites and re-renders this screen.
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { applyCrt, applyPalette, applyVolumes, crtAvailable, crtShown } from '@/game/display';
import { cycle, TEXT_SPEEDS, TRI_STATES, type Options } from '@/game/options';
import { session } from '@/game/session';
import { toggle } from '@/ui/chrome';
import { t } from '@/ui/copy';
import { Menu, type MenuItem } from '@/ui/Menu';
import { addText, setText } from '@/ui/text';
import { COLORS } from '@/ui/theme';
import { BaseScene } from './BaseScene';

type RowId = 'crt' | 'music' | 'sfx' | 'textSpeed' | 'touch' | 'minigames' | 'reducedMotion' | 'palette' | 'difficulty' | 'back';
const ROWS: readonly RowId[] = ['crt', 'music', 'sfx', 'textSpeed', 'touch', 'minigames', 'reducedMotion', 'palette', 'difficulty', 'back'];
const LABEL_W = 19;
const MENU_X = 24;
const MENU_Y = 64;
const ROW_H = 26;

/** "6 ###..": the step and a 5-cell bar (one cell per two steps). */
const bar = (n: number): string => `${String(n).padStart(2)} ${'#'.repeat(Math.round(n / 2))}${'.'.repeat(5 - Math.round(n / 2))}`;

export class OptionsScene extends BaseScene {
  private menu!: Menu;
  private hint!: Phaser.GameObjects.BitmapText;
  private toggles: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Options');
  }

  protected override music(): string {
    return 'title';
  }

  create(data?: { row?: number }): void {
    this.begin();
    this.heading(24, t('options.title'));
    this.menu = new Menu(this, this.items(), {
      x: MENU_X, y: MENU_Y, numbered: true, lineHeight: ROW_H, scale: 2, cursor: data?.row ?? 0,
      onSelect: (i) => this.change(i, 1),
      onMove: (i) => this.describe(i),
      onBack: () => this.go('Title'),
    });
    this.hint = addText(this, MENU_X, 352, '', { color: COLORS.dim, wrap: 592 });
    this.router.push({
      onKey: (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.change(this.menu.cursor, -1);
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.change(this.menu.cursor, 1);
        else this.menu.onKey(e);
      },
    });
    this.describe(this.menu.cursor);
    this.paintToggles();
  }

  /** Value word for a row (spelled out; the toggle sprite is decoration). */
  private value(id: RowId): string {
    const o = session.options;
    const v = (k: string): string => t(`options.value.${k}`);
    switch (id) {
      case 'crt': return crtAvailable(this.game) ? v(crtShown(this.game) ? 'on' : 'off') : v('na');
      case 'music': return bar(o.music);
      case 'sfx': return bar(o.sfx);
      case 'textSpeed': return v(o.textSpeed);
      case 'touch': return v(o.touch);
      case 'minigames': return v(o.autoResolveMiniGames ? 'autoResolve' : 'play');
      case 'reducedMotion': return v(o.reducedMotion);
      case 'palette': return v(o.palette === 'cb' ? 'on' : 'off');
      case 'difficulty': return v('spacer');
      default: return '';
    }
  }

  private items(): MenuItem[] {
    return ROWS.map((id) => {
      const label = t(`options.${id}`);
      return { label: id === 'back' ? label : `${`${label} `.padEnd(LABEL_W, '.')} ${this.value(id)}` };
    });
  }

  /** The `ui.toggle` switch after the On/Off rows (CRT, palette). */
  private paintToggles(): void {
    this.toggles.forEach((g) => g.destroy());
    this.toggles = [];
    const o = session.options;
    const onOff: Partial<Record<RowId, boolean>> = { palette: o.palette === 'cb' };
    if (crtAvailable(this.game)) onOff.crt = crtShown(this.game);
    ROWS.forEach((id, i) => {
      const on = onOff[id];
      if (on !== undefined) this.toggles.push(toggle(this, 584, MENU_Y + i * ROW_H + 4, on));
    });
  }

  private describe(i: number): void {
    const id = ROWS[i];
    setText(this.hint, id ? t(`options.hint.${id}`) : '');
  }

  private set<K extends keyof Options>(key: K, value: Options[K]): void {
    session.setOption(key, value);
  }

  /** Change row `i` by `dir` (-1 / +1); Back (or Enter on it) returns. */
  private change(i: number, dir: number): void {
    const id = ROWS[i];
    const o = session.options;
    const step = (n: number): number => Math.min(10, Math.max(0, n + dir));
    switch (id) {
      case 'crt':
        if (!crtAvailable(this.game)) return this.menu.say(t('options.hint.crtNa'));
        this.set('crt', !crtShown(this.game));
        applyCrt(this.game);
        break;
      case 'music':
        this.set('music', step(o.music));
        applyVolumes();
        break;
      case 'sfx':
        this.set('sfx', step(o.sfx));
        applyVolumes();
        audio().sfx('ui.select');
        break;
      case 'textSpeed': this.set('textSpeed', cycle(TEXT_SPEEDS, o.textSpeed, dir)); break;
      case 'touch': this.set('touch', cycle(TRI_STATES, o.touch, dir)); break;
      case 'minigames': this.set('autoResolveMiniGames', !o.autoResolveMiniGames); break;
      case 'reducedMotion':
        this.set('reducedMotion', cycle(TRI_STATES, o.reducedMotion, dir));
        applyCrt(this.game);
        break;
      case 'palette':
        this.set('palette', o.palette === 'cb' ? 'standard' : 'cb');
        applyPalette(this);
        this.scene.restart({ row: i });
        return;
      case 'difficulty': return this.menu.say(t('options.hint.difficulty'));
      default: return this.go('Title');
    }
    this.menu.setItems(this.items());
    this.paintToggles();
  }
}
