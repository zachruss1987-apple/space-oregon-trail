/** Word-wrapped prose with an optional typewriter reveal (honors session.settings.typewriter). */
import Phaser from 'phaser';
import { session } from '@/game/session';
import { COLORS, textStyle } from './theme';

export interface TextBoxOptions {
  color?: string;
  /** Reveal character by character (still subject to the global setting). */
  typewriter?: boolean;
  depth?: number;
  size?: number;
}

export class TextBox {
  readonly text: Phaser.GameObjects.Text;
  private full = '';
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, private readonly width: number, content = '', private readonly opts: TextBoxOptions = {}) {
    this.text = scene.add.text(x, y, '', textStyle(opts.color ?? COLORS.text, width, opts.size)).setDepth(opts.depth ?? 0);
    this.set(content);
  }

  /** Replace the content (restarts the typewriter if enabled). */
  set(content: string): void {
    this.full = content;
    this.timer?.remove();
    this.timer = null;
    const animate = this.opts.typewriter && session.settings.typewriter && content.length > 0;
    if (!animate) {
      this.text.setText(content);
      return;
    }
    let shown = 0;
    this.text.setText('');
    this.timer = this.scene.time.addEvent({
      delay: session.settings.textSpeedMs,
      repeat: content.length - 1,
      callback: () => {
        shown += 1;
        this.text.setText(this.full.slice(0, shown));
        if (shown >= this.full.length) this.timer = null;
      },
    });
  }

  /** True while the typewriter is still revealing. */
  get typing(): boolean {
    return this.timer !== null;
  }

  /** Show everything now. */
  finish(): void {
    this.timer?.remove();
    this.timer = null;
    this.text.setText(this.full);
  }

  /** Rendered height in pixels (of the full text once finished). */
  get height(): number {
    return this.text.height;
  }

  /** Wrapped line count of the full content. */
  lineCount(): number {
    return this.text.getWrappedText(this.full).length;
  }

  destroy(): void {
    this.timer?.remove();
    this.text.destroy();
  }

  get wrapWidth(): number {
    return this.width;
  }
}
