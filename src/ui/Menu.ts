/** Vertical cursor menu: arrows/WASD, Enter/Space, number keys, Esc, mouse hover/click, disabled items with reasons. */
import Phaser from 'phaser';
import { isBack, isConfirm, isDown, isUp, type KeyHandler } from './keys';
import { COLORS, LINE_HEIGHT, textStyle } from './theme';

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
}

export class Menu implements KeyHandler {
  cursor: number;
  private items: MenuItem[];
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly reason: Phaser.GameObjects.Text;
  private readonly lh: number;

  constructor(private readonly scene: Phaser.Scene, items: MenuItem[], private readonly opts: MenuOptions) {
    this.items = items;
    this.lh = opts.lineHeight ?? LINE_HEIGHT;
    this.cursor = Math.min(opts.cursor ?? 0, Math.max(0, items.length - 1));
    this.reason = scene.add.text(opts.x, opts.y, '', textStyle(COLORS.warn)).setDepth(opts.depth ?? 0);
    this.build();
  }

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
  }

  onKey(e: KeyboardEvent): void {
    if (isUp(e)) this.move(-1);
    else if (isDown(e)) this.move(1);
    else if (isConfirm(e)) {
      if (!e.repeat) this.choose(this.cursor);
    } else if (isBack(e)) this.opts.onBack?.();
    else if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < this.items.length) {
        // A disabled row only explains itself; the cursor stays where it was.
        if (!this.items[i]?.disabled) this.setCursor(i);
        this.choose(i);
      }
    }
  }

  /** Activate a row (as if Enter were pressed on it). */
  choose(i: number): void {
    const item = this.items[i];
    if (!item) return;
    if (item.disabled) {
      if (this.opts.onDisabled) this.opts.onDisabled(item.disabled, i);
      else this.say(item.disabled);
      return;
    }
    this.opts.onSelect(i);
  }

  setCursor(i: number): void {
    if (i === this.cursor || i < 0 || i >= this.items.length) return;
    this.cursor = i;
    this.say('');
    this.paint();
    this.opts.onMove?.(i);
  }

  destroy(): void {
    this.rows.forEach((r) => r.destroy());
    this.rows.length = 0;
    this.reason.destroy();
  }

  private move(d: number): void {
    const n = this.items.length;
    if (n > 0) this.setCursor((this.cursor + d + n) % n);
  }

  private build(): void {
    this.rows.forEach((r) => r.destroy());
    this.rows.length = 0;
    const { x, y } = this.opts;
    this.items.forEach((_, i) => {
      const row = this.scene.add.text(x, y + i * this.lh, '', textStyle()).setDepth(this.opts.depth ?? 0);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => this.setCursor(i));
      row.on('pointerdown', () => {
        this.setCursor(i);
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
      this.rows[i]?.setText(`${on ? '>' : ' '} ${num}${item.label}`).setColor(color);
    });
  }
}
