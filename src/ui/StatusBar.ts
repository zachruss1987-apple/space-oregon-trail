/** Label/value grid for the Travel status panel ("Date: May 12, 2184   Weather: Fair ..."), bitmap text on the 8 px grid. */
import type Phaser from 'phaser';
import { addText } from './text';
import { CHAR_W, COLORS, LINE_HEIGHT } from './theme';

/** One cell: label and value. */
export type StatusCell = readonly [label: string, value: string, width?: number];

export class StatusBar {
  private readonly rows: Phaser.GameObjects.BitmapText[][] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number, private readonly colWidths: readonly number[], private readonly lineHeight = LINE_HEIGHT) {}

  /** Render rows of cells; column i starts at the sum of widths before it (in characters; a cell may override). */
  set(rows: readonly (readonly StatusCell[])[]): void {
    this.destroy();
    rows.forEach((cells, r) => {
      let cx = this.x;
      const line: Phaser.GameObjects.BitmapText[] = [];
      cells.forEach(([label, value, width], c) => {
        const y = this.y + r * this.lineHeight;
        const l = addText(this.scene, cx, y, `${label}: `, { color: COLORS.dim });
        const v = addText(this.scene, cx + (label.length + 2) * CHAR_W, y, value, { color: COLORS.text });
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
