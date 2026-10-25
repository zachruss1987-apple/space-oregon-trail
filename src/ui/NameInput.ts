/** Text entry for printable ASCII (default ≤ 12 chars). Empty commits the placeholder/default. */
import Phaser from 'phaser';
import { isBack, type KeyHandler } from './keys';
import { COLORS, textStyle } from './theme';

export interface NameInputOptions {
  /** Shown dimmed while empty and committed if left empty. */
  placeholder?: string;
  maxLength?: number;
  depth?: number;
  onCommit: (value: string) => void;
  onCancel?: () => void;
  /** Extra keys the owner wants (e.g. Tab for random names); return true if handled. */
  onOtherKey?: (e: KeyboardEvent) => boolean;
}

export class NameInput implements KeyHandler {
  private value = '';
  private readonly text: Phaser.GameObjects.Text;
  private readonly max: number;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly opts: NameInputOptions) {
    this.max = opts.maxLength ?? 12;
    this.text = scene.add.text(x, y, '', textStyle()).setDepth(opts.depth ?? 0);
    this.paint();
  }

  onKey(e: KeyboardEvent): void {
    if (this.opts.onOtherKey?.(e)) return;
    if (e.key === 'Enter') {
      if (!e.repeat) this.opts.onCommit(this.value.trim() || (this.opts.placeholder ?? ''));
    } else if (isBack(e)) this.opts.onCancel?.();
    else if (e.key === 'Backspace') this.setValue(this.value.slice(0, -1));
    else if (e.key.length === 1 && /^[\x20-\x7e]$/.test(e.key) && this.value.length < this.max) this.setValue(this.value + e.key);
  }

  setValue(v: string): void {
    this.value = v.slice(0, this.max);
    this.paint();
  }

  /** Change the placeholder (e.g. after "Random names"). */
  setPlaceholder(p: string): void {
    this.opts.placeholder = p;
    this.paint();
  }

  get current(): string {
    return this.value;
  }

  destroy(): void {
    this.text.destroy();
  }

  private paint(): void {
    const empty = this.value.length === 0;
    const shown = empty ? (this.opts.placeholder ?? '') : this.value;
    this.text.setText(`${shown}_`).setColor(empty ? COLORS.dim : COLORS.bright);
  }
}
