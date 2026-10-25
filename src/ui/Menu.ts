/**
 * Vertical cursor menu: arrows/WASD (and Tab / Shift+Tab), Enter/Space, number keys, Esc, mouse hover/click, disabled
 * items with reasons. Rows are bitmap text; the `ui.cursor` ship marks the selected row. UI sounds: move, select, back,
 * deny. The newest live menu is mirrored in the hidden `#proxima-menu` listbox (src/game/a11y.ts).
 */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { announce, pushMenu, removeMenu, syncMenu, type A11yMenu } from '@/game/a11y';
import { session } from '@/game/session';
import { cursor } from './chrome';
import { isBack, isConfirm, isDown, isUp, type KeyHandler } from './keys';
import { addText } from './text';
import { COLORS } from './theme';

/** One menu row. `disabled` is the reason shown when it is chosen (null/undefined = enabled). */
export interface MenuItem {
  label: string;
  disabled?: string | null;
}

export interface MenuOptions {
  x: number;
  y: number;
  /** Prefix rows with "1." etc. (number keys work either way). */
  numbered?: boolean;
  lineHeight?: number;
  /** Starting cursor row. */
  cursor?: number;
  onSelect: (index: number) => void;
  onBack?: () => void;
  /** Called when the cursor moves. */
  onMove?: (index: number) => void;
  /** Called when a disabled row is chosen; default shows the reason under the menu. */
  onDisabled?: (reason: string, index: number) => void;
  /** Depth for all menu objects. */
  depth?: number;
  /** Integer text scale (x2 on the title). */
  scale?: number;
  /** Silence the select sound (the caller plays its own). */
  quiet?: boolean;
}

export class Menu implements KeyHandler {
  cursor: number;
  private items: MenuItem[];
  private readonly rows: Phaser.GameObjects.BitmapText[] = [];
  private readonly reason: Phaser.GameObjects.BitmapText;
  private readonly mark: Phaser.GameObjects.Image;
  private readonly lh: number;

  constructor(private readonly scene: Phaser.Scene, items: MenuItem[], private readonly opts: MenuOptions) {
    this.items = items;
    this.lh = opts.lineHeight ?? 16;
    this.cursor = Math.min(opts.cursor ?? 0, Math.max(0, items.length - 1));
    this.reason = addText(scene, opts.x, opts.y, '', { color: COLORS.warn, depth: opts.depth ?? 0 });
    this.mark = cursor(scene, opts.depth ?? 0, session.settings.reducedMotion).setScale(opts.scale ?? 1);
    this.build();
    pushMenu(this.a11y);
  }

  /** The listbox's view of this menu. */
  private readonly a11y: A11yMenu = ((m: Menu): A11yMenu => ({
    items: () => m.items,
    get cursor(): number {
      return m.cursor;
    },
    alive: () => !!m.mark.scene,
  }))(this);

  /** Replace the rows (keeps the cursor where possible). */
  setItems(items: MenuItem[]): void {
    this.items = items;
    this.cursor = Math.min(this.cursor, Math.max(0, items.length - 1));
    this.build();
  }

  /** Height in pixels of the rows. */
  get height(): number {
    return this.items.length * this.lh;
  }

  /** Show a message under the menu (cleared on the next move). */
  say(message: string): void {
    this.reason.setText(message);
    if (message) announce(message);
  }

  onKey(e: KeyboardEvent): void {
    if (isUp(e) || (e.key === 'Tab' && e.shiftKey)) this.move(-1);
    else if (isDown(e) || e.key === 'Tab') this.move(1);
    else if (isConfirm(e)) {
      if (!e.repeat) this.choose(this.cursor);
    } else if (isBack(e)) {
      if (this.opts.onBack) {
        audio().sfx('ui.back');
        this.opts.onBack();
      }
    } else if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < this.items.length) {
        // A disabled row only explains itself; the cursor stays where it was.
        if (!this.items[i]?.disabled) this.setCursor(i, true);
        this.choose(i);
      }
    }
  }

  /** Activate a row (as if Enter were pressed on it). */
  choose(i: number): void {
    const item = this.items[i];
    if (!item) return;
    if (item.disabled) {
      audio().sfx('ui.deny');
      if (this.opts.onDisabled) this.opts.onDisabled(item.disabled, i);
      else this.say(item.disabled);
      return;
    }
    if (!this.opts.quiet) audio().sfx('ui.select');
    this.opts.onSelect(i);
  }

  setCursor(i: number, silent = false): void {
    if (i === this.cursor || i < 0 || i >= this.items.length) return;
    this.cursor = i;
    if (!silent) audio().sfx('ui.move');
    this.say('');
    this.paint();
    this.opts.onMove?.(i);
  }

  destroy(): void {
    removeMenu(this.a11y);
    this.rows.forEach((r) => r.destroy());
    this.rows.length = 0;
    this.reason.destroy();
    this.mark.destroy();
  }

  private move(d: number): void {
    const n = this.items.length;
    if (n > 0) this.setCursor((this.cursor + d + n) % n);
  }

  private build(): void {
    this.rows.forEach((r) => r.destroy());
    this.rows.length = 0;
    const { x, y } = this.opts;
    const scale = this.opts.scale ?? 1;
    this.items.forEach((_, i) => {
      const row = addText(this.scene, x, y + i * this.lh, '', { depth: this.opts.depth ?? 0, scale });
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => this.setCursor(i));
      row.on('pointerdown', () => {
        this.setCursor(i, true);
        this.choose(i);
      });
      this.rows.push(row);
    });
    this.reason.setPosition(x, y + this.items.length * this.lh + 4);
    this.paint();
  }

  private paint(): void {
    this.items.forEach((item, i) => {
      const on = i === this.cursor;
      const num = this.opts.numbered ? `${i + 1}. ` : '';
      const color = item.disabled ? COLORS.dim : on ? COLORS.bright : COLORS.text;
      this.rows[i]?.setText(`  ${num}${item.label}`).setTint(color);
    });
    const row = this.rows[this.cursor];
    this.mark.setVisible(row !== undefined);
    if (row) this.mark.setPosition(row.x, row.y);
    syncMenu();
  }
}
