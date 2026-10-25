/** Integer entry: type digits, arrows adjust (Up/Down ±1, Left/Right ±10), Enter commits, Esc cancels. */
import type Phaser from 'phaser';
import { isBack, type KeyHandler } from './keys';
import { addText } from './text';
import { COLORS } from './theme';

export interface NumberInputOptions {
  min: number;
  max: number;
  value?: number;
  depth?: number;
  onCommit: (value: number) => void;
  onCancel?: () => void;
  /** Called on each change (for running totals). */
  onChange?: (value: number) => void;
}

export class NumberInput implements KeyHandler {
  readonly textEntry = true;
  readonly hints = 'number';
  private value: number;
  /** True until the first digit is typed: typing replaces the starting value. */
  private fresh = true;
  private readonly text: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly opts: NumberInputOptions) {
    this.value = this.clamp(opts.value ?? opts.min);
    this.text = addText(scene, x, y, '', { color: COLORS.bright, depth: opts.depth ?? 0 });
    this.paint();
  }

  onKey(e: KeyboardEvent): void {
    if (/^[0-9]$/.test(e.key)) {
      const next = this.fresh ? Number(e.key) : Number(`${this.value}${e.key}`);
      this.fresh = false;
      this.set(Math.min(next, 99999));
    } else if (e.key === 'Backspace') {
      this.fresh = false;
      this.set(Math.floor(this.value / 10));
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.step(1);
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.step(-1);
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.step(10);
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.step(-10);
    else if (e.key === 'Enter' || e.key === ' ') {
      if (!e.repeat) this.opts.onCommit(this.clamp(this.value));
    } else if (isBack(e)) this.opts.onCancel?.();
  }

  get current(): number {
    return this.value;
  }

  destroy(): void {
    this.text.destroy();
  }

  private step(d: number): void {
    this.fresh = false;
    this.set(this.clamp(this.value + d));
  }

  /** While typing, allow values above max to show (clamped on commit) so "1000" can be typed digit by digit. */
  private set(v: number): void {
    this.value = Math.max(0, v);
    this.paint();
    this.opts.onChange?.(this.clamp(this.value));
  }

  private clamp(v: number): number {
    return Math.max(this.opts.min, Math.min(this.opts.max, Math.floor(v)));
  }

  private paint(): void {
    const over = this.value > this.opts.max || this.value < this.opts.min;
    this.text.setText(`[ ${String(this.value).padStart(5)} ]`).setTint(over ? COLORS.warn : COLORS.bright);
  }
}
