/**
 * A small scrolling log that can replay several days of entries one day at a time (the Travel auto-advance look),
 * with `data-busy="1"` set while it plays so input and e2e tests wait.
 */
import Phaser from 'phaser';
import { markFlag } from '@/game/contract';
import { session } from '@/game/session';
import type { LogEntry } from '@/sim';
import { TextBox } from './TextBox';

export class DayLog {
  private readonly box: TextBox;
  private lines: string[] = [];
  /** True while a replay is running (ignore input). */
  busy = false;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, width: number, private readonly maxLines = 4) {
    this.box = new TextBox(scene, x, y, width, '', { size: 12 });
  }

  /** Show these lines now (keeps the newest that fit). */
  show(lines: readonly string[]): void {
    this.lines = [...lines];
    this.paint();
  }

  /** Append lines at once. */
  add(lines: readonly string[]): void {
    this.lines.push(...lines);
    this.paint();
  }

  /** Replay entries grouped by day, one day per step, then call `done`. */
  play(entries: readonly LogEntry[], done: () => void): void {
    const days: LogEntry[][] = [];
    for (const e of entries) {
      const last = days[days.length - 1];
      if (last && last[0]!.day === e.day) last.push(e);
      else days.push([e]);
    }
    if (days.length <= 1) {
      this.add(entries.map((e) => e.text));
      return done();
    }
    this.setBusy(true);
    const step = (i: number): void => {
      const day = days[i];
      if (!day) {
        this.setBusy(false);
        return done();
      }
      this.add(day.map((e) => e.text));
      this.scene.time.delayedCall(session.settings.dayDelayMs * 2, () => step(i + 1));
    };
    step(0);
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    markFlag('busy', on);
  }

  private paint(): void {
    let lines = this.lines.slice(-this.maxLines);
    this.box.set(lines.join('\n'));
    while (lines.length > 1 && this.box.lineCount() > this.maxLines) {
      lines = lines.slice(1);
      this.box.set(lines.join('\n'));
    }
  }
}
