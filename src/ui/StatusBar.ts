/** Label/value grid for the Travel status panel ("Date: May 12, 2184   Weather: Fair ..."). */
import Phaser from 'phaser';
import { CHAR_W, COLORS, LINE_HEIGHT, textStyle } from './theme';

/** One cell: label and value. */
export type StatusCell = readonly [label: string, value: string, width?: number];

export class StatusBar {
  private readonly rows: Phaser.GameObjects.Text[][] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number, private readonly colWidths: readonly number[]) {}

  /** Render rows of cells; column i starts at the sum of widths before it (in characters; a cell may override). */
  set(rows: readonly (readonly StatusCell[])[]): void {
    this.rows.flat().forEach((t) => t.destroy());
    this.rows.length = 0;
    rows.forEach((cells, r) => {
      let cx = this.x;
      const line: Phaser.GameObjects.Text[] = [];
      cells.forEach(([label, value, width], c) => {
        const y = this.y + r * LINE_HEIGHT;
        const l = this.scene.add.text(cx, y, `${label}: `, textStyle(COLORS.dim));
        const v = this.scene.add.text(cx + l.width, y, value, textStyle(COLORS.text));
        line.push(l, v);
        cx += (width ?? this.colWidths[c] ?? 20) * CHAR_W;
      });
      this.rows.push(line);
    });
  }

  destroy(): void {
    this.rows.flat().forEach((t) => t.destroy());
    this.rows.length = 0;
  }
}
