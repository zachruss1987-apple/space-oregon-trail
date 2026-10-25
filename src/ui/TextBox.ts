/** Word-wrapped prose in the bitmap font with an optional typewriter reveal (honors session.settings.typewriter). */
import type Phaser from 'phaser';
import { audio } from '@/audio/AudioManager';
import { session } from '@/game/session';
import { addText, lineCount, linePitch } from './text';
import { COLORS } from './theme';

export interface TextBoxOptions {
  color?: number;
  /** Reveal character by character (still subject to the global setting). */
  typewriter?: boolean;
  depth?: number;
  /** Integer scale (default x1). */
  scale?: number;
}

export class TextBox {
  readonly text: Phaser.GameObjects.BitmapText;
  private full = '';
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, private readonly width: number, content = '', private readonly opts: TextBoxOptions = {}) {
    this.text = addText(scene, x, y, '', { color: opts.color ?? COLORS.text, wrap: width, scale: opts.scale, depth: opts.depth ?? 0 });
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
        if (this.full[shown - 1] !== ' ') audio().sfx('text.tick');
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

  /** Rendered height in pixels of the full text. */
  get height(): number {
    return this.lineCount() * linePitch(this.opts.scale ?? 1);
  }

  /** Wrapped line count of the full content. */
  lineCount(): number {
    return lineCount(this.full, this.width, this.opts.scale ?? 1);
  }

  destroy(): void {
    this.timer?.remove();
    this.text.destroy();
  }

  get wrapWidth(): number {
    return this.width;
  }
}
